// Drawing functions for game elements
const Draw = {
    snakes(snakes, opacities = {}) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;
        
        Object.entries(snakes).forEach(([from, to]) => {
            const opacity = opacities[from] !== undefined ? opacities[from] : 1.0;
            ctx.globalAlpha = opacity;
            const fromPos = Utils.getPosition(parseInt(from));
            const toPos = Utils.getPosition(parseInt(to));
            
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;
            const perpX = -dy / length;
            const perpY = dx / length;
            const curveAmount = length * 0.2;
            const controlX = midX + perpX * curveAmount;
            const controlY = midY + perpY * curveAmount;
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y);
            gradient.addColorStop(0, '#86efac');
            gradient.addColorStop(0.5, '#4ade80');
            gradient.addColorStop(1, '#22c55e');
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = cellSize * 0.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.quadraticCurveTo(controlX, controlY, toPos.x, toPos.y);
            ctx.stroke();
            
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = cellSize * 0.18;
            ctx.setLineDash([cellSize * 0.15, cellSize * 0.15]);
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.quadraticCurveTo(controlX, controlY, toPos.x, toPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            const startDx = controlX - fromPos.x;
            const startDy = controlY - fromPos.y;
            const headAngle = Math.atan2(startDy, startDx) + Math.PI;
            
            ctx.save();
            ctx.translate(fromPos.x, fromPos.y);
            ctx.rotate(headAngle);
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            const headWidth = cellSize * 0.25;
            const headHeight = cellSize * 0.2;
            
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(0, 0, headWidth, headHeight, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            const eyeOffsetX = headWidth * 0.3;
            const eyeOffsetY = headHeight * 0.4;
            const eyeRadius = headWidth * 0.15;
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            
            const tongueLength = headWidth * 0.6;
            const tongueX = headWidth;
            
            ctx.beginPath();
            ctx.moveTo(headWidth * 0.8, 0);
            ctx.lineTo(tongueX + tongueLength * 0.7, 0);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(tongueX + tongueLength * 0.7, 0);
            ctx.lineTo(tongueX + tongueLength, -tongueLength * 0.3);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(tongueX + tongueLength * 0.7, 0);
            ctx.lineTo(tongueX + tongueLength, tongueLength * 0.3);
            ctx.stroke();
            
            ctx.restore();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.lineCap = 'butt';
            ctx.globalAlpha = 1.0;
        });
    },
    
    ladders(ladders, opacities = {}) {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const ctx = DOM.ctx;
        
        Object.entries(ladders).forEach(([from, to]) => {
            const opacity = opacities[from] !== undefined ? opacities[from] : 1.0;
            ctx.globalAlpha = opacity;
            const fromPos = Utils.getPosition(parseInt(from));
            const toPos = Utils.getPosition(parseInt(to));
            
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            const railWidth = cellSize * 0.15;
            
            const perpX = Math.cos(angle + Math.PI / 2) * railWidth;
            const perpY = Math.sin(angle + Math.PI / 2) * railWidth;
            
            const rail1Start = { x: fromPos.x - perpX, y: fromPos.y - perpY };
            const rail1End = { x: toPos.x - perpX, y: toPos.y - perpY };
            
            const rail2Start = { x: fromPos.x + perpX, y: fromPos.y + perpY };
            const rail2End = { x: toPos.x + perpX, y: toPos.y + perpY };
            
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(rail1Start.x + 2, rail1Start.y + 2);
            ctx.lineTo(rail1End.x + 2, rail1End.y + 2);
            ctx.moveTo(rail2Start.x + 2, rail2Start.y + 2);
            ctx.lineTo(rail2End.x + 2, rail2End.y + 2);
            ctx.stroke();
            
            const gradient = ctx.createLinearGradient(fromPos.x, fromPos.y, toPos.x, toPos.y);
            gradient.addColorStop(0, '#8b5a2b');
            gradient.addColorStop(1, '#6b4423');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(rail1Start.x, rail1Start.y);
            ctx.lineTo(rail1End.x, rail1End.y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(rail2Start.x, rail2Start.y);
            ctx.lineTo(rail2End.x, rail2End.y);
            ctx.stroke();
            
            const numRungs = Math.max(3, Math.floor(length / (cellSize * 0.4)));
            ctx.strokeStyle = '#8b5a2b';
            ctx.lineWidth = 4;
            
            for (let i = 1; i < numRungs; i++) {
                const t = i / numRungs;
                const rung1X = rail1Start.x + (rail1End.x - rail1Start.x) * t;
                const rung1Y = rail1Start.y + (rail1End.y - rail1Start.y) * t;
                const rung2X = rail2Start.x + (rail2End.x - rail2Start.x) * t;
                const rung2Y = rail2Start.y + (rail2End.y - rail2Start.y) * t;
                
                ctx.beginPath();
                ctx.moveTo(rung1X, rung1Y);
                ctx.lineTo(rung2X, rung2Y);
                ctx.stroke();
            }
            
            ctx.lineWidth = 1;
            ctx.lineCap = 'butt';
            ctx.globalAlpha = 1.0;
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
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, cellSize, cellSize);

            const voidBorderWidth = 2;
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = voidBorderWidth;
            ctx.strokeRect(
                x + voidBorderWidth / 2,
                y + voidBorderWidth / 2,
                cellSize - voidBorderWidth,
                cellSize - voidBorderWidth
            );

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
