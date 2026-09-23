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
    UI.updateConnectionStatus('connecting', 'Connecting…');
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
            if (option.classList.contains('taken')) {
                UI.showNotification('This color is already taken in the room', 'warning');
                return;
            }
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
            if (option.classList.contains('taken')) {
                UI.showNotification('This icon is already taken in the room', 'warning');
                return;
            }
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

        Customization.tryJoinWithConflictCheck({
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

        Customization.tryJoinWithConflictCheck({
            type: 'join-room',
            roomId: roomCode,
            playerName: name
        });
    });

    // Conflict modal buttons
    DOM.keepCustomizationBtn.addEventListener('click', () => {
        DOM.conflictModal.classList.remove('active');
        if (GameState.pendingJoinAction) {
            const taken = GameState.lastRoomPeek?.takenCustomizations || { colors: [], icons: [] };
            if (taken.colors.includes(GameState.selectedColor)) {
                [...DOM.colorOptions].find(option => !taken.colors.includes(option.dataset.color))?.click();
            }
            if (taken.icons.includes(GameState.selectedIcon)) {
                [...DOM.iconOptions].find(option => !taken.icons.includes(option.dataset.icon))?.click();
            }
            Customization.executeJoinAction(GameState.pendingJoinAction);
            GameState.pendingJoinAction = null;
        }
    });

    DOM.changeCustomizationBtn.addEventListener('click', () => {
        DOM.conflictModal.classList.remove('active');
        GameState.pendingJoinAction = null;
        const scrollTarget = DOM.stepColor || DOM.setupScreen;
        if (scrollTarget) {
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
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

        GameState.send('discover-games');
        UI.showNotification('Searching for local games...', 'info');

        setTimeout(() => {
            DOM.refreshGamesBtn.disabled = false;
            DOM.refreshGamesBtn.querySelector('.refresh-icon').textContent = '🔄';
        }, 5000);
    });

    // Lobby buttons
    DOM.copyRoomCodeBtn.addEventListener('click', async () => {
        const roomCode = DOM.roomCodeDisplay.textContent;
        const ok = await Utils.copyToClipboard(roomCode);
        UI.showNotification(ok ? 'Room code copied!' : 'Could not copy room code', ok ? 'success' : 'error');
    });

    if (DOM.copyInviteLinkBtn) {
        DOM.copyInviteLinkBtn.addEventListener('click', async () => {
            if (!GameState.currentRoom) return;
            const url = Utils.getInviteUrl(GameState.currentRoom);
            const ok = await Utils.copyToClipboard(url);
            UI.showNotification(ok ? 'Invite link copied!' : 'Could not copy link', ok ? 'success' : 'error');
        });
    }

    const toggleSoundMute = () => {
        AudioSystem.toggleMuted();
        UI.updateMuteButtonLabels();
        UI.showNotification(GameState.soundMuted ? 'Sound muted' : 'Sound enabled', 'info');
    };

    if (DOM.muteSoundBtn) {
        DOM.muteSoundBtn.addEventListener('click', toggleSoundMute);
    }
    if (DOM.mobileMuteBtn) {
        DOM.mobileMuteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSoundMute();
            UI.closeMobileSettingsMenu();
        });
    }

    UI.updateMuteButtonLabels();

    DOM.roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
        const code = e.target.value.trim();
        GameState.lastRoomPeek = null;
        UI.updateTakenCustomizations({ colors: [], icons: [] });
        if (code.length === 6) {
            GameState.send('peek-room', { roomId: code });
        }
    });

    DOM.readyBtn.addEventListener('click', () => {
        GameState.send('toggle-ready', { roomId: GameState.currentRoom });
    });

    DOM.startGameBtn.addEventListener('click', () => {
        GameState.send('start-game', { roomId: GameState.currentRoom });
    });

    // Game buttons
    DOM.rollDiceBtn.addEventListener('click', () => {
        if (GameState.gameState && GameState.currentPlayer && !GameState.animationInProgress && !GameState.turnResolutionInProgress) {
            const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
            const isMyTurn = currentTurnPlayer?.persistentId === GameState.currentPlayer.persistentId;
            if (isMyTurn && !DOM.rollDiceBtn.disabled) {
                DOM.rollDiceBtn.disabled = true;
                DOM.mobileRollBtn.disabled = true;
                GameState.turnResolutionInProgress = true;
                GameState.send('roll-dice', { roomId: GameState.currentRoom });
            }
        }
    });

    DOM.mobileRollBtn.addEventListener('click', () => {
        if (GameState.gameState && GameState.currentPlayer && !GameState.animationInProgress && !GameState.turnResolutionInProgress) {
            const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
            const isMyTurn = currentTurnPlayer.persistentId === GameState.currentPlayer.persistentId;
            if (isMyTurn && !DOM.mobileRollBtn.disabled) {
                DOM.mobileRollBtn.disabled = true;
                DOM.rollDiceBtn.disabled = true;
                GameState.turnResolutionInProgress = true;
                GameState.send('roll-dice', { roomId: GameState.currentRoom });
            }
        }
    });

    DOM.resetGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the game?')) {
            GameState.send('reset-game', { roomId: GameState.currentRoom });
        }
    });

    DOM.testExplosionBtn.addEventListener('click', () => {
        if (!GameState.currentRoom) return;
        GameState.send('trigger-test-explosion', { roomId: GameState.currentRoom });
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
        DOM.setControlBtn.disabled = false;
    });

    DOM.setControlBtn.addEventListener('click', () => {
        const selectedTarget = DOM.targetPlayerOptions.querySelector('.target-player-option.selected');
        const targetPlayerId = selectedTarget?.dataset.playerId;
        if (!targetPlayerId) {
            UI.showNotification('Please select a target player', 'error');
            return;
        }

        const diceValues = [];
        const diceOptionGroups = DOM.diceValueControls.querySelectorAll('.dice-value-options');

        for (const group of diceOptionGroups) {
            const selectedOption = group.querySelector('.dice-value-option.selected');
            const value = parseInt(selectedOption?.dataset.value, 10);
            if (isNaN(value) || value < 1 || value > 6) {
                UI.showNotification('Dice values must be between 1 and 6', 'error');
                return;
            }
            diceValues.push(value);
        }

        GameState.send('set-controlled-dice', {
            roomId: GameState.currentRoom,
            targetPlayerId: targetPlayerId,
            diceValues: diceValues
        });

        DOM.diceControlModal.classList.remove('active');
        DOM.setControlBtn.disabled = false;
    });

    // Camera button
    DOM.mobileCameraBtn.addEventListener('click', () => {
        const isMobile = Utils.isMobileLayout();

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

    // Mobile settings (⋮ menu)
    if (DOM.mobileSettingsBtn) {
        DOM.mobileSettingsBtn.addEventListener('click', (e) => UI.toggleMobileSettingsMenu(e));
        DOM.mobileSettingsBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                UI.toggleMobileSettingsMenu(e);
            }
        });
    }

    window.addEventListener('resize', () => {
        if (GameState.isMobileMenuOpen) {
            UI.positionMobileSettingsMenu();
        }
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (GameState.isMobileMenuOpen) {
                UI.positionMobileSettingsMenu();
            }
        });
    }

    DOM.mobileResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to reset the game?')) {
            GameState.send('reset-game', { roomId: GameState.currentRoom });
            UI.closeMobileSettingsMenu();
        }
    });

    DOM.mobileTestExplosionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!GameState.currentRoom) return;
        GameState.send('trigger-test-explosion', { roomId: GameState.currentRoom });
        UI.closeMobileSettingsMenu();
    });

    DOM.mobileLeaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.send('manual-disconnect', { roomId: GameState.currentRoom });
            UI.closeMobileSettingsMenu();
        }
    });

    // Disconnect buttons
    DOM.leaveLobbyBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.send('manual-disconnect', { roomId: GameState.currentRoom });
        }
    });

    DOM.leaveGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            GameState.send('manual-disconnect', { roomId: GameState.currentRoom });
        }
    });

    // Winner modal buttons
    DOM.playAgainBtn.addEventListener('click', () => {
        GameState.totalRolls = 0;
        GameState.playerRollCounts = {};
        GameState.send('reset-game', { roomId: GameState.currentRoom });
        DOM.winnerModal.classList.remove('active');
    });

    DOM.newGameBtn.addEventListener('click', () => {
        GameState.totalRolls = 0;
        GameState.playerRollCounts = {};
        if (GameState.currentRoom) {
            GameState.send('manual-disconnect', { roomId: GameState.currentRoom });
        }
        DOM.winnerModal.classList.remove('active');
    });

    // Window / viewport resize (pinch-zoom and orientation need visualViewport)
    const scheduleCanvasResize = () => {
        if (Renderer._resizeCanvasRaf) {
            cancelAnimationFrame(Renderer._resizeCanvasRaf);
        }
        Renderer._resizeCanvasRaf = requestAnimationFrame(() => {
            Renderer._resizeCanvasRaf = null;
            Renderer.resizeCanvas();
        });
    };

    const syncMobileGameLayout = () => {
        Utils.syncGameLayoutMode();
        scheduleCanvasResize();
    };

    window.addEventListener('resize', syncMobileGameLayout);
    window.addEventListener('orientationchange', () => {
        setTimeout(syncMobileGameLayout, 150);
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncMobileGameLayout);
    }

    if (typeof ResizeObserver !== 'undefined') {
        const gameLayoutObserver = new ResizeObserver(() => {
            if (!DOM.gameScreen.classList.contains('active')) return;
            scheduleCanvasResize();
        });

        const gameContainer = document.querySelector('.game-container');
        const boardContainer = document.querySelector('.board-container');
        const mobileBottomPanel = document.querySelector('.mobile-bottom-panel');

        if (gameContainer) gameLayoutObserver.observe(gameContainer);
        if (boardContainer) gameLayoutObserver.observe(boardContainer);
        if (DOM.mobileTopBar) gameLayoutObserver.observe(DOM.mobileTopBar);
        if (mobileBottomPanel) gameLayoutObserver.observe(mobileBottomPanel);
    }

    window.addEventListener('load', () => {
        Utils.syncGameLayoutMode();
        Renderer.resizeCanvas();
    });

    if (typeof window.matchMedia === 'function') {
        const mobileLayoutMq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
        const onMobileLayoutChange = () => syncMobileGameLayout();
        if (mobileLayoutMq.addEventListener) {
            mobileLayoutMq.addEventListener('change', onMobileLayoutChange);
        } else if (mobileLayoutMq.addListener) {
            mobileLayoutMq.addListener(onMobileLayoutChange);
        }
    }

    // Initialize UI
    UI.updatePlayerPreview();
    Discovery.updateLocalGamesList();
    Discovery.startAutoDiscovery();

    // Connection and saved-session restoration happen once, on each socket connect.
    UI.switchScreen('welcome');

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
        toggle.setAttribute('role', 'button');
        toggle.tabIndex = 0;
        toggle.setAttribute('aria-expanded', String(!content.classList.contains('collapsed')));
        toggle.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle.click();
            }
        });
        
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
            toggle.setAttribute('aria-expanded', String(!content.classList.contains('collapsed')));
        });
    });
}
