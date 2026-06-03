const { io } = require('socket.io-client');

function waitForConnect(socket, timeoutMs = 5000) {
    if (socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Socket connect timeout')), timeoutMs);
        socket.once('connect', () => {
            clearTimeout(timer);
            resolve();
        });
        socket.once('connect_error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for "${event}"`));
        }, timeoutMs);

        socket.once(event, (payload) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });
}

function waitForError(socket, timeoutMs = 3000) {
    return waitForEvent(socket, 'error', timeoutMs);
}

async function connectClient(baseUrl) {
    const socket = io(baseUrl, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false
    });
    await waitForConnect(socket);
    return socket;
}

function disconnectClient(socket) {
    return new Promise((resolve) => {
        if (!socket || !socket.connected) {
            resolve();
            return;
        }
        socket.once('disconnect', resolve);
        socket.disconnect();
        setTimeout(resolve, 500);
    });
}

async function createRoom(socket, name, options = {}) {
    const createdPromise = waitForEvent(socket, 'room-created');
    const statePromise = waitForEvent(socket, 'game-state');

    socket.emit('create-room', {
        playerName: name,
        playerColor: options.color || '#FF6B6B',
        playerIcon: options.icon || '🎮',
        diceCount: options.diceCount || 1,
        snakeThreshold: options.snakeThreshold || 3,
        minesEnabled: false,
        discoverable: !!options.discoverable,
        requireSixToStart: !!options.requireSixToStart,
        exactRollToWin: !!options.exactRollToWin
    });

    const [payload, state] = await Promise.all([createdPromise, statePromise]);
    return { ...payload, state };
}

async function joinRoom(socket, roomId, name, options = {}) {
    const joinedPromise = waitForEvent(socket, 'room-joined');
    const statePromise = waitForEvent(socket, 'game-state');

    socket.emit('join-room', {
        roomId,
        playerName: name,
        playerColor: options.color || '#4ECDC4',
        playerIcon: options.icon || '🎯'
    });

    const [payload, state] = await Promise.all([joinedPromise, statePromise]);
    return { ...payload, state };
}

module.exports = {
    waitForConnect,
    waitForEvent,
    waitForError,
    connectClient,
    disconnectClient,
    createRoom,
    joinRoom
};