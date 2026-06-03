// Utility functions
const Utils = {
    /** Touch / narrow layouts — wider than 768px for landscape phones */
    isMobileLayout() {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
    },

    /** Keep mobile grid + chrome in sync with viewport (landscape phones are often >768px wide). */
    syncGameLayoutMode() {
        const gameScreen = document.getElementById('game-screen');
        const gameActive = gameScreen?.classList.contains('active');
        const useMobileChrome = !!(gameActive && Utils.isMobileLayout());

        document.body.classList.toggle('game-active-mobile', useMobileChrome);
        if (gameScreen) {
            gameScreen.classList.toggle('mobile-game-layout', useMobileChrome);
        }
        return useMobileChrome;
    },

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                // fall through
            }
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (e) {
            document.body.removeChild(textarea);
            return false;
        }
    },

    getInviteUrl(roomId) {
        const params = new URLSearchParams({
            autoJoin: 'true',
            room: roomId
        });
        const name = document.getElementById('player-name')?.value?.trim();
        if (name) params.set('name', name);
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    },

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
        const canvasSize = GameState.canvasLogicalSize || CONFIG.CANVAS_LOGICAL_SIZE;
        const cellSize = canvasSize / boardSize;

        if (!cellSize || !canvasSize) {
            return { x: canvasSize / 2, y: canvasSize / 2 };
        }

        if (num <= 0) return { x: cellSize / 2, y: canvasSize - cellSize / 2 };
        if (num > 100) num = 100;
        
        if (!isFinite(num) || isNaN(num)) {
            console.warn(`⚠️ Invalid position number: ${num}`);
            return { x: 0, y: canvasSize };
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

        if (!isFinite(x) || !isFinite(y) || isNaN(x) || isNaN(y)) {
            return { x: canvasSize / 2, y: canvasSize / 2 };
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
