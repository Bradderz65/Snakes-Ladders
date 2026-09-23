// Cancellable animations. A reset, disconnect or newer turn invalidates every callback.
const Animations = {
    generation: 0,
    timers: new Set(),

    cancel() {
        this.generation++;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        GameState.playerAnimations = {};
        GameState.animationInProgress = false;
        GameState.diceAnimationInProgress = false;
        GameState.turnResolutionInProgress = false;
        GameState.pendingTurnAnimationCompletion = null;
        GameState.pendingMinePosition = null;
        GameState.explosionAnimations = [];
        DOM.diceBackdrop.classList.remove('active');
        DOM.diceContainer.classList.remove('rolling');
        Renderer.stopRenderLoop();
    },

    delay(callback, ms) {
        const generation = this.generation;
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (generation === this.generation) callback();
        }, ms);
        this.timers.add(timer);
    },

    animatePlayerPosition(playerId, from, to, duration, onComplete, snake = false) {
        const generation = this.generation;
        const start = performance.now();
        const fromPoint = Utils.getPosition(from);
        const toPoint = Utils.getPosition(to);
        const control = snake ? Utils.getSnakeControlPoint(fromPoint, toPoint) : null;
        Renderer.startRenderLoop();
        const frame = now => {
            if (generation !== this.generation) return;
            const progress = Math.min((now - start) / duration, 1);
            const eased = Utils.easeInOutQuad(progress);
            GameState.playerAnimations[playerId] = {
                from, to, progress: eased, locked: true,
                isFollowingSnake: snake,
                currentBezierPos: snake ? Utils.getPointOnBezierCurve(fromPoint, control, toPoint, eased) : null
            };
            if (progress < 1) requestAnimationFrame(frame);
            else if (onComplete) onComplete();
        };
        requestAnimationFrame(frame);
    },

    animateMove(result, onComplete) {
        GameState.animationInProgress = true;
        const playerId = result.player.persistentId;
        const path = result.movementPath || [];
        const duration = Math.max(200, CONFIG.ANIMATION.STEP_DURATION_BASE - path.length * CONFIG.ANIMATION.STEP_DURATION_REDUCTION);
        const sound = AudioSystem.selectBySeed('playerMove', 'playerMove2', String(result.turnId), 0.7);
        const finish = () => {
            GameState.animationInProgress = false;
            delete GameState.playerAnimations[playerId];
            onComplete();
        };
        const hazard = () => {
            if (result.mine) {
                GameState.pendingMinePosition = null;
                AudioSystem.play('mineExplosion');
                Explosions.create(result.mine.position);
                this.animatePlayerPosition(playerId, result.mine.position, 1, 650, () => this.delay(finish, 850));
            } else if (result.voidFall) {
                AudioSystem.play('downSnake');
                this.animatePlayerPosition(playerId, result.voidFall.from, result.voidFall.to, 750, finish);
            } else if (result.snake) {
                AudioSystem.play('downSnake');
                this.animatePlayerPosition(playerId, result.snake.from, result.snake.to, CONFIG.ANIMATION.SNAKE_DURATION, finish, true);
            } else finish();
        };
        const transition = () => {
            if (result.ladder) {
                AudioSystem.play('climbLadder');
                this.animatePlayerPosition(playerId, result.ladder.from, result.ladder.to, CONFIG.ANIMATION.LADDER_DURATION, hazard);
            } else hazard();
        };
        const step = index => {
            if (index >= path.length) {
                if (result.snake || result.ladder || result.mine || result.voidFall) this.delay(transition, CONFIG.ANIMATION.TRANSITION_DELAY);
                else finish();
                return;
            }
            AudioSystem.play(sound);
            this.animatePlayerPosition(playerId, index ? path[index - 1] : result.oldPosition, path[index], duration, () => step(index + 1));
        };
        step(0);
    },

    animateDiceRoll(values, callback, options = {}) {
        const diceValues = Array.isArray(values) ? values : [values];
        DOM.diceContainer.replaceChildren();
        if (options.playerName) {
            const label = document.createElement('div');
            label.className = 'dice-roll-label';
            label.textContent = `${options.playerName} is rolling`;
            DOM.diceContainer.appendChild(label);
        }
        const dice = diceValues.map(() => {
            const element = document.createElement('div');
            element.className = 'dice rolling';
            for (let i = 0; i < 9; i++) {
                const dot = document.createElement('div');
                dot.className = 'dice-dot';
                element.appendChild(dot);
            }
            DOM.diceContainer.appendChild(element);
            return element;
        });
        AudioSystem.play(AudioSystem.selectRandom('diceRoll', 'diceRoll2', 0.7));
        DOM.diceBackdrop.classList.add('active');
        DOM.diceContainer.classList.add('rolling');
        let frames = 0;
        const tick = () => {
            dice.forEach(element => this.setDiceFace(element, Math.floor(Math.random() * 6) + 1));
            if (++frames < CONFIG.ANIMATION.DICE_FRAMES) {
                this.delay(tick, CONFIG.ANIMATION.DICE_FRAME_DELAY);
                return;
            }
            dice.forEach((element, i) => this.setDiceFace(element, diceValues[i]));
            this.delay(() => {
                DOM.diceContainer.classList.remove('rolling');
                DOM.diceBackdrop.classList.remove('active');
                GameState.diceAnimationInProgress = false;
                callback();
            }, CONFIG.ANIMATION.DICE_RESULT_HOLD);
        };
        tick();
    },

    setDiceFace(element, number) {
        element.className = `dice dice-face-${number}`;
    }
};
