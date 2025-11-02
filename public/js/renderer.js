// Main rendering system
const Renderer = {
    renderLoopId: null,
    lastRenderTime: 0,
    isActive: false,
    
    drawBoard() {
        if (!GameState.gameState) return;
        
        const drawBoardStartTime = performance.now();
        const boardSize = CONFIG.BOARD_SIZE;
        const cellSize = GameState.canvasLogicalSize / boardSize;
        const ctx = DOM.ctx;

        const cameraUpdateStartTime = performance.now();
        Camera.update();
        const cameraUpdateTime = performance.now() - cameraUpdateStartTime;
        if (cameraUpdateTime > 3) {
            console.warn(`📷 Camera update in drawBoard: ${cameraUpdateTime.toFixed(2)}ms`);
        }

        const clearStartTime = performance.now();
        ctx.clearRect(0, 0, GameState.canvasLogicalSize, GameState.canvasLogicalSize);
        const clearTime = performance.now() - clearStartTime;
        if (clearTime > 2) {
            console.warn(`🧹 Canvas clear: ${clearTime.toFixed(2)}ms`);
        }

        ctx.save();
        Camera.apply(ctx);
        
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const num = Utils.getCellNumber(row, col);
                const x = col * cellSize;
                const y = row * cellSize;
                
                const isLight = (row + col) % 2 === 0;
                
                if (isLight) {
                    ctx.fillStyle = '#334155';
                } else {
                    ctx.fillStyle = '#1e293b';
                }
                
                ctx.fillRect(x, y, cellSize, cellSize);
                
                if (num === 100) {
                    ctx.fillStyle = 'rgba(240, 147, 251, 0.2)';
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
                
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x, y, cellSize, cellSize);
                
                ctx.fillStyle = num === 100 ? '#f093fb' : '#cbd5e1';
                ctx.font = `bold ${cellSize * 0.25}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(num, x + cellSize / 2, y + cellSize * 0.25);
                
                if (num === 100) {
                    ctx.font = `${cellSize * 0.35}px Arial`;
                    ctx.fillText('🏆', x + cellSize / 2, y + cellSize * 0.6);
                }
            }
        }
        
        if (GameState.gameState.voids && GameState.gameState.voids.length > 0) {
            Draw.voids(GameState.gameState.voids);
        }
        
        let snakeOpacities = {};
        let ladderOpacities = {};
        
        if (GameState.gameState.players && GameState.gameState.players.length > 0) {
            const fullVisibilityDistance = CONFIG.VISUAL.FULL_VISIBILITY_DISTANCE;
            const fadeStartDistance = CONFIG.VISUAL.FADE_START_DISTANCE;
            const distantOpacity = CONFIG.VISUAL.DISTANT_OPACITY;
            const fadeRange = fadeStartDistance - fullVisibilityDistance;
            
            const playerTiles = GameState.gameState.players.map(player => {
                const animation = GameState.playerAnimations[player.persistentId];
                if (animation && animation.locked && !animation.isFollowingSnake) {
                    return animation.from + (animation.to - animation.from) * animation.progress;
                }
                return player.position;
            });
            
            const calculateOpacity = (tileNumber) => {
                let minDistance = Infinity;
                for (let i = 0; i < playerTiles.length; i++) {
                    const distance = Math.abs(tileNumber - playerTiles[i]);
                    if (distance < minDistance) minDistance = distance;
                }
                
                if (minDistance <= fullVisibilityDistance) return 1.0;
                if (minDistance <= fadeStartDistance) {
                    const fadeProgress = (fadeStartDistance - minDistance) / fadeRange;
                    return distantOpacity + (0.8 * fadeProgress);
                }
                return distantOpacity;
            };
            
            if (GameState.gameState.snakes) {
                Object.keys(GameState.gameState.snakes).forEach(snakeHead => {
                    snakeOpacities[snakeHead] = calculateOpacity(parseInt(snakeHead));
                });
            }
            
            if (GameState.gameState.ladders) {
                Object.keys(GameState.gameState.ladders).forEach(ladderBottom => {
                    ladderOpacities[ladderBottom] = calculateOpacity(parseInt(ladderBottom));
                });
            }
        }
        
        if (GameState.gameState.snakes) {
            Draw.snakes(GameState.gameState.snakes, snakeOpacities);
        }
        
        if (GameState.gameState.ladders) {
            Draw.ladders(GameState.gameState.ladders, ladderOpacities);
        }
        
        if (GameState.gameState.mines && GameState.gameState.mines.length > 0) {
            Draw.mines(GameState.gameState.mines);
        }
        
        Explosions.draw();
        
        GameState.gameState.players.forEach((player, index) => {
            if (player.position > 0) {
                Draw.player(player, index);
            }
        });

        ctx.restore();
        
        const totalDrawBoardTime = performance.now() - drawBoardStartTime;
        if (totalDrawBoardTime > 10) {
            console.warn(`🎨 Total drawBoard time: ${totalDrawBoardTime.toFixed(2)}ms`);
        }
    },
    
    startRenderLoop() {
        if (this.isActive) return;
        this.isActive = true;

        const render = (timestamp) => {
            if (!this.isActive) return;
            
            PerformanceMonitor.startFrame();

            const targetFrameTime = CONFIG.PERFORMANCE.TARGET_FRAME_TIME;
            if (timestamp - this.lastRenderTime >= targetFrameTime) {
                const renderStartTime = performance.now();
                
                if (Camera.enabled && GameState.gameState && GameState.gameState.started) {
                    const cameraStartTime = performance.now();
                    Camera.update();
                    const cameraTime = performance.now() - cameraStartTime;
                    if (cameraTime > 3) {
                        console.warn(`📷 Slow camera update: ${cameraTime.toFixed(2)}ms`);
                    }
                }

                if (GameState.gameState && GameState.gameState.started) {
                    const drawStartTime = performance.now();
                    this.drawBoard();
                    const drawTime = performance.now() - drawStartTime;
                    if (drawTime > 8) {
                        console.warn(`🎨 Slow board draw: ${drawTime.toFixed(2)}ms`);
                    }
                }
                
                const totalRenderTime = performance.now() - renderStartTime;
                if (totalRenderTime > 12) {
                    console.warn(`🖼️ Slow render frame: ${totalRenderTime.toFixed(2)}ms`);
                }

                this.lastRenderTime = timestamp;
            }

            this.renderLoopId = requestAnimationFrame(render);
            
            PerformanceMonitor.endFrame();
        };

        render(0);
    },
    
    stopRenderLoop() {
        this.isActive = false;
        if (this.renderLoopId) {
            cancelAnimationFrame(this.renderLoopId);
            this.renderLoopId = null;
        }
    },
    
    hasActiveAnimations() {
        return Object.keys(GameState.playerAnimations).length > 0 || 
               GameState.explosionAnimations.length > 0 || 
               Camera.enabled;
    },
    
    resizeCanvas() {
        const container = document.querySelector('.board-container');
        if (!container) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        if (containerWidth === 0 || containerHeight === 0) {
            setTimeout(() => this.resizeCanvas(), 50);
            return;
        }
        
        const isMobile = window.innerWidth <= 768;
        const paddingBuffer = isMobile ? 8 : 32;
        const maxSize = Math.min(containerWidth - paddingBuffer, containerHeight - paddingBuffer, 800);
        GameState.canvasLogicalSize = maxSize;
        
        const dpr = window.devicePixelRatio || 1;
        
        DOM.canvas.style.width = maxSize + 'px';
        DOM.canvas.style.height = maxSize + 'px';
        
        DOM.canvas.width = maxSize * dpr;
        DOM.canvas.height = maxSize * dpr;
        
        DOM.ctx.setTransform(1, 0, 0, 1, 0, 0);
        DOM.ctx.scale(dpr, dpr);
        
        if (GameState.gameState && GameState.gameState.started) {
            this.drawBoard();
        }
    }
};
