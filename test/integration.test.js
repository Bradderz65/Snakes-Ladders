const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, games, ROLL_DEBOUNCE_MS } = require('../server');
const {
    connectClient,
    disconnectClient,
    createRoom,
    joinRoom,
    waitForEvent,
    waitForError
} = require('./helpers');

describe('Socket.IO integration', () => {
    let baseUrl;
    const clients = [];

    before(async () => {
        if (process.env.SKIP_SERVER_TESTS === '1') {
            return;
        }
        const info = await startServer(0, '127.0.0.1');
        baseUrl = info.url;
    });

    after(async () => {
        await Promise.all(clients.map(disconnectClient));
        await stopServer();
    });

    async function openClient() {
        const socket = await connectClient(baseUrl);
        clients.push(socket);
        return socket;
    }

    it('creates room with host flag and rules in state', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'HostPlayer', { diceCount: 2, requireSixToStart: true });

        assert.equal(created.isHost, true);
        assert.ok(created.roomId);
        assert.match(created.state.rulesSummary, /2 dice/);
        assert.match(created.state.rulesSummary, /roll 6 to start/);
        assert.equal(created.state.hostPersistentId, created.player.persistentId);
    });

    it('rejects duplicate customization on join', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host', { color: '#FF6B6B', icon: '🎮' });

        const guest = await openClient();
        guest.emit('join-room', {
            roomId: created.roomId,
            playerName: 'Guest',
            playerColor: '#FF6B6B',
            playerIcon: '🎯'
        });

        const err = await waitForError(guest);
        assert.match(err.message, /color/i);
    });

    it('peek-room returns lobby info without joining', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host', { discoverable: true });

        const peeker = await openClient();
        peeker.emit('peek-room', { roomId: created.roomId });
        const peek = await waitForEvent(peeker, 'room-peek');

        assert.equal(peek.found, true);
        assert.equal(peek.players.length, 1);
        assert.ok(peek.rulesSummary);
        assert.deepEqual(peek.takenCustomizations.colors, ['#FF6B6B']);
    });

    it('only host can start the game', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');

        const guest = await openClient();
        await joinRoom(guest, created.roomId, 'Guest', { color: '#4ECDC4', icon: '🎯' });

        host.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(host, 'game-state');
        guest.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(guest, 'game-state');

        guest.emit('start-game', { roomId: created.roomId });
        const guestErr = await waitForError(guest);
        assert.match(guestErr.message, /host/i);

        host.emit('start-game', { roomId: created.roomId });
        await waitForEvent(host, 'game-started');
        await waitForEvent(guest, 'game-started');
    });

    it('enforces roll debounce', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');
        host.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(host, 'game-state');
        host.emit('start-game', { roomId: created.roomId });
        await waitForEvent(host, 'game-started');

        host.emit('roll-dice', { roomId: created.roomId });
        const roll = await waitForEvent(host, 'dice-rolled');

        host.emit('turn-animation-complete', {
            roomId: created.roomId,
            playerId: roll.player.persistentId
        });
        await waitForEvent(host, 'game-state');

        await new Promise((resolve) => setTimeout(resolve, ROLL_DEBOUNCE_MS + 50));

        host.emit('roll-dice', { roomId: created.roomId });
        await waitForEvent(host, 'dice-rolled');

        host.emit('roll-dice', { roomId: created.roomId });
        const err = await waitForError(host);
        assert.match(err.message, /wait|animation/i);
    });

    it('unlocks turn after animation complete', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');
        host.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(host, 'game-state');
        host.emit('start-game', { roomId: created.roomId });
        await waitForEvent(host, 'game-started');

        host.emit('roll-dice', { roomId: created.roomId });
        const roll = await waitForEvent(host, 'dice-rolled');

        host.emit('roll-dice', { roomId: created.roomId });
        const lockedErr = await waitForError(host);
        assert.match(lockedErr.message, /animation|wait/i);

        host.emit('turn-animation-complete', {
            roomId: created.roomId,
            playerId: roll.player.persistentId
        });
        await waitForEvent(host, 'game-state');
        await new Promise((resolve) => setTimeout(resolve, ROLL_DEBOUNCE_MS + 50));

        host.emit('roll-dice', { roomId: created.roomId });
        const secondRoll = await waitForEvent(host, 'dice-rolled');
        assert.ok(secondRoll.player);
    });

    it('host can kick lobby players', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');

        const guest = await openClient();
        const joined = await joinRoom(guest, created.roomId, 'Guest', { color: '#4ECDC4', icon: '🎯' });

        host.emit('kick-player', {
            roomId: created.roomId,
            targetPersistentId: joined.player.persistentId
        });

        await waitForEvent(guest, 'kicked-from-room');
        await waitForEvent(host, 'player-kicked');

        const game = [...games.values()].find(g => g.roomId === created.roomId);
        assert.equal(game.players.length, 1);
    });

    it('discover-games lists local discoverable rooms', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host', { discoverable: true });

        const finder = await openClient();
        finder.emit('discover-games');
        const discovered = await waitForEvent(finder, 'games-discovered');

        assert.ok(discovered.games.some(g => g.roomId === created.roomId));
        assert.ok(discovered.games[0].rulesSummary);
    });

    it('reconnect restores player session', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');
        const persistentId = created.player.persistentId;

        await disconnectClient(host);
        clients.pop();

        const reconnected = await openClient();
        reconnected.emit('reconnect-to-room', {
            roomId: created.roomId,
            persistentId
        });

        const payload = await waitForEvent(reconnected, 'reconnected');
        assert.equal(payload.roomId, created.roomId);
        assert.equal(payload.player.persistentId, persistentId);
        assert.equal(payload.isHost, true);
    });

    it('non-host cannot reset game', async () => {
        const host = await openClient();
        const created = await createRoom(host, 'Host');

        const guest = await openClient();
        await joinRoom(guest, created.roomId, 'Guest', { color: '#4ECDC4', icon: '🎯' });

        host.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(host, 'game-state');
        guest.emit('toggle-ready', { roomId: created.roomId });
        await waitForEvent(guest, 'game-state');
        host.emit('start-game', { roomId: created.roomId });
        await waitForEvent(host, 'game-started');

        guest.emit('reset-game', { roomId: created.roomId });
        const err = await waitForError(guest);
        assert.match(err.message, /host/i);
    });
});