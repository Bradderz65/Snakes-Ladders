const { randomUUID, randomInt } = require('node:crypto');

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
const MAX_PLAYER_NAME_LENGTH = 15;
const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80', '#EC7063', '#AF7AC5'];
const PLAYER_ICONS = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '♟️', '♞', '⚔️', '🛡️', '🏁', '⭐', '🌙', '☀️', '🔷', '🔶', '🟢', '🟣', '🔴'];

function boundedInteger(value, min, max, fallback) {
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function shuffled(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function sanitizePlayerName(name) {
    if (typeof name !== 'string') return 'Player';
    const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    return trimmed.replace(/[<>"'&\x00-\x1f\x7f]/g, '') || 'Player';
}
class Game {
    constructor(roomId, discoverable = false, diceCount = 1, snakeThreshold = 3, minesEnabled = false, minesCount = 5, ladderMinesOnly = false, randomizeSnakesLadders = false, requireSixToStart = false, exactRollToWin = false) {
        this.roomId = roomId;
        this.players = [];
        this.currentTurn = 0;
        this.started = false;
        this.winner = null;
        this.lastRoll = null;
        this.turnLocked = false;
        this.turnLockedPlayerId = null;
        this.discoverable = discoverable === true;
        this.createdAt = Date.now();
        this.lastActivityAt = Date.now();
        this.hostname = null;
        this.hostPersistentId = null;
        this.playerRollCounts = {};
        this.diceCount = boundedInteger(diceCount, 1, 2, 1); // Number of dice to roll (1 or 2)
        this.snakeThreshold = boundedInteger(snakeThreshold, 2, 5, 3); // Number of snakes needed for revenge power (2-5)
        this.minesEnabled = minesEnabled === true; // Whether mines are enabled
        this.minesCount = boundedInteger(minesCount, 3, 15, 5); // Number of mines to spawn (3-15)
        this.ladderMinesOnly = ladderMinesOnly === true; // Whether mines can only appear at ladder tops
        this.randomizeSnakesLadders = randomizeSnakesLadders === true; // Whether to use random snake/ladder positions
        this.requireSixToStart = requireSixToStart === true; // Whether players must roll 6 to enter board
        this.exactRollToWin = exactRollToWin === true; // Whether players must land exactly on 100 to win
        this.mines = []; // Array of tile positions with mines
        this.voids = []; // Array of tile positions that became voids
        this.onTurnLocked = null;
        this.turnId = 0;

        // Generate random snakes and ladders if enabled
        if (this.randomizeSnakesLadders) {
            this.generateRandomSnakesAndLadders();
        }

        // Generate mines if enabled
        if (this.minesEnabled) {
            this.generateMines();
        }
    }
    
    generateMines() {
        const occupied = new Set([1, 100, ...this.voids, ...Object.keys(this.getSnakes()).map(Number)]);
        const candidates = this.ladderMinesOnly
            ? [...new Set(Object.values(this.getLadders()))]
            : Array.from({ length: 98 }, (_, i) => i + 2);
        if (!this.ladderMinesOnly) {
            Object.keys(this.getLadders()).forEach(tile => occupied.add(Number(tile)));
        }
        this.mines = shuffled(candidates.filter(tile => !occupied.has(tile))).slice(0, this.minesCount);
    }

    generateRandomSnakesAndLadders() {
        // Generate snake lengths naturally varied like the base game
        // Base game has: 3, 4, 10, 20, 20, 20, 21, 38, 43, 63
        // Mix of very short, short, medium, and occasionally very long
        const generateSnakeLength = () => {
            const rand = Math.random();
            if (rand < 0.05) return Math.floor(Math.random() * 30) + 50; // 5%: dramatic long (50-79)
            if (rand < 0.15) return Math.floor(Math.random() * 20) + 30; // 10%: long (30-49)
            if (rand < 0.40) return Math.floor(Math.random() * 15) + 15; // 25%: medium (15-29)
            if (rand < 0.70) return Math.floor(Math.random() * 8) + 7;   // 30%: short (7-14)
            return Math.floor(Math.random() * 4) + 3;                     // 30%: very short (3-6)
        };

        // Generate ladder lengths naturally varied like the base game
        // Base game has: 8, 10, 16, 20, 21, 22, 37, 56
        // Mix of short, medium, and occasionally very long dramatic climbs
        const generateLadderLength = () => {
            const rand = Math.random();
            if (rand < 0.08) return Math.floor(Math.random() * 25) + 50; // 8%: epic climb (50-74)
            if (rand < 0.20) return Math.floor(Math.random() * 15) + 35; // 12%: long climb (35-49)
            if (rand < 0.50) return Math.floor(Math.random() * 15) + 20; // 30%: medium climb (20-34)
            return Math.floor(Math.random() * 12) + 8;                    // 50%: short climb (8-19)
        };

        // Multiple generation attempts to avoid sparse/failed random boards.
        const GENERATION_RETRIES = 8;
        const MAX_ATTEMPTS = 5000;
        const MIN_SNAKES = 7;
        const MIN_LADDERS = 6;

        for (let attempt = 1; attempt <= GENERATION_RETRIES; attempt++) {
            const snakes = {};
            const ladders = {};
            const occupied = new Set([1, 100]);

            const targetSnakeCount = Math.floor(Math.random() * 3) + 8; // 8-10 snakes
            const targetLadderCount = Math.floor(Math.random() * 3) + 7; // 7-9 ladders

            console.log(`🎲 Generating natural Snakes & Ladders (attempt ${attempt}/${GENERATION_RETRIES}) - Target: ${targetSnakeCount} snakes, ${targetLadderCount} ladders`);

            // Generate snakes - place them naturally across the board
            let snakeAttempts = 0;
            while (Object.keys(snakes).length < targetSnakeCount && snakeAttempts < MAX_ATTEMPTS) {
                snakeAttempts++;

                // Snake heads can be anywhere from position 10 to 99
                const head = Math.floor(Math.random() * 90) + 10;
                if (occupied.has(head)) continue;

                const length = generateSnakeLength();
                const tail = head - length;

                // Validate: tail must be >= 2 and not occupied
                if (tail >= 2 && !occupied.has(tail)) {
                    snakes[head] = tail;
                    occupied.add(head);
                    occupied.add(tail);
                }
            }

            // Generate ladders - place them naturally across the board
            let ladderAttempts = 0;
            while (Object.keys(ladders).length < targetLadderCount && ladderAttempts < MAX_ATTEMPTS) {
                ladderAttempts++;

                // Ladder bottoms can be anywhere from position 2 to 85
                const bottom = Math.floor(Math.random() * 84) + 2;
                if (occupied.has(bottom)) continue;

                const length = generateLadderLength();
                const top = bottom + length;

                // Validate: top must be <= 99 and not occupied
                if (top <= 99 && !occupied.has(top)) {
                    ladders[bottom] = top;
                    occupied.add(bottom);
                    occupied.add(top);
                }
            }

            const snakeCount = Object.keys(snakes).length;
            const ladderCount = Object.keys(ladders).length;

            // Accept only sufficiently populated boards.
            if (snakeCount >= MIN_SNAKES && ladderCount >= MIN_LADDERS) {
                this.snakes = snakes;
                this.ladders = ladders;

                const snakeLengths = Object.entries(this.snakes).map(([head, tail]) =>
                    parseInt(head) - parseInt(tail)
                ).sort((a, b) => b - a);
                const ladderLengths = Object.entries(this.ladders).map(([bottom, top]) =>
                    parseInt(top) - parseInt(bottom)
                ).sort((a, b) => b - a);

                console.log(`✅ Generated ${snakeCount} snakes and ${ladderCount} ladders`);
                console.log(`🐍 Snake lengths: [${snakeLengths.join(', ')}]`);
                console.log(`🪜 Ladder lengths: [${ladderLengths.join(', ')}]`);
                console.log('📋 Snakes:', this.snakes);
                console.log('📋 Ladders:', this.ladders);
                return;
            }

            console.log(`⚠️ Random board underfilled on attempt ${attempt}: ${snakeCount} snakes, ${ladderCount} ladders`);
        }

        // Safe fallback: use default board if all random attempts fail.
        this.snakes = null;
        this.ladders = null;
        console.log('⚠️ Falling back to default snakes/ladders after repeated random generation failures');
    }

    // Helper method to get snakes (custom or default)
    getSnakes() {
        return this.randomizeSnakesLadders && this.snakes && Object.keys(this.snakes).length > 0 ? this.snakes : SNAKES;
    }

    // Helper method to get ladders (custom or default)
    getLadders() {
        return this.randomizeSnakesLadders && this.ladders && Object.keys(this.ladders).length > 0 ? this.ladders : LADDERS;
    }

    getTakenCustomizations() {
        return {
            colors: this.players.map(p => p.color),
            icons: this.players.map(p => p.icon)
        };
    }

    getRulesSummary() {
        const parts = [];
        parts.push(`${this.diceCount} ${this.diceCount === 1 ? 'die' : 'dice'}`);
        parts.push(`🐍⚡ power after ${this.snakeThreshold} snakes`);
        if (this.randomizeSnakesLadders) parts.push('random board');
        if (this.requireSixToStart) parts.push('roll 6 to start');
        parts.push(this.exactRollToWin ? 'exact roll to win (bounce back)' : 'exact roll to win (stay on overshoot)');
        if (this.minesEnabled) {
            parts.push(`mines (${this.minesCount}${this.ladderMinesOnly ? ', ladder tops only' : ''})`);
        }
        return parts.join(' · ');
    }

    customizationConflict(color, icon) {
        for (const player of this.players) {
            if (player.color === color && player.icon === icon) {
                return { conflict: true, message: `${player.name} already uses this color and icon` };
            }
            if (player.color === color) {
                return { conflict: true, message: `${player.name} already uses this color` };
            }
            if (player.icon === icon) {
                return { conflict: true, message: `${player.name} already uses this icon` };
            }
        }
        return { conflict: false };
    }

    addPlayer(playerId, playerName, persistentId = null, playerColor = null, playerIcon = null) {
        if (this.players.length >= 6) {
            return { success: false, message: 'Room is full' };
        }

        if (this.started) return { success: false, message: 'Game already started' };
        if (this.players.some(p => p.id === playerId)) {
            return { success: false, message: 'Player already joined this room' };
        }
        const safeName = sanitizePlayerName(playerName);
        const color = typeof playerColor === 'string' && PLAYER_COLORS.includes(playerColor.toUpperCase())
            ? playerColor.toUpperCase()
            : PLAYER_COLORS.find(value => !this.players.some(p => p.color === value));
        const icon = PLAYER_ICONS.includes(playerIcon)
            ? playerIcon
            : PLAYER_ICONS.find(value => !this.players.some(p => p.icon === value));

        const customizationCheck = this.customizationConflict(color, icon);
        if (customizationCheck.conflict) {
            return { success: false, message: customizationCheck.message };
        }

        const player = {
            id: playerId,
            persistentId: persistentId || this.generatePlayerId(),
            name: safeName,
            position: 0,
            color: color,
            icon: icon,
            ready: false,
            isBot: false,
            botTakeover: false,
            botTakeoverAt: null,
            snakeHits: 0, // Track how many times player hit snakes
            hasDiceControl: false, // Whether player earned dice control power
            controlledDiceRoll: null, // Store controlled dice values {targetPlayerId, diceValues}
            hasUsedPower: false, // Track if player has already used their revenge power this game
            disconnectedAt: null
        };

        this.players.push(player);
        this.lastActivityAt = Date.now();
        if (!this.hostPersistentId) {
            this.hostPersistentId = player.persistentId;
        }
        if (!this.playerRollCounts[player.persistentId]) {
            this.playerRollCounts[player.persistentId] = 0;
        }
        return { success: true, player };
    }

    maybeGrantRevengePower(player) {
        if (!player) return false;
        if (player.snakeHits >= this.snakeThreshold && !player.hasDiceControl && !player.hasUsedPower) {
            player.hasDiceControl = true;
            return true;
        }
        return false;
    }

    generatePlayerId() {
        return `player_${randomUUID()}`;
    }

    reconnectPlayer(oldPersistentId, newSocketId) {
        const player = this.players.find(p => p.persistentId === oldPersistentId);
        if (player) {
            player.id = newSocketId;
            player.disconnectedAt = null;
            this.lastActivityAt = Date.now();
            return { success: true, player };
        }
        return { success: false, message: 'Player not found in game' };
    }

    findPlayerByPersistentId(persistentId) {
        return this.players.find(p => p.persistentId === persistentId);
    }

    lockTurnForPlayer(player) {
        this.turnId++;
        this.turnLocked = true;
        this.turnLockedPlayerId = player ? player.persistentId : null;
        if (typeof this.onTurnLocked === 'function') {
            this.onTurnLocked(this.roomId, player);
        }
    }

    unlockTurn() {
        this.turnLocked = false;
        this.turnLockedPlayerId = null;
    }

    shouldBotTakeOverLeavingPlayer(playerId) {
        if (!this.started || this.winner) return false;

        const leavingPlayer = this.players.find(p => p.id === playerId);
        if (!leavingPlayer || leavingPlayer.isBot) return false;

        const remainingPlayers = this.players.filter(p => p.id !== playerId);
        const remainingHumans = remainingPlayers.filter(p => !p.isBot);

        // Only auto-fill the exact case where the game would otherwise become solo.
        return remainingPlayers.length === 1 && remainingHumans.length === 1;
    }

    convertPlayerToBot(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            return { success: false, message: 'Player not found in game' };
        }

        player.id = `bot_${player.persistentId}_${Date.now()}`;
        player.ready = true;
        player.isBot = true;
        player.botTakeover = true;
        player.botTakeoverAt = Date.now();
        player.disconnectedAt = null;
        this.ensureHost();

        return { success: true, player };
    }

    ensureHost(disconnectGraceMs = 0) {
        const host = this.findPlayerByPersistentId(this.hostPersistentId);
        if (!host || host.isBot || (host.disconnectedAt && Date.now() - host.disconnectedAt >= disconnectGraceMs)) {
            const next = this.players.find(p => !p.isBot && !p.disconnectedAt)
                || this.players.find(p => !p.isBot);
            this.hostPersistentId = next ? next.persistentId : null;
        }
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) return;
        const [removed] = this.players.splice(index, 1);
        // Preserve the current player when an earlier seat is removed.
        if (index < this.currentTurn) this.currentTurn--;
        if (this.currentTurn >= this.players.length) this.currentTurn = 0;
        delete this.playerRollCounts[removed.persistentId];
        for (const player of this.players) {
            if (player.controlledDiceRoll?.targetPlayerId === removed.persistentId) player.controlledDiceRoll = null;
        }
        // A departing player's already-resolved move may still be animating for others.
        // The server releases that turn after the remaining acknowledgements or timeout.
        this.ensureHost();
        this.lastActivityAt = Date.now();
    }

    setPlayerReady(playerId, ready) {
        const player = this.players.find(p => p.id === playerId);
        if (player && !this.started) {
            player.ready = ready === true;
            this.lastActivityAt = Date.now();
        }
    }

    canStart() {
        return !this.started && this.players.length >= 1 && this.players.every(p => p.ready && !p.disconnectedAt);
    }

    startGame() {
        if (!this.canStart()) return false;
        this.started = true;
        this.currentTurn = 0;
        this.lastActivityAt = Date.now();
        return true;
    }

    reset() {
        for (const player of this.players) {
            Object.assign(player, {
                position: 0, ready: !!player.isBot, snakeHits: 0,
                hasDiceControl: false, controlledDiceRoll: null, hasUsedPower: false
            });
            this.playerRollCounts[player.persistentId] = 0;
        }
        this.currentTurn = 0;
        this.started = false;
        this.winner = null;
        this.lastRoll = null;
        this.lastActivityAt = Date.now();
        this.unlockTurn();
        this.voids = [];
        if (this.randomizeSnakesLadders) this.generateRandomSnakesAndLadders();
        this.mines = [];
        if (this.minesEnabled) this.generateMines();
    }

    setControlledDice(controllerId, targetId, diceValues) {
        const controller = this.players.find(p => p.id === controllerId);
        const target = this.findPlayerByPersistentId(targetId);
        if (!this.started || this.winner) return { success: false, message: 'Game is not active' };
        if (!controller?.hasDiceControl || controller.hasUsedPower) return { success: false, message: 'You do not have dice control power' };
        if (!Array.isArray(diceValues) || diceValues.length !== this.diceCount ||
            !diceValues.every(value => Number.isInteger(value) && value >= 1 && value <= 6)) {
            return { success: false, message: 'Choose a value from 1 to 6 for each die' };
        }
        if (!target || target === controller) return { success: false, message: 'Choose another player' };
        if (this.players.some(p => p.controlledDiceRoll?.targetPlayerId === targetId)) {
            return { success: false, message: `${target.name} already has a pending controlled roll` };
        }
        controller.controlledDiceRoll = { targetPlayerId: targetId, diceValues: [...diceValues] };
        controller.hasDiceControl = false;
        controller.hasUsedPower = true;
        this.lastActivityAt = Date.now();
        return { success: true, targetPlayerName: target.name, diceValues: [...diceValues] };
    }

    rollDice(controlledValues = null) {
        // If there are controlled values, use them instead of random
        if (controlledValues && Array.isArray(controlledValues)) {
            return controlledValues;
        }
        
        // Roll the number of dice specified for this game
        const rolls = [];
        for (let i = 0; i < this.diceCount; i++) {
            rolls.push(randomInt(1, 7));
        }
        return rolls;
    }
    
    // Calculate total from dice rolls
    getDiceTotal(rolls) {
        return rolls.reduce((sum, roll) => sum + roll, 0);
    }

    // Preview and execution share the same rules, including bounce and chained hazards.
    resolveMove(position, diceRolls) {
        const diceTotal = this.getDiceTotal(diceRolls);
        const move = {
            oldPosition: position, newPosition: position, movementPath: [],
            snake: null, ladder: null, mine: null, voidFall: null,
            anotherTurn: this.diceCount === 1 ? diceTotal === 6 : diceRolls[0] === diceRolls[1]
        };
        if (this.requireSixToStart && position === 0) {
            if (diceRolls.includes(6)) {
                move.newPosition = 1;
                move.movementPath = [1];
                move.enteredBoard = true;
            } else {
                move.needsSixToStart = true;
                move.anotherTurn = false;
            }
            return move;
        }
        if (position + diceTotal > WINNING_POSITION && !this.exactRollToWin) return move;

        let direction = 1;
        for (let i = 0; i < diceTotal; i++) {
            if (position === WINNING_POSITION) direction = -1;
            position += direction;
            move.movementPath.push(position);
        }
        if (direction === -1) {
            move.bouncedBack = true;
            move.overshoot = move.oldPosition + diceTotal - WINNING_POSITION;
        }
        const applyHazard = () => {
            if (this.voids.includes(position)) {
                move.voidFall = { from: position, to: Math.max(position - diceTotal * 3, 1) };
                position = move.voidFall.to;
            } else if (this.mines.includes(position)) {
                move.mine = { position };
                position = 1;
            } else if (this.getSnakes()[position]) {
                move.snake = { from: position, to: this.getSnakes()[position] };
                position = move.snake.to;
            }
        };
        if (!this.voids.includes(position) && !this.mines.includes(position) && !this.getSnakes()[position] && this.getLadders()[position]) {
            move.ladder = { from: position, to: this.getLadders()[position] };
            position = move.ladder.to;
        }
        applyHazard();
        move.newPosition = position;
        return move;
    }

    movePlayer(playerId) {
        if (!this.started) return { success: false, message: 'Game has not started' };
        if (this.winner) return { success: false, message: 'Game has ended' };
        if (this.turnLocked) return { success: false, message: 'Wait for the current turn animation to finish' };
        const player = this.players[this.currentTurn];
        if (!player || player.id !== playerId) return { success: false, message: 'Not your turn' };
        const controller = this.players.find(p => p.controlledDiceRoll?.targetPlayerId === player.persistentId);
        const diceRolls = this.rollDice(controller?.controlledDiceRoll.diceValues);
        if (controller) controller.controlledDiceRoll = null;
        const move = this.resolveMove(player.position, diceRolls);
        player.position = move.newPosition;
        this.lastRoll = this.getDiceTotal(diceRolls);
        this.lastActivityAt = Date.now();
        this.playerRollCounts[player.persistentId] = (this.playerRollCounts[player.persistentId] || 0) + 1;
        let powerGranted = false;
        if (move.snake) {
            player.snakeHits++;
            powerGranted = this.maybeGrantRevengePower(player);
        }
        if (move.mine) {
            this.mines = this.mines.filter(tile => tile !== move.mine.position);
            if (!this.voids.includes(move.mine.position)) this.voids.push(move.mine.position);
        }
        if (player.position === WINNING_POSITION) this.winner = player;
        if (!move.anotherTurn && !this.winner) this.currentTurn = (this.currentTurn + 1) % this.players.length;
        this.lockTurnForPlayer(player);
        return {
            success: true, ...move, diceRoll: this.lastRoll, diceRolls,
            player: this.publicPlayer(player), winner: this.winner ? this.publicPlayer(this.winner) : null,
            turnId: this.turnId, powerGranted, wasControlled: !!controller,
            controllerPlayerId: controller ? controller.persistentId : null
        };
    }

    publicPlayer(player) {
        const { controlledDiceRoll, ...publicFields } = player;
        return { ...publicFields };
    }

    getState() {
        const sanitizedPlayers = this.players.map(player => this.publicPlayer(player));
        const sanitizedWinner = this.winner
            ? this.publicPlayer(this.winner)
            : null;

        return {
            roomId: this.roomId,
            turnId: this.turnId,
            turnLocked: this.turnLocked,
            turnLockedPlayerId: this.turnLockedPlayerId,
            players: sanitizedPlayers,
            currentTurn: this.currentTurn,
            started: this.started,
            winner: sanitizedWinner,
            lastRoll: this.lastRoll,
            snakes: this.getSnakes(),
            ladders: this.getLadders(),
            discoverable: this.discoverable,
            hostname: this.hostname,
            hostPersistentId: this.hostPersistentId,
            rulesSummary: this.getRulesSummary(),
            takenCustomizations: this.getTakenCustomizations(),
            playerRollCounts: { ...this.playerRollCounts },
            diceCount: this.diceCount,
            snakeThreshold: this.snakeThreshold,
            minesEnabled: this.minesEnabled,
            minesCount: this.minesCount,
            mines: this.mines,
            voids: this.voids,
            ladderMinesOnly: this.ladderMinesOnly,
            randomizeSnakesLadders: this.randomizeSnakesLadders,
            requireSixToStart: this.requireSixToStart,
            exactRollToWin: this.exactRollToWin
        };
    }

    getDiscoveryInfo() {
        return {
            roomId: this.roomId,
            hostname: this.hostname,
            playerCount: this.players.length,
            maxPlayers: 6,
            started: this.started,
            createdAt: this.createdAt,
            rulesSummary: this.getRulesSummary()
        };
    }
}

module.exports = {
    Game,
    SNAKES,
    LADDERS,
    BOARD_SIZE,
    WINNING_POSITION,
    MAX_PLAYER_NAME_LENGTH,
    sanitizePlayerName,
    PLAYER_COLORS,
    PLAYER_ICONS
};
