// Player customization helper functions
const Customization = {
    checkForConflicts(players, excludePlayerId = null) {
        const conflicts = [];
        players.forEach(player => {
            if (player.id !== excludePlayerId) {
                if (player.color === GameState.selectedColor && player.icon === GameState.selectedIcon) {
                    conflicts.push({
                        type: 'both',
                        player: player.name,
                        color: GameState.selectedColor,
                        icon: GameState.selectedIcon
                    });
                } else if (player.color === GameState.selectedColor) {
                    conflicts.push({
                        type: 'color',
                        player: player.name,
                        color: GameState.selectedColor
                    });
                } else if (player.icon === GameState.selectedIcon) {
                    conflicts.push({
                        type: 'icon',
                        player: player.name,
                        icon: GameState.selectedIcon
                    });
                }
            }
        });
        return conflicts;
    },
    
    showConflictModal(conflicts) {
        let message = 'Your player customization conflicts with other players:\n\n';

        conflicts.forEach(conflict => {
            if (conflict.type === 'both') {
                message += `• ${conflict.player} has the same color AND icon\n`;
            } else if (conflict.type === 'color') {
                message += `• ${conflict.player} has the same color\n`;
            } else if (conflict.type === 'icon') {
                message += `• ${conflict.player} has the same icon\n`;
            }
        });

        message += '\nWould you like to choose different colors/icons, or keep your choice?';

        DOM.conflictMessage.textContent = message;
        DOM.conflictModal.classList.add('active');
    },
    
    executeJoinAction(action) {
        if (action.type === 'create-room') {
            const discoverable = DOM.enableDiscoveryCheckbox.checked;
            const hostname = discoverable ? `${action.playerName}'s Game` : null;

            GameState.socket.emit('create-room', {
                playerName: action.playerName,
                discoverable,
                hostname,
                playerColor: GameState.selectedColor,
                playerIcon: GameState.selectedIcon,
                diceCount: GameState.selectedDiceCount,
                snakeThreshold: GameState.selectedSnakeThreshold,
                minesEnabled: GameState.minesEnabled,
                minesCount: GameState.minesCount,
                ladderMinesOnly: GameState.ladderMinesOnly,
                randomizeSnakesLadders: GameState.randomizeSnakesLadders,
                requireSixToStart: GameState.requireSixToStart,
                exactRollToWin: GameState.exactRollToWin
            });
        } else if (action.type === 'join-room') {
            GameState.socket.emit('join-room', {
                roomId: action.roomId,
                playerName: action.playerName,
                playerColor: GameState.selectedColor,
                playerIcon: GameState.selectedIcon
            });
        }
    },
    
    checkJoinProgress() {
        if (GameState.currentMode !== 'join') return;
        
        const name = DOM.playerNameInput.value.trim();
        if (name && !GameState.joinSteps.name) {
            GameState.joinSteps.name = true;
            DOM.stepColor.style.display = 'block';
            DOM.setupSubtitle.textContent = 'Join a Game - Step 2: Choose Your Color';
            const colorContent = DOM.stepColor.querySelector('.collapsible-content');
            colorContent.classList.remove('collapsed');
            GameState.autoOpenedSections.color = true;
        } else if (!name && GameState.joinSteps.name) {
            GameState.joinSteps.name = false;
            GameState.joinSteps.color = false;
            GameState.joinSteps.icon = false;
            DOM.stepColor.style.display = 'none';
            DOM.stepIcon.style.display = 'none';
            DOM.joinConfirmBtn.style.display = 'none';
            DOM.setupSubtitle.textContent = 'Join a Game - Step 1: Enter Your Name';
            GameState.autoOpenedSections.color = false;
            GameState.autoOpenedSections.icon = false;
        }
    },
    
    onColorSelected() {
        if (GameState.currentMode !== 'join') return;
        
        if (GameState.joinSteps.name && !GameState.joinSteps.color) {
            GameState.joinSteps.color = true;
            DOM.stepIcon.style.display = 'block';
            DOM.setupSubtitle.textContent = 'Join a Game - Step 3: Choose Your Icon';
            const iconContent = DOM.stepIcon.querySelector('.collapsible-content');
            iconContent.classList.remove('collapsed');
            GameState.autoOpenedSections.icon = true;
        }
    },
    
    onIconSelected() {
        if (GameState.currentMode !== 'join') return;
        
        if (GameState.joinSteps.name && GameState.joinSteps.color && !GameState.joinSteps.icon) {
            GameState.joinSteps.icon = true;
            DOM.joinConfirmBtn.style.display = 'inline-flex';
            DOM.setupSubtitle.textContent = 'Join a Game - Ready to Connect!';
        }
    }
};
