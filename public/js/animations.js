// Animation system
const Animations = {
    animatePlayerPosition(playerId, fromPos, toPos, duration, onComplete) {
        const startTime = Date.now();
        Renderer.startRenderLoop();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = Utils.easeInOutQuad(progress);

            GameState.playerAnimations[playerId] = {
                from: fromPos,
                to: toPos,
                progress: easedProgress,
                locked: true
            };

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        }

        animate();
    },
    
    animatePlayerAlongSnake(playerId, fromPos, toPos, duration, onComplete) {
        const startTime = Date.now();
        const controlPos = Utils.getSnakeControlPoint(fromPos, toPos);

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = Utils.easeInOutQuad(progress);

            const currentPos = Utils.getPointOnBezierCurve(fromPos, controlPos, toPos, easedProgress);

            if (!isFinite(currentPos.x) || !isFinite(currentPos.y)) {
                console.warn('Invalid Bézier curve position calculated, falling back to linear interpolation');
                const fallbackPos = {
                    x: fromPos.x + (toPos.x - fromPos.x) * easedProgress,
                    y: fromPos.y + (toPos.y - fromPos.y) * easedProgress
                };
                currentPos.x = fallbackPos.x;
                currentPos.y = fallbackPos.y;
            }

            GameState.playerAnimations[playerId] = {
                from: fromPos,
                to: toPos,
                progress: easedProgress,
                locked: true,
                currentBezierPos: currentPos,
                isFollowingSnake: true,
                controlPos: controlPos
            };

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (GameState.playerAnimations[playerId]) {
                    GameState.playerAnimations[playerId].isFollowingSnake = false;
                    GameState.playerAnimations[playerId].currentBezierPos = null;
                    GameState.playerAnimations[playerId].controlPos = null;
                }
                if (onComplete) onComplete();
            }
        }

        animate();
    },
    
    animatePlayerMovement(playerId, startPos, endPos, diceRoll, snakeOrLadder, snake, ladder, onComplete) {
        const animationStartTime = performance.now();
        GameState.animationInProgress = true;

        const movementSound = AudioSystem.selectRandom('playerMove', 'playerMove2', 0.7);
        let lastSoundTime = 0;
        const soundInterval = CONFIG.ANIMATION.SOUND_INTERVAL;

        const steps = [];
        for (let i = 1; i <= diceRoll; i++) {
            steps.push(startPos + i);
        }

        function animateStep(stepIndex) {
            if (stepIndex >= steps.length) {
                if (snakeOrLadder) {
                    setTimeout(() => {
                        if (snake) {
                            AudioSystem.play('downSnake');
                        } else if (ladder) {
                            AudioSystem.play('climbLadder');
                        }

                        if (snake) {
                            const fromPos = Utils.getPosition(steps[steps.length - 1]);
                            const toPos = Utils.getPosition(endPos);
                            Animations.animatePlayerAlongSnake(
                                playerId,
                                fromPos,
                                toPos,
                                CONFIG.ANIMATION.SNAKE_DURATION,
                                () => {
                                    GameState.animationInProgress = false;
                                    
                                    const totalAnimationTime = performance.now() - animationStartTime;
                                    if (totalAnimationTime > 1800) {
                                        console.warn(`🐍 Slow snake animation: ${totalAnimationTime.toFixed(2)}ms`);
                                    }
                                    
                                    if (onComplete) onComplete();
                                }
                            );
                        } else if (ladder) {
                            const ladderStart = ladder.from;
                            const ladderEnd = ladder.to;

                            Animations.animatePlayerPosition(
                                playerId,
                                ladderStart,
                                ladderEnd,
                                CONFIG.ANIMATION.LADDER_DURATION,
                                () => {
                                    GameState.animationInProgress = false;

                                    GameState.socket.emit('ladder-animation-complete', {
                                        roomId: GameState.currentRoom,
                                        playerId: playerId,
                                        ladderEnd: ladderEnd
                                    });
                                    
                                    const totalAnimationTime = performance.now() - animationStartTime;
                                    if (totalAnimationTime > 1500) {
                                        console.warn(`🪜 Slow ladder animation: ${totalAnimationTime.toFixed(2)}ms`);
                                    }

                                    if (onComplete) onComplete();
                                }
                            );
                        }
                    }, CONFIG.ANIMATION.TRANSITION_DELAY);
                } else {
                    GameState.animationInProgress = false;
                    
                    const totalAnimationTime = performance.now() - animationStartTime;
                    if (totalAnimationTime > 1500) {
                        console.warn(`🎬 Slow player movement animation: ${totalAnimationTime.toFixed(2)}ms for ${diceRoll} steps`);
                    }
                    
                    if (onComplete) onComplete();
                }
                return;
            }

            const targetPos = steps[stepIndex];
            const duration = Math.max(200, CONFIG.ANIMATION.STEP_DURATION_BASE - (diceRoll * CONFIG.ANIMATION.STEP_DURATION_REDUCTION));
            const fromPos = stepIndex === 0 ? startPos : steps[stepIndex - 1];

            const now = Date.now();
            if (now - lastSoundTime >= soundInterval) {
                try {
                    AudioSystem.play(movementSound);
                    lastSoundTime = now;
                } catch (error) {
                    console.warn('Sound playback failed during movement:', error);
                }
            } else if (stepIndex === 0 || stepIndex === steps.length - 1) {
                try {
                    AudioSystem.play(movementSound, 0.7);
                } catch (error) {
                    console.warn('Fallback sound failed:', error);
                }
            }

            Animations.animatePlayerPosition(playerId, fromPos, targetPos, duration, () => {
                animateStep(stepIndex + 1);
            });
        }

        animateStep(0);
    },
    
    animateDiceRoll(diceValues, callback) {
        const diceAnimationStartTime = performance.now();
        
        const valuesArray = Array.isArray(diceValues) ? diceValues : [diceValues];
        
        DOM.diceContainer.innerHTML = '';
        
        const diceElements = [];
        valuesArray.forEach((val, index) => {
            const diceDiv = document.createElement('div');
            diceDiv.className = 'dice';
            diceDiv.id = `dice-${index}`;
            
            for (let i = 0; i < 9; i++) {
                const dot = document.createElement('div');
                dot.className = 'dice-dot';
                diceDiv.appendChild(dot);
            }
            
            DOM.diceContainer.appendChild(diceDiv);
            diceElements.push(diceDiv);
        });
        
        const diceRollSound = AudioSystem.selectRandom('diceRoll', 'diceRoll2', 0.7);
        const soundStartTime = performance.now();
        AudioSystem.play(diceRollSound);
        const soundTime = performance.now() - soundStartTime;
        if (soundTime > 10) {
            console.warn(`🎲 Slow dice sound: ${soundTime.toFixed(2)}ms`);
        }
        
        DOM.diceBackdrop.classList.add('active');
        DOM.diceContainer.classList.add('rolling');
        
        diceElements.forEach(dice => dice.classList.add('rolling'));
        
        let counter = 0;
        const totalFrames = CONFIG.ANIMATION.DICE_FRAMES;
        const frameDelay = CONFIG.ANIMATION.DICE_FRAME_DELAY;
        
        const interval = setInterval(() => {
            diceElements.forEach(dice => {
                const randomNum = Math.floor(Math.random() * 6) + 1;
                this.setDiceFace(dice, randomNum);
            });
            counter++;
            
            if (counter >= totalFrames) {
                clearInterval(interval);
                
                diceElements.forEach((dice, index) => {
                    this.setDiceFace(dice, valuesArray[index]);
                });
                
                setTimeout(() => {
                    diceElements.forEach(dice => dice.classList.remove('rolling'));
                    
                    setTimeout(() => {
                        DOM.diceContainer.classList.remove('rolling');
                        DOM.diceBackdrop.classList.remove('active');
                        
                        if (callback) callback();
                        
                        const totalDiceAnimationTime = performance.now() - diceAnimationStartTime;
                        if (totalDiceAnimationTime > 1000) {
                            console.warn(`🎲 Slow dice animation: ${totalDiceAnimationTime.toFixed(2)}ms`);
                        }
                    }, 150);
                }, 200);
            }
        }, frameDelay);
    },
    
    setDiceFace(element, number) {
        element.className = 'dice';
        element.classList.add(`dice-face-${number}`);
    }
};
