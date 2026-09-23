// Game state management
const GameState = {
    // Connection state
    socket: null,
    currentRoom: null,
    currentPlayer: null,
    reconnectToken: null,
    reconnectSuppressed: false,
    gameState: null,
    isReconnecting: false,
    isHost: false,
    connectionStatus: 'connecting',
    soundMuted: (() => { try { return localStorage.getItem('snakesSoundMuted') === 'true'; } catch { return false; } })(),
    lastRoomPeek: null,
    
    // Animation state
    animationInProgress: false,
    turnResolutionInProgress: false,
    pendingTurnAnimationCompletion: null,
    playerAnimations: {},
    diceAnimationInProgress: false,
    explosionAnimations: [],
    pendingMinePosition: null,
    
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
    selectedIcon: '🎯',
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
    send(event, data) {
        if (!this.socket?.connected || this.isReconnecting) {
            UI.showNotification('Wait for the connection to return before playing.', 'info');
            return false;
        }
        this.socket.emit(event, data);
        return true;
    },

    saveSession() {
        if (this.currentRoom && this.currentPlayer) {
            const session = {
                roomId: this.currentRoom,
                persistentId: this.currentPlayer.persistentId,
                reconnectToken: this.reconnectToken,
                playerName: this.currentPlayer.name
            };
            try { localStorage.setItem('snakesAndLaddersSession', JSON.stringify(session)); } catch { /* Storage may be disabled. */ }
        }
    },
    
    loadSession() {
        try {
            const session = JSON.parse(localStorage.getItem('snakesAndLaddersSession'));
            if (session && typeof session.roomId === 'string' && typeof session.persistentId === 'string' && typeof session.reconnectToken === 'string') return session;
        } catch { /* Ignore unavailable storage and old/corrupt sessions. */ }
        return null;
    },
    
    clearSession() {
        try { localStorage.removeItem('snakesAndLaddersSession'); } catch { /* Storage may be disabled. */ }
    }
};
