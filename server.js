const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dgram = require('dgram');
const os = require('os');
const {
    Game,
    WINNING_POSITION,
    MAX_PLAYER_NAME_LENGTH,
    sanitizePlayerName
} = require('./lib/game-engine');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));

// Game state
const games = new Map();
const socketRooms = new Map();
const turnLockTimers = new Map();
const rollDebounce = new Map();
const playerKickTimers = new Map();

// Timeouts & limits
const TURN_LOCK_TIMEOUT_MS = 25000;
const PLAYER_DISCONNECT_KICK_MS = 30 * 60 * 1000;
const ROOM_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const ROLL_DEBOUNCE_MS = 400;

// Discovery configuration
const DISCOVERY_PORT = 30303;
const DISCOVERY_INTERVAL = 5000; // Broadcast every 5 seconds
let discoveryEnabled = false;
let discoverySocket = null;
let discoveryInterval = null;
let localGames = new Map(); // Track discoverable games

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (
                    name.toLowerCase().includes('wi-fi') ||
                    name.toLowerCase().includes('wlan') ||
                    name.toLowerCase().includes('ethernet') ||
                    name.toLowerCase().includes('en')
                ) {
                    return iface.address;
                }
            }
        }
    }
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function isGameHost(game, socket) {
    if (!game || !socket) return false;
    const player = game.players.find(p => p.id === socket.id);
    return !!(player && game.hostPersistentId && player.persistentId === game.hostPersistentId);
}

function clearTurnLockTimer(roomId) {
    if (turnLockTimers.has(roomId)) {
        clearTimeout(turnLockTimers.get(roomId));
        turnLockTimers.delete(roomId);
    }
}

function unlockGameTurn(game) {
    if (!game) return;
    clearTurnLockTimer(game.roomId);
    game.unlockTurn();
}

function wireGameCallbacks(game) {
    game.onTurnLocked = (roomId) => scheduleTurnUnlock(roomId);
}

function scheduleTurnUnlock(roomId) {
    clearTurnLockTimer(roomId);
    const timer = setTimeout(() => {
        turnLockTimers.delete(roomId);
        const game = games.get(roomId);
        if (!game || !game.turnLocked) return;
        console.log(`Turn lock timeout in room ${roomId}, unlocking`);
        unlockGameTurn(game);
        io.to(roomId).emit('turn-unlocked', { reason: 'timeout' });
        scheduleBotTurn(roomId, 'turn lock timeout');
    }, TURN_LOCK_TIMEOUT_MS);
    turnLockTimers.set(roomId, timer);
}

function clearPlayerKickTimer(roomId, persistentId) {
    const key = `${roomId}:${persistentId}`;
    if (playerKickTimers.has(key)) {
        clearTimeout(playerKickTimers.get(key));
        playerKickTimers.delete(key);
    }
}

function schedulePlayerKick(roomId, persistentId) {
    const key = `${roomId}:${persistentId}`;
    clearPlayerKickTimer(roomId, persistentId);
    const timer = setTimeout(() => {
        playerKickTimers.delete(key);
        const game = games.get(roomId);
        if (!game || game.started) return;
        const player = game.findPlayerByPersistentId(persistentId);
        if (!player || !player.disconnectedAt) return;
        if (Date.now() - player.disconnectedAt < PLAYER_DISCONNECT_KICK_MS) return;

        const playerIndex = game.players.findIndex(p => p.persistentId === persistentId);
        if (playerIndex === -1) return;

        const removedName = player.name;
        const wasHost = game.hostPersistentId === persistentId;
        game.removePlayer(player.id);

        if (game.players.length === 0) {
            cleanupRoom(roomId);
        } else {
            if (wasHost) {
                game.hostPersistentId = game.players[0].persistentId;
            }
            io.to(roomId).emit('player-kicked', { playerName: removedName, reason: 'inactive' });
            io.to(roomId).emit('game-state', game.getState());
        }
    }, PLAYER_DISCONNECT_KICK_MS);
    playerKickTimers.set(key, timer);
}

function cleanupRoom(roomId) {
    if (botTurnTimers.has(roomId)) {
        clearTimeout(botTurnTimers.get(roomId));
        botTurnTimers.delete(roomId);
    }
    clearTurnLockTimer(roomId);
    games.delete(roomId);

    const hasDiscoverableGames = Array.from(games.values()).some(g => g.discoverable);
    if (!hasDiscoverableGames && discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
        setTimeout(stopDiscovery, 2000);
    }
}

function cleanupIdleRooms() {
    const now = Date.now();
    for (const [roomId, game] of games.entries()) {
        const lastActivity = game.lastActivityAt || game.createdAt;
        const allDisconnected = game.players.every(p => p.disconnectedAt);
        if (now - lastActivity > ROOM_IDLE_TTL_MS || (allDisconnected && game.players.length > 0 && now - lastActivity > 60000)) {
            console.log(`Cleaning up idle room ${roomId}`);
            game.players.forEach(p => {
                const sock = io.sockets.sockets.get(p.id);
                if (sock) {
                    sock.leave(roomId);
                    socketRooms.delete(p.id);
                }
            });
            cleanupRoom(roomId);
        }
    }
}


// Discovery functions
function startDiscovery() {
    if (discoveryEnabled) return;

    discoveryEnabled = true;
    discoverySocket = dgram.createSocket('udp4');

    discoverySocket.on('error', (err) => {
        console.log('Discovery socket error:', err);
        stopDiscovery();
    });

    discoverySocket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'DISCOVER_REQUEST') {
                // Send response with discoverable games
                const discoverableGames = Array.from(games.values())
                    .filter(game => game.discoverable && !game.started)
                    .map(game => game.getDiscoveryInfo());

                if (discoverableGames.length > 0) {
                    const response = {
                        type: 'DISCOVER_RESPONSE',
                        serverIP: getLocalIP(),
                        serverPort: PORT,
                        games: discoverableGames,
                        timestamp: Date.now()
                    };

                    discoverySocket.send(
                        JSON.stringify(response),
                        rinfo.port,
                        rinfo.address
                    );
                }
            }
        } catch (err) {
            // Ignore malformed messages
        }
    });

    discoverySocket.bind(DISCOVERY_PORT, () => {
        discoverySocket.setBroadcast(true);
        console.log(`🔍 Game discovery enabled on port ${DISCOVERY_PORT}`);
    });
}

function stopDiscovery() {
    if (!discoveryEnabled) return;

    discoveryEnabled = false;
    if (discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
    }
    if (discoverySocket) {
        discoverySocket.close();
        discoverySocket = null;
    }
    console.log('🔍 Game discovery disabled');
}

function broadcastDiscovery() {
    if (!discoveryEnabled || !discoverySocket) return;

    const discoverableGames = Array.from(games.values())
        .filter(game => game.discoverable && !game.started)
        .map(game => game.getDiscoveryInfo());

    if (discoverableGames.length > 0) {
        const message = {
            type: 'GAME_BROADCAST',
            serverIP: getLocalIP(),
            serverPort: PORT,
            games: discoverableGames,
            timestamp: Date.now()
        };

        const buffer = Buffer.from(JSON.stringify(message));

        // Broadcast to local network
        discoverySocket.send(
            buffer,
            DISCOVERY_PORT,
            '255.255.255.255',
            (err) => {
                if (err) {
                    console.log('Broadcast error:', err);
                }
            }
        );
    }
}

const botTurnTimers = new Map();
const BOT_TURN_DELAY_MS = 1200;

function getCurrentTurnPlayer(game) {
    if (!game || game.players.length === 0) return null;
    return game.players[game.currentTurn] || null;
}

function getDiceCandidates(diceCount) {
    if (diceCount === 2) {
        const candidates = [];
        for (let die1 = 1; die1 <= 6; die1++) {
            for (let die2 = 1; die2 <= 6; die2++) {
                candidates.push([die1, die2]);
            }
        }
        return candidates;
    }

    return [1, 2, 3, 4, 5, 6].map(value => [value]);
}

function simulateFinalPositionForDice(game, player, diceValues) {
    const total = game.getDiceTotal(diceValues);

    if (game.requireSixToStart && player.position === 0) {
        return diceValues.includes(6) ? 1 : 0;
    }

    let position = player.position + total;

    if (game.exactRollToWin && position > WINNING_POSITION) {
        position = WINNING_POSITION - (position - WINNING_POSITION);
        if (position < 1) position = 1;
    } else if (!game.exactRollToWin && position > WINNING_POSITION) {
        position = player.position;
    }

    if (game.voids.includes(position)) {
        position = Math.max(position - (total * 3), 1);
    } else if (game.mines.includes(position)) {
        position = 1;
    } else if (game.getSnakes()[position]) {
        position = game.getSnakes()[position];
    } else if (game.getLadders()[position]) {
        const ladderDestination = game.getLadders()[position];
        if (game.mines.includes(ladderDestination)) {
            position = 1;
        } else if (game.getSnakes()[ladderDestination]) {
            position = game.getSnakes()[ladderDestination];
        } else {
            position = ladderDestination;
        }
    }

    return position;
}

function selectBotControlledDice(game, targetPlayer) {
    return getDiceCandidates(game.diceCount)
        .map(diceValues => ({
            diceValues,
            finalPosition: simulateFinalPositionForDice(game, targetPlayer, diceValues),
            total: game.getDiceTotal(diceValues)
        }))
        .sort((a, b) => {
            if (a.finalPosition !== b.finalPosition) {
                return a.finalPosition - b.finalPosition;
            }
            return a.total - b.total;
        })[0].diceValues;
}

function maybeUseBotDiceControl(game, botPlayer, roomId) {
    if (!botPlayer.hasDiceControl || botPlayer.hasUsedPower || botPlayer.controlledDiceRoll) {
        return;
    }

    const targetPlayer = game.players
        .filter(player => player.persistentId !== botPlayer.persistentId)
        .sort((a, b) => b.position - a.position)[0];

    if (!targetPlayer) return;

    const diceValues = selectBotControlledDice(game, targetPlayer);
    botPlayer.controlledDiceRoll = {
        targetPlayerId: targetPlayer.persistentId,
        diceValues
    };
    botPlayer.hasDiceControl = false;
    botPlayer.hasUsedPower = true;

    io.to(roomId).emit('bot-dice-control-set', {
        botName: botPlayer.name,
        targetPlayerName: targetPlayer.name
    });
}

function scheduleBotTurn(roomId, reason = 'bot turn') {
    const game = games.get(roomId);
    if (!game || !game.started || game.winner || game.turnLocked) return;

    const botPlayer = getCurrentTurnPlayer(game);
    if (!botPlayer || !botPlayer.isBot) return;

    if (botTurnTimers.has(roomId)) {
        clearTimeout(botTurnTimers.get(roomId));
    }

    const timer = setTimeout(() => {
        botTurnTimers.delete(roomId);

        const latestGame = games.get(roomId);
        if (!latestGame || !latestGame.started || latestGame.winner || latestGame.turnLocked) return;

        const currentBot = getCurrentTurnPlayer(latestGame);
        if (!currentBot || !currentBot.isBot) return;

        maybeUseBotDiceControl(latestGame, currentBot, roomId);

        console.log(`AI bot ${currentBot.name} rolling in room ${roomId} (${reason})`);
        const result = latestGame.movePlayer(currentBot.id);

        if (result.success) {
            io.to(roomId).emit('dice-rolled', result);
            io.to(roomId).emit('game-state', latestGame.getState());
        } else {
            console.log(`AI bot ${currentBot.name} could not roll in room ${roomId}: ${result.message}`);
        }
    }, BOT_TURN_DELAY_MS);

    botTurnTimers.set(roomId, timer);
}

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ playerName, discoverable = false, hostname = null, playerColor = null, playerIcon = null, diceCount = 1, snakeThreshold = 3, minesEnabled = false, minesCount = 5, ladderMinesOnly = false, randomizeSnakesLadders = false, requireSixToStart = false, exactRollToWin = false }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rollDebounce.delete(socket.id);
        // Validate diceCount (must be 1 or 2)
        const validDiceCount = (diceCount === 1 || diceCount === 2) ? diceCount : 1;
        // Validate snakeThreshold (must be 2-5)
        const validSnakeThreshold = (snakeThreshold >= 2 && snakeThreshold <= 5) ? snakeThreshold : 3;
        // Validate minesCount (must be 3-15)
        const validMinesCount = (minesCount >= 3 && minesCount <= 15) ? minesCount : 5;
        const game = new Game(roomId, discoverable, validDiceCount, validSnakeThreshold, minesEnabled, validMinesCount, ladderMinesOnly, randomizeSnakesLadders, requireSixToStart, exactRollToWin);
        wireGameCallbacks(game);
        if (hostname) {
            game.hostname = hostname;
        }
        const result = game.addPlayer(socket.id, playerName, null, playerColor, playerIcon);

        if (result.success) {
            games.set(roomId, game);
            socket.join(roomId);
            socketRooms.set(socket.id, roomId);
            socket.emit('room-created', { roomId, player: result.player, discoverable, isHost: true });
            io.to(roomId).emit('game-state', game.getState());

            // Start broadcasting if this is discoverable and discovery isn't enabled yet
            if (discoverable && !discoveryInterval) {
                startDiscovery();
                discoveryInterval = setInterval(broadcastDiscovery, DISCOVERY_INTERVAL);
                // Initial broadcast
                setTimeout(broadcastDiscovery, 1000);
            }
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    socket.on('reconnect-to-room', ({ roomId, persistentId }) => {
        const game = games.get(roomId);
        
        if (!game) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = game.reconnectPlayer(persistentId, socket.id);
        
        if (result.success) {
            socket.join(roomId);
            socketRooms.set(socket.id, roomId);
            clearPlayerKickTimer(roomId, persistentId);
            const isHost = game.hostPersistentId === result.player.persistentId;
            socket.emit('reconnected', { roomId, player: result.player, isHost });
            io.to(roomId).emit('game-state', game.getState());
            console.log(`Player ${result.player.name} reconnected to room ${roomId}`);
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    socket.on('join-room', ({ roomId, playerName, playerColor = null, playerIcon = null }) => {
        const game = games.get(roomId);

        if (!game) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (game.started) {
            socket.emit('error', { message: 'Game already started' });
            return;
        }

        const result = game.addPlayer(socket.id, playerName, null, playerColor, playerIcon);

        if (result.success) {
            socket.join(roomId);
            socketRooms.set(socket.id, roomId);
            const isHost = game.hostPersistentId === result.player.persistentId;
            socket.emit('room-joined', { roomId, player: result.player, isHost });
            io.to(roomId).emit('game-state', game.getState());
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    socket.on('peek-room', ({ roomId }) => {
        const game = games.get((roomId || '').toUpperCase());
        if (!game) {
            socket.emit('room-peek', { found: false });
            return;
        }
        socket.emit('room-peek', {
            found: true,
            started: game.started,
            rulesSummary: game.getRulesSummary(),
            players: game.players.map(p => ({
                name: p.name,
                color: p.color,
                icon: p.icon
            })),
            takenCustomizations: game.getTakenCustomizations()
        });
    });

    socket.on('kick-player', ({ roomId, targetPersistentId }) => {
        const game = games.get(roomId);
        if (!game || game.started) return;
        if (!isGameHost(game, socket)) {
            socket.emit('error', { message: 'Only the host can remove players' });
            return;
        }

        const target = game.findPlayerByPersistentId(targetPersistentId);
        if (!target) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }
        if (target.persistentId === game.hostPersistentId) {
            socket.emit('error', { message: 'Cannot kick the host' });
            return;
        }

        const targetSocket = io.sockets.sockets.get(target.id);
        const removedName = target.name;
        game.removePlayer(target.id);
        socketRooms.delete(target.id);
        if (targetSocket) {
            targetSocket.leave(roomId);
            targetSocket.emit('kicked-from-room', { roomId, reason: 'removed by host' });
        }

        if (game.players.length === 0) {
            cleanupRoom(roomId);
        } else {
            io.to(roomId).emit('player-kicked', { playerName: removedName, reason: 'host' });
            io.to(roomId).emit('game-state', game.getState());
        }
    });

    socket.on('toggle-ready', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        if (player) {
            game.setPlayerReady(socket.id, !player.ready);
            io.to(roomId).emit('game-state', game.getState());
        }
    });

    socket.on('start-game', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        if (!isGameHost(game, socket)) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        if (game.startGame()) {
            io.to(roomId).emit('game-started');
            io.to(roomId).emit('game-state', game.getState());
            scheduleBotTurn(roomId, 'game started');
        }
    });

    socket.on('roll-dice', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game || !game.started) return;

        const now = Date.now();
        const lastRoll = rollDebounce.get(socket.id) || 0;
        if (now - lastRoll < ROLL_DEBOUNCE_MS) {
            socket.emit('error', { message: 'Please wait before rolling again' });
            return;
        }
        rollDebounce.set(socket.id, now);

        const result = game.movePlayer(socket.id);
        
        if (result.success) {
            io.to(roomId).emit('dice-rolled', result);
            io.to(roomId).emit('game-state', game.getState());
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    socket.on('reset-game', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        if (!isGameHost(game, socket)) {
            socket.emit('error', { message: 'Only the host can reset the game' });
            return;
        }

        if (botTurnTimers.has(roomId)) {
            clearTimeout(botTurnTimers.get(roomId));
            botTurnTimers.delete(roomId);
        }

        // Reset all players
        game.players.forEach(player => {
            player.position = 0;
            player.ready = !!player.isBot;
            player.snakeHits = 0;
            player.hasDiceControl = false;
            player.controlledDiceRoll = null;
            player.hasUsedPower = false;
            game.playerRollCounts[player.persistentId] = 0;
        });
        game.currentTurn = 0;
        game.started = false;
        game.winner = null;
        game.lastRoll = null;
        game.lastActivityAt = Date.now();
        unlockGameTurn(game);
        
        // Reset board hazards/state
        game.voids = [];
        if (game.randomizeSnakesLadders) {
            game.generateRandomSnakesAndLadders();
        }
        if (game.minesEnabled) {
            game.generateMines();
        }

        io.to(roomId).emit('game-reset');
        io.to(roomId).emit('game-state', game.getState());
    });

    socket.on('set-controlled-dice', ({ roomId, targetPlayerId, diceValues }) => {
        const game = games.get(roomId);
        if (!game || !game.started) return;

        const controllerPlayer = game.players.find(p => p.id === socket.id);
        if (!controllerPlayer || !controllerPlayer.hasDiceControl) {
            socket.emit('error', { message: 'You do not have dice control power' });
            return;
        }

        // Validate dice values
        if (!Array.isArray(diceValues) || diceValues.length !== game.diceCount) {
            socket.emit('error', { message: 'Invalid dice values' });
            return;
        }

        // Validate each dice value is between 1-6
        if (!diceValues.every(val => val >= 1 && val <= 6)) {
            socket.emit('error', { message: 'Dice values must be between 1 and 6' });
            return;
        }

        // Validate target player exists
        const targetPlayer = game.players.find(p => p.persistentId === targetPlayerId);
        if (!targetPlayer) {
            socket.emit('error', { message: 'Target player not found' });
            return;
        }

        // Revenge power should target another player.
        if (targetPlayer.persistentId === controllerPlayer.persistentId) {
            socket.emit('error', { message: 'You cannot target yourself with revenge power' });
            return;
        }

        // Only one pending controlled roll per target to avoid ambiguous resolution.
        const existingController = game.players.find(p =>
            p.controlledDiceRoll &&
            p.controlledDiceRoll.targetPlayerId === targetPlayerId &&
            p.persistentId !== controllerPlayer.persistentId
        );
        if (existingController) {
            socket.emit('error', { message: `${targetPlayer.name} already has a pending controlled roll` });
            return;
        }

        // Set the controlled dice roll
        controllerPlayer.controlledDiceRoll = {
            targetPlayerId: targetPlayerId,
            diceValues: diceValues
        };

        // Remove the power after setting (one-time use)
        controllerPlayer.hasDiceControl = false;
        
        // Mark that the player has used their power this game (prevents getting it again)
        controllerPlayer.hasUsedPower = true;

        // Notify the controller (secretly)
        socket.emit('dice-control-set', {
            targetPlayerName: targetPlayer.name,
            diceValues: diceValues
        });

        // Update game state for everyone
        io.to(roomId).emit('game-state', game.getState());
    });

    socket.on('manual-disconnect', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        if (player) {
            console.log(`Player ${player.name} manually disconnected from room ${roomId}`);

            const botTakeover = game.shouldBotTakeOverLeavingPlayer(socket.id)
                ? game.convertPlayerToBot(socket.id)
                : { success: false };

            socket.leave(roomId);
            socketRooms.delete(socket.id);
            rollDebounce.delete(socket.id);
            clearPlayerKickTimer(roomId, player.persistentId);

            if (game.turnLocked && game.turnLockedPlayerId === player.persistentId) {
                unlockGameTurn(game);
                scheduleBotTurn(roomId, 'leaving player unlocked turn');
            }

            if (botTakeover.success) {
                io.to(roomId).emit('bot-took-over', {
                    playerName: player.name,
                    botName: botTakeover.player.name
                });
                scheduleBotTurn(roomId, 'player left and bot took over');
            } else {
                game.removePlayer(socket.id);
            }

            // Delete game if no players left
            if (game.players.length === 0) {
                cleanupRoom(roomId);
            } else {
                if (game.hostPersistentId === player.persistentId) {
                    game.hostPersistentId = game.players[0].persistentId;
                }
                io.to(roomId).emit('game-state', game.getState());
                if (!botTakeover.success) {
                    io.to(roomId).emit('player-left', { playerName: player.name });
                }
            }

            socket.emit('disconnected');
        }
    });

    // Discovery event handlers
    socket.on('discover-games', () => {
        const localDiscoverable = Array.from(games.values())
            .filter(game => game.discoverable && !game.started)
            .map(game => ({
                ...game.getDiscoveryInfo(),
                serverIP: getLocalIP(),
                serverPort: PORT
            }));

        if (localDiscoverable.length > 0) {
            socket.emit('games-discovered', {
                type: 'DISCOVER_RESPONSE',
                serverIP: getLocalIP(),
                serverPort: PORT,
                games: localDiscoverable,
                timestamp: Date.now()
            });
        }

        if (!discoveryEnabled) {
            startDiscovery();
        }
    });

    socket.on('explosion-complete', ({ roomId, position }) => {
        const game = games.get(roomId);
        if (!game) return;

        // Remove the mine from the mines array (now that animation is complete)
        const mineIndex = game.mines.indexOf(position);
        if (mineIndex > -1) {
            game.mines.splice(mineIndex, 1);
        }

        // Add the position to voids now that client animation is complete
        if (!game.voids.includes(position)) {
            game.voids.push(position);
        }

        // Update all clients with new void state
        io.to(roomId).emit('game-state', game.getState());
    });

    socket.on('turn-animation-complete', ({ roomId, playerId }) => {
        const game = games.get(roomId);
        if (!game || !game.started) return;

        const player = game.players.find(p => p.persistentId === playerId);
        if (!player) return;

        if (game.turnLocked && game.turnLockedPlayerId && game.turnLockedPlayerId !== playerId) {
            return;
        }

        unlockGameTurn(game);
        io.to(roomId).emit('game-state', game.getState());
        scheduleBotTurn(roomId, 'turn animation complete');
    });

    socket.on('trigger-test-explosion', ({ roomId, position = null }) => {
        const game = games.get(roomId);
        if (!game) return;

        if (!isGameHost(game, socket)) {
            socket.emit('error', { message: 'Only the host can trigger test explosions' });
            return;
        }

        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;

        let targetPosition = null;

        if (Number.isInteger(position) && position >= 2 && position <= 99 && !game.voids.includes(position)) {
            targetPosition = position;
        } else if (game.mines.length > 0) {
            targetPosition = game.mines[Math.floor(Math.random() * game.mines.length)];
        } else {
            const candidates = [];
            for (let tile = 2; tile <= 99; tile++) {
                if (!game.voids.includes(tile)) {
                    candidates.push(tile);
                }
            }

            if (candidates.length === 0) return;
            targetPosition = candidates[Math.floor(Math.random() * candidates.length)];
        }

        io.to(roomId).emit('test-explosion-triggered', {
            position: targetPosition,
            triggeredBy: player.name
        });
    });

    socket.on('ladder-animation-complete', ({ roomId, playerId, ladderEnd }) => {
        const game = games.get(roomId);
        if (!game) return;

        // Check if there's a mine at the ladder destination that was waiting
        if (game.mines.includes(ladderEnd)) {
            // Find the player who climbed the ladder
            const player = game.players.find(p => p.persistentId === playerId);
            if (player) {
                // Move player to position 1 (mine explosion result)
                player.position = 1;

                // Remove mine from array
                const mineIndex = game.mines.indexOf(ladderEnd);
                if (mineIndex > -1) {
                    game.mines.splice(mineIndex, 1);
                }

                // Add position to voids
                if (!game.voids.includes(ladderEnd)) {
                    game.voids.push(ladderEnd);
                }

                // Send mine explosion event to all clients
                io.to(roomId).emit('ladder-mine-explosion', {
                    position: ladderEnd,
                    playerId: playerId
                });

                // Update game state
                io.to(roomId).emit('game-state', game.getState());
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rollDebounce.delete(socket.id);

        const roomId = socketRooms.get(socket.id);
        socketRooms.delete(socket.id);
        if (!roomId) return;

        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;

        player.disconnectedAt = Date.now();
        game.lastActivityAt = Date.now();

        if (game.turnLocked && game.turnLockedPlayerId === player.persistentId) {
            unlockGameTurn(game);
            scheduleBotTurn(roomId, 'disconnect unlocked turn');
        }

        if (!game.started) {
            schedulePlayerKick(roomId, player.persistentId);
        }
    });
});

const PORT = process.env.PORT || 3000;
let cleanupRoomsInterval = null;

function clearAllServerTimers() {
    for (const timer of botTurnTimers.values()) clearTimeout(timer);
    botTurnTimers.clear();
    for (const timer of turnLockTimers.values()) clearTimeout(timer);
    turnLockTimers.clear();
    for (const timer of playerKickTimers.values()) clearTimeout(timer);
    playerKickTimers.clear();
    if (discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
    }
    if (cleanupRoomsInterval) {
        clearInterval(cleanupRoomsInterval);
        cleanupRoomsInterval = null;
    }
}

function startServer(port = PORT, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
        const onListening = () => {
            server.off('error', onError);
            const address = server.address();
            resolve({
                port: address.port,
                host: address.address,
                url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${address.port}`
            });
        };
        const onError = (err) => {
            server.off('listening', onListening);
            reject(err);
        };

        if (server.listening) {
            const address = server.address();
            return resolve({
                port: address.port,
                host: address.address,
                url: `http://127.0.0.1:${address.port}`
            });
        }

        server.once('error', onError);
        server.listen(port, host, onListening);
    });
}

function stopServer() {
    return new Promise((resolve) => {
        clearAllServerTimers();
        games.clear();
        socketRooms.clear();
        rollDebounce.clear();

        io.close(() => {
            if (!server.listening) {
                return resolve();
            }
            server.close(() => resolve());
        });
    });
}

if (require.main === module) {
    cleanupRoomsInterval = setInterval(cleanupIdleRooms, 60 * 60 * 1000);
    startServer(PORT, '0.0.0.0').then(({ port }) => {
        const localIP = getLocalIP();
        console.log(`\n🎲 Snakes and Ladders Server Running 🎲`);
        console.log(`\n📡 Local:    http://localhost:${port}`);
        console.log(`📡 Network:  http://${localIP}:${port}`);
        console.log(`\nShare the network URL with friends to play together!\n`);
    });
}

module.exports = {
    app,
    server,
    io,
    games,
    Game,
    sanitizePlayerName,
    startServer,
    stopServer,
    isGameHost,
    unlockGameTurn,
    TURN_LOCK_TIMEOUT_MS,
    ROLL_DEBOUNCE_MS,
    MAX_PLAYER_NAME_LENGTH
};
