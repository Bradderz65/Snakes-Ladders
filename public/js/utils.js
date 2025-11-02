// Utility functions
const Utils = {
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    
    getCellNumber(row, col) {
        const boardSize = CONFIG.BOARD_SIZE;
        const rowFromBottom = boardSize - 1 - row;
        
        if (rowFromBottom % 2 === 0) {
            return rowFromBottom * boardSize + col + 1;
        } else {
            return rowFromBottom * boardSize + (boardSize - col);
        }
    },
    
    getPosition(num) {
        const boardSize = CONFIG.BOARD_SIZE;
        const cellSize = GameState.canvasLogicalSize / boardSize;

        if (num <= 0) return { x: cellSize / 2, y: GameState.canvasLogicalSize - cellSize / 2 };
        if (num > 100) num = 100;
        
        if (!isFinite(num) || isNaN(num)) {
            console.warn(`⚠️ Invalid position number: ${num}`);
            return { x: 0, y: GameState.canvasLogicalSize };
        }

        const rowFromBottom = Math.floor((num - 1) / boardSize);
        const row = boardSize - 1 - rowFromBottom;

        let col;
        if (rowFromBottom % 2 === 0) {
            col = (num - 1) % boardSize;
        } else {
            col = boardSize - 1 - ((num - 1) % boardSize);
        }

        const x = col * cellSize + cellSize / 2;
        const y = row * cellSize + cellSize / 2;

        if (!isFinite(x) || !isFinite(y) || !cellSize || !GameState.canvasLogicalSize || isNaN(x) || isNaN(y)) {
            console.warn(`⚠️ Invalid coordinates calculated in getPosition: num=${num}, x=${x}, y=${y}, cellSize=${cellSize}`);
            return { x: GameState.canvasLogicalSize / 2, y: GameState.canvasLogicalSize / 2 };
        }

        return { x, y };
    },
    
    getSnakeControlPoint(fromPos, toPos) {
        if (!fromPos || !toPos || !isFinite(fromPos.x) || !isFinite(fromPos.y) || !isFinite(toPos.x) || !isFinite(toPos.y)) {
            console.warn('Invalid positions in getSnakeControlPoint, using midpoint as control point');
            return {
                x: (fromPos?.x || 0 + toPos?.x || 0) / 2,
                y: (fromPos?.y || 0 + toPos?.y || 0) / 2
            };
        }

        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) {
            return { x: fromPos.x, y: fromPos.y };
        }

        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;
        const perpX = -dy / length;
        const perpY = dx / length;
        const curveAmount = length * 0.2;
        const controlX = midX + perpX * curveAmount;
        const controlY = midY + perpY * curveAmount;

        return { x: controlX, y: controlY };
    },
    
    getPointOnBezierCurve(startPos, controlPos, endPos, t) {
        if (!startPos || !controlPos || !endPos ||
            !isFinite(startPos.x) || !isFinite(startPos.y) ||
            !isFinite(controlPos.x) || !isFinite(controlPos.y) ||
            !isFinite(endPos.x) || !isFinite(endPos.y) ||
            !isFinite(t)) {
            console.warn('Invalid parameters in getPointOnBezierCurve, falling back to linear interpolation');
            const x = startPos?.x || 0 + (endPos?.x || 0 - startPos?.x || 0) * t;
            const y = startPos?.y || 0 + (endPos?.y || 0 - startPos?.y || 0) * t;
            return { x, y };
        }

        const x = Math.pow(1 - t, 2) * startPos.x +
                  2 * (1 - t) * t * controlPos.x +
                  Math.pow(t, 2) * endPos.x;
        const y = Math.pow(1 - t, 2) * startPos.y +
                  2 * (1 - t) * t * controlPos.y +
                  Math.pow(t, 2) * endPos.y;

        return { x, y };
    },
    
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    },
    
    getUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        return {
            autoJoin: params.get('autoJoin') === 'true',
            room: params.get('room'),
            name: params.get('name'),
            color: params.get('color'),
            icon: params.get('icon')
        };
    }
};
