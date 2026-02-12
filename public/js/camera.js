// Camera system for mobile
const Camera = {
    enabled: false,
    zoom: CONFIG.CAMERA.DEFAULT_ZOOM,
    targetZoom: CONFIG.CAMERA.DEFAULT_ZOOM,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    framingPadding: 10,

    resolveAnimationPoint(player, animation) {
        if (!animation || !animation.locked) {
            return Utils.getPosition(player.position);
        }

        if (animation.isFollowingSnake && animation.currentBezierPos) {
            return animation.currentBezierPos;
        }

        const fromPos = typeof animation.from === 'number' ? Utils.getPosition(animation.from) : animation.from;
        const toPos = typeof animation.to === 'number' ? Utils.getPosition(animation.to) : animation.to;
        const progress = Number.isFinite(animation.progress) ? animation.progress : 0;

        if (
            fromPos && toPos &&
            Number.isFinite(fromPos.x) && Number.isFinite(fromPos.y) &&
            Number.isFinite(toPos.x) && Number.isFinite(toPos.y)
        ) {
            return {
                x: fromPos.x + (toPos.x - fromPos.x) * progress,
                y: fromPos.y + (toPos.y - fromPos.y) * progress
            };
        }

        return Utils.getPosition(player.position);
    },

    getCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        return {
            width: DOM.canvas.width / dpr,
            height: DOM.canvas.height / dpr
        };
    },

    getCenterBounds(zoomLevel) {
        const { width, height } = this.getCanvasSize();
        const boardSize = GameState.canvasLogicalSize || CONFIG.CANVAS_LOGICAL_SIZE;
        const halfViewX = width / (2 * zoomLevel);
        const halfViewY = height / (2 * zoomLevel);
        const minX = halfViewX;
        const maxX = boardSize - halfViewX;
        const minY = halfViewY;
        const maxY = boardSize - halfViewY;

        // If zoomed out enough to show beyond board bounds, pin center to board midpoint.
        if (minX > maxX || minY > maxY) {
            const center = boardSize / 2;
            return { minX: center, maxX: center, minY: center, maxY: center };
        }

        return { minX, maxX, minY, maxY };
    },

    clampCenter(x, y, zoomLevel) {
        const bounds = this.getCenterBounds(zoomLevel);
        return {
            x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
        };
    },
    
    updateTarget() {
        if (!this.enabled || !GameState.gameState || !GameState.gameState.players || GameState.gameState.players.length === 0) return;

        const playerPositions = [];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        GameState.gameState.players.forEach(player => {
            const animation = GameState.playerAnimations[player.persistentId];
            const pos = this.resolveAnimationPoint(player, animation);

            playerPositions.push(pos);
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        this.calculateOptimalZoom(playerPositions);

        const targetCenter = this.clampCenter(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            this.targetZoom
        );
        this.targetX = targetCenter.x;
        this.targetY = targetCenter.y;
    },
    
    calculateOptimalZoom(playerPositions) {
        if (playerPositions.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        playerPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        const cellSize = (GameState.canvasLogicalSize || CONFIG.CANVAS_LOGICAL_SIZE) / CONFIG.BOARD_SIZE;
        const playerRadius = cellSize * CONFIG.VISUAL.PLAYER_RADIUS_FACTOR;
        // Keep margins tight so camera stays as zoomed in as possible while preserving visibility.
        const edgePadding = Math.max(this.framingPadding, playerRadius + 4);
        const spreadX = (maxX - minX) + (edgePadding * 2);
        const spreadY = (maxY - minY) + (edgePadding * 2);
        const { width: canvasWidth, height: canvasHeight } = this.getCanvasSize();
        const zoomForWidth = canvasWidth / Math.max(spreadX, 1);
        const zoomForHeight = canvasHeight / Math.max(spreadY, 1);
        const requiredZoom = Math.min(zoomForWidth, zoomForHeight);
        const boardSize = GameState.canvasLogicalSize || CONFIG.CANVAS_LOGICAL_SIZE;
        const boardFitZoom = Math.min(canvasWidth / boardSize, canvasHeight / boardSize);
        const minAllowedZoom = Math.min(CONFIG.CAMERA.MIN_ZOOM, boardFitZoom);

        this.targetZoom = Math.max(minAllowedZoom, Math.min(CONFIG.CAMERA.MAX_ZOOM, requiredZoom));
    },
    
    update() {
        if (!this.enabled) return;

        this.updateTarget();

        this.currentX += (this.targetX - this.currentX) * CONFIG.CAMERA.SMOOTHING;
        this.currentY += (this.targetY - this.currentY) * CONFIG.CAMERA.SMOOTHING;

        const zoomSmoothing = this.targetZoom > this.zoom
            ? Math.max(CONFIG.CAMERA.ZOOM_SMOOTHING, 0.16)
            : CONFIG.CAMERA.ZOOM_SMOOTHING;
        this.zoom += (this.targetZoom - this.zoom) * zoomSmoothing;

        const clampedCurrent = this.clampCenter(this.currentX, this.currentY, this.zoom);
        this.currentX = clampedCurrent.x;
        this.currentY = clampedCurrent.y;
    },
    
    apply(ctx) {
        if (!this.enabled) return;

        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const canvas = DOM.canvas;
        const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.currentX, -this.currentY);
    },
    
    reset() {
        this.currentX = 0;
        this.currentY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.zoom = this.targetZoom = CONFIG.CAMERA.DEFAULT_ZOOM;
    },
    
    updateButtonIcon() {
        const cameraIcon = DOM.mobileCameraBtn.querySelector('.camera-icon');
        const cameraState = DOM.mobileCameraBtn.querySelector('.camera-state');
        if (cameraIcon) {
            if (this.enabled) {
                cameraIcon.textContent = '🎯';
                DOM.mobileCameraBtn.classList.add('active');
                DOM.mobileCameraBtn.setAttribute('aria-label', 'Disable follow camera');
                if (cameraState) cameraState.textContent = 'On';
            } else {
                cameraIcon.textContent = '📷';
                DOM.mobileCameraBtn.classList.remove('active');
                DOM.mobileCameraBtn.setAttribute('aria-label', 'Enable follow camera');
                if (cameraState) cameraState.textContent = 'Off';
            }
        }
    }
};
