// UI management and interactions
const UI = {
    showNotification(message, type = 'info') {
        if (DOM.notification.timeout) {
            clearTimeout(DOM.notification.timeout);
        }

        DOM.notification.textContent = message;
        DOM.notification.className = `notification ${type} show`;

        DOM.notification.timeout = setTimeout(() => {
            DOM.notification.classList.remove('show');
        }, 3500);
    },

    renderTurnMarkup(player) {
        const color = Utils.escapeHtml(player.color);
        const name = UI.formatPlayerName(player);
        return `
            <span class="hud-turn-indicator" style="--player-color: ${color}"></span>
            <span class="hud-turn-text">${name}</span>
        `;
    },

    renderRollMarkup(value, label = 'Last roll') {
        if (value === null || value === undefined || value === '') {
            return 'No rolls yet';
        }
        return `${label}: <strong>${Utils.escapeHtml(String(value))}</strong>`;
    },

    renderMobileRollMarkup(value) {
        if (value === null || value === undefined || value === '') {
            return '<span class="hud-roll-empty" aria-hidden="true">—</span>';
        }
        return `<span class="hud-roll-label">🎲</span><span class="hud-roll-value">${Utils.escapeHtml(String(value))}</span>`;
    },

    buildMobilePlayerChipHtml(player, isActive) {
        const icon = player.icon || Utils.escapeHtml(player.name.charAt(0).toUpperCase());
        const activeClass = isActive ? ' active' : '';
        const positionLabel = player.position > 0 ? String(player.position) : '—';
        let rawName = player.name;
        if (GameState.currentPlayer && player.persistentId === GameState.currentPlayer.persistentId) {
            rawName = 'You';
        } else if (Utils.isMobileLayout() && window.innerWidth >= 640 && rawName.length > 6) {
            rawName = `${rawName.slice(0, 5)}…`;
        } else if (rawName.length > 9) {
            rawName = `${rawName.slice(0, 8)}…`;
        }
        const displayName = Utils.escapeHtml(rawName);

        return `
            <div class="hud-mobile-chip mobile-scoreboard-item${activeClass}" role="listitem" title="${Utils.escapeHtml(UI.formatPlayerName(player))} · ${positionLabel}">
                <span class="hud-mobile-chip-avatar mobile-scoreboard-color" style="background-color: ${Utils.escapeHtml(player.color)}">
                    <span class="mobile-scoreboard-icon">${icon}</span>
                </span>
                <span class="hud-mobile-chip-name mobile-scoreboard-name">${displayName}</span>
                <span class="hud-mobile-chip-pos mobile-scoreboard-position">${positionLabel}</span>
            </div>
        `;
    },

    buildPlayerChipHtml(player, isActive) {
        const icon = player.icon || Utils.escapeHtml(player.name.charAt(0).toUpperCase());
        const activeClass = isActive ? ' active' : '';
        const positionLabel = player.position > 0 ? `${player.position}` : '—';

        return `
            <div class="hud-player-chip scoreboard-item${activeClass}">
                <span class="hud-chip-avatar scoreboard-color" style="background-color: ${Utils.escapeHtml(player.color)}">
                    <span class="hud-chip-icon scoreboard-icon">${icon}</span>
                </span>
                <span class="hud-chip-body scoreboard-details">
                    <span class="hud-chip-name scoreboard-name">${UI.formatPlayerName(player)}</span>
                    <span class="hud-chip-meta scoreboard-position">${positionLabel}</span>
                </span>
            </div>
        `;
    },

    formatPlayerName(player, options = {}) {
        if (!player) return '';

        const safeName = Utils.escapeHtml(player.name);
        const suffixes = [];
        if (player.isBot) suffixes.push('AI');
        if (options.isHost) suffixes.push('Host');
        if (options.isCurrentPlayer) suffixes.push('You');

        return suffixes.length > 0
            ? `${safeName} (${suffixes.join(', ')})`
            : safeName;
    },

    updateConnectionStatus(status, message) {
        if (!DOM.connectionStatus) return;
        GameState.connectionStatus = status;
        DOM.connectionStatus.className = `connection-status ${status}`;
        if (DOM.connectionStatusText) {
            DOM.connectionStatusText.textContent = message;
        }
    },

    updateMuteButtonLabels() {
        const label = GameState.soundMuted ? 'Sound off' : 'Sound on';
        if (DOM.muteSoundLabel) DOM.muteSoundLabel.textContent = label;
        if (DOM.mobileMuteLabel) DOM.mobileMuteLabel.textContent = label;
    },

    resetMobileSettingsMenuPlacement() {
        if (!DOM.mobileSettingsMenu) return;
        const menu = DOM.mobileSettingsMenu;
        menu.classList.remove('menu-drop-up', 'menu-drop-left');
        menu.style.removeProperty('position');
        menu.style.removeProperty('left');
        menu.style.removeProperty('right');
        menu.style.removeProperty('top');
        menu.style.removeProperty('bottom');
        menu.style.removeProperty('transform');
    },

    positionMobileSettingsMenu() {
        if (!DOM.mobileSettingsBtn || !DOM.mobileSettingsMenu) return;

        const menu = DOM.mobileSettingsMenu;
        UI.resetMobileSettingsMenuPlacement();

        const adjust = () => {
            const pad = 8;
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            menu.classList.toggle('menu-drop-up', rect.bottom > viewportHeight - pad);
            menu.classList.toggle('menu-drop-left', rect.left < pad);

            const adjusted = menu.getBoundingClientRect();
            if (adjusted.right > viewportWidth - pad) {
                menu.classList.add('menu-drop-left');
            }
        };

        requestAnimationFrame(() => {
            adjust();
            requestAnimationFrame(adjust);
        });
    },

    closeMobileSettingsMenu() {
        if (!DOM.mobileSettingsMenu) return;
        GameState.isMobileMenuOpen = false;
        DOM.mobileSettingsMenu.classList.remove('open');
        UI.resetMobileSettingsMenuPlacement();
        if (DOM.mobileSettingsBtn) {
            DOM.mobileSettingsBtn.setAttribute('aria-expanded', 'false');
        }
        if (UI._mobileMenuCloseHandler) {
            document.removeEventListener('pointerdown', UI._mobileMenuCloseHandler, true);
            UI._mobileMenuCloseHandler = null;
        }
    },

    toggleMobileSettingsMenu(event) {
        if (!DOM.mobileSettingsBtn || !DOM.mobileSettingsMenu) return;

        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (GameState.isMobileMenuOpen) {
            UI.closeMobileSettingsMenu();
            return;
        }

        GameState.isMobileMenuOpen = true;
        DOM.mobileSettingsMenu.classList.add('open');
        DOM.mobileSettingsBtn.setAttribute('aria-expanded', 'true');
        UI.positionMobileSettingsMenu();

        if (UI._mobileMenuCloseHandler) {
            document.removeEventListener('pointerdown', UI._mobileMenuCloseHandler, true);
        }

        UI._mobileMenuCloseHandler = (pointerEvent) => {
            if (DOM.mobileSettingsBtn?.contains(pointerEvent.target)) return;
            if (DOM.mobileSettingsMenu?.contains(pointerEvent.target)) return;
            UI.closeMobileSettingsMenu();
        };

        requestAnimationFrame(() => {
            document.addEventListener('pointerdown', UI._mobileMenuCloseHandler, true);
        });
    },

    updateHostOnlyTools() {
        const show = !!GameState.isHost;
        DOM.hostOnlyTools.forEach(el => {
            el.style.display = show ? '' : 'none';
        });
        if (DOM.resetGameBtn) {
            DOM.resetGameBtn.style.display = show ? '' : 'none';
        }
    },

    updateTakenCustomizations(taken) {
        if (!taken) return;

        DOM.colorOptions.forEach(option => {
            const color = option.dataset.color;
            const takenByAnother = taken.colors.includes(color);
            option.classList.toggle('taken', takenByAnother);
            option.setAttribute('aria-disabled', takenByAnother ? 'true' : 'false');
        });

        DOM.iconOptions.forEach(option => {
            const icon = option.dataset.icon;
            const takenByAnother = taken.icons.includes(icon);
            option.classList.toggle('taken', takenByAnother);
            option.setAttribute('aria-disabled', takenByAnother ? 'true' : 'false');
        });
    },

    updateLobbyRules() {
        if (!GameState.gameState || !DOM.lobbyRules) return;
        const rules = GameState.gameState.rulesSummary;
        DOM.lobbyRules.textContent = rules ? `Rules: ${rules}` : '';
        DOM.lobbyRules.style.display = rules ? 'block' : 'none';
    },

    updateLobbyHostHint() {
        if (!DOM.lobbyHostHint || !GameState.gameState) return;

        if (GameState.isHost) {
            DOM.lobbyHostHint.textContent = 'You are the host. Start the game when everyone is ready.';
            if (DOM.lobbyInfo) {
                const allReady = GameState.gameState.players.every(p => p.ready);
                DOM.lobbyInfo.textContent = allReady
                    ? 'All players ready — start when you are'
                    : 'Waiting for all players to be ready…';
            }
            DOM.startGameBtn.style.display = GameState.gameState.players.every(p => p.ready) ? 'block' : 'none';
        } else {
            DOM.lobbyHostHint.textContent = 'Waiting for the host to start the game.';
            DOM.startGameBtn.style.display = 'none';
            if (DOM.lobbyInfo) {
                DOM.lobbyInfo.textContent = 'Get ready — the host will start when everyone is prepared.';
            }
        }
    },
    
    switchScreen(screen) {
        DOM.welcomeScreen.classList.remove('active');
        DOM.lobbyScreen.classList.remove('active');
        DOM.gameScreen.classList.remove('active');

        if (screen !== 'game') {
            Renderer.stopRenderLoop();
            Camera.enabled = false;
            Camera.reset();
            DOM.mobileCameraBtn.classList.remove('active');
            Camera.updateButtonIcon();
            GameState.explosionAnimations = [];
            UI.closeMobileSettingsMenu();
        }

        if (screen !== 'game') {
            Utils.syncGameLayoutMode();
        }

        switch(screen) {
            case 'welcome':
                DOM.welcomeScreen.classList.add('active');
                GameState.currentMode = null;
                DOM.welcomeScreen.classList.remove('show-setup');
                DOM.choiceScreen.style.display = '';
                DOM.setupScreen.style.display = 'none';
                Discovery.startAutoDiscovery();
                break;
            case 'lobby':
                DOM.lobbyScreen.classList.add('active');
                Discovery.stopAutoDiscovery();
                break;
            case 'game':
                DOM.gameScreen.classList.add('active');
                Discovery.stopAutoDiscovery();
                Utils.syncGameLayoutMode();
                const fitBoard = () => {
                    Renderer.resizeCanvas();
                    Renderer.drawBoard();
                };
                requestAnimationFrame(fitBoard);
                setTimeout(fitBoard, 120);
                setTimeout(fitBoard, 320);
                break;
        }
    },
    
    updateLobby() {
        if (!GameState.gameState) return;

        UI.updateLobbyRules();
        UI.updateLobbyHostHint();
        UI.updateHostOnlyTools();

        if (GameState.gameState.takenCustomizations) {
            UI.updateTakenCustomizations(GameState.gameState.takenCustomizations);
        }

        DOM.playersList.innerHTML = '';
        GameState.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';

            const isCurrentPlayer = GameState.currentPlayer &&
                player.persistentId === GameState.currentPlayer.persistentId;
            const isHostPlayer = GameState.gameState.hostPersistentId === player.persistentId;
            const safeIcon = player.icon || Utils.escapeHtml(player.name.charAt(0).toUpperCase());

            let actionsHtml = '';
            const canKick = GameState.isHost && !isCurrentPlayer && !isHostPlayer && !GameState.gameState.started;
            if (canKick) {
                actionsHtml = '<button type="button" class="btn-kick-player">Remove</button>';
            }

            playerItem.innerHTML = `
                <div class="player-color" style="background-color: ${Utils.escapeHtml(player.color)}">
                    <span class="player-icon">${safeIcon}</span>
                </div>
                <div class="player-info">
                    <div class="player-name">${UI.formatPlayerName(player, { isCurrentPlayer, isHost: isHostPlayer })}</div>
                </div>
                <span class="ready-badge ${player.ready ? 'ready' : 'waiting'}">
                    ${player.ready ? '✓ Ready' : 'Waiting...'}
                </span>
                ${actionsHtml}
            `;

            const kickBtn = playerItem.querySelector('.btn-kick-player');
            if (kickBtn) {
                kickBtn.dataset.persistentId = player.persistentId;
                kickBtn.addEventListener('click', () => {
                    if (confirm(`Remove ${player.name} from the lobby?`)) {
                        GameState.socket.emit('kick-player', {
                            roomId: GameState.currentRoom,
                            targetPersistentId: player.persistentId
                        });
                    }
                });
            }

            DOM.playersList.appendChild(playerItem);
        });

        const currentPlayerState = GameState.currentPlayer
            ? GameState.gameState.players.find(p => p.persistentId === GameState.currentPlayer.persistentId)
            : null;
        if (currentPlayerState) {
            if (currentPlayerState.ready) {
                DOM.readyBtn.textContent = 'Not Ready';
                DOM.readyBtn.classList.add('ready');
            } else {
                DOM.readyBtn.textContent = 'Ready';
                DOM.readyBtn.classList.remove('ready');
            }
        }
    },
    
    updateGameScreen() {
        if (!GameState.gameState) return;

        const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
        const turnMarkup = UI.renderTurnMarkup(currentTurnPlayer);
        DOM.currentTurnDisplay.innerHTML = turnMarkup;
        
        if (GameState.currentPlayer) {
            const myPlayerState = GameState.gameState.players.find(p => p.persistentId === GameState.currentPlayer.persistentId);
            if (myPlayerState && myPlayerState.hasDiceControl) {
                DOM.diceControlPowerBtn.style.display = 'flex';
                DOM.mobilePowerBtn.style.display = 'flex';
            } else {
                DOM.diceControlPowerBtn.style.display = 'none';
                DOM.mobilePowerBtn.style.display = 'none';
            }
        }

        if (!GameState.diceAnimationInProgress) {
            DOM.lastRollDisplay.innerHTML = UI.renderRollMarkup(GameState.gameState.lastRoll);
        }

        DOM.mobileCurrentTurn.innerHTML = turnMarkup;

        if (!GameState.diceAnimationInProgress) {
            DOM.mobileLastRoll.innerHTML = UI.renderMobileRollMarkup(GameState.gameState.lastRoll);
        }

        DOM.scoreboardList.innerHTML = '';
        DOM.mobileScoreboardList.innerHTML = '';
        GameState.gameState.players.forEach((player, index) => {
            const isActive = index === GameState.gameState.currentTurn;
            const chipHtml = UI.buildPlayerChipHtml(player, isActive);

            const desktopChip = document.createElement('div');
            desktopChip.innerHTML = chipHtml;
            DOM.scoreboardList.appendChild(desktopChip.firstElementChild);

            const mobileChip = document.createElement('div');
            mobileChip.innerHTML = UI.buildMobilePlayerChipHtml(player, isActive);
            DOM.mobileScoreboardList.appendChild(mobileChip.firstElementChild);
        });

        const isMyTurn = GameState.currentPlayer && currentTurnPlayer.persistentId === GameState.currentPlayer.persistentId;
        if (
            isMyTurn &&
            !GameState.gameState.winner &&
            !GameState.animationInProgress &&
            !GameState.diceAnimationInProgress &&
            !GameState.turnResolutionInProgress
        ) {
            DOM.rollDiceBtn.disabled = false;
            DOM.mobileRollBtn.disabled = false;
        } else {
            DOM.rollDiceBtn.disabled = true;
            DOM.mobileRollBtn.disabled = true;
        }

        if (!GameState.animationInProgress && Object.keys(GameState.playerAnimations).length === 0) {
            if (!Renderer.isActive) {
                Renderer.drawBoard();
            }
        }
    },
    
    showWinnerModal(winner) {
        DOM.winnerName.textContent = winner.name;
        const serverRolls = GameState.gameState?.playerRollCounts?.[winner.persistentId];
        const winnerRollCount = serverRolls ?? GameState.playerRollCounts[winner.persistentId] ?? 0;
        DOM.winnerRolls.textContent = winnerRollCount;

        const modal = document.querySelector('.winner-modal-content');
        modal.style.animation = 'none';
        setTimeout(() => {
            modal.style.animation = '';
        }, 10);

        DOM.winnerModal.classList.add('active');
    },
    
    showSetupScreen(mode) {
        DOM.welcomeScreen.classList.add('show-setup');
        DOM.choiceScreen.style.display = 'none';
        DOM.setupScreen.style.display = 'block';
        
        if (mode === 'create') {
            DOM.setupSubtitle.textContent = 'Configure your session';
            DOM.gameOptionsSection.style.display = 'block';
            DOM.createRoomBtn.style.display = 'inline-flex';
            DOM.joinConfirmBtn.style.display = 'none';
            DOM.joinConnectionSection.style.display = 'none';
            
            DOM.stepColor.style.display = 'block';
            DOM.stepIcon.style.display = 'block';
            
            DOM.stepColor.querySelector('.collapsible-content').classList.remove('collapsed');
            DOM.stepIcon.querySelector('.collapsible-content').classList.remove('collapsed');
        } else if (mode === 'join') {
            DOM.setupSubtitle.textContent = 'Join a session — enter your name';
            DOM.gameOptionsSection.style.display = 'none';
            DOM.createRoomBtn.style.display = 'none';
            DOM.joinConnectionSection.style.display = 'none';
            
            GameState.joinSteps = { name: false, color: false, icon: false };
            GameState.autoOpenedSections = { color: false, icon: false };
            DOM.stepColor.style.display = 'none';
            DOM.stepIcon.style.display = 'none';
            DOM.joinConfirmBtn.style.display = 'none';
            
            setTimeout(() => DOM.playerNameInput.focus(), 50);
        }
    },
    
    showChoiceScreen() {
        DOM.welcomeScreen.classList.remove('show-setup');
        DOM.setupScreen.style.display = 'none';
        DOM.choiceScreen.style.display = '';
        GameState.currentMode = null;
    },
    
    updatePlayerPreview() {
        DOM.previewPlayer.style.backgroundColor = GameState.selectedColor;
        DOM.previewIcon.textContent = GameState.selectedIcon;
    },
    
    openDiceControlModal() {
        if (!GameState.gameState || !GameState.currentPlayer) return;

        const threshold = GameState.gameState.snakeThreshold || 3;
        const powerMessage = document.querySelector('.power-message');
        if (powerMessage) {
            powerMessage.textContent = `You've been bitten by ${threshold} snakes! Control another player's next dice roll...`;
        }

        DOM.targetPlayerOptions.innerHTML = '';
        let selectablePlayers = 0;
        GameState.gameState.players.forEach(player => {
            if (player.persistentId !== GameState.currentPlayer.persistentId) {
                selectablePlayers++;
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'target-player-option';
                option.dataset.playerId = player.persistentId;
                option.setAttribute('aria-pressed', 'false');
                option.innerHTML = `
                    <span class="player-option-icon">${player.icon || '🙂'}</span>
                    <span class="player-option-name">${UI.formatPlayerName(player)}</span>
                `; // icon is emoji from server; name escaped via formatPlayerName
                DOM.targetPlayerOptions.appendChild(option);
            }
        });

        if (selectablePlayers === 0) {
            DOM.targetPlayerOptions.innerHTML = '<div class="target-player-empty">No available target players</div>';
            DOM.targetPlayerOptions.onclick = null;
            DOM.setControlBtn.disabled = true;
        } else {
            DOM.setControlBtn.disabled = false;
            DOM.targetPlayerOptions.onclick = (event) => {
                const option = event.target.closest('.target-player-option');
                if (!option) return;

                DOM.targetPlayerOptions.querySelectorAll('.target-player-option').forEach(button => {
                    button.classList.remove('selected');
                    button.setAttribute('aria-pressed', 'false');
                });

                option.classList.add('selected');
                option.setAttribute('aria-pressed', 'true');
            };
        }

        DOM.diceValueControls.innerHTML = '';
        for (let i = 0; i < GameState.currentDiceCount; i++) {
            const diceInput = document.createElement('div');
            diceInput.className = 'dice-value-input';
            diceInput.innerHTML = `
                <label>Die ${i + 1}</label>
                <div class="dice-value-options" role="radiogroup" aria-label="Die ${i + 1} value">
                    <button type="button" class="dice-value-option selected" data-value="1" aria-pressed="true">1</button>
                    <button type="button" class="dice-value-option" data-value="2" aria-pressed="false">2</button>
                    <button type="button" class="dice-value-option" data-value="3" aria-pressed="false">3</button>
                    <button type="button" class="dice-value-option" data-value="4" aria-pressed="false">4</button>
                    <button type="button" class="dice-value-option" data-value="5" aria-pressed="false">5</button>
                    <button type="button" class="dice-value-option" data-value="6" aria-pressed="false">6</button>
                </div>
            `;
            DOM.diceValueControls.appendChild(diceInput);
        }

        DOM.diceValueControls.querySelectorAll('.dice-value-options').forEach(optionGroup => {
            optionGroup.addEventListener('click', (event) => {
                const button = event.target.closest('.dice-value-option');
                if (!button) return;

                optionGroup.querySelectorAll('.dice-value-option').forEach(option => {
                    option.classList.remove('selected');
                    option.setAttribute('aria-pressed', 'false');
                });

                button.classList.add('selected');
                button.setAttribute('aria-pressed', 'true');
            });
        });

        DOM.diceControlModal.classList.add('active');
    }
};
