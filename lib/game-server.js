const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { Server } = require('socket.io');
const { Game, sanitizePlayerName } = require('./game-engine');

const TURN_LOCK_TIMEOUT_MS = 25000;
const ROLL_DEBOUNCE_MS = 400;
const DISCONNECT_GRACE_MS = 30000;
const LOBBY_IDLE_TTL_MS = 30 * 60 * 1000;
const ROOM_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_EVENTS = new Set(['create-room', 'join-room', 'reconnect-to-room', 'peek-room', 'discover-games']);
const ROOM_EVENTS = new Set(['toggle-ready', 'start-game', 'roll-dice', 'reset-game', 'kick-player',
    'set-controlled-dice', 'manual-disconnect', 'turn-animation-complete', 'trigger-test-explosion']);

function isGameHost(game, socket) {
    return !!game?.players.some(p => p.id === socket.id && p.persistentId === game.hostPersistentId && !p.isBot);
}

function validToken(actual, expected) {
    if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual) || typeof expected !== 'string') return false;
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function createGameServer(options = {}) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        maxHttpBufferSize: 16 * 1024,
        allowRequest(request, done) {
            if (!request.headers.origin) return done(null, true);
            try {
                done(null, new URL(request.headers.origin).host === request.headers.host);
            } catch {
                done(null, false);
            }
        }
    });
    const games = new Map();
    const socketRooms = new Map();
    // Credentials never live in players or broadcast state.
    const credentials = new Map();
    const pendingAnimations = new Map();
    const timers = new Map();
    const lastRolls = new Map();
    const turnTimeout = options.turnLockTimeoutMs ?? TURN_LOCK_TIMEOUT_MS;
    const disconnectGrace = options.disconnectGraceMs ?? DISCONNECT_GRACE_MS;
    const botDelay = options.botDelayMs ?? 1200;
    let cleanupInterval;
    let stopping = false;

    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('X-Frame-Options', 'DENY');
        next();
    });
    app.get('/health', (req, res) => res.json({ status: 'ok', rooms: games.size }));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use('/sounds', express.static(path.join(__dirname, '../sounds')));

    function clearTimer(key) {
        clearTimeout(timers.get(key));
        timers.delete(key);
    }

    function later(key, delay, callback) {
        clearTimer(key);
        const timer = setTimeout(() => {
            timers.delete(key);
            callback();
        }, delay);
        timer.unref();
        timers.set(key, timer);
    }

    function emitState(game) {
        io.to(game.roomId).emit('game-state', game.getState());
    }

    function connectedHumans(game) {
        return game.players.filter(p => !p.isBot && !p.disconnectedAt && io.sockets.sockets.has(p.id));
    }

    function cleanupRoom(roomId) {
        const game = games.get(roomId);
        if (!game) return;
        for (const key of timers.keys()) if (key.startsWith(`${roomId}:`)) clearTimer(key);
        for (const player of game.players) {
            const socket = io.sockets.sockets.get(player.id);
            socket?.emit('room-closed', { roomId, message: 'This inactive room has closed. Create a new game.' });
            socket?.leave(roomId);
            socketRooms.delete(player.id);
            lastRolls.delete(player.id);
        }
        pendingAnimations.delete(roomId);
        credentials.delete(roomId);
        games.delete(roomId);
    }

    function cleanupIdleRooms() {
        const now = Date.now();
        for (const game of games.values()) {
            const ttl = game.started ? (options.roomIdleTtlMs ?? ROOM_IDLE_TTL_MS) : (options.lobbyIdleTtlMs ?? LOBBY_IDLE_TTL_MS);
            if (!connectedHumans(game).length && now - game.lastActivityAt >= ttl) cleanupRoom(game.roomId);
        }
    }

    function unlockGameTurn(game) {
        clearTimer(`${game.roomId}:turn`);
        pendingAnimations.delete(game.roomId);
        game.unlockTurn();
        emitState(game);
        scheduleBotTurn(game);
    }

    function dropAnimationWaiter(game, persistentId) {
        const waiting = pendingAnimations.get(game.roomId);
        if (!waiting) return;
        waiting.delete(persistentId);
        if (!waiting.size && game.turnLocked) unlockGameTurn(game);
    }

    function publishMove(game, result) {
        if (!result.success) return;
        pendingAnimations.set(game.roomId, new Set(connectedHumans(game).map(p => p.persistentId)));
        later(`${game.roomId}:turn`, turnTimeout, () => {
            if (!games.has(game.roomId) || !game.turnLocked) return;
            io.to(game.roomId).emit('turn-unlocked', { roomId: game.roomId, turnId: game.turnId, reason: 'timeout' });
            unlockGameTurn(game);
        });
        io.to(game.roomId).emit('dice-rolled', { ...result, roomId: game.roomId });
        emitState(game);
    }

    function scheduleBotTurn(game) {
        clearTimer(`${game.roomId}:bot`);
        if (!game.started || game.winner || game.turnLocked || !connectedHumans(game).length) return;
        if (!game.players[game.currentTurn]?.isBot) return;
        later(`${game.roomId}:bot`, botDelay, () => {
            if (!games.has(game.roomId) || !game.started || game.winner || game.turnLocked || !connectedHumans(game).length) return;
            const bot = game.players[game.currentTurn];
            if (!bot?.isBot) return;
            if (bot.hasDiceControl) {
                const target = game.players.filter(p => p !== bot && !game.players.some(c => c.controlledDiceRoll?.targetPlayerId === p.persistentId))
                    .sort((a, b) => b.position - a.position)[0];
                if (target) {
                    const candidates = [];
                    for (let first = 1; first <= 6; first++) {
                        if (game.diceCount === 1) candidates.push([first]);
                        else for (let second = 1; second <= 6; second++) candidates.push([first, second]);
                    }
                    candidates.sort((a, b) => game.resolveMove(target.position, a).newPosition - game.resolveMove(target.position, b).newPosition);
                    const control = game.setControlledDice(bot.id, target.persistentId, candidates[0]);
                    if (control.success) io.to(game.roomId).emit('bot-dice-control-set', { botName: bot.name, targetPlayerName: target.name });
                }
            }
            publishMove(game, game.movePlayer(bot.id));
        });
    }

    function scheduleDisconnect(game, player) {
        later(`${game.roomId}:away:${player.persistentId}`, disconnectGrace, () => {
            if (!games.has(game.roomId) || !player.disconnectedAt) return;
            game.ensureHost();
            if (game.started && !game.winner && connectedHumans(game).length) {
                game.convertPlayerToBot(player.id);
                player.temporaryBot = true;
                io.to(game.roomId).emit('bot-took-over', { playerName: player.name, botName: player.name, temporary: true });
                scheduleBotTurn(game);
            }
            emitState(game);
        });
    }

    function leaveRoom(socket, game) {
        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;
        clearTimer(`${game.roomId}:away:${player.persistentId}`);
        credentials.get(game.roomId)?.delete(player.persistentId);
        socket.leave(game.roomId);
        socketRooms.delete(socket.id);
        lastRolls.delete(socket.id);
        if (game.shouldBotTakeOverLeavingPlayer(socket.id)) {
            game.convertPlayerToBot(socket.id);
            io.to(game.roomId).emit('bot-took-over', { playerName: player.name, botName: player.name });
        } else {
            game.removePlayer(socket.id);
            io.to(game.roomId).emit('player-left', { playerName: player.name });
        }
        dropAnimationWaiter(game, player.persistentId);
        if (!game.players.some(p => !p.isBot || p.temporaryBot)) cleanupRoom(game.roomId);
        else {
            emitState(game);
            scheduleBotTurn(game);
        }
        socket.emit('disconnected');
    }

    function sendSession(socket, game, player, event) {
        socket.join(game.roomId);
        socketRooms.set(socket.id, game.roomId);
        socket.emit(event, {
            roomId: game.roomId, player: game.publicPlayer(player),
            reconnectToken: credentials.get(game.roomId).get(player.persistentId),
            discoverable: game.discoverable, isHost: isGameHost(game, socket)
        });
        emitState(game);
    }

    io.on('connection', socket => {
        let windowStart = Date.now();
        let eventCount = 0;
        const fail = (message, code = 'INVALID_ACTION') => socket.emit('error', { message, code });

        // Validate once at the boundary so handlers only receive objects and valid room membership.
        socket.use((packet, next) => {
            const [event] = packet;
            if (!PUBLIC_EVENTS.has(event) && !ROOM_EVENTS.has(event)) return;
            if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); eventCount = 0; }
            if (++eventCount > 40) { fail('Too many actions. Please wait a moment.'); return; }
            const data = packet[1] ?? {};
            if (typeof data !== 'object' || Array.isArray(data)) { fail('Invalid request'); return; }
            packet[1] = data;
            if (event !== 'create-room' && event !== 'discover-games') {
                if (typeof data.roomId !== 'string' || !/^[A-Z0-9]{6}$/i.test(data.roomId.trim())) {
                    fail('Enter a six-character room code'); return;
                }
                data.roomId = data.roomId.trim().toUpperCase();
            }
            if (ROOM_EVENTS.has(event) && socketRooms.get(socket.id) !== data.roomId) {
                fail('Join this room before playing'); return;
            }
            if (['create-room', 'join-room', 'reconnect-to-room'].includes(event) && socketRooms.has(socket.id)) {
                fail('Leave your current room before joining another'); return;
            }
            next();
        });

        socket.on('create-room', data => {
            if (games.size >= (options.maxRooms ?? 500)) return fail('The server is full. Try again later.');
            let roomId;
            do { roomId = Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randomInt(36)]).join(''); }
            while (games.has(roomId));
            const game = new Game(roomId, data.discoverable, data.diceCount, data.snakeThreshold,
                data.minesEnabled, data.minesCount, data.ladderMinesOnly, data.randomizeSnakesLadders,
                data.requireSixToStart, data.exactRollToWin);
            game.hostname = `${sanitizePlayerName(data.playerName)}'s Game`;
            const result = game.addPlayer(socket.id, data.playerName, null, data.playerColor, data.playerIcon);
            if (!result.success) return fail(result.message);
            games.set(roomId, game);
            credentials.set(roomId, new Map([[result.player.persistentId, randomBytes(32).toString('hex')]]));
            sendSession(socket, game, result.player, 'room-created');
        });

        socket.on('join-room', data => {
            const game = games.get(data.roomId);
            if (!game) return fail('Room not found', 'ROOM_NOT_FOUND');
            const result = game.addPlayer(socket.id, data.playerName, null, data.playerColor, data.playerIcon);
            if (!result.success) return fail(result.message);
            credentials.get(game.roomId).set(result.player.persistentId, randomBytes(32).toString('hex'));
            game.ensureHost(disconnectGrace);
            sendSession(socket, game, result.player, 'room-joined');
        });

        socket.on('reconnect-to-room', data => {
            const game = games.get(data.roomId);
            const player = game?.findPlayerByPersistentId(data.persistentId);
            if (!player || !validToken(data.reconnectToken, credentials.get(data.roomId)?.get(data.persistentId))) {
                return fail('Your saved session has expired. Please join a new game.', 'SESSION_EXPIRED');
            }
            const oldSocket = io.sockets.sockets.get(player.id);
            if (oldSocket && oldSocket !== socket) {
                oldSocket.leave(game.roomId);
                socketRooms.delete(oldSocket.id);
                lastRolls.delete(oldSocket.id);
                oldSocket.emit('session-replaced', { roomId: game.roomId });
            }
            clearTimer(`${game.roomId}:away:${player.persistentId}`);
            if (player.temporaryBot) {
                player.isBot = false;
                player.temporaryBot = false;
                player.botTakeover = false;
            }
            game.reconnectPlayer(player.persistentId, socket.id);
            game.ensureHost(disconnectGrace);
            sendSession(socket, game, player, 'reconnected');
            dropAnimationWaiter(game, player.persistentId);
            scheduleBotTurn(game);
            for (const away of game.players.filter(p => p.disconnectedAt)) scheduleDisconnect(game, away);
        });

        socket.on('peek-room', ({ roomId }) => {
            const game = games.get(roomId);
            socket.emit('room-peek', game ? {
                roomId, found: true, started: game.started, rulesSummary: game.getRulesSummary(),
                players: game.players.map(({ name, color, icon }) => ({ name, color, icon })),
                takenCustomizations: game.getTakenCustomizations()
            } : { roomId, found: false });
        });

        socket.on('discover-games', () => {
            socket.emit('games-discovered', {
                sameServer: true,
                serverIP: 'local', serverPort: server.address()?.port,
                games: [...games.values()].filter(game => game.discoverable && !game.started && game.players.length < 6 && connectedHumans(game).length)
                    .map(game => game.getDiscoveryInfo()),
                timestamp: Date.now()
            });
        });

        function roomAction(event, handler, hostOnly = false) {
            socket.on(event, data => {
                const game = games.get(data.roomId);
                if (!game) return fail('Room not found', 'ROOM_NOT_FOUND');
                if (hostOnly && !isGameHost(game, socket)) return fail('Only the host can do this');
                handler(game, data);
            });
        }

        roomAction('toggle-ready', game => {
            const player = game.players.find(p => p.id === socket.id);
            game.setPlayerReady(socket.id, !player.ready);
            emitState(game);
        });
        roomAction('start-game', game => {
            if (!game.startGame()) return fail('All connected players must be ready before starting');
            io.to(game.roomId).emit('game-started');
            emitState(game);
            scheduleBotTurn(game);
        }, true);
        roomAction('roll-dice', game => {
            if (Date.now() - (lastRolls.get(socket.id) || 0) < ROLL_DEBOUNCE_MS) return fail('Please wait before rolling again', 'ROLL_REJECTED');
            const result = game.movePlayer(socket.id);
            if (!result.success) return fail(result.message, 'ROLL_REJECTED');
            lastRolls.set(socket.id, Date.now());
            publishMove(game, result);
        });
        roomAction('turn-animation-complete', (game, data) => {
            if (!game.turnLocked || data.turnId !== game.turnId || data.playerId !== game.turnLockedPlayerId) return;
            const player = game.players.find(p => p.id === socket.id);
            dropAnimationWaiter(game, player.persistentId);
        });
        roomAction('reset-game', game => {
            clearTimer(`${game.roomId}:turn`);
            clearTimer(`${game.roomId}:bot`);
            pendingAnimations.delete(game.roomId);
            game.reset();
            game.players.forEach(player => lastRolls.delete(player.id));
            io.to(game.roomId).emit('game-reset');
            emitState(game);
        }, true);
        roomAction('kick-player', (game, data) => {
            if (game.started) return fail('Players can only be removed in the lobby');
            const player = game.findPlayerByPersistentId(data.targetPersistentId);
            if (!player || player.persistentId === game.hostPersistentId) return fail('Choose another player');
            clearTimer(`${game.roomId}:away:${player.persistentId}`);
            credentials.get(game.roomId).delete(player.persistentId);
            const target = io.sockets.sockets.get(player.id);
            target?.leave(game.roomId);
            target?.emit('kicked-from-room', { roomId: game.roomId });
            socketRooms.delete(player.id);
            lastRolls.delete(player.id);
            game.removePlayer(player.id);
            io.to(game.roomId).emit('player-kicked', { playerName: player.name, reason: 'host' });
            emitState(game);
        }, true);
        roomAction('set-controlled-dice', (game, data) => {
            const result = game.setControlledDice(socket.id, data.targetPlayerId, data.diceValues);
            if (!result.success) return fail(result.message);
            socket.emit('dice-control-set', result);
            emitState(game);
        });
        roomAction('manual-disconnect', game => leaveRoom(socket, game));
        // This is a visual preview only; it cannot change board state.
        roomAction('trigger-test-explosion', (game, data) => {
            if (!game.started || game.turnLocked) return fail('Wait until the current turn finishes');
            const position = Number.isInteger(data.position) && data.position >= 2 && data.position <= 99
                ? data.position : game.mines[0] || 50;
            io.to(game.roomId).emit('test-explosion-triggered', {
                position, triggeredBy: game.players.find(p => p.id === socket.id).name
            });
        }, true);

        socket.on('disconnect', () => {
            const game = games.get(socketRooms.get(socket.id));
            socketRooms.delete(socket.id);
            lastRolls.delete(socket.id);
            if (stopping || !game) return;
            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;
            player.disconnectedAt = Date.now();
            game.lastActivityAt = Date.now();
            if (!game.started) player.ready = false;
            game.ensureHost(disconnectGrace);
            dropAnimationWaiter(game, player.persistentId);
            scheduleDisconnect(game, player);
            emitState(game);
        });
    });

    function startServer(port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT), host = '0.0.0.0') {
        return new Promise((resolve, reject) => {
            const listening = () => {
                server.off('error', onError);
                stopping = false;
                if (!cleanupInterval) {
                    cleanupInterval = setInterval(cleanupIdleRooms, options.cleanupIntervalMs ?? 60000);
                    cleanupInterval.unref();
                }
                const address = server.address();
                resolve({ port: address.port, host: address.address, url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${address.port}` });
            };
            const onError = error => { server.off('listening', listening); reject(error); };
            if (server.listening) return listening();
            server.once('error', onError);
            server.listen(port, host, listening);
        });
    }

    function stopServer() {
        stopping = true;
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        for (const key of timers.keys()) clearTimer(key);
        pendingAnimations.clear();
        games.clear();
        socketRooms.clear();
        credentials.clear();
        lastRolls.clear();
        return new Promise(resolve => io.close(resolve));
    }

    return { app, server, io, games, startServer, stopServer, cleanupIdleRooms, unlockGameTurn };
}

module.exports = { createGameServer, isGameHost, TURN_LOCK_TIMEOUT_MS, ROLL_DEBOUNCE_MS };
