// Socket.IO connection
const socket = io();

// Game state
let currentRoom = null;
let currentPlayer = null;
let gameState = null;
let isReconnecting = false;

// Animation state
let animationInProgress = false;
let playerAnimations = {};

// Sound system
const sounds = {
    diceRoll: new Audio('/sounds/diceroll.mp3'),
    playerMove: new Audio('/sounds/playermove.mp3'),
    climbLadder: new Audio('/sounds/climbladder.mp3'),
    downSnake: new Audio('/sounds/downsnake.mp3')
};

// Preload sounds and set volume
sounds.diceRoll.preload = 'auto';
sounds.diceRoll.volume = 0.5;
sounds.playerMove.preload = 'auto';
sounds.playerMove.volume = 0.375; // 25% quieter than dice roll
sounds.climbLadder.preload = 'auto';
sounds.climbLadder.volume = 0.3;
sounds.downSnake.preload = 'auto';
sounds.downSnake.volume = 0.3;

// Helper function to play sound with error handling
function playSound(soundName) {
    const sound = sounds[soundName];
    if (sound) {
        // Start downSnake sound 0.5 seconds in to skip intro
        sound.currentTime = soundName === 'downSnake' ? 0.5 : 0;
        sound.play().catch(err => {
            console.log('Sound play failed:', err);
        });
    }
}

// Canvas logical size (for drawing calculations)
let canvasLogicalSize = 800;

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const winnerModal = document.getElementById('winner-modal');

// Welcome screen
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const roomCodeInput = document.getElementById('room-code');
const joinSubmitBtn = document.getElementById('join-submit-btn');

// Lobby screen
const roomCodeDisplay = document.getElementById('room-code-display');
const copyRoomCodeBtn = document.getElementById('copy-room-code');
const playersList = document.getElementById('players-list');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');

// Game screen
const currentTurnDisplay = document.getElementById('current-turn-display');
const lastRollDisplay = document.getElementById('last-roll-display');
const scoreboardList = document.getElementById('scoreboard-list');
const rollDiceBtn = document.getElementById('roll-dice-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const leaveGameBtn = document.getElementById('leave-game-btn');
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');

// Winner modal
const winnerName = document.getElementById('winner-name');
const playAgainBtn = document.getElementById('play-again-btn');

// Notification
const notification = document.getElementById('notification');

// Dice animation
const diceContainer = document.getElementById('dice-container');
const diceElement = document.getElementById('dice');
const diceBackdrop = document.getElementById('dice-backdrop');

// Mobile UI controls
const toggleUIBtn = document.getElementById('toggle-ui-btn');
const mobileRollBtn = document.getElementById('mobile-roll-btn');
const gameSidebar = document.getElementById('game-sidebar');

// Session management functions
function saveSession() {
    if (currentRoom && currentPlayer) {
        const session = {
            roomId: currentRoom,
            persistentId: currentPlayer.persistentId,
            playerName: currentPlayer.name
        };
        localStorage.setItem('snakesAndLaddersSession', JSON.stringify(session));
    }
}

function loadSession() {
    const sessionData = localStorage.getItem('snakesAndLaddersSession');
    if (sessionData) {
        try {
            return JSON.parse(sessionData);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function clearSession() {
    localStorage.removeItem('snakesAndLaddersSession');
}

function attemptReconnection() {
    const session = loadSession();
    if (session && !isReconnecting) {
        isReconnecting = true;
        showNotification('Reconnecting to game...', 'info');
        socket.emit('reconnect-to-room', {
            roomId: session.roomId,
            persistentId: session.persistentId
        });
    }
}

// Event listeners - Welcome screen
createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        showNotification('Please enter your name', 'error');
        return;
    }
    socket.emit('create-room', { playerName: name });
});

joinRoomBtn.addEventListener('click', () => {
    joinRoomInput.style.display = joinRoomInput.style.display === 'none' ? 'block' : 'none';
});

joinSubmitBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (!name) {
        showNotification('Please enter your name', 'error');
        return;
    }
    
    if (!roomCode) {
        showNotification('Please enter room code', 'error');
        return;
    }
    
    socket.emit('join-room', { roomId: roomCode, playerName: name });
});

roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// Event listeners - Lobby screen
copyRoomCodeBtn.addEventListener('click', () => {
    const roomCode = roomCodeDisplay.textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        showNotification('Room code copied!', 'success');
    });
});

readyBtn.addEventListener('click', () => {
    socket.emit('toggle-ready', { roomId: currentRoom });
});

startGameBtn.addEventListener('click', () => {
    socket.emit('start-game', { roomId: currentRoom });
});

// Event listeners - Game screen
rollDiceBtn.addEventListener('click', () => {
    if (gameState && currentPlayer && !animationInProgress) {
        const currentTurnPlayer = gameState.players[gameState.currentTurn];
        const isMyTurn = currentTurnPlayer.persistentId === currentPlayer.persistentId;
        if (isMyTurn && !rollDiceBtn.disabled) {
            rollDiceBtn.disabled = true;
            mobileRollBtn.disabled = true;
            socket.emit('roll-dice', { roomId: currentRoom });
        }
    }
});

resetGameBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the game?')) {
        socket.emit('reset-game', { roomId: currentRoom });
    }
});

playAgainBtn.addEventListener('click', () => {
    socket.emit('reset-game', { roomId: currentRoom });
    winnerModal.classList.remove('active');
});

// Disconnect buttons
leaveLobbyBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the game?')) {
        socket.emit('manual-disconnect', { roomId: currentRoom });
    }
});

leaveGameBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the game?')) {
        socket.emit('manual-disconnect', { roomId: currentRoom });
    }
});

// Mobile UI toggle
let isSidebarVisible = false; // Start hidden on mobile for cleaner view

// Initialize sidebar state on mobile
function initializeMobileUI() {
    if (window.innerWidth <= 768) {
        gameSidebar.classList.add('hidden');
        toggleUIBtn.querySelector('.toggle-icon').textContent = '📋';
        isSidebarVisible = false;
    } else {
        gameSidebar.classList.remove('hidden');
        isSidebarVisible = true;
    }
}

toggleUIBtn.addEventListener('click', () => {
    isSidebarVisible = !isSidebarVisible;
    if (isSidebarVisible) {
        gameSidebar.classList.remove('hidden');
        toggleUIBtn.querySelector('.toggle-icon').textContent = '☰';
    } else {
        gameSidebar.classList.add('hidden');
        toggleUIBtn.querySelector('.toggle-icon').textContent = '📋';
    }
});

// Mobile roll button (synced with desktop roll button)
mobileRollBtn.addEventListener('click', () => {
    if (gameState && currentPlayer && !animationInProgress) {
        const currentTurnPlayer = gameState.players[gameState.currentTurn];
        const isMyTurn = currentTurnPlayer.persistentId === currentPlayer.persistentId;
        if (isMyTurn && !mobileRollBtn.disabled) {
            mobileRollBtn.disabled = true;
            rollDiceBtn.disabled = true;
            socket.emit('roll-dice', { roomId: currentRoom });
        }
    }
});

// Socket event handlers
socket.on('room-created', ({ roomId, player }) => {
    currentRoom = roomId;
    currentPlayer = player;
    roomCodeDisplay.textContent = roomId;
    saveSession();
    switchScreen('lobby');
    showNotification('Room created successfully!', 'success');
});

socket.on('room-joined', ({ roomId, player }) => {
    currentRoom = roomId;
    currentPlayer = player;
    roomCodeDisplay.textContent = roomId;
    saveSession();
    switchScreen('lobby');
    showNotification('Joined room successfully!', 'success');
});

socket.on('reconnected', ({ roomId, player }) => {
    currentRoom = roomId;
    currentPlayer = player;
    roomCodeDisplay.textContent = roomId;
    isReconnecting = false;
    saveSession();
    showNotification('Reconnected successfully!', 'success');
    
    // Wait for game state to determine which screen to show
    setTimeout(() => {
        if (gameState) {
            if (gameState.started) {
                switchScreen('game');
            } else {
                switchScreen('lobby');
            }
        } else {
            switchScreen('lobby');
        }
    }, 100);
});

socket.on('disconnected', () => {
    clearSession();
    currentRoom = null;
    currentPlayer = null;
    gameState = null;
    switchScreen('welcome');
    showNotification('You have left the game', 'info');
});

socket.on('player-left', ({ playerName }) => {
    showNotification(`${playerName} left the game`, 'info');
});

socket.on('game-state', (state) => {
    // Store the incoming state but don't immediately update positions during animations
    const wasStarted = gameState && gameState.started;
    gameState = state;
    updateLobby();
    if (state.started) {
        updateGameScreen();
        // If game just started, ensure canvas is properly sized
        if (!wasStarted) {
            setTimeout(() => resizeCanvas(), 100);
        }
    }
});

socket.on('game-started', () => {
    switchScreen('game');
    showNotification('Game started!', 'success');
});

socket.on('dice-rolled', (result) => {
    // Use the player data from the result instead of searching gameState
    // This prevents race conditions when game-state hasn't updated yet
    const rollingPlayer = result.player;
    
    if (!rollingPlayer) {
        console.error('No player data in dice-rolled result:', result);
        return;
    }
    
    if (!result.diceRoll || result.oldPosition === undefined || result.newPosition === undefined) {
        console.error('Invalid dice-rolled result data:', result);
        return;
    }
    
    console.log(`Dice rolled: ${rollingPlayer.name} rolled ${result.diceRoll}, moving ${result.oldPosition} → ${result.newPosition}`);
    
    // CRITICAL: Freeze the player's visual position at oldPosition before any state updates
    // This prevents the instant teleportation bug
    playerAnimations[rollingPlayer.persistentId] = {
        from: result.oldPosition,
        to: result.oldPosition,
        progress: 0,
        locked: true  // Lock prevents position updates from game state
    };
    
    // Immediately redraw to show frozen position
    drawBoard();
    
    // Show dice animation
    animateDiceRoll(result.diceRoll, () => {
        lastRollDisplay.textContent = `🎲 Rolled: ${result.diceRoll}`;
        
        // Start player movement animation
        const oldPosition = result.oldPosition;
        const newPosition = result.newPosition;
        const hasSnakeOrLadder = result.snake || result.ladder;
        
        // Start player movement animation
        animatePlayerMovement(
            rollingPlayer.persistentId,
            oldPosition,
            newPosition,
            result.diceRoll,
            hasSnakeOrLadder,
            () => {
                // Animation complete - unlock the player position
                delete playerAnimations[rollingPlayer.persistentId];
                
                // Show snake or ladder notification with sound
                if (result.snake) {
                    playSound('downSnake');
                    showNotification(`🐍 Snake! Slide down ${result.snake.from} → ${result.snake.to}`, 'info');
                } else if (result.ladder) {
                    playSound('climbLadder');
                    showNotification(`🪜 Ladder! Climb up ${result.ladder.from} → ${result.ladder.to}`, 'success');
                } else if (result.anotherTurn) {
                    showNotification(`🎲 Rolled a 6! ${rollingPlayer.name} gets another turn!`, 'success');
                }
                
                // Check for winner
                if (result.winner) {
                    setTimeout(() => {
                        winnerName.textContent = `${result.winner.name}`;
                        winnerModal.classList.add('active');
                    }, 500);
                }
                
                // Update button states based on whose turn it is now
                setTimeout(() => {
                    updateGameScreen();
                }, 200);
            }
        );
    });
});

socket.on('game-reset', () => {
    winnerModal.classList.remove('active');
    switchScreen('lobby');
    showNotification('Game has been reset', 'info');
});

socket.on('error', ({ message }) => {
    if (isReconnecting) {
        // If reconnection failed, clear session and show welcome
        clearSession();
        isReconnecting = false;
        switchScreen('welcome');
    }
    showNotification(message, 'error');
});

// Animation helper functions
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function animatePlayerPosition(playerId, fromPos, toPos, duration, onComplete) {
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutQuad(progress);
        
        // Store animated position for this player with lock to prevent state updates
        playerAnimations[playerId] = {
            from: fromPos,
            to: toPos,
            progress: easedProgress,
            locked: true
        };
        
        drawBoard();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Don't delete here - let the caller handle cleanup
            if (onComplete) onComplete();
        }
    }
    
    animate();
}

function animatePlayerMovement(playerId, startPos, endPos, diceRoll, snakeOrLadder, onComplete) {
    animationInProgress = true;
    
    // Step 1: Animate normal movement
    const steps = [];
    for (let i = 1; i <= diceRoll; i++) {
        steps.push(startPos + i);
    }
    
    function animateStep(stepIndex) {
        if (stepIndex >= steps.length) {
            // All steps done, check for snake or ladder
            if (snakeOrLadder) {
                // Add a brief pause before snake/ladder animation
                setTimeout(() => {
                    animatePlayerPosition(
                        playerId,
                        steps[steps.length - 1],
                        endPos,
                        800,
                        () => {
                            animationInProgress = false;
                            if (onComplete) onComplete();
                        }
                    );
                }, 300);
            } else {
                animationInProgress = false;
                if (onComplete) onComplete();
            }
            return;
        }
        
        const targetPos = steps[stepIndex];
        const duration = 200;
        const fromPos = stepIndex === 0 ? startPos : steps[stepIndex - 1];
        
        // Play movement sound for each step
        playSound('playerMove');
        
        animatePlayerPosition(playerId, fromPos, targetPos, duration, () => {
            animateStep(stepIndex + 1);
        });
    }
    
    animateStep(0);
}

// Initialize dice with dots
function initializeDice() {
    diceElement.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const dot = document.createElement('div');
        dot.className = 'dice-dot';
        diceElement.appendChild(dot);
    }
}

// Set dice face
function setDiceFace(number) {
    // Remove all face classes
    diceElement.className = 'dice';
    // Add the specific face class
    diceElement.classList.add(`dice-face-${number}`);
}

// Dice animation function
function animateDiceRoll(finalNumber, callback) {
    // Initialize dice if not already done
    if (diceElement.children.length !== 9) {
        initializeDice();
    }
    
    // Play dice roll sound
    playSound('diceRoll');
    
    // Show backdrop and container
    diceBackdrop.classList.add('active');
    diceContainer.classList.add('rolling');
    diceElement.classList.add('rolling');
    
    // Animate through random numbers
    let counter = 0;
    const totalFrames = 20;
    const frameDelay = 50;
    
    const interval = setInterval(() => {
        const randomNum = Math.floor(Math.random() * 6) + 1;
        setDiceFace(randomNum);
        counter++;
        
        if (counter >= totalFrames) {
            clearInterval(interval);
            
            // Show final number
            setDiceFace(finalNumber);
            
            // Remove animation classes after a delay
            setTimeout(() => {
                diceElement.classList.remove('rolling');
                
                setTimeout(() => {
                    diceContainer.classList.remove('rolling');
                    diceBackdrop.classList.remove('active');
                    
                    // Call callback after animation completes
                    if (callback) callback();
                }, 300);
            }, 500);
        }
    }, frameDelay);
}

// UI functions
function switchScreen(screen) {
    welcomeScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    
    switch(screen) {
        case 'welcome':
            welcomeScreen.classList.add('active');
            break;
        case 'lobby':
            lobbyScreen.classList.add('active');
            break;
        case 'game':
            gameScreen.classList.add('active');
            initializeMobileUI(); // Set up mobile UI state
            // Resize canvas after screen switch to ensure proper dimensions
            setTimeout(() => {
                resizeCanvas();
                drawBoard();
            }, 50);
            break;
    }
}

function updateLobby() {
    if (!gameState) return;
    
    // Update players list
    playersList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        const isCurrentPlayer = player.id === socket.id;
        
        playerItem.innerHTML = `
            <div class="player-color" style="background-color: ${player.color}"></div>
            <div class="player-info">
                <div class="player-name">${player.name}${isCurrentPlayer ? ' (You)' : ''}</div>
            </div>
            <span class="ready-badge ${player.ready ? 'ready' : 'waiting'}">
                ${player.ready ? '✓ Ready' : 'Waiting...'}
            </span>
        `;
        
        playersList.appendChild(playerItem);
    });
    
    // Update ready button
    const currentPlayerState = gameState.players.find(p => p.id === socket.id);
    if (currentPlayerState) {
        if (currentPlayerState.ready) {
            readyBtn.textContent = 'Not Ready';
            readyBtn.classList.add('ready');
        } else {
            readyBtn.textContent = 'Ready';
            readyBtn.classList.remove('ready');
        }
    }
    
    // Show start button if all players are ready (minimum 1 player)
    if (gameState.players.length >= 1 && gameState.players.every(p => p.ready)) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }
}

function updateGameScreen() {
    if (!gameState) return;
    
    // Update current turn display
    const currentTurnPlayer = gameState.players[gameState.currentTurn];
    currentTurnDisplay.innerHTML = `
        <div style="color: ${currentTurnPlayer.color}">
            ${currentTurnPlayer.name}'s Turn
        </div>
    `;
    
    // Update last roll display
    if (gameState.lastRoll) {
        lastRollDisplay.textContent = `🎲 Last Roll: ${gameState.lastRoll}`;
    } else {
        lastRollDisplay.textContent = '🎲 No rolls yet';
    }
    
    // Update scoreboard
    scoreboardList.innerHTML = '';
    gameState.players.forEach((player, index) => {
        const scoreboardItem = document.createElement('div');
        scoreboardItem.className = `scoreboard-item ${index === gameState.currentTurn ? 'active' : ''}`;
        
        scoreboardItem.innerHTML = `
            <div class="scoreboard-color" style="background-color: ${player.color}"></div>
            <div class="scoreboard-details">
                <div class="scoreboard-name">${player.name}</div>
                <div class="scoreboard-position">Position: ${player.position}</div>
            </div>
        `;
        
        scoreboardList.appendChild(scoreboardItem);
    });
    
    // Enable/disable roll button (both desktop and mobile)
    const isMyTurn = currentPlayer && currentTurnPlayer.persistentId === currentPlayer.persistentId;
    if (isMyTurn && !gameState.winner && !animationInProgress) {
        rollDiceBtn.disabled = false;
        mobileRollBtn.disabled = false;
    } else {
        rollDiceBtn.disabled = true;
        mobileRollBtn.disabled = true;
    }
    
    // Only redraw if no animation is in progress
    if (!animationInProgress && Object.keys(playerAnimations).length === 0) {
        drawBoard();
    }
}

function showNotification(message, type = 'info') {
    // Clear any existing timeout
    if (notification.timeout) {
        clearTimeout(notification.timeout);
    }
    
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    notification.timeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3500);
}

// Board drawing functions
function drawBoard() {
    if (!gameState) return;
    
    const boardSize = 10;
    const cellSize = canvasLogicalSize / boardSize;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasLogicalSize, canvasLogicalSize);
    
    // Draw cells
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const num = getCellNumber(row, col);
            const x = col * cellSize;
            const y = row * cellSize;
            
            // Alternating colors with gradient
            const isLight = (row + col) % 2 === 0;
            const gradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
            
            if (isLight) {
                gradient.addColorStop(0, '#334155');
                gradient.addColorStop(1, '#2d3748');
            } else {
                gradient.addColorStop(0, '#1e293b');
                gradient.addColorStop(1, '#1a202c');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, cellSize, cellSize);
            
            // Special highlight for cell 100
            if (num === 100) {
                const winGradient = ctx.createRadialGradient(
                    x + cellSize / 2, y + cellSize / 2, 0,
                    x + cellSize / 2, y + cellSize / 2, cellSize / 2
                );
                winGradient.addColorStop(0, 'rgba(240, 147, 251, 0.3)');
                winGradient.addColorStop(1, 'rgba(102, 126, 234, 0.1)');
                ctx.fillStyle = winGradient;
                ctx.fillRect(x, y, cellSize, cellSize);
            }
            
            // Draw cell border
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, cellSize, cellSize);
            
            // Draw cell number with better styling
            ctx.fillStyle = num === 100 ? '#f093fb' : '#cbd5e1';
            ctx.font = `bold ${cellSize * 0.25}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num, x + cellSize / 2, y + cellSize * 0.25);
            
            // Add star emoji for cell 100
            if (num === 100) {
                ctx.font = `${cellSize * 0.35}px Arial`;
                ctx.fillText('🏆', x + cellSize / 2, y + cellSize * 0.6);
            }
        }
    }
    
    // Draw snakes
    if (gameState.snakes) {
        drawSnakes(gameState.snakes);
    }
    
    // Draw ladders
    if (gameState.ladders) {
        drawLadders(gameState.ladders);
    }
    
    // Draw players
    gameState.players.forEach((player, index) => {
        if (player.position > 0) {
            drawPlayer(player, index);
        }
    });
}

function getCellNumber(row, col) {
    const boardSize = 10;
    const rowFromBottom = boardSize - 1 - row;
    
    if (rowFromBottom % 2 === 0) {
        return rowFromBottom * boardSize + col + 1;
    } else {
        return rowFromBottom * boardSize + (boardSize - col);
    }
}

function getPosition(num) {
    const boardSize = 10;
    const cellSize = canvasLogicalSize / boardSize;
    
    if (num <= 0) return { x: 0, y: canvasLogicalSize };
    if (num > 100) num = 100;
    
    const rowFromBottom = Math.floor((num - 1) / boardSize);
    const row = boardSize - 1 - rowFromBottom;
    
    let col;
    if (rowFromBottom % 2 === 0) {
        col = (num - 1) % boardSize;
    } else {
        col = boardSize - 1 - ((num - 1) % boardSize);
    }
    
    return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
    };
}

function drawSnakes(snakes) {
    const cellSize = canvasLogicalSize / 10;
    
    Object.entries(snakes).forEach(([from, to]) => {
        const fromPos = getPosition(parseInt(from));
        const toPos = getPosition(parseInt(to));
        
        // Calculate control point for curved path (Bezier curve)
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Create a control point offset perpendicular to the line for curve
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;
        const perpX = -dy / length;
        const perpY = dx / length;
        const curveAmount = length * 0.2; // How much the snake curves
        const controlX = midX + perpX * curveAmount;
        const controlY = midY + perpY * curveAmount;
        
        // Draw shadow for snake body
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        // Draw snake body with gradient (light green)
        const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y);
        gradient.addColorStop(0, '#86efac'); // Light green
        gradient.addColorStop(0.5, '#4ade80'); // Medium green
        gradient.addColorStop(1, '#22c55e'); // Darker green
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = cellSize * 0.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw curved snake body
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.quadraticCurveTo(controlX, controlY, toPos.x, toPos.y);
        ctx.stroke();
        
        // Draw pattern on snake body (darker green stripes)
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = cellSize * 0.18;
        ctx.setLineDash([cellSize * 0.15, cellSize * 0.15]);
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.quadraticCurveTo(controlX, controlY, toPos.x, toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Calculate angle at the start of the curve for head orientation
        const startDx = controlX - fromPos.x;
        const startDy = controlY - fromPos.y;
        const headAngle = Math.atan2(startDy, startDx) + Math.PI; // Flip 180 degrees
        
        // Draw snake head at the start (where you get eaten)
        ctx.save();
        ctx.translate(fromPos.x, fromPos.y);
        ctx.rotate(headAngle);
        
        // Shadow for head
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        const headWidth = cellSize * 0.25;
        const headHeight = cellSize * 0.2;
        
        // Draw head shape (oval)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(0, 0, headWidth, headHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw head outline
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Reset shadow for facial features
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw eyes (white with black pupils)
        const eyeOffsetX = headWidth * 0.3;
        const eyeOffsetY = headHeight * 0.4;
        const eyeRadius = headWidth * 0.15;
        
        // Left eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Left pupil
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Right eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Right pupil
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw forked tongue
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        const tongueLength = headWidth * 0.6;
        const tongueX = headWidth;
        
        // Main tongue
        ctx.beginPath();
        ctx.moveTo(headWidth * 0.8, 0);
        ctx.lineTo(tongueX + tongueLength * 0.7, 0);
        ctx.stroke();
        
        // Fork left
        ctx.beginPath();
        ctx.moveTo(tongueX + tongueLength * 0.7, 0);
        ctx.lineTo(tongueX + tongueLength, -tongueLength * 0.3);
        ctx.stroke();
        
        // Fork right
        ctx.beginPath();
        ctx.moveTo(tongueX + tongueLength * 0.7, 0);
        ctx.lineTo(tongueX + tongueLength, tongueLength * 0.3);
        ctx.stroke();
        
        ctx.restore();
        
        // Reset all styles
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineCap = 'butt';
    });
}

function drawLadders(ladders) {
    const cellSize = canvasLogicalSize / 10;
    
    Object.entries(ladders).forEach(([from, to]) => {
        const fromPos = getPosition(parseInt(from));
        const toPos = getPosition(parseInt(to));
        
        // Calculate ladder dimensions
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Ladder rail spacing (distance between the two side rails)
        const railWidth = cellSize * 0.15;
        
        // Calculate perpendicular offset for the two rails
        const perpX = Math.cos(angle + Math.PI / 2) * railWidth;
        const perpY = Math.sin(angle + Math.PI / 2) * railWidth;
        
        // Left rail positions
        const rail1Start = { x: fromPos.x - perpX, y: fromPos.y - perpY };
        const rail1End = { x: toPos.x - perpX, y: toPos.y - perpY };
        
        // Right rail positions
        const rail2Start = { x: fromPos.x + perpX, y: fromPos.y + perpY };
        const rail2End = { x: toPos.x + perpX, y: toPos.y + perpY };
        
        // Draw shadow for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(rail1Start.x + 2, rail1Start.y + 2);
        ctx.lineTo(rail1End.x + 2, rail1End.y + 2);
        ctx.moveTo(rail2Start.x + 2, rail2Start.y + 2);
        ctx.lineTo(rail2End.x + 2, rail2End.y + 2);
        ctx.stroke();
        
        // Draw ladder rails with gradient
        const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y);
        gradient.addColorStop(0, '#8b5a2b');
        gradient.addColorStop(1, '#6b4423');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        // Left rail
        ctx.beginPath();
        ctx.moveTo(rail1Start.x, rail1Start.y);
        ctx.lineTo(rail1End.x, rail1End.y);
        ctx.stroke();
        
        // Right rail
        ctx.beginPath();
        ctx.moveTo(rail2Start.x, rail2Start.y);
        ctx.lineTo(rail2End.x, rail2End.y);
        ctx.stroke();
        
        // Draw rungs
        const numRungs = Math.max(3, Math.floor(length / (cellSize * 0.4)));
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 4;
        
        for (let i = 1; i < numRungs; i++) {
            const t = i / numRungs;
            const rung1X = rail1Start.x + (rail1End.x - rail1Start.x) * t;
            const rung1Y = rail1Start.y + (rail1End.y - rail1Start.y) * t;
            const rung2X = rail2Start.x + (rail2End.x - rail2Start.x) * t;
            const rung2Y = rail2Start.y + (rail2End.y - rail2Start.y) * t;
            
            ctx.beginPath();
            ctx.moveTo(rung1X, rung1Y);
            ctx.lineTo(rung2X, rung2Y);
            ctx.stroke();
        }
        
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';
    });
}

function drawPlayer(player, index) {
    let pos;
    let isAnimating = false;
    
    // Check if player has an active animation
    const animation = playerAnimations[player.persistentId];
    if (animation && animation.locked) {
        // Player is locked in animation - use animated position
        isAnimating = true;
        const fromPos = getPosition(animation.from);
        const toPos = getPosition(animation.to);
        pos = {
            x: fromPos.x + (toPos.x - fromPos.x) * animation.progress,
            y: fromPos.y + (toPos.y - fromPos.y) * animation.progress
        };
    } else {
        // Use actual game state position
        pos = getPosition(player.position);
    }
    
    const cellSize = canvasLogicalSize / 10;
    let playerRadius = cellSize * 0.18;
    
    // Add bounce and scale effect during animation
    if (isAnimating) {
        const bounceHeight = Math.sin(animation.progress * Math.PI) * 15;
        pos.y -= bounceHeight;
        playerRadius *= 1 + Math.sin(animation.progress * Math.PI) * 0.15;
    }
    
    // Offset for multiple players on same cell
    const offset = (index - (gameState.players.length - 1) / 2) * (playerRadius * 1.2);
    const centerX = pos.x + offset;
    const centerY = pos.y + cellSize * 0.2;
    
    // Draw player shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    
    // Draw outer glow (enhanced during animation)
    const glowRadius = isAnimating ? playerRadius * 2.2 : playerRadius * 1.5;
    const glowGradient = ctx.createRadialGradient(
        centerX, centerY, playerRadius * 0.5,
        centerX, centerY, glowRadius
    );
    glowGradient.addColorStop(0, player.color);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player circle with gradient
    const playerGradient = ctx.createRadialGradient(
        centerX - playerRadius * 0.3, centerY - playerRadius * 0.3, 0,
        centerX, centerY, playerRadius
    );
    playerGradient.addColorStop(0, player.color + 'ff');
    playerGradient.addColorStop(1, player.color + 'cc');
    ctx.fillStyle = playerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, playerRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw player name initial
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${playerRadius * 1.1}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(player.name.charAt(0).toUpperCase(), centerX, centerY);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

// Resize canvas for mobile
function resizeCanvas() {
    const container = document.querySelector('.board-container');
    if (!container) return;
    
    // Wait for container to have proper dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth === 0 || containerHeight === 0) {
        // Container not ready, try again shortly
        setTimeout(resizeCanvas, 50);
        return;
    }
    
    // Use the smaller dimension to keep canvas square and fit in container
    // Use smaller padding buffer on mobile (4px) vs desktop (16px)
    const isMobile = window.innerWidth <= 768;
    const paddingBuffer = isMobile ? 8 : 32;
    const maxSize = Math.min(containerWidth - paddingBuffer, containerHeight - paddingBuffer, 800);
    canvasLogicalSize = maxSize;
    
    // Fix for high-DPI displays (mobile devices)
    const dpr = window.devicePixelRatio || 1;
    
    // Set display size (CSS pixels)
    canvas.style.width = maxSize + 'px';
    canvas.style.height = maxSize + 'px';
    
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = maxSize * dpr;
    canvas.height = maxSize * dpr;
    
    // Reset transform and scale all drawing operations by the dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    if (gameState && gameState.started) {
        drawBoard();
    }
}

window.addEventListener('resize', () => {
    resizeCanvas();
    // Reinitialize mobile UI on orientation change or resize
    if (gameScreen.classList.contains('active')) {
        initializeMobileUI();
    }
});
window.addEventListener('load', resizeCanvas);

// Initialize
// Initialize dice on page load
initializeDice();

// Check for existing session on page load
const existingSession = loadSession();
if (existingSession) {
    attemptReconnection();
} else {
    switchScreen('welcome');
}

// Handle connection events
socket.on('connect', () => {
    console.log('Connected to server');
    // Try to reconnect to previous session if exists
    if (!currentRoom && !isReconnecting) {
        attemptReconnection();
    }
});
