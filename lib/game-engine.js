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

function sanitizePlayerName(name) {
    if (typeof name !== 'string') return 'Player';
    const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    return trimmed.replace(/[<>"'&]/g, '') || 'Player';
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
        this.discoverable = discoverable;
        this.createdAt = Date.now();
        this.lastActivityAt = Date.now();
        this.hostname = null;
        this.hostPersistentId = null;
        this.playerRollCounts = {};
        this.diceCount = diceCount; // Number of dice to roll (1 or 2)
        this.snakeThreshold = snakeThreshold; // Number of snakes needed for revenge power (2-5)
        this.minesEnabled = minesEnabled; // Whether mines are enabled
        this.minesCount = minesCount; // Number of mines to spawn (3-15)
        this.ladderMinesOnly = ladderMinesOnly; // Whether mines can only appear at ladder tops
        this.randomizeSnakesLadders = randomizeSnakesLadders; // Whether to use random snake/ladder positions
        this.requireSixToStart = requireSixToStart; // Whether players must roll 6 to enter board
        this.exactRollToWin = exactRollToWin; // Whether players must land exactly on 100 to win
        this.mines = []; // Array of tile positions with mines
        this.voids = []; // Array of tile positions that became voids
        this.onTurnLocked = null;

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
        // Clear existing mines
        this.mines = [];

        if (this.ladderMinesOnly) {
            // Only place mines at ladder destinations (tops of ladders)
            const ladderTops = Object.values(this.getLadders()); // Get all ladder destination tiles

            // Remove occupied tiles from ladder tops (start, end, existing voids, snake heads)
            const availableLadderTops = ladderTops.filter(top =>
                top !== 1 && // Not start tile
                top !== 100 && // Not end tile
                !this.voids.includes(top) && // Not existing void
                !Object.keys(this.getSnakes()).includes(top.toString()) // Not snake head
            );

            // Shuffle and select random ladder tops for mines
            const shuffledTops = availableLadderTops.sort(() => Math.random() - 0.5);
            const minesToPlace = Math.min(this.minesCount, shuffledTops.length);

            for (let i = 0; i < minesToPlace; i++) {
                this.mines.push(shuffledTops[i]);
            }

            console.log(`Generated ${this.mines.length} mines at ladder tops:`, this.mines);
        } else {
            // Original random mine placement logic
            // Get all occupied tiles (snakes, ladders, start, end, and existing voids)
            const occupiedTiles = new Set([1, 100]); // Start and end tiles
            Object.keys(this.getSnakes()).forEach(tile => occupiedTiles.add(parseInt(tile)));
            Object.keys(this.getLadders()).forEach(tile => occupiedTiles.add(parseInt(tile)));
            // Add existing voids to occupied tiles to prevent mines on destroyed tiles
            this.voids.forEach(voidTile => occupiedTiles.add(voidTile));

            // Generate random mine positions
            while (this.mines.length < this.minesCount) {
                const randomTile = Math.floor(Math.random() * 99) + 2; // 2-99 (avoid 1 and 100)

                if (!occupiedTiles.has(randomTile) && !this.mines.includes(randomTile)) {
                    this.mines.push(randomTile);
                }
            }

            console.log(`Generated ${this.mines.length} mines at random positions:`, this.mines);
        }
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
        if (this.exactRollToWin) parts.push('exact roll to win');
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

        const safeName = sanitizePlayerName(playerName);

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
        return 'player_' + Math.random().toString(36).substring(2, 15);
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

        return { success: true, player };
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

        if (this.turnLocked) {
            return { success: false, message: 'Wait for the current turn animation to finish' };
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
        this.lastActivityAt = Date.now();
        this.playerRollCounts[player.persistentId] = (this.playerRollCounts[player.persistentId] || 0) + 1;
        
        // Clear the controlled dice roll after use
        const wasControlled = controlledValues !== null;
        if (wasControlled && controllerPlayer) {
            controllerPlayer.controlledDiceRoll = null;
        }
        
        const oldPosition = player.position;
        
        // Rule: Require 6 to start - player must roll a 6 to enter the board at position 1
        if (this.requireSixToStart && player.position === 0) {
            // Check if player rolled a 6 (for 1 die) or if any die shows 6 (for 2 dice)
            const rolledSix = diceRolls.includes(6);
            
            if (rolledSix) {
                // Player enters the board at position 1
                player.position = 1;
                
                // Check for another turn
                const rolledDouble = this.diceCount === 2 && diceRolls[0] === diceRolls[1];
                const anotherTurn = (this.diceCount === 1 && diceTotal === 6) || rolledDouble;
                
                if (!anotherTurn) {
                    this.currentTurn = (this.currentTurn + 1) % this.players.length;
                }
                
                this.lockTurnForPlayer(player);
                return {
                    success: true,
                    diceRoll: diceTotal,
                    diceRolls: diceRolls,
                    oldPosition: oldPosition,
                    newPosition: 1,
                    player: player,
                    snake: null,
                    ladder: null,
                    winner: null,
                    anotherTurn: anotherTurn,
                    wasControlled: wasControlled,
                    controllerPlayerId: wasControlled && controllerPlayer ? controllerPlayer.persistentId : null,
                    powerGranted: false,
                    enteredBoard: true // Flag to indicate player just entered the board
                };
            } else {
                // Player didn't roll a 6, stays at position 0
                // No another turn for not rolling 6
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
                
                this.lockTurnForPlayer(player);
                return {
                    success: true,
                    diceRoll: diceTotal,
                    diceRolls: diceRolls,
                    oldPosition: oldPosition,
                    newPosition: 0,
                    player: player,
                    snake: null,
                    ladder: null,
                    winner: null,
                    anotherTurn: false,
                    wasControlled: wasControlled,
                    controllerPlayerId: wasControlled && controllerPlayer ? controllerPlayer.persistentId : null,
                    powerGranted: false,
                    needsSixToStart: true // Flag to indicate player needs to roll 6
                };
            }
        }
        
        let newPosition = player.position + diceTotal;
        
        // Rule: Exact roll to win - if overshooting 100, bounce back
        if (this.exactRollToWin && newPosition > WINNING_POSITION) {
            // Calculate bounce back: overshoot amount gets subtracted from 100
            const overshoot = newPosition - WINNING_POSITION;
            newPosition = WINNING_POSITION - overshoot;
            
            // Ensure we don't go below 1
            if (newPosition < 1) {
                newPosition = 1;
            }
            
            player.position = newPosition;
            
            // Check for another turn
            const rolledDouble = this.diceCount === 2 && diceRolls[0] === diceRolls[1];
            const anotherTurn = (this.diceCount === 1 && diceTotal === 6) || rolledDouble;
            
            if (!anotherTurn) {
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
            }
            
            this.lockTurnForPlayer(player);
            return {
                success: true,
                diceRoll: diceTotal,
                diceRolls: diceRolls,
                oldPosition: oldPosition,
                newPosition: newPosition,
                player: player,
                snake: null,
                ladder: null,
                winner: null,
                anotherTurn: anotherTurn,
                wasControlled: wasControlled,
                controllerPlayerId: wasControlled && controllerPlayer ? controllerPlayer.persistentId : null,
                powerGranted: false,
                bouncedBack: true, // Flag to indicate player bounced back
                overshoot: overshoot
            };
        }
        
        // Original rule: Can't move if it would go past 100 (when exactRollToWin is disabled)
        if (!this.exactRollToWin && newPosition > WINNING_POSITION) {
            // For 2 dice, check if it's a double (both dice same value) for another turn
            // For 1 die, check if it's 6
            const rolledDouble = this.diceCount === 2 && diceRolls[0] === diceRolls[1];
            const anotherTurn = (this.diceCount === 1 && diceTotal === 6) || rolledDouble;
            
            if (!anotherTurn) {
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
            }
            this.lockTurnForPlayer(player);
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
        else if (this.getSnakes()[newPosition]) {
            const snakes = this.getSnakes();
            snake = { from: newPosition, to: snakes[newPosition] };
            player.position = snakes[newPosition];
            newPosition = player.position;

            // Increment snake hit counter
            player.snakeHits++;
            powerGranted = this.maybeGrantRevengePower(player);
        }
        // Check for ladder (only if didn't hit mine/void/snake)
        else if (this.getLadders()[newPosition]) {
            const ladders = this.getLadders();
            const snakes = this.getSnakes();
            ladder = { from: newPosition, to: ladders[newPosition] };

            // Don't move player position yet - wait for client animation
            // But check if there's a mine at the destination for planning purposes
            const ladderDestination = ladders[newPosition];

            // Check for mine at ladder destination - but don't explode yet
            if (this.mines.includes(ladderDestination)) {
                // Store mine info but don't explode until ladder animation completes
                mine = { position: ladderDestination, waitForLadder: true };
                // Don't move player yet - wait for ladder animation then mine explosion
            }
            // Check for snake at ladder destination (less common but possible)
            else if (snakes[ladderDestination]) {
                // Move player to ladder destination then snake destination
                player.position = ladderDestination;
                newPosition = player.position;

                snake = { from: newPosition, to: snakes[newPosition] };
                player.position = snakes[newPosition];
                newPosition = player.position;

                // Increment snake hit counter
                player.snakeHits++;
                powerGranted = this.maybeGrantRevengePower(player);

                // Clear ladder since snake takes precedence
                ladder = null;
            }
            else {
                // Normal ladder - move player to destination for game state consistency
                // Client will handle animation from ladder start to destination
                player.position = ladderDestination;
                newPosition = player.position;
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

        this.lockTurnForPlayer(player);
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
        const sanitizedPlayers = this.players.map(player => ({
            id: player.id,
            persistentId: player.persistentId,
            name: player.name,
            position: player.position,
            color: player.color,
            icon: player.icon,
            ready: player.ready,
            isBot: !!player.isBot,
            botTakeover: !!player.botTakeover,
            snakeHits: player.snakeHits,
            hasDiceControl: player.hasDiceControl,
            hasUsedPower: player.hasUsedPower
        }));
        const sanitizedWinner = this.winner
            ? sanitizedPlayers.find(p => p.persistentId === this.winner.persistentId) || null
            : null;

        return {
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
    sanitizePlayerName
};
