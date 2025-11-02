// DOM elements and references
const DOM = {
    // Screens
    welcomeScreen: document.getElementById('welcome-screen'),
    lobbyScreen: document.getElementById('lobby-screen'),
    gameScreen: document.getElementById('game-screen'),
    winnerModal: document.getElementById('winner-modal'),
    
    // Welcome screen
    choiceScreen: document.getElementById('choice-screen'),
    setupScreen: document.getElementById('setup-screen'),
    choiceCreateBtn: document.getElementById('choice-create-btn'),
    choiceJoinBtn: document.getElementById('choice-join-btn'),
    backToChoiceBtn: document.getElementById('back-to-choice-btn'),
    setupSubtitle: document.getElementById('setup-subtitle'),
    gameOptionsSection: document.getElementById('game-options-section'),
    
    // Player setup
    playerNameInput: document.getElementById('player-name'),
    createRoomBtn: document.getElementById('create-room-btn'),
    roomCodeInput: document.getElementById('room-code'),
    joinSubmitBtn: document.getElementById('join-submit-btn'),
    joinConfirmBtn: document.getElementById('join-confirm-btn'),
    joinConnectionSection: document.getElementById('join-connection-section'),
    
    // Join steps
    stepName: document.getElementById('step-name'),
    stepColor: document.getElementById('step-color'),
    stepIcon: document.getElementById('step-icon'),
    
    // Discovery
    enableDiscoveryCheckbox: document.getElementById('enable-discovery'),
    localGamesSection: document.getElementById('local-games-section'),
    localGamesList: document.getElementById('local-games-list'),
    refreshGamesBtn: document.getElementById('refresh-games-btn'),
    
    // Customization
    colorOptions: document.querySelectorAll('.color-option'),
    iconOptions: document.querySelectorAll('.icon-option'),
    previewPlayer: document.getElementById('preview-player'),
    previewIcon: document.getElementById('preview-icon'),
    conflictModal: document.getElementById('conflict-modal'),
    conflictMessage: document.getElementById('conflict-message'),
    keepCustomizationBtn: document.getElementById('keep-customization-btn'),
    changeCustomizationBtn: document.getElementById('change-customization-btn'),
    
    // Dice control
    diceControlModal: document.getElementById('dice-control-modal'),
    diceControlPowerBtn: document.getElementById('dice-control-power-btn'),
    targetPlayerSelect: document.getElementById('target-player-select'),
    diceValueControls: document.getElementById('dice-value-controls'),
    setControlBtn: document.getElementById('set-control-btn'),
    cancelControlBtn: document.getElementById('cancel-control-btn'),
    
    // Lobby
    roomCodeDisplay: document.getElementById('room-code-display'),
    copyRoomCodeBtn: document.getElementById('copy-room-code'),
    playersList: document.getElementById('players-list'),
    readyBtn: document.getElementById('ready-btn'),
    startGameBtn: document.getElementById('start-game-btn'),
    leaveLobbyBtn: document.getElementById('leave-lobby-btn'),
    
    // Game
    currentTurnDisplay: document.getElementById('current-turn-display'),
    lastRollDisplay: document.getElementById('last-roll-display'),
    scoreboardList: document.getElementById('scoreboard-list'),
    rollDiceBtn: document.getElementById('roll-dice-btn'),
    resetGameBtn: document.getElementById('reset-game-btn'),
    leaveGameBtn: document.getElementById('leave-game-btn'),
    canvas: document.getElementById('game-board'),
    ctx: document.getElementById('game-board').getContext('2d'),
    
    // Mobile
    mobileTopBar: document.getElementById('mobile-top-bar'),
    mobileCurrentTurn: document.getElementById('mobile-current-turn'),
    mobileLastRoll: document.getElementById('mobile-last-roll'),
    mobileScoreboardList: document.getElementById('mobile-scoreboard-list'),
    mobileRollBtn: document.getElementById('mobile-roll-btn'),
    mobilePowerBtn: document.getElementById('mobile-power-btn'),
    gameSidebar: document.getElementById('game-sidebar'),
    mobileSettingsBtn: document.getElementById('mobile-settings-btn'),
    mobileSettingsMenu: document.getElementById('mobile-settings-menu'),
    mobileResetBtn: document.getElementById('mobile-reset-btn'),
    mobileLeaveBtn: document.getElementById('mobile-leave-btn'),
    mobileCameraBtn: document.getElementById('mobile-camera-btn'),
    
    // Winner modal
    winnerName: document.getElementById('winner-name'),
    winnerRolls: document.getElementById('winner-rolls'),
    playAgainBtn: document.getElementById('play-again-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    
    // Notification
    notification: document.getElementById('notification'),
    
    // Dice animation
    diceContainer: document.getElementById('dice-container'),
    diceElement: document.getElementById('dice'),
    diceBackdrop: document.getElementById('dice-backdrop')
};
