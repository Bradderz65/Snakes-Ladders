// Main rendering system
const Renderer = {
    renderLoopId: null,
    lastRenderTime: 0,
    isActive: false,
    
    drawBoard() {
        if (!GameState.gameState) return;
        if (!GameState.canvasLogicalSize || GameState.canvasLogicalSize < 1) return;

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
                
                const cellBorderWidth = 1.5;
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = cellBorderWidth;
                // Inset border so strokes at board edges are not clipped by canvas bounds.
                ctx.strokeRect(
                    x + cellBorderWidth / 2,
                    y + cellBorderWidth / 2,
                    cellSize - cellBorderWidth,
                    cellSize - cellBorderWidth
                );
                
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
                if (animation && animation.locked) {
                    if (animation.isFollowingSnake && animation.currentBezierPos) {
                        const curveRow = Math.max(0, Math.min(boardSize - 1, Math.floor(animation.currentBezierPos.y / cellSize)));
                        const curveCol = Math.max(0, Math.min(boardSize - 1, Math.floor(animation.currentBezierPos.x / cellSize)));
                        const approxTile = Math.round(Utils.getCellNumber(
                            curveRow,
                            curveCol
                        ));
                        return Number.isFinite(approxTile) ? approxTile : player.position;
                    }

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
                
                if (minDistance <= fullVisibilityDistance || fadeRange <= 0) return 1.0;
                if (minDistance <= fadeStartDistance) {
                    const fadeProgress = (fadeStartDistance - minDistance) / fadeRange;
                    return distantOpacity + ((1 - distantOpacity) * fadeProgress);
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
    
    getBoardFrameInsets(frame) {
        if (!frame) return { horizontal: 0, vertical: 0 };
        const frameStyles = window.getComputedStyle(frame);
        return {
            horizontal:
                parseFloat(frameStyles.paddingLeft) +
                parseFloat(frameStyles.paddingRight) +
                parseFloat(frameStyles.borderLeftWidth) +
                parseFloat(frameStyles.borderRightWidth),
            vertical:
                parseFloat(frameStyles.paddingTop) +
                parseFloat(frameStyles.paddingBottom) +
                parseFloat(frameStyles.borderTopWidth) +
                parseFloat(frameStyles.borderBottomWidth)
        };
    },

    getMobileBoardBounds() {
        const container = document.querySelector('.board-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 16 && rect.height > 16) {
                return {
                    width: Math.max(0, rect.width - 4),
                    height: Math.max(0, rect.height - 4)
                };
            }
        }

        const vv = window.visualViewport;
        const viewportWidth = vv?.width ?? document.documentElement.clientWidth;
        const viewportHeight = vv?.height ?? document.documentElement.clientHeight;
        const topBar = DOM.mobileTopBar;
        const bottomPanel = document.querySelector('.mobile-bottom-panel');
        const gameContainer = document.querySelector('#game-screen.active .game-container');

        let top = (vv?.offsetTop ?? 0) + 8;
        let bottom = (vv?.offsetTop ?? 0) + viewportHeight - 8;

        if (topBar && window.getComputedStyle(topBar).display !== 'none') {
            const barRect = topBar.getBoundingClientRect();
            if (barRect.height > 0) {
                top = barRect.bottom + 4;
            }
        }

        if (bottomPanel && window.getComputedStyle(bottomPanel).display !== 'none') {
            const panelRect = bottomPanel.getBoundingClientRect();
            if (panelRect.height > 0) {
                bottom = panelRect.top - 4;
            }
        }

        let sidePad = 8;
        if (gameContainer) {
            const gcStyles = window.getComputedStyle(gameContainer);
            sidePad += (parseFloat(gcStyles.paddingLeft) || 0) + (parseFloat(gcStyles.paddingRight) || 0);
            top += parseFloat(gcStyles.paddingTop) || 0;
            bottom -= parseFloat(gcStyles.paddingBottom) || 0;
        }

        return {
            width: Math.max(0, viewportWidth - sidePad),
            height: Math.max(0, bottom - top)
        };
    },

    getDesktopBoardBounds(container) {
        const paddingBuffer = 16;
        const boardRect = container.getBoundingClientRect();
        const gameContainer = container.closest('.game-container');

        let width = boardRect.width;
        let height = boardRect.height;

        if (gameContainer) {
            const gcRect = gameContainer.getBoundingClientRect();
            const styles = window.getComputedStyle(gameContainer);
            const gap = parseFloat(styles.columnGap || styles.gap) || 12;
            const sidebar = document.getElementById('game-sidebar');

            if (sidebar && window.getComputedStyle(sidebar).display !== 'none') {
                const sidebarRect = sidebar.getBoundingClientRect();
                width = Math.max(width, gcRect.width - sidebarRect.width - gap);
            } else {
                width = Math.max(width, gcRect.width);
            }

            height = Math.max(height, gcRect.height);
            const viewportHeight = Math.max(0, window.innerHeight - gcRect.top - 16);
            height = Math.max(height, viewportHeight);
        }

        return {
            width: Math.max(0, width - paddingBuffer),
            height: Math.max(0, height - paddingBuffer)
        };
    },

    getAvailableBoardSize(container, frame) {
        const insets = this.getBoardFrameInsets(frame);
        const isMobile = Utils.isMobileLayout();

        if (isMobile) {
            const bounds = this.getMobileBoardBounds();
            return {
                width: bounds.width - insets.horizontal,
                height: bounds.height - insets.vertical
            };
        }

        const bounds = this.getDesktopBoardBounds(container);
        return {
            width: bounds.width - insets.horizontal,
            height: bounds.height - insets.vertical
        };
    },

    getMaxBoardCap() {
        if (Utils.isMobileLayout()) {
            return 800;
        }
        return CONFIG.MAX_BOARD_DISPLAY_SIZE || 1400;
    },

    resizeCanvas() {
        const gameScreen = document.getElementById('game-screen');
        if (!gameScreen?.classList.contains('active')) return;

        const container = document.querySelector('.board-container');
        if (!container) return;
        const frame = DOM.canvas ? DOM.canvas.parentElement : null;

        const { width: availableWidth, height: availableHeight } = this.getAvailableBoardSize(container, frame);
        if (availableWidth <= 0 || availableHeight <= 0) {
            setTimeout(() => this.resizeCanvas(), 50);
            return;
        }

        const maxSize = Math.min(availableWidth, availableHeight, this.getMaxBoardCap());

        if (!Number.isFinite(maxSize) || maxSize < 1) {
            setTimeout(() => this.resizeCanvas(), 50);
            return;
        }

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
