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
        }

        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            document.body.classList.remove('game-active-mobile');
        }

        switch(screen) {
            case 'welcome':
                DOM.welcomeScreen.classList.add('active');
                GameState.currentMode = null;
                DOM.choiceScreen.style.display = 'block';
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
                if (isMobile) {
                    document.body.classList.add('game-active-mobile');
                }
                setTimeout(() => {
                    Renderer.resizeCanvas();
                    Renderer.drawBoard();
                }, 50);
                break;
        }
    },
    
    updateLobby() {
        if (!GameState.gameState) return;
        
        DOM.playersList.innerHTML = '';
        GameState.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const isCurrentPlayer = player.id === GameState.socket.id;
            
            playerItem.innerHTML = `
                <div class="player-color" style="background-color: ${player.color}">
                    <span class="player-icon">${player.icon || player.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="player-info">
                    <div class="player-name">${player.name}${isCurrentPlayer ? ' (You)' : ''}</div>
                </div>
                <span class="ready-badge ${player.ready ? 'ready' : 'waiting'}">
                    ${player.ready ? '✓ Ready' : 'Waiting...'}
                </span>
            `;
            
            DOM.playersList.appendChild(playerItem);
        });
        
        const currentPlayerState = GameState.gameState.players.find(p => p.id === GameState.socket.id);
        if (currentPlayerState) {
            if (currentPlayerState.ready) {
                DOM.readyBtn.textContent = 'Not Ready';
                DOM.readyBtn.classList.add('ready');
            } else {
                DOM.readyBtn.textContent = 'Ready';
                DOM.readyBtn.classList.remove('ready');
            }
        }
        
        if (GameState.gameState.players.length >= 1 && GameState.gameState.players.every(p => p.ready)) {
            DOM.startGameBtn.style.display = 'block';
        } else {
            DOM.startGameBtn.style.display = 'none';
        }
    },
    
    updateGameScreen() {
        if (!GameState.gameState) return;

        const currentTurnPlayer = GameState.gameState.players[GameState.gameState.currentTurn];
        DOM.currentTurnDisplay.innerHTML = `
            <div style="color: ${currentTurnPlayer.color}">
                ${currentTurnPlayer.name}'s Turn
            </div>
        `;
        
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
            if (GameState.gameState.lastRoll) {
                DOM.lastRollDisplay.textContent = `🎲 Last Roll: ${GameState.gameState.lastRoll}`;
            } else {
                DOM.lastRollDisplay.textContent = '🎲 No rolls yet';
            }
        }

        DOM.mobileCurrentTurn.innerHTML = `
            <div style="color: ${currentTurnPlayer.color}">
                ${currentTurnPlayer.name}'s Turn
            </div>
        `;

        if (!GameState.diceAnimationInProgress) {
            if (GameState.gameState.lastRoll) {
                DOM.mobileLastRoll.textContent = `🎲 Last Roll: ${GameState.gameState.lastRoll}`;
            } else {
                DOM.mobileLastRoll.textContent = '🎲 No rolls yet';
            }
        }

        DOM.scoreboardList.innerHTML = '';
        GameState.gameState.players.forEach((player, index) => {
            const scoreboardItem = document.createElement('div');
            scoreboardItem.className = `scoreboard-item ${index === GameState.gameState.currentTurn ? 'active' : ''}`;

            scoreboardItem.innerHTML = `
                <div class="scoreboard-color" style="background-color: ${player.color}">
                    <span class="scoreboard-icon">${player.icon || player.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="scoreboard-details">
                    <div class="scoreboard-name">${player.name}</div>
                    <div class="scoreboard-position">Position: ${player.position}</div>
                </div>
            `;

            DOM.scoreboardList.appendChild(scoreboardItem);
        });

        DOM.mobileScoreboardList.innerHTML = '';
        GameState.gameState.players.forEach((player, index) => {
            const mobileScoreboardItem = document.createElement('div');
            mobileScoreboardItem.className = 'mobile-scoreboard-item';

            if (index === GameState.gameState.currentTurn) {
                mobileScoreboardItem.style.border = '2px solid var(--accent-color)';
                mobileScoreboardItem.style.background = 'rgba(240, 147, 251, 0.1)';
            }

            mobileScoreboardItem.innerHTML = `
                <div class="mobile-scoreboard-color" style="background-color: ${player.color}">
                    <span class="mobile-scoreboard-icon">${player.icon || player.name.charAt(0).toUpperCase()}</span>
                </div>
                <div class="mobile-scoreboard-details">
                    <div class="mobile-scoreboard-name">${player.name}</div>
                    <div class="mobile-scoreboard-position">Pos: ${player.position}</div>
                </div>
            `;

            DOM.mobileScoreboardList.appendChild(mobileScoreboardItem);
        });

        const isMyTurn = GameState.currentPlayer && currentTurnPlayer.persistentId === GameState.currentPlayer.persistentId;
        if (isMyTurn && !GameState.gameState.winner && !GameState.animationInProgress) {
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
        DOM.winnerName.textContent = `${winner.name}`;
        const winnerRollCount = GameState.playerRollCounts[winner.persistentId] || 0;
        DOM.winnerRolls.textContent = winnerRollCount;

        const modal = document.querySelector('.winner-modal-content');
        modal.style.animation = 'none';
        setTimeout(() => {
            modal.style.animation = '';
        }, 10);

        DOM.winnerModal.classList.add('active');
    },
    
    showSetupScreen(mode) {
        DOM.choiceScreen.style.display = 'none';
        DOM.setupScreen.style.display = 'block';
        
        if (mode === 'create') {
            DOM.setupSubtitle.textContent = 'Create a New Game';
            DOM.gameOptionsSection.style.display = 'block';
            DOM.createRoomBtn.style.display = 'inline-flex';
            DOM.joinConfirmBtn.style.display = 'none';
            DOM.joinConnectionSection.style.display = 'none';
            
            DOM.stepColor.style.display = 'block';
            DOM.stepIcon.style.display = 'block';
            
            DOM.stepColor.querySelector('.collapsible-content').classList.remove('collapsed');
            DOM.stepIcon.querySelector('.collapsible-content').classList.remove('collapsed');
        } else if (mode === 'join') {
            DOM.setupSubtitle.textContent = 'Join a Game - Step 1: Enter Your Name';
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
        DOM.setupScreen.style.display = 'none';
        DOM.choiceScreen.style.display = 'block';
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
                    <span class="player-option-name">${player.name}</span>
                `;
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
