// Game state management
const GameState = {
    // Connection state
    socket: null,
    currentRoom: null,
    currentPlayer: null,
    gameState: null,
    isReconnecting: false,
    
    // Animation state
    animationInProgress: false,
    playerAnimations: {},
    diceAnimationInProgress: false,
    explosionAnimations: [],
    
    // Game statistics
    totalRolls: 0,
    playerRollCounts: {},
    
    // UI state
    currentMode: null,
    joinSteps: {
        name: false,
        color: false,
        icon: false
    },
    autoOpenedSections: {
        color: false,
        icon: false
    },
    
    // Player customization
    selectedColor: '#FF6B6B',
    selectedIcon: '🎮',
    pendingJoinAction: null,
    selectedDiceCount: 1,
    selectedSnakeThreshold: 3,
    minesEnabled: false,
    minesCount: 5,
    ladderMinesOnly: false,
    randomizeSnakesLadders: false,
    requireSixToStart: false,
    exactRollToWin: false,
    
    // Discovery state
    discoveredGames: new Map(),
    lastDiscoveryTime: 0,
    autoDiscoveryInterval: null,
    
    // Mobile menu state
    isMobileMenuOpen: false,
    
    // Canvas state
    canvasLogicalSize: 800,
    currentDiceCount: 1,
    
    // Session management
    saveSession() {
        if (this.currentRoom && this.currentPlayer) {
            const session = {
                roomId: this.currentRoom,
                persistentId: this.currentPlayer.persistentId,
                playerName: this.currentPlayer.name
            };
            localStorage.setItem('snakesAndLaddersSession', JSON.stringify(session));
        }
    },
    
    loadSession() {
        const sessionData = localStorage.getItem('snakesAndLaddersSession');
        if (sessionData) {
            try {
                return JSON.parse(sessionData);
            } catch (e) {
                return null;
            }
        }
        return null;
    },
    
    clearSession() {
        localStorage.removeItem('snakesAndLaddersSession');
    }
};
