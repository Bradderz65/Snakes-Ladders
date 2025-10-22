const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dgram = require('dgram');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));

// Game state
const games = new Map();

// Discovery configuration
const DISCOVERY_PORT = 30303;
const DISCOVERY_INTERVAL = 5000; // Broadcast every 5 seconds
let discoveryEnabled = false;
let discoverySocket = null;
let discoveryInterval = null;
let localGames = new Map(); // Track discoverable games

// Snakes and Ladders configuration
const SNAKES = {
    16: 6,
    47: 26,
    49: 11,
    56: 53,
    62: 19,
    64: 60,
    87: 24,
    93: 73,
    95: 75,
    98: 78
};

const LADDERS = {
    1: 38,
    4: 14,
    9: 31,
    21: 42,
    28: 84,
    36: 44,
    51: 67,
    71: 91,
    80: 100
};

const BOARD_SIZE = 100;
const WINNING_POSITION = 100;

class Game {
    constructor(roomId, discoverable = false) {
        this.roomId = roomId;
        this.players = [];
        this.currentTurn = 0;
        this.started = false;
        this.winner = null;
        this.lastRoll = null;
        this.discoverable = discoverable;
        this.createdAt = Date.now();
        this.hostname = null;
    }

    addPlayer(playerId, playerName, persistentId = null, playerColor = null, playerIcon = null) {
        if (this.players.length >= 6) {
            return { success: false, message: 'Room is full' };
        }

        // Use custom color/icon if provided, otherwise use defaults
        const defaultColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
        const defaultIcons = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭'];

        let color = playerColor || defaultColors[this.players.length];
        let icon = playerIcon || defaultIcons[this.players.length];

        // If no custom values provided and we've used all defaults, fall back to first
        if (!playerColor && this.players.length >= defaultColors.length) {
            color = defaultColors[0];
        }
        if (!playerIcon && this.players.length >= defaultIcons.length) {
            icon = defaultIcons[0];
        }

        const player = {
            id: playerId,
            persistentId: persistentId || this.generatePlayerId(),
            name: playerName,
            position: 0,
            color: color,
            icon: icon,
            ready: false
        };

        this.players.push(player);
        return { success: true, player };
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substring(2, 15);
    }

    reconnectPlayer(oldPersistentId, newSocketId) {
        const player = this.players.find(p => p.persistentId === oldPersistentId);
        if (player) {
            player.id = newSocketId;
            return { success: true, player };
        }
        return { success: false, message: 'Player not found in game' };
    }

    findPlayerByPersistentId(persistentId) {
        return this.players.find(p => p.persistentId === persistentId);
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);
            if (this.currentTurn >= this.players.length && this.players.length > 0) {
                this.currentTurn = 0;
            }
        }
    }

    setPlayerReady(playerId, ready) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.ready = ready;
        }
    }

    canStart() {
        return this.players.length >= 1 && this.players.every(p => p.ready);
    }

    startGame() {
        if (this.canStart()) {
            this.started = true;
            this.currentTurn = 0;
            return true;
        }
        return false;
    }

    rollDice() {
        return Math.floor(Math.random() * 6) + 1;
    }

    movePlayer(playerId) {
        if (this.winner) {
            return { success: false, message: 'Game has ended' };
        }

        const player = this.players[this.currentTurn];
        if (player.id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        const diceRoll = this.rollDice();
        this.lastRoll = diceRoll;
        
        const oldPosition = player.position;
        let newPosition = player.position + diceRoll;
        
        // Can't move if it would go past 100
        if (newPosition > WINNING_POSITION) {
            const rolledSix = diceRoll === 6;
            if (!rolledSix) {
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
            }
            return {
                success: true,
                diceRoll,
                oldPosition: player.position,
                newPosition: player.position,
                player: player,
                snake: null,
                ladder: null,
                winner: null,
                anotherTurn: rolledSix
            };
        }

        player.position = newPosition;
        
        let snake = null;
        let ladder = null;

        // Check for snake
        if (SNAKES[newPosition]) {
            snake = { from: newPosition, to: SNAKES[newPosition] };
            player.position = SNAKES[newPosition];
            newPosition = player.position;
        }

        // Check for ladder
        if (LADDERS[newPosition]) {
            ladder = { from: newPosition, to: LADDERS[newPosition] };
            player.position = LADDERS[newPosition];
            newPosition = player.position;
        }

        // Check for winner
        if (player.position === WINNING_POSITION) {
            this.winner = player;
        }

        // Move to next turn (unless player rolled a 6)
        const rolledSix = diceRoll === 6;
        if (!rolledSix) {
            this.currentTurn = (this.currentTurn + 1) % this.players.length;
        }

        return {
            success: true,
            diceRoll,
            oldPosition: oldPosition,
            newPosition: player.position,
            player: player,
            snake,
            ladder,
            winner: this.winner,
            anotherTurn: rolledSix
        };
    }

    getState() {
        return {
            players: this.players,
            currentTurn: this.currentTurn,
            started: this.started,
            winner: this.winner,
            lastRoll: this.lastRoll,
            snakes: SNAKES,
            ladders: LADDERS,
            discoverable: this.discoverable,
            hostname: this.hostname
        };
    }

    getDiscoveryInfo() {
        return {
            roomId: this.roomId,
            hostname: this.hostname,
            playerCount: this.players.length,
            maxPlayers: 6,
            started: this.started,
            createdAt: this.createdAt
        };
    }
}

// Discovery functions
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (interface.family === 'IPv4' && !interface.internal) {
                // Prefer WiFi/ethernet over other interfaces
                if (name.toLowerCase().includes('wi-fi') ||
                    name.toLowerCase().includes('wlan') ||
                    name.toLowerCase().includes('ethernet') ||
                    name.toLowerCase().includes('en')) {
                    return interface.address;
                }
            }
        }
    }
    // Fallback to any non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return '127.0.0.1';
}

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

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ playerName, discoverable = false, hostname = null, playerColor = null, playerIcon = null }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new Game(roomId, discoverable);
        if (hostname) {
            game.hostname = hostname;
        }
        const result = game.addPlayer(socket.id, playerName, null, playerColor, playerIcon);

        if (result.success) {
            games.set(roomId, game);
            socket.join(roomId);
            socket.emit('room-created', { roomId, player: result.player, discoverable });
            io.to(roomId).emit('game-state', game.getState());

            // Start broadcasting if this is discoverable and discovery isn't enabled yet
            if (discoverable && !discoveryInterval) {
                startDiscovery();
                discoveryInterval = setInterval(broadcastDiscovery, DISCOVERY_INTERVAL);
                // Initial broadcast
                setTimeout(broadcastDiscovery, 1000);
            }
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
            socket.emit('reconnected', { roomId, player: result.player });
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
            socket.emit('room-joined', { roomId, player: result.player });
            io.to(roomId).emit('game-state', game.getState());
        } else {
            socket.emit('error', { message: result.message });
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

        if (game.startGame()) {
            io.to(roomId).emit('game-started');
            io.to(roomId).emit('game-state', game.getState());
        }
    });

    socket.on('roll-dice', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game || !game.started) return;

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

        // Reset all players
        game.players.forEach(player => {
            player.position = 0;
            player.ready = false;
        });
        game.currentTurn = 0;
        game.started = false;
        game.winner = null;
        game.lastRoll = null;

        io.to(roomId).emit('game-reset');
        io.to(roomId).emit('game-state', game.getState());
    });

    socket.on('manual-disconnect', ({ roomId }) => {
        const game = games.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        if (player) {
            console.log(`Player ${player.name} manually disconnected from room ${roomId}`);
            game.removePlayer(socket.id);
            socket.leave(roomId);

            // Delete game if no players left
            if (game.players.length === 0) {
                games.delete(roomId);
                // Stop discovery if no discoverable games left
                const hasDiscoverableGames = Array.from(games.values()).some(g => g.discoverable);
                if (!hasDiscoverableGames && discoveryInterval) {
                    clearInterval(discoveryInterval);
                    discoveryInterval = null;
                    setTimeout(stopDiscovery, 2000);
                }
            } else {
                io.to(roomId).emit('game-state', game.getState());
                io.to(roomId).emit('player-left', { playerName: player.name });
            }

            socket.emit('disconnected');
        }
    });

    // Discovery event handlers
    socket.on('discover-games', () => {
        if (!discoveryEnabled) {
            startDiscovery();
        }

        // Send discovery request
        const clientSocket = dgram.createSocket('udp4');
        const message = Buffer.from(JSON.stringify({ type: 'DISCOVER_REQUEST' }));

        clientSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'DISCOVER_RESPONSE') {
                    socket.emit('games-discovered', data);
                }
            } catch (err) {
                // Ignore malformed messages
            }
        });

        clientSocket.bind(() => {
            clientSocket.setBroadcast(true);
            clientSocket.send(message, DISCOVERY_PORT, '255.255.255.255', (err) => {
                if (err) {
                    console.log('Discovery request error:', err);
                }
                // Close socket after sending
                setTimeout(() => clientSocket.close(), 5000);
            });
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Don't remove players on disconnect - they might reconnect
        // Players are only removed on manual disconnect or timeout
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎲 Snakes and Ladders Server Running 🎲`);
    console.log(`\n📡 Local:    http://localhost:${PORT}`);
    console.log(`📡 Network:  http://<your-local-ip>:${PORT}`);
    console.log(`\nShare the network URL with friends to play together!\n`);
});
