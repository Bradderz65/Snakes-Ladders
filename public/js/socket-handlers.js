// Socket.IO event handlers
const SocketHandlers = {
    init(socket) {
        GameState.socket = socket;
        
        socket.on('room-created', ({ roomId, player, discoverable }) => {
            GameState.currentRoom = roomId;
            GameState.currentPlayer = player;
            DOM.roomCodeDisplay.textContent = roomId;
            GameState.saveSession();
            UI.switchScreen('lobby');

            if (discoverable) {
                UI.showNotification('Room created and discoverable on local network!', 'success');
            } else {
                UI.showNotification('Room created successfully!', 'success');
            }
        });

        socket.on('room-joined', ({ roomId, player }) => {
            GameState.currentRoom = roomId;
            GameState.currentPlayer = player;
            DOM.roomCodeDisplay.textContent = roomId;
            GameState.saveSession();
            UI.switchScreen('lobby');
            UI.showNotification('Joined room successfully!', 'success');
        });

        socket.on('reconnected', ({ roomId, player }) => {
            GameState.currentRoom = roomId;
            GameState.currentPlayer = player;
            DOM.roomCodeDisplay.textContent = roomId;
            GameState.isReconnecting = false;
            GameState.saveSession();
            UI.showNotification('Reconnected successfully!', 'success');
            
            setTimeout(() => {
                if (GameState.gameState) {
                    if (GameState.gameState.started) {
                        UI.switchScreen('game');
                    } else {
                        UI.switchScreen('lobby');
                    }
                } else {
                    UI.switchScreen('lobby');
                }
            }, 100);
        });

        socket.on('disconnected', () => {
            GameState.clearSession();
            GameState.currentRoom = null;
            GameState.currentPlayer = null;
            GameState.gameState = null;
            Renderer.stopRenderLoop();
            Camera.enabled = false;
            Camera.reset();
            GameState.diceAnimationInProgress = false;
            GameState.explosionAnimations = [];
            DOM.mobileCameraBtn.classList.remove('active');
            Camera.updateButtonIcon();
            document.body.classList.remove('game-active-mobile');
            UI.switchScreen('welcome');
            UI.showNotification('You have left the game', 'info');
        });

        socket.on('player-left', ({ playerId, playerName }) => {
            UI.showNotification(`${playerName} left the game`, 'info');

            if (Camera.enabled && GameState.gameState && GameState.gameState.players.length > 0) {
                Camera.updateTarget();
                UI.showNotification('Camera updated - Recentering on remaining players', 'info');
            } else if (Camera.enabled && (!GameState.gameState || GameState.gameState.players.length === 0)) {
                Camera.enabled = false;
                Camera.reset();
                Renderer.stopRenderLoop();
                DOM.mobileCameraBtn.classList.remove('active');
                Camera.updateButtonIcon();
                UI.showNotification('Camera disabled - No players in game', 'info');
            }
        });

        socket.on('game-state', (state) => {
            const wasStarted = GameState.gameState && GameState.gameState.started;
            GameState.gameState = state;
            if (state.diceCount) {
                GameState.currentDiceCount = state.diceCount;
            }

            if (state.voids && GameState.gameState.tempVoids) {
                GameState.gameState.tempVoids = [];
            }

            UI.updateLobby();
            if (state.started) {
                UI.updateGameScreen();
                if (!wasStarted) {
                    setTimeout(() => Renderer.resizeCanvas(), 50);
                }
            }
        });

        socket.on('game-started', () => {
            GameState.totalRolls = 0;
            GameState.playerRollCounts = {};
            UI.switchScreen('game');
            UI.showNotification('Game started!', 'success');
        });

        socket.on('dice-rolled', (result) => {
            this.handleDiceRoll(result);
        });

        socket.on('game-reset', () => {
            DOM.winnerModal.classList.remove('active');
            GameState.totalRolls = 0;
            GameState.playerRollCounts = {};
            GameState.diceAnimationInProgress = false;
            GameState.explosionAnimations = [];
            UI.switchScreen('lobby');
            UI.showNotification('Game has been reset', 'info');
        });

        socket.on('dice-control-set', ({ targetPlayerName, diceValues }) => {
            UI.showNotification(`🐍⚡ Dice control set! ${targetPlayerName} will roll ${diceValues.join('-')} on their next turn...`, 'success');
        });

        socket.on('error', ({ message }) => {
            if (GameState.isReconnecting) {
                GameState.clearSession();
                GameState.isReconnecting = false;
                UI.switchScreen('welcome');
            }
            UI.showNotification(message, 'error');
        });

        socket.on('ladder-mine-explosion', (data) => {
            AudioSystem.play('mineExplosion');
            Explosions.create(data.position);
            UI.showNotification(`💣💥 MINE EXPLOSION! Tile ${data.position} destroyed! Fall to tile 1!`, 'error');

            if (!GameState.gameState.tempVoids) {
                GameState.gameState.tempVoids = [];
            }
            GameState.gameState.tempVoids.push(data.position);
        });

        socket.on('games-discovered', (data) => {
            GameState.lastDiscoveryTime = Date.now();
            const serverKey = `${data.serverIP}:${data.serverPort}`;

            GameState.discoveredGames.set(serverKey, {
                ...data,
                games: data.games.map(game => ({
                    ...game,
                    serverIP: data.serverIP,
                    serverPort: data.serverPort
                }))
            });

            Discovery.updateLocalGamesList();
        });

        socket.on('game-broadcast', (data) => {
            const serverKey = `${data.serverIP}:${data.serverPort}`;

            if (Date.now() - GameState.lastDiscoveryTime > 5000) {
                GameState.discoveredGames.set(serverKey, {
                    ...data,
                    games: data.games.map(game => ({
                        ...game,
                        serverIP: data.serverIP,
                        serverPort: data.serverPort
                    }))
                });

                Discovery.updateLocalGamesList();
            }
        });

        socket.on('connect', () => {
            console.log('Connected to server');
            if (!GameState.currentRoom && !GameState.isReconnecting) {
                const existingSession = GameState.loadSession();
                if (existingSession) {
                    GameState.isReconnecting = true;
                    UI.showNotification('Reconnecting to game...', 'info');
                    socket.emit('reconnect-to-room', {
                        roomId: existingSession.roomId,
                        persistentId: existingSession.persistentId
                    });
                }
            }
        });
    },
    
    handleDiceRoll(result) {
        GameState.totalRolls++;
        if (result.player) {
            if (!GameState.playerRollCounts[result.player.persistentId]) {
                GameState.playerRollCounts[result.player.persistentId] = 0;
            }
            GameState.playerRollCounts[result.player.persistentId]++;
        }

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
        
        GameState.playerAnimations[rollingPlayer.persistentId] = {
            from: result.oldPosition,
            to: result.oldPosition,
            progress: 0,
            locked: true
        };
        
        Renderer.startRenderLoop();
        
        GameState.diceAnimationInProgress = true;
        const diceToShow = result.diceRolls || result.diceRoll;
        Animations.animateDiceRoll(diceToShow, () => {
            const oldPosition = result.oldPosition;
            const newPosition = result.newPosition;
            const hasSnakeOrLadder = result.snake || result.ladder;

            const effectiveDiceRoll = result.enteredBoard ? 1 : result.diceRoll;

            if (result.needsSixToStart && oldPosition === 0 && newPosition === 0) {
                delete GameState.playerAnimations[rollingPlayer.persistentId];
                GameState.diceAnimationInProgress = false;
                GameState.animationInProgress = false;
                
                if (!Renderer.hasActiveAnimations()) {
                    Renderer.stopRenderLoop();
                }
                
                DOM.lastRollDisplay.textContent = `🎲 Rolled: ${result.diceRoll}`;
                
                UI.showNotification(`🎯 ${rollingPlayer.name} needs to roll a 6 to enter the board!`, 'info');
                
                setTimeout(() => {
                    UI.updateGameScreen();
                }, 100);
                return;
            }

            Animations.animatePlayerMovement(
                rollingPlayer.persistentId,
                oldPosition,
                newPosition,
                effectiveDiceRoll,
                hasSnakeOrLadder,
                result.snake,
                result.ladder,
                () => {
                    delete GameState.playerAnimations[rollingPlayer.persistentId];
                    GameState.diceAnimationInProgress = false;
                    GameState.animationInProgress = false;
                    
                    if (!Renderer.hasActiveAnimations()) {
                        Renderer.stopRenderLoop();
                    }
                    
                    DOM.lastRollDisplay.textContent = `🎲 Rolled: ${result.diceRoll}`;

                    if (result.wasControlled && GameState.currentPlayer && result.controllerPlayerId === GameState.currentPlayer.persistentId) {
                        UI.showNotification(`🐍⚡ Your controlled roll succeeded! ${rollingPlayer.name} rolled ${result.diceRoll}`, 'success');
                    }

                    if (result.powerGranted && GameState.currentPlayer && rollingPlayer.persistentId === GameState.currentPlayer.persistentId) {
                        const threshold = GameState.gameState.snakeThreshold || 3;
                        UI.showNotification(`🐍⚡ REVENGE POWER UNLOCKED! You've been bitten by ${threshold} snakes! Click the power button to control another player's dice!`, 'success');
                    }

                    if (result.enteredBoard) {
                        UI.showNotification(`🎯 ${rollingPlayer.name} rolled a 6 and entered the board at tile 1!`, 'success');
                    }

                    if (result.bouncedBack) {
                        UI.showNotification(`🏁 ${rollingPlayer.name} overshot by ${result.overshoot}! Bounced back to tile ${result.newPosition}!`, 'warning');
                    }

                    if (result.mine) {
                        if (!result.mine.waitForLadder) {
                            AudioSystem.play('mineExplosion');
                            Explosions.create(result.mine.position);
                            UI.showNotification(`💣💥 MINE EXPLOSION! Tile ${result.mine.position} destroyed! Fall to tile 1!`, 'error');

                            if (!GameState.gameState.tempVoids) {
                                GameState.gameState.tempVoids = [];
                            }
                            GameState.gameState.tempVoids.push(result.mine.position);
                        } else {
                            console.log('Mine explosion deferred until ladder animation completes');
                        }
                    }
                    else if (result.voidFall) {
                        AudioSystem.play('downSnake');
                        if (result.voidFall.to === 1) {
                            UI.showNotification(`⚫ Fell into the void at tile ${result.voidFall.from}! Can't move back further, left at tile 1!`, 'error');
                        } else {
                            UI.showNotification(`⚫ Fell into the void at tile ${result.voidFall.from}! Fall back to tile ${result.voidFall.to}!`, 'error');
                        }
                    }
                    else if (result.snake) {
                        UI.showNotification(`🐍 Snake! Slide down ${result.snake.from} → ${result.snake.to}`, 'info');
                    } else if (result.ladder) {
                        UI.showNotification(`🪜 Ladder! Climb up ${result.ladder.from} → ${result.ladder.to}`, 'success');
                    } else if (result.anotherTurn) {
                        if (GameState.currentDiceCount === 2) {
                            const diceRolls = result.diceRolls || [result.diceRoll];
                            if (diceRolls.length === 2 && diceRolls[0] === diceRolls[1]) {
                                UI.showNotification(`🎲🎲 Rolled doubles (${diceRolls[0]}-${diceRolls[1]})! ${rollingPlayer.name} gets another turn!`, 'success');
                            } else {
                                UI.showNotification(`🎲 ${rollingPlayer.name} gets another turn!`, 'success');
                            }
                        } else {
                            UI.showNotification(`🎲 Rolled a 6! ${rollingPlayer.name} gets another turn!`, 'success');
                        }
                    }

                    if (result.winner) {
                        setTimeout(() => {
                            UI.showWinnerModal(result.winner);
                        }, 500);
                    }

                    setTimeout(() => {
                        UI.updateGameScreen();
                    }, 100);
                }
            );
        });
    }
};
