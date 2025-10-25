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
    71: 91
};

const BOARD_SIZE = 100;
const WINNING_POSITION = 100;

class Game {
    constructor(roomId, discoverable = false, diceCount = 1, snakeThreshold = 3, minesEnabled = false, minesCount = 5) {
        this.roomId = roomId;
        this.players = [];
        this.currentTurn = 0;
        this.started = false;
        this.winner = null;
        this.lastRoll = null;
        this.discoverable = discoverable;
        this.createdAt = Date.now();
        this.hostname = null;
        this.diceCount = diceCount; // Number of dice to roll (1 or 2)
        this.snakeThreshold = snakeThreshold; // Number of snakes needed for revenge power (2-5)
        this.minesEnabled = minesEnabled; // Whether mines are enabled
        this.minesCount = minesCount; // Number of mines to spawn (3-15)
        this.mines = []; // Array of tile positions with mines
        this.voids = []; // Array of tile positions that became voids
        
        // Generate mines if enabled
        if (this.minesEnabled) {
            this.generateMines();
        }
    }
    
    generateMines() {
        // Clear existing mines
        this.mines = [];

        // Get all occupied tiles (snakes, ladders, start, end, and existing voids)
        const occupiedTiles = new Set([1, 100]); // Start and end tiles
        Object.keys(SNAKES).forEach(tile => occupiedTiles.add(parseInt(tile)));
        Object.keys(LADDERS).forEach(tile => occupiedTiles.add(parseInt(tile)));
        // Add existing voids to occupied tiles to prevent mines on destroyed tiles
        this.voids.forEach(voidTile => occupiedTiles.add(voidTile));

        // Generate random mine positions
        while (this.mines.length < this.minesCount) {
            const randomTile = Math.floor(Math.random() * 99) + 2; // 2-99 (avoid 1 and 100)

            if (!occupiedTiles.has(randomTile) && !this.mines.includes(randomTile)) {
                this.mines.push(randomTile);
            }
        }

        console.log(`Generated ${this.mines.length} mines at positions:`, this.mines);
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
            ready: false,
            snakeHits: 0, // Track how many times player hit snakes
            hasDiceControl: false, // Whether player earned dice control power
            controlledDiceRoll: null, // Store controlled dice values {targetPlayerId, diceValues}
            hasUsedPower: false // Track if player has already used their revenge power this game
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

    rollDice(controlledValues = null) {
        // If there are controlled values, use them instead of random
        if (controlledValues && Array.isArray(controlledValues)) {
            return controlledValues;
        }
        
        // Roll the number of dice specified for this game
        const rolls = [];
        for (let i = 0; i < this.diceCount; i++) {
            rolls.push(Math.floor(Math.random() * 6) + 1);
        }
        return rolls;
    }
    
    // Calculate total from dice rolls
    getDiceTotal(rolls) {
        return rolls.reduce((sum, roll) => sum + roll, 0);
    }

    movePlayer(playerId) {
        if (this.winner) {
            return { success: false, message: 'Game has ended' };
        }

        const player = this.players[this.currentTurn];
        if (player.id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        // Check if any player has set a controlled dice roll for this player
        let controlledValues = null;
        let controllerPlayer = null;
        for (const p of this.players) {
            if (p.controlledDiceRoll && p.controlledDiceRoll.targetPlayerId === player.persistentId) {
                controlledValues = p.controlledDiceRoll.diceValues;
                controllerPlayer = p;
                break;
            }
        }

        const diceRolls = this.rollDice(controlledValues);
        const diceTotal = this.getDiceTotal(diceRolls);
        this.lastRoll = diceTotal;
        
        // Clear the controlled dice roll after use
        const wasControlled = controlledValues !== null;
        if (wasControlled && controllerPlayer) {
            controllerPlayer.controlledDiceRoll = null;
        }
        
        const oldPosition = player.position;
        let newPosition = player.position + diceTotal;
        
        // Can't move if it would go past 100
        if (newPosition > WINNING_POSITION) {
            // For 2 dice, check if it's a double (both dice same value) for another turn
            // For 1 die, check if it's 6
            const rolledDouble = this.diceCount === 2 && diceRolls[0] === diceRolls[1];
            const anotherTurn = (this.diceCount === 1 && diceTotal === 6) || rolledDouble;
            
            if (!anotherTurn) {
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
            }
            return {
                success: true,
                diceRoll: diceTotal,
                diceRolls: diceRolls,
                oldPosition: player.position,
                newPosition: player.position,
                player: player,
                snake: null,
                ladder: null,
                winner: null,
                anotherTurn: anotherTurn
            };
        }

        player.position = newPosition;
        
        let snake = null;
        let ladder = null;
        let powerGranted = false;
        let mine = null;
        let voidFall = null;

        // Check for void first (player falls back 3x the dice roll)
        if (this.voids.includes(newPosition)) {
            const fallbackPosition = Math.max(newPosition - (diceTotal * 3), 1);
            voidFall = { from: newPosition, to: fallbackPosition };
            player.position = fallbackPosition;
            newPosition = fallbackPosition;
        }
        // Check for mine (explodes and creates void)
        else if (this.mines.includes(newPosition)) {
            mine = { position: newPosition };

            // Note: Don't remove mine from array yet - wait for client animation to complete
            // This prevents mine from disappearing before player reaches it

            // Player falls to tile 1
            player.position = 1;
            newPosition = 1;
        }
        // Check for snake (only if didn't hit mine/void)
        else if (SNAKES[newPosition]) {
            snake = { from: newPosition, to: SNAKES[newPosition] };
            player.position = SNAKES[newPosition];
            newPosition = player.position;
            
            // Increment snake hit counter
            player.snakeHits++;
            
            // Grant dice control power if player has hit the threshold number of snakes 
            // and doesn't already have it, and hasn't used it yet this game
            if (player.snakeHits >= this.snakeThreshold && !player.hasDiceControl && !player.hasUsedPower) {
                player.hasDiceControl = true;
                powerGranted = true;
            }
        }
        // Check for ladder (only if didn't hit mine/void/snake)
        else if (LADDERS[newPosition]) {
            ladder = { from: newPosition, to: LADDERS[newPosition] };
            player.position = LADDERS[newPosition];
            newPosition = player.position;

            // Check for mine at ladder destination - IMPORTANT: Check after moving up ladder
            if (this.mines.includes(newPosition)) {
                mine = { position: newPosition };

                // Note: Don't remove mine from array yet - wait for client animation to complete
                // This prevents mine from disappearing before player reaches it

                // Player falls to tile 1 (even from ladder)
                player.position = 1;
                newPosition = 1;

                // Clear ladder since mine takes precedence
                ladder = null;
            }
            // Check for snake at ladder destination (less common but possible)
            else if (SNAKES[newPosition]) {
                snake = { from: newPosition, to: SNAKES[newPosition] };
                player.position = SNAKES[newPosition];
                newPosition = player.position;

                // Increment snake hit counter
                player.snakeHits++;

                // Grant dice control power if player has hit the threshold number of snakes
                // and doesn't already have it, and hasn't used it yet this game
                if (player.snakeHits >= this.snakeThreshold && !player.hasDiceControl && !player.hasUsedPower) {
                    player.hasDiceControl = true;
                    powerGranted = true;
                }

                // Clear ladder since snake takes precedence
                ladder = null;
            }
        }

        // Check for winner
        if (player.position === WINNING_POSITION) {
            this.winner = player;
        }

        // Move to next turn (unless player rolled a double with 2 dice or 6 with 1 die)
        // For 2 dice, check if it's a double (both dice same value)
        // For 1 die, check if it's 6
        const rolledDouble = this.diceCount === 2 && diceRolls[0] === diceRolls[1];
        const anotherTurn = (this.diceCount === 1 && diceTotal === 6) || rolledDouble;
        
        if (!anotherTurn) {
            this.currentTurn = (this.currentTurn + 1) % this.players.length;
        }

        return {
            success: true,
            diceRoll: diceTotal,
            diceRolls: diceRolls,
            oldPosition: oldPosition,
            newPosition: player.position,
            player: player,
            snake,
            ladder,
            mine,
            voidFall,
            winner: this.winner,
            anotherTurn: anotherTurn,
            wasControlled: wasControlled,
            controllerPlayerId: wasControlled && controllerPlayer ? controllerPlayer.persistentId : null,
            powerGranted: powerGranted
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
            hostname: this.hostname,
            diceCount: this.diceCount,
            snakeThreshold: this.snakeThreshold,
            minesEnabled: this.minesEnabled,
            mines: this.mines,
            voids: this.voids
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

    socket.on('create-room', ({ playerName, discoverable = false, hostname = null, playerColor = null, playerIcon = null, diceCount = 1, snakeThreshold = 3, minesEnabled = false, minesCount = 5 }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        // Validate diceCount (must be 1 or 2)
        const validDiceCount = (diceCount === 1 || diceCount === 2) ? diceCount : 1;
        // Validate snakeThreshold (must be 2-5)
        const validSnakeThreshold = (snakeThreshold >= 2 && snakeThreshold <= 5) ? snakeThreshold : 3;
        // Validate minesCount (must be 3-15)
        const validMinesCount = (minesCount >= 3 && minesCount <= 15) ? minesCount : 5;
        const game = new Game(roomId, discoverable, validDiceCount, validSnakeThreshold, minesEnabled, validMinesCount);
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
            player.snakeHits = 0;
            player.hasDiceControl = false;
            player.controlledDiceRoll = null;
            player.hasUsedPower = false;
        });
        game.currentTurn = 0;
        game.started = false;
        game.winner = null;
        game.lastRoll = null;
        
        // Reset mines and voids
        game.voids = [];
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
