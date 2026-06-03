// Drawing functions for game elements
const Draw = {
    _snakeCurve(fromPos, toPos) {
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;
        const perpX = -dy / length;
        const perpY = dx / length;
        const curveAmount = length * 0.22;
        return {
            length,
            control: {
                x: midX + perpX * curveAmount,
                y: midY + perpY * curveAmount
            }
        };
    },

    _quadraticPath(ctx, from, control, to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
    },

    _drawSnakeHead(ctx, bodyStart, bodyAngle, cellSize) {
        const headLen = cellSize * 0.38;
        const headW = cellSize * 0.3;
        const outline = Math.max(1.5, cellSize * 0.03);
        // Back of head shape (neck) — aligned to where the body curve begins
        const neckLocalX = -headLen * 0.35;
        const rot = bodyAngle + Math.PI;
        const hx = bodyStart.x - neckLocalX * Math.cos(rot);
        const hy = bodyStart.y - neckLocalX * Math.sin(rot);

        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(rot);

        const drawHeadShape = () => {
            ctx.beginPath();
            ctx.moveTo(headLen * 0.55, 0);
            ctx.quadraticCurveTo(headLen * 0.15, -headW * 0.55, -headLen * 0.35, -headW * 0.42);
            ctx.quadraticCurveTo(-headLen * 0.08, 0, -headLen * 0.35, headW * 0.42);
            ctx.quadraticCurveTo(headLen * 0.15, headW * 0.55, headLen * 0.55, 0);
            ctx.closePath();
        };

        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.translate(2, 2);
        drawHeadShape();
        ctx.fill();
        ctx.translate(-2, -2);

        const headGrad = ctx.createLinearGradient(-headLen * 0.3, 0, headLen * 0.5, 0);
        headGrad.addColorStop(0, '#6d2828');
        headGrad.addColorStop(0.5, '#a83c3c');
        headGrad.addColorStop(1, '#c24a4a');
        ctx.fillStyle = headGrad;
        drawHeadShape();
        ctx.fill();

        ctx.strokeStyle = '#2d1212';
        ctx.lineWidth = outline;
        ctx.lineJoin = 'round';
        drawHeadShape();
        ctx.stroke();

        const eyeX = headLen * 0.08;
        const eyeY = headW * 0.22;
        const eyeR = cellSize * 0.055;
        const pupilR = cellSize * 0.028;

        ctx.fillStyle = '#fff8ee';
        ctx.beginPath();
        ctx.arc(eyeX, -eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(eyeX + eyeR * 0.25, -eyeY, pupilR, 0, Math.PI * 2);
        ctx.arc(eyeX + eyeR * 0.25, eyeY, pupilR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e85a5a';
        ctx.lineWidth = Math.max(1.5, cellSize * 0.022);
        ctx.lineCap = 'round';
        const tongueBase = headLen * 0.52;
        const tongueLen = cellSize * 0.14;
        ctx.beginPath();
        ctx.moveTo(tongueBase, 0);
        ctx.lineTo(tongueBase + tongueLen, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tongueBase + tongueLen, 0);
        ctx.lineTo(tongueBase + tongueLen * 1.15, -tongueLen * 0.45);
        ctx.moveTo(tongueBase + tongueLen, 0);
        ctx.lineTo(tongueBase + tongueLen * 1.15, tongueLen * 0.45);
        ctx.stroke();

        ctx.restore();
    },

    snakes(snakes, opacities = {}) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;

        Object.entries(snakes).forEach(([from, to]) => {
            const opacity = opacities[from] !== undefined ? opacities[from] : 1.0;
            ctx.save();
            ctx.globalAlpha = opacity;

            const fromPos = Utils.getPosition(parseInt(from));
            const toPos = Utils.getPosition(parseInt(to));
            const { control } = Draw._snakeCurve(fromPos, toPos);

            const bodyAngle = Math.atan2(control.y - fromPos.y, control.x - fromPos.x);
            const headLen = cellSize * 0.38;
            const neckLocalX = -headLen * 0.35;
            const bodyStart = {
                x: fromPos.x - neckLocalX * Math.cos(bodyAngle),
                y: fromPos.y - neckLocalX * Math.sin(bodyAngle)
            };

            const outlineW = cellSize * 0.22;
            const bodyW = cellSize * 0.155;
            const glossW = cellSize * 0.05;

            // Shadow
            ctx.save();
            ctx.translate(2, 3);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.lineWidth = outlineW;
            ctx.lineCap = 'round';
            Draw._quadraticPath(ctx, bodyStart, control, toPos);
            ctx.stroke();
            ctx.restore();

            // Dark outline
            ctx.strokeStyle = '#2d1212';
            ctx.lineWidth = outlineW;
            ctx.lineCap = 'round';
            Draw._quadraticPath(ctx, bodyStart, control, toPos);
            ctx.stroke();

            // Body — smooth ribbon
            const bodyGrad = ctx.createLinearGradient(bodyStart.x, bodyStart.y, toPos.x, toPos.y);
            bodyGrad.addColorStop(0, '#b84a4a');
            bodyGrad.addColorStop(0.45, '#9a3838');
            bodyGrad.addColorStop(1, '#6d2828');
            ctx.strokeStyle = bodyGrad;
            ctx.lineWidth = bodyW;
            Draw._quadraticPath(ctx, bodyStart, control, toPos);
            ctx.stroke();

            // Light edge
            ctx.strokeStyle = 'rgba(255, 220, 210, 0.35)';
            ctx.lineWidth = glossW;
            Draw._quadraticPath(ctx, bodyStart, control, toPos);
            ctx.stroke();

            // Subtle belly stripe
            ctx.setLineDash([cellSize * 0.12, cellSize * 0.18]);
            ctx.strokeStyle = 'rgba(45, 15, 15, 0.35)';
            ctx.lineWidth = cellSize * 0.04;
            Draw._quadraticPath(ctx, bodyStart, control, toPos);
            ctx.stroke();
            ctx.setLineDash([]);

            Draw._drawSnakeHead(ctx, bodyStart, bodyAngle, cellSize);
            ctx.restore();
        });
    },

    ladders(ladders, opacities = {}) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;

        Object.entries(ladders).forEach(([from, to]) => {
            const opacity = opacities[from] !== undefined ? opacities[from] : 1.0;
            ctx.save();
            ctx.globalAlpha = opacity;

            const fromPos = Utils.getPosition(parseInt(from));
            const toPos = Utils.getPosition(parseInt(to));
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            const angle = Math.atan2(dy, dx);
            const spread = cellSize * 0.11;

            const px = Math.cos(angle + Math.PI / 2) * spread;
            const py = Math.sin(angle + Math.PI / 2) * spread;

            const r1a = { x: fromPos.x - px, y: fromPos.y - py };
            const r1b = { x: toPos.x - px, y: toPos.y - py };
            const r2a = { x: fromPos.x + px, y: fromPos.y + py };
            const r2b = { x: toPos.x + px, y: toPos.y + py };

            const railW = Math.max(3, cellSize * 0.065);
            const rungW = Math.max(2.5, cellSize * 0.045);
            const shadowOff = 2;

            const strokeLine = (a, b, w, color, ox, oy) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = w;
                ctx.lineCap = 'square';
                ctx.beginPath();
                ctx.moveTo(a.x + ox, a.y + oy);
                ctx.lineTo(b.x + ox, b.y + oy);
                ctx.stroke();
            };

            // Shadow
            strokeLine(r1a, r1b, railW, 'rgba(0,0,0,0.2)', shadowOff, shadowOff);
            strokeLine(r2a, r2b, railW, 'rgba(0,0,0,0.2)', shadowOff, shadowOff);

            // Rails
            strokeLine(r1a, r1b, railW, '#6b4a28', 0, 0);
            strokeLine(r2a, r2b, railW, '#6b4a28', 0, 0);
            strokeLine(r1a, r1b, railW * 0.35, 'rgba(255,255,255,0.12)', -px * 0.08, -py * 0.08);

            const numRungs = Math.max(4, Math.floor(length / (cellSize * 0.42)));
            for (let i = 1; i <= numRungs; i++) {
                const t = i / (numRungs + 1);
                const x1 = r1a.x + (r1b.x - r1a.x) * t;
                const y1 = r1a.y + (r1b.y - r1a.y) * t;
                const x2 = r2a.x + (r2b.x - r2a.x) * t;
                const y2 = r2a.y + (r2b.y - r2a.y) * t;
                const thick = i === numRungs ? rungW * 1.35 : rungW;
                strokeLine({ x: x1, y: y1 }, { x: x2, y: y2 }, thick, '#4a3218', shadowOff, shadowOff);
                strokeLine({ x: x1, y: y1 }, { x: x2, y: y2 }, thick, '#8f6538', 0, 0);
            }

            // Small markers at bottom (start) of climb
            const dotR = cellSize * 0.04;
            [r1a, r2a].forEach((p) => {
                ctx.fillStyle = '#5c4018';
                ctx.beginPath();
                ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        });
    },
    
    mines(mines) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;
        
        mines.forEach(minePosition => {
            const pos = Utils.getPosition(minePosition);
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 5;
            
            const mineRadius = cellSize * 0.15;
            const gradient = ctx.createRadialGradient(
                pos.x - mineRadius * 0.3, pos.y - mineRadius * 0.3, 0,
                pos.x, pos.y, mineRadius
            );
            gradient.addColorStop(0, '#4a4a4a');
            gradient.addColorStop(1, '#1a1a1a');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, mineRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.font = `${cellSize * 0.35}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000000';
            ctx.fillText('💣', pos.x, pos.y);
        });
    },
    
    voids(voids) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const boardSize = CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;
        
        const tempVoids = GameState.gameState.tempVoids || [];
        const allVoids = [...voids, ...tempVoids];

        allVoids.forEach(voidPosition => {
            const rowFromBottom = Math.floor((voidPosition - 1) / boardSize);
            const row = boardSize - 1 - rowFromBottom;
            
            let col;
            if (rowFromBottom % 2 === 0) {
                col = (voidPosition - 1) % boardSize;
            } else {
                col = boardSize - 1 - ((voidPosition - 1) % boardSize);
            }
            
            const x = col * cellSize;
            const y = row * cellSize;
            
            ctx.save();
            ctx.fillStyle = '#121a18';
            ctx.fillRect(x, y, cellSize, cellSize);
            ctx.strokeStyle = '#2a3d36';
            ctx.lineWidth = Math.max(1, cellSize * 0.02);
            ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
            ctx.restore();
        });
    },
    
    player(player, index) {
        let pos;
        let isAnimating = false;

        const animation = GameState.playerAnimations[player.persistentId];
        if (animation && animation.locked) {
            isAnimating = true;

            if (animation.isFollowingSnake && animation.currentBezierPos) {
                pos = animation.currentBezierPos;
            } else {
                const fromPos = Utils.getPosition(animation.from);
                const toPos = Utils.getPosition(animation.to);
                pos = {
                    x: fromPos.x + (toPos.x - fromPos.x) * animation.progress,
                    y: fromPos.y + (toPos.y - fromPos.y) * animation.progress
                };
            }
        } else {
            pos = Utils.getPosition(player.position);
        }
        
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        let playerRadius = cellSize * CONFIG.VISUAL.PLAYER_RADIUS_FACTOR;
        
        if (isAnimating) {
            const bounceHeight = Math.sin(animation.progress * Math.PI) * CONFIG.VISUAL.PLAYER_BOUNCE_HEIGHT;
            pos.y -= bounceHeight;
            playerRadius *= 1 + Math.sin(animation.progress * Math.PI) * 0.15;
        }
        
        const getDisplayedTile = (p) => {
            const pAnimation = GameState.playerAnimations[p.persistentId];
            if (pAnimation && pAnimation.locked) {
                // When animating, derive the tile from the *actual drawn position*.
                // Using a fractional tile number + Math.round() causes false "same tile" matches
                // while a piece is merely passing by another tile.
                let drawPos;

                if (pAnimation.isFollowingSnake && pAnimation.currentBezierPos) {
                    drawPos = pAnimation.currentBezierPos;
                } else {
                    const fromPos = Utils.getPosition(pAnimation.from);
                    const toPos = Utils.getPosition(pAnimation.to);
                    drawPos = {
                        x: fromPos.x + (toPos.x - fromPos.x) * pAnimation.progress,
                        y: fromPos.y + (toPos.y - fromPos.y) * pAnimation.progress
                    };
                }

                const row = Math.max(0, Math.min(CONFIG.BOARD_SIZE - 1, Math.floor(drawPos.y / cellSize)));
                const col = Math.max(0, Math.min(CONFIG.BOARD_SIZE - 1, Math.floor(drawPos.x / cellSize)));
                return Utils.getCellNumber(row, col);
            }

            return p.position;
        };

        // Only spread tokens when players are on the same displayed tile.
        const currentTile = getDisplayedTile(player);
        const sameTilePlayers = GameState.gameState.players.filter(p => getDisplayedTile(p) === currentTile && currentTile > 0);
        const sameTileIndex = Math.max(0, sameTilePlayers.findIndex(p => p.persistentId === player.persistentId));
        const offset = sameTilePlayers.length > 1
            ? (sameTileIndex - (sameTilePlayers.length - 1) / 2) * (playerRadius * 1.2)
            : 0;
        const centerX = pos.x + offset;
        const centerY = pos.y;

        if (!pos || !isFinite(centerX) || !isFinite(centerY) || !pos.x || !pos.y || isNaN(centerX) || isNaN(centerY)) {
            if (player.position !== 0) {
                console.warn(`⚠️ Invalid player position detected, skipping draw - Player: ${player.name}`);
            }
            return;
        }

        const ctx = DOM.ctx;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        
        const glowRadius = isAnimating ? playerRadius * 2.3 : playerRadius * 1.6;
        const glowGradient = ctx.createRadialGradient(
            centerX, centerY, playerRadius * 0.5,
            centerX, centerY, glowRadius
        );
        glowGradient.addColorStop(0, player.color);
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring gives each piece a consistent premium edge.
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(centerX, centerY, playerRadius * 1.08, 0, Math.PI * 2);
        ctx.fill();

        const playerGradient = ctx.createRadialGradient(
            centerX - playerRadius * 0.28,
            centerY - playerRadius * 0.32,
            playerRadius * 0.08,
            centerX,
            centerY,
            playerRadius
        );
        playerGradient.addColorStop(0, player.color + 'ff');
        playerGradient.addColorStop(0.7, player.color + 'e6');
        playerGradient.addColorStop(1, player.color + 'b8');
        ctx.fillStyle = playerGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, playerRadius * 0.98, 0, Math.PI * 2);
        ctx.fill();

        // Gloss highlight to make the token feel less flat.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.beginPath();
        ctx.ellipse(
            centerX - playerRadius * 0.2,
            centerY - playerRadius * 0.28,
            playerRadius * 0.45,
            playerRadius * 0.28,
            -0.3,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, playerRadius * 0.96, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;

        if (player.icon) {
            ctx.font = `${playerRadius * 1.42}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            ctx.fillText(player.icon, centerX, centerY + playerRadius * 0.03);
        } else {
            ctx.font = `700 ${playerRadius * 1.08}px "Trebuchet MS", "Segoe UI", sans-serif`;
            ctx.fillText(player.name.charAt(0).toUpperCase(), centerX, centerY + playerRadius * 0.02);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
};
