// Main initialization and event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize collapsible sections
    initializeCollapsibleSections();
    
    // Initialize audio context on first user interaction
    const initAudioOnInteraction = () => {
        AudioSystem.init();
        document.removeEventListener('click', initAudioOnInteraction);
        document.removeEventListener('touchstart', initAudioOnInteraction);
    };
    
    document.addEventListener('click', initAudioOnInteraction);
    document.addEventListener('touchstart', initAudioOnInteraction);

    // Initialize socket handlers
    const socket = io();
    SocketHandlers.init(socket);

    // Choice screen event listeners
    DOM.choiceCreateBtn.addEventListener('click', () => {
        GameState.currentMode = 'create';
        UI.showSetupScreen('create');
    });

    DOM.choiceJoinBtn.addEventListener('click', () => {
        GameState.currentMode = 'join';
        UI.showSetupScreen('join');
    });

    DOM.backToChoiceBtn.addEventListener('click', () => {
        UI.showChoiceScreen();
    });

    // Player name input
    DOM.playerNameInput.addEventListener('input', (e) => {
        const previewNameEl = document.getElementById('preview-name');
        if (previewNameEl) {
            previewNameEl.textContent = e.target.value.trim() || 'Player';
        }
        Customization.checkJoinProgress();
    });

    // Color selection
    DOM.colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.color-option.selected').forEach(el => {
                el.classList.remove('selected');
            });
            option.classList.add('selected');
            GameState.selectedColor = option.dataset.color;
            UI.updatePlayerPreview();
            Customization.onColorSelected();
        });
    });

    // Icon selection
    DOM.iconOptions.forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.icon-option.selected').forEach(el => {
                el.classList.remove('selected');
            });
            option.classList.add('selected');
            GameState.selectedIcon = option.dataset.icon;
            UI.updatePlayerPreview();
            Customization.onIconSelected();
        });
    });

    // Create room button
    DOM.createRoomBtn.addEventListener('click', () => {
        const name = DOM.playerNameInput.value.trim();
        if (!name) {
            UI.showNotification('Please enter your name', 'error');
            return;
        }

        if (GameState.gameState && GameState.gameState.players) {
            const conflicts = Customization.checkForConflicts(GameState.gameState.players);
            if (conflicts.length > 0) {
                GameState.pendingJoinAction = {
                    type: 'create-room',
                    playerName: name
                };
                Customization.showConflictModal(conflicts);
                return;
            }
        }

        Customization.executeJoinAction({
            type: 'create-room',
            playerName: name
        });
    });

    // Join room buttons
    DOM.joinConfirmBtn.addEventListener('click', () => {
        if (!DOM.playerNameInput.value.trim()) {
            UI.showNotification('Please enter your name', 'error');
            return;
        }
        
        DOM.setupSubtitle.textContent = 'Choose How to Join';
        DOM.joinConnectionSection.style.display = 'block';
        DOM.joinConfirmBtn.style.display = 'none';
        
        setTimeout(() => {
            DOM.joinConnectionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    });

    DOM.joinSubmitBtn.addEventListener('click', () => {
        const name = DOM.playerNameInput.value.trim();
        const roomCode = DOM.roomCodeInput.value.trim().toUpperCase();

        if (!name) {
            UI.showNotification('Please enter your name', 'error');
            return;
        }

        if (!roomCode) {
            UI.showNotification('Please enter room code', 'error');
            return;
        }

        if (GameState.gameState && GameState.gameState.players) {
            const conflicts = Customization.checkForConflicts(GameState.gameState.players);
            if (conflicts.length > 0) {
                GameState.pendingJoinAction = {
                    type: 'join-room',
                    roomId: roomCode,
                    playerName: name
                };
                Customization.showConflictModal(conflicts);
                return;
            }
        }

        Customization.executeJoinAction({
            type: 'join-room',
            roomId: roomCode,
            playerName: name
        });
    });

    DOM.roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Conflict modal buttons
    DOM.keepCustomizationBtn.addEventListener('click', () => {
        DOM.conflictModal.classList.remove('active');
        if (GameState.pendingJoinAction) {
            Customization.executeJoinAction(GameState.pendingJoinAction);
            GameState.pendingJoinAction = null;
        }
    });

    DOM.changeCustomizationBtn.addEventListener('click', () => {
        DOM.conflictModal.classList.remove('active');
        GameState.pendingJoinAction = null;
        document.querySelector('.player-customization').scrollIntoView({ behavior: 'smooth' });
    });

    // Game options
    document.querySelectorAll('input[name="dice-count"]').forEach(option => {
        option.addEventListener('change', (e) => {
            GameState.selectedDiceCount = parseInt(e.target.value);
        });
    });

    document.querySelectorAll('input[name="snake-threshold"]').forEach(option => {
        option.addEventListener('change', (e) => {
            GameState.selectedSnakeThreshold = parseInt(e.target.value);
        });
    });

    const enableMinesCheckbox = document.getElementById('enable-mines');
    const minesConfig = document.getElementById('mines-config');
    const minesCountSlider = document.getElementById('mines-count');
    const minesCountValue = document.getElementById('mines-count-value');
    const ladderMinesOnlyCheckbox = document.getElementById('ladder-mines-only');
    const ladderMinesHint = document.querySelector('.ladder-mines-hint');

    enableMinesCheckbox.addEventListener('change', (e) => {
        GameState.minesEnabled = e.target.checked;
        minesConfig.style.display = GameState.minesEnabled ? 'block' : 'none';
    });

    minesCountSlider.addEventListener('input', (e) => {
        GameState.minesCount = parseInt(e.target.value);
        minesCountValue.textContent = GameState.minesCount;
    });

    ladderMinesOnlyCheckbox.addEventListener('change', (e) => {
        GameState.ladderMinesOnly = e.target.checked;
        if (ladderMinesHint) {
            ladderMinesHint.style.display = GameState.ladderMinesOnly ? 'block' : 'none';
        }
    });

    const enableRandomizationCheckbox = document.getElementById('enable-randomization');
    const randomizationConfig = document.getElementById('randomization-config');

    enableRandomizationCheckbox.addEventListener('change', (e) => {
        GameState.randomizeSnakesLadders = e.target.checked;
        randomizationConfig.style.display = GameState.randomizeSnakesLadders ? 'block' : 'none';
    });

    const requireSixToStartCheckbox = document.getElementById('require-six-to-start');
    const exactRollToWinCheckbox = document.getElementById('exact-roll-to-win');

    requireSixToStartCheckbox.addEventListener('change', (e) => {
        GameState.requireSixToStart = e.target.checked;
    });

    exactRollToWinCheckbox.addEventListener('change', (e) => {
        GameState.exactRollToWin = e.target.checked;
    });

    // Discovery
    DOM.refreshGamesBtn.addEventListener('click', () => {
        DOM.refreshGamesBtn.disabled = true;
        DOM.refreshGamesBtn.querySelector('.refresh-icon').textContent = '⏳';
        GameState.discoveredGames.clear();
        Discovery.updateLocalGamesList();

        GameState.socket.emit('discover-games');
        UI.showNotification('Searching for local games...', 'info');

        setTimeout(() => {
            DOM.refreshGamesBtn.disabled = false;
            DOM.refreshGamesBtn.querySelector('.refresh-icon').textContent = '🔄';
        }, 5000);
    });

    // Lobby buttons
    DOM.copyRoomCodeBtn.addEventListener('click', () => {
        const roomCode = DOM.roomCodeDisplay.textContent;
        navigator.clipboard.writeText(roomCode).then(() => {
            UI.showNotification('Room code copied!', 'success');
        });
    });

    DOM.readyBtn.addEventListener('click', () => {
        GameState.socket.emit('toggle-ready', { roomId: GameState.currentRoom });
    });

    DOM.startGameBtn.addEventListener('click', () => {
        GameState.socket.emit('start-game', { roomId: GameState.currentRoom });
    });

    // Game buttons
    DOM.rollDiceBtn.addEventListener('click', () => {
        if (GameState.gameState && GameState.currentPlayer && !GameState.animationInProgress) {
            const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
            const isMyTurn = currentTurnPlayer.persistentId === GameState.currentPlayer.persistentId;
            if (isMyTurn && !DOM.rollDiceBtn.disabled) {
                DOM.rollDiceBtn.disabled = true;
                DOM.mobileRollBtn.disabled = true;
                GameState.socket.emit('roll-dice', { roomId: GameState.currentRoom });
            }
        }
    });

    DOM.mobileRollBtn.addEventListener('click', () => {
        if (GameState.gameState && GameState.currentPlayer && !GameState.animationInProgress) {
            const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
            const isMyTurn = currentTurnPlayer.persistentId === GameState.currentPlayer.persistentId;
            if (isMyTurn && !DOM.mobileRollBtn.disabled) {
                DOM.mobileRollBtn.disabled = true;
                DOM.rollDiceBtn.disabled = true;
                GameState.socket.emit('roll-dice', { roomId: GameState.currentRoom });
            }
        }
    });

    DOM.resetGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the game?')) {
            GameState.socket.emit('reset-game', { roomId: GameState.currentRoom });
        }
    });

    // Dice control
    DOM.diceControlPowerBtn.addEventListener('click', () => {
        UI.openDiceControlModal();
    });

    DOM.mobilePowerBtn.addEventListener('click', () => {
        UI.openDiceControlModal();
    });

    DOM.cancelControlBtn.addEventListener('click', () => {
        DOM.diceControlModal.classList.remove('active');
    });

    DOM.setControlBtn.addEventListener('click', () => {
        const targetPlayerId = DOM.targetPlayerSelect.value;
        if (!targetPlayerId) {
            UI.showNotification('Please select a target player', 'error');
            return;
        }

        const diceValues = [];
        const diceInputs = DOM.diceValueControls.querySelectorAll('input');
        
        for (const input of diceInputs) {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 1 || value > 6) {
                UI.showNotification('Dice values must be between 1 and 6', 'error');
                return;
            }
            diceValues.push(value);
        }

        GameState.socket.emit('set-controlled-dice', {
            roomId: GameState.currentRoom,
            targetPlayerId: targetPlayerId,
            diceValues: diceValues
        });

        DOM.diceControlModal.classList.remove('active');
    });

    // Camera button
    DOM.mobileCameraBtn.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;

        if (!isMobile) {
            UI.showNotification('Camera zoom is only available on mobile devices!', 'warning');
            return;
        }

        if (!GameState.gameState || !GameState.gameState.players || GameState.gameState.players.length === 0) {
            UI.showNotification('No players in game!', 'warning');
            return;
        }

        Camera.enabled = !Camera.enabled;

        if (Camera.enabled) {
            Camera.updateTarget();
            Renderer.startRenderLoop();
            DOM.mobileCameraBtn.classList.add('active');
            Camera.updateButtonIcon();
            UI.showNotification(`Dynamic camera enabled - Auto-zoom to keep all players in view!`, 'success');
        } else {
            Camera.reset();
            Renderer.stopRenderLoop();
            DOM.mobileCameraBtn.classList.remove('active');
            Camera.updateButtonIcon();
            UI.showNotification('Camera disabled - Reset view', 'info');
        }

        if (GameState.gameState && GameState.gameState.started) {
            Renderer.drawBoard();
        }
    });

    // Mobile settings
    DOM.mobileSettingsBtn.addEventListener('click', () => {
        GameState.isMobileMenuOpen = !GameState.isMobileMenuOpen;
        if (GameState.isMobileMenuOpen) {
            DOM.mobileSettingsMenu.classList.add('open');
            setTimeout(() => {
                document.addEventListener('click', closeMobileMenu);
            }, 100);
        } else {
            DOM.mobileSettingsMenu.classList.remove('open');
            document.removeEventListener('click', closeMobileMenu);
        }
    });

    function closeMobileMenu(event) {
        if (!DOM.mobileSettingsBtn.contains(event.target) && !DOM.mobileSettingsMenu.contains(event.target)) {
            GameState.isMobileMenuOpen = false;
            DOM.mobileSettingsMenu.classList.remove('open');
            document.removeEventListener('click', closeMobileMenu);
        }
    }

    DOM.mobileResetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the game?')) {
            GameState.socket.emit('reset-game', { roomId: GameState.currentRoom });
            DOM.mobileSettingsMenu.classList.remove('open');
            GameState.isMobileMenuOpen = false;
            document.removeEventListener('click', closeMobileMenu);
        }
    });

    DOM.mobileLeaveBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.socket.emit('manual-disconnect', { roomId: GameState.currentRoom });
            DOM.mobileSettingsMenu.classList.remove('open');
            GameState.isMobileMenuOpen = false;
            document.removeEventListener('click', closeMobileMenu);
        }
    });

    // Disconnect buttons
    DOM.leaveLobbyBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.socket.emit('manual-disconnect', { roomId: GameState.currentRoom });
        }
    });

    DOM.leaveGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.socket.emit('manual-disconnect', { roomId: GameState.currentRoom });
        }
    });

    // Winner modal buttons
    DOM.playAgainBtn.addEventListener('click', () => {
        GameState.totalRolls = 0;
        GameState.playerRollCounts = {};
        GameState.socket.emit('reset-game', { roomId: GameState.currentRoom });
        DOM.winnerModal.classList.remove('active');
    });

    DOM.newGameBtn.addEventListener('click', () => {
        GameState.totalRolls = 0;
        GameState.playerRollCounts = {};
        if (GameState.currentRoom) {
            GameState.socket.emit('manual-disconnect', { roomId: GameState.currentRoom });
        }
        DOM.winnerModal.classList.remove('active');
    });

    // Window events
    window.addEventListener('resize', () => {
        Renderer.resizeCanvas();

        const isMobile = window.innerWidth <= 768;
        const isGameActive = DOM.gameScreen.classList.contains('active');

        if (isMobile && isGameActive) {
            document.body.classList.add('game-active-mobile');
        } else {
            document.body.classList.remove('game-active-mobile');
        }
    });

    window.addEventListener('load', () => {
        Renderer.resizeCanvas();
    });

    // Initialize UI
    UI.updatePlayerPreview();
    Discovery.updateLocalGamesList();
    Discovery.startAutoDiscovery();

    // Check for auto-join parameters
    const urlParams = Utils.getUrlParameters();
    if (urlParams.autoJoin && urlParams.room && urlParams.name) {
        DOM.playerNameInput.value = urlParams.name;

        if (urlParams.color) {
            GameState.selectedColor = urlParams.color;
            document.querySelectorAll('.color-option.selected').forEach(el => {
                el.classList.remove('selected');
            });
            const colorOption = document.querySelector(`.color-option[data-color="${urlParams.color}"]`);
            if (colorOption) {
                colorOption.classList.add('selected');
            }
        }

        if (urlParams.icon) {
            GameState.selectedIcon = urlParams.icon;
            document.querySelectorAll('.icon-option.selected').forEach(el => {
                el.classList.remove('selected');
            });
            const iconOption = document.querySelector(`.icon-option[data-icon="${urlParams.icon}"]`);
            if (iconOption) {
                iconOption.classList.add('selected');
            }
        }

        UI.updatePlayerPreview();

        let autoJoinHandled = false;
        socket.on('connect', () => {
            if (!autoJoinHandled) {
                autoJoinHandled = true;
                setTimeout(() => {
                    UI.showNotification(`Auto-joining room ${urlParams.room}...`, 'info');
                    socket.emit('join-room', {
                        roomId: urlParams.room,
                        playerName: urlParams.name,
                        playerColor: GameState.selectedColor,
                        playerIcon: GameState.selectedIcon
                    });
                }, 500);
            }
        });
    } else {
        setTimeout(() => {
            if (DOM.welcomeScreen.classList.contains('active')) {
                DOM.refreshGamesBtn.click();
            }
        }, 2000);
    }

    // Check for existing session
    const existingSession = GameState.loadSession();
    if (existingSession) {
        GameState.isReconnecting = true;
        UI.showNotification('Reconnecting to game...', 'info');
        socket.emit('reconnect-to-room', {
            roomId: existingSession.roomId,
            persistentId: existingSession.persistentId
        });
    } else {
        UI.switchScreen('welcome');
    }
});

// Collapsible sections helper
function initializeCollapsibleSections() {
    const sectionToggles = document.querySelectorAll('.section-header-toggle');
    const isMobile = window.innerWidth <= 768;
    
    sectionToggles.forEach(toggle => {
        const content = toggle.nextElementSibling;
        
        if (isMobile) {
            toggle.classList.add('collapsed');
            content.classList.add('collapsed');
        }
        
        toggle.addEventListener('click', () => {
            if (GameState.currentMode === 'join') {
                const section = toggle.getAttribute('data-section');
                if (section === 'color' && GameState.autoOpenedSections.color && !content.classList.contains('collapsed')) {
                    GameState.autoOpenedSections.color = false;
                    return;
                }
                if (section === 'icon' && GameState.autoOpenedSections.icon && !content.classList.contains('collapsed')) {
                    GameState.autoOpenedSections.icon = false;
                    return;
                }
            }
            
            toggle.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    });
}
