// Camera system for mobile
const Camera = {
    enabled: false,
    zoom: CONFIG.CAMERA.DEFAULT_ZOOM,
    targetZoom: CONFIG.CAMERA.DEFAULT_ZOOM,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    
    updateTarget() {
        if (!this.enabled || !GameState.gameState || !GameState.gameState.players || GameState.gameState.players.length === 0) return;

        const playerPositions = [];
        let totalX = 0;
        let totalY = 0;

        GameState.gameState.players.forEach(player => {
            let pos;
            const animation = GameState.playerAnimations[player.persistentId];
            if (animation && animation.locked) {
                const fromPos = Utils.getPosition(animation.from);
                const toPos = Utils.getPosition(animation.to);
                pos = {
                    x: fromPos.x + (toPos.x - fromPos.x) * animation.progress,
                    y: fromPos.y + (toPos.y - fromPos.y) * animation.progress
                };
            } else {
                pos = Utils.getPosition(player.position);
            }

            playerPositions.push(pos);
            totalX += pos.x;
            totalY += pos.y;
        });

        this.targetX = totalX / playerPositions.length;
        this.targetY = totalY / playerPositions.length;

        this.calculateOptimalZoom(playerPositions);
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

        const spreadX = maxX - minX;
        const spreadY = maxY - minY;
        const maxSpread = Math.max(spreadX, spreadY);

        const padding = 100;
        const requiredSpread = maxSpread + padding;

        const canvas = DOM.canvas;
        const isMobile = window.innerWidth <= 768;
        const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
        const minCanvasDimension = Math.min(canvasWidth, canvasHeight);

        const requiredZoom = minCanvasDimension / requiredSpread;

        this.targetZoom = Math.max(CONFIG.CAMERA.MIN_ZOOM, Math.min(CONFIG.CAMERA.MAX_ZOOM, requiredZoom));
    },
    
    update() {
        if (!this.enabled) return;

        this.currentX += (this.targetX - this.currentX) * CONFIG.CAMERA.SMOOTHING;
        this.currentY += (this.targetY - this.currentY) * CONFIG.CAMERA.SMOOTHING;

        this.zoom += (this.targetZoom - this.zoom) * CONFIG.CAMERA.ZOOM_SMOOTHING;

        if (Math.floor(performance.now() / 50) % CONFIG.PERFORMANCE.CAMERA_UPDATE_THROTTLE === 0) {
            this.updateTarget();
        }
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
        if (cameraIcon) {
            if (this.enabled) {
                cameraIcon.textContent = '🔍';
                DOM.mobileCameraBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            } else {
                cameraIcon.textContent = '📷';
                DOM.mobileCameraBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
            }
        }
    }
};
