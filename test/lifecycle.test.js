const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createGameServer } = require('../lib/game-server');
const { connectClient, disconnectClient, createRoom, joinRoom, waitForEvent } = require('./helpers');

describe('Room lifecycle', () => {
    let runtime;
    let url;
    let clients;

    beforeEach(async () => {
        runtime = createGameServer({ turnLockTimeoutMs: 350, disconnectGraceMs: 1000, botDelayMs: 15 });
        ({ url } = await runtime.startServer(0, '127.0.0.1'));
        clients = [];
    });
    afterEach(async () => {
        await runtime.stopServer();
        clients.forEach(socket => socket.disconnect());
    });

    async function open() {
        const socket = await connectClient(url);
        clients.push(socket);
        return socket;
    }
    async function exchange(socket, event, data, response = 'game-state', predicate) {
        const pending = waitForEvent(socket, response, 3000, predicate);
        socket.emit(event, data);
        return pending;
    }
    async function pair() {
        const host = await open();
        const created = await createRoom(host, 'Host', { discoverable: true });
        const guest = await open();
        const joined = await joinRoom(guest, created.roomId, 'Guest');
        const game = runtime.games.get(created.roomId);
        return { host, guest, created, joined, game };
    }
    async function start(host, guest, roomId) {
        await exchange(host, 'toggle-ready', { roomId });
        if (guest) await exchange(guest, 'toggle-ready', { roomId });
        await exchange(host, 'start-game', { roomId }, 'game-state', state => state.started);
    }

    it('waits for both players to finish a turn animation', async () => {
        const { host, guest, created, game } = await pair();
        await start(host, guest, created.roomId);
        game.rollDice = () => [2];
        const move = await exchange(host, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        const ack = { roomId: created.roomId, playerId: move.player.persistentId, turnId: move.turnId };
        host.emit('turn-animation-complete', ack);
        // A following request confirms the preceding acknowledgement was processed.
        await exchange(host, 'peek-room', { roomId: created.roomId }, 'room-peek');
        assert.equal(game.turnLocked, true);
        await exchange(guest, 'turn-animation-complete', ack, 'game-state', state => !state.turnLocked);
        assert.equal(game.currentTurn, 1);
        assert.equal(game.turnLocked, false);
    });

    it('recovers the turn when a browser never completes its animation', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        await start(host, null, created.roomId);
        const unlocked = waitForEvent(host, 'game-state', 3000, state => state.lastRoll && !state.turnLocked);
        await exchange(host, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        assert.equal((await unlocked).turnLocked, false);
    });

    it('keeps the remaining players synchronized when the rolling player leaves', async () => {
        const { host, guest, created, game } = await pair();
        const third = await open();
        await joinRoom(third, created.roomId, 'Third', { color: '#45B7D1', icon: '🎲' });
        await exchange(third, 'toggle-ready', { roomId: created.roomId });
        await start(host, guest, created.roomId);
        game.currentTurn = 1;
        game.rollDice = () => [2];
        const move = await exchange(guest, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        await exchange(guest, 'manual-disconnect', { roomId: created.roomId }, 'disconnected');
        assert.equal(game.turnLocked, true);
        assert.equal(game.players[game.currentTurn].name, 'Third');
        const ack = { roomId: created.roomId, playerId: move.player.persistentId, turnId: move.turnId };
        host.emit('turn-animation-complete', ack);
        await exchange(third, 'turn-animation-complete', ack, 'game-state', state => !state.turnLocked);
    });

    it('ignores delayed animation completion from a previous round', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        await start(host, null, created.roomId);
        const first = await exchange(host, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        await exchange(host, 'reset-game', { roomId: created.roomId });
        await start(host, null, created.roomId);
        const second = await exchange(host, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        host.emit('turn-animation-complete', { roomId: created.roomId, playerId: first.player.persistentId, turnId: first.turnId });
        await exchange(host, 'peek-room', { roomId: created.roomId }, 'room-peek');
        const game = runtime.games.get(created.roomId);
        assert.equal(game.turnLocked, true);
        assert.ok(second.turnId > first.turnId);
    });

    it('keeps ladder-mine results correct without any client completion messages', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        await start(host, null, created.roomId);
        const game = runtime.games.get(created.roomId);
        game.mines = [14];
        game.rollDice = () => [4];
        const move = await exchange(host, 'roll-dice', { roomId: created.roomId }, 'dice-rolled');
        assert.equal(move.newPosition, 1);
        assert.deepEqual(game.mines, []);
        assert.deepEqual(game.voids, [14]);
        const recovered = await open();
        const state = waitForEvent(recovered, 'game-state');
        await exchange(recovered, 'reconnect-to-room', {
            roomId: created.roomId, persistentId: created.player.persistentId, reconnectToken: created.reconnectToken
        }, 'reconnected');
        assert.equal((await state).players[0].position, 1);
    });

    it('restores a session and removes its previous socket from the room', async () => {
        const { host, created, game } = await pair();
        const recovered = await open();
        const replaced = waitForEvent(host, 'session-replaced');
        const payload = await exchange(recovered, 'reconnect-to-room', {
            roomId: created.roomId, persistentId: created.player.persistentId, reconnectToken: created.reconnectToken
        }, 'reconnected');
        await replaced;
        assert.equal(payload.player.persistentId, created.player.persistentId);
        assert.equal(game.players.length, 2);
        assert.equal(runtime.io.sockets.sockets.get(host.id).rooms.has(created.roomId), false);
        assert.equal(game.getState().players.some(p => Object.hasOwn(p, 'reconnectToken')), false);
    });

    it('preserves host controls through a brief disconnect', async () => {
        const { host, created, game } = await pair();
        const serverSocket = runtime.io.sockets.sockets.get(host.id);
        const closed = new Promise(resolve => serverSocket.once('disconnect', resolve));
        await disconnectClient(host);
        await closed;
        assert.equal(game.hostPersistentId, created.player.persistentId);
        const returning = await open();
        const restored = await exchange(returning, 'reconnect-to-room', {
            roomId: created.roomId, persistentId: created.player.persistentId, reconnectToken: created.reconnectToken
        }, 'reconnected');
        assert.equal(restored.isHost, true);
        assert.equal(game.hostPersistentId, created.player.persistentId);
    });

    it('requires the saved private reconnect credential', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        const returning = await open();
        const error = await exchange(returning, 'reconnect-to-room', {
            roomId: created.roomId, persistentId: created.player.persistentId
        }, 'error');
        assert.equal(error.code, 'SESSION_EXPIRED');
        assert.equal(runtime.games.get(created.roomId).players[0].id, host.id);
    });

    it('lets a temporary bot play, then returns control to the reconnecting player', async () => {
        const { host, guest, created, game } = await pair();
        await start(host, guest, created.roomId);
        game.rollDice = () => [2];
        const botRoll = waitForEvent(guest, 'dice-rolled');
        await disconnectClient(host);
        const move = await botRoll;
        assert.equal(move.player.isBot, true);
        assert.equal(move.newPosition, 2);
        assert.equal(game.hostPersistentId, game.players[1].persistentId);
        const returning = await open();
        const restored = await exchange(returning, 'reconnect-to-room', {
            roomId: created.roomId, persistentId: created.player.persistentId, reconnectToken: created.reconnectToken
        }, 'reconnected');
        assert.equal(restored.player.isBot, false);
        assert.equal(restored.player.position, 2);
    });

    it('assigns a human host when the old host leaves and a bot takes over', async () => {
        const { host, guest, created, joined, game } = await pair();
        await start(host, guest, created.roomId);
        await exchange(host, 'manual-disconnect', { roomId: created.roomId }, 'disconnected');
        assert.equal(game.hostPersistentId, joined.player.persistentId);
        assert.equal(game.players[0].isBot, true);
        await exchange(guest, 'manual-disconnect', { roomId: created.roomId }, 'disconnected');
        assert.equal(runtime.games.has(created.roomId), false);
    });

    it('returns an empty discovery list after the advertised room starts', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host', { discoverable: true });
        const finder = await open();
        const before = await exchange(finder, 'discover-games', {}, 'games-discovered');
        assert.equal(before.games.length, 1);
        assert.equal(before.serverPort, runtime.server.address().port);
        assert.equal(before.sameServer, true);
        await start(host, null, created.roomId);
        const after = await exchange(finder, 'discover-games', {}, 'games-discovered');
        assert.deepEqual(after.games, []);
    });

    it('retains connected rooms while removing expired disconnected rooms', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        const game = runtime.games.get(created.roomId);
        game.lastActivityAt = 0;
        runtime.cleanupIdleRooms();
        assert.equal(runtime.games.has(created.roomId), true);
        const disconnected = new Promise(resolve => runtime.io.sockets.sockets.get(host.id).once('disconnect', resolve));
        await disconnectClient(host);
        await disconnected;
        game.lastActivityAt = 0;
        runtime.cleanupIdleRooms();
        assert.equal(runtime.games.has(created.roomId), false);
    });

    it('accepts lowercase room codes and prevents accidental duplicate rooms', async () => {
        const host = await open();
        const created = await createRoom(host, 'Host');
        const guest = await open();
        await joinRoom(guest, created.roomId.toLowerCase(), 'Guest');
        const error = await exchange(host, 'create-room', { playerName: 'Host' }, 'error');
        assert.match(error.message, /current room/);
        assert.equal(runtime.games.size, 1);
        assert.equal(runtime.games.get(created.roomId).players.length, 2);
    });

    it('serves the game and a health endpoint', async () => {
        const response = await fetch(url);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /game-board/);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        const health = await fetch(`${url}/health`);
        assert.deepEqual(await health.json(), { status: 'ok', rooms: 0 });
    });
});
