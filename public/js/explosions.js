// Explosion particle system
class ExplosionParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.size = Math.random() * 4 + 2;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.015;
        this.color = `hsl(${Math.random() * 60 + 10}, 100%, ${Math.random() * 50 + 50}%)`;
        this.isSpark = Math.random() < 0.3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.vx *= 0.98;
        this.life -= this.decay;
        this.size *= 0.98;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.life;

        if (this.isSpark) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

const Explosions = {
    create(position) {
        const pos = Utils.getPosition(position);
        const explosion = {
            x: pos.x,
            y: pos.y,
            minePosition: position,
            startTime: Date.now(),
            duration: 1500,
            particles: [],
            holeFadeIn: 0
        };

        for (let i = 0; i < 25; i++) {
            explosion.particles.push(new ExplosionParticle(pos.x, pos.y));
        }

        GameState.explosionAnimations.push(explosion);
        Renderer.startRenderLoop();
    },
    
    draw() {
        const cellSize = GameState.canvasLogicalSize / CONFIG.BOARD_SIZE;
        const currentTime = Date.now();
        const ctx = DOM.ctx;

        const hadExplosions = GameState.explosionAnimations.length > 0;
        GameState.explosionAnimations = GameState.explosionAnimations.filter(explosion => {
            const elapsed = currentTime - explosion.startTime;
            const progress = Math.min(elapsed / explosion.duration, 1);

            if (progress >= 1) {
                if (GameState.currentRoom && explosion.minePosition) {
                    GameState.socket.emit('explosion-complete', {
                        roomId: GameState.currentRoom,
                        position: explosion.minePosition
                    });
                }
                return false;
            }

            explosion.holeFadeIn = Math.max(0, Math.min((progress - 0.3) / 0.4, 1));

            ctx.save();

            const phase1 = 0.15;
            const phase2 = 0.5;
            const phase3 = 1.0;

            explosion.particles = explosion.particles.filter(particle => {
                particle.update();
                if (particle.life > 0) {
                    particle.draw(ctx);
                    return true;
                }
                return false;
            });

            if (progress < phase2) {
                const expansionProgress = progress / phase2;
                const newParticles = Math.floor((1 - expansionProgress) * 3);
                for (let i = 0; i < newParticles; i++) {
                    explosion.particles.push(new ExplosionParticle(explosion.x, explosion.y));
                }
            }

            if (progress < phase1) {
                const flashProgress = progress / phase1;
                const flashRadius = cellSize * 0.5 * (1 + flashProgress * 0.5);
                const flashAlpha = 1 - flashProgress * 0.3;

                const flashGradient = ctx.createRadialGradient(
                    explosion.x, explosion.y, 0,
                    explosion.x, explosion.y, flashRadius
                );
                flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
                flashGradient.addColorStop(0.3, `rgba(255, 255, 200, ${flashAlpha * 0.9})`);
                flashGradient.addColorStop(0.6, `rgba(255, 200, 100, ${flashAlpha * 0.7})`);
                flashGradient.addColorStop(1, `rgba(255, 100, 0, 0)`);

                ctx.fillStyle = flashGradient;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, flashRadius, 0, Math.PI * 2);
                ctx.fill();

            } else if (progress < phase2) {
                const ringProgress = (progress - phase1) / (phase2 - phase1);
                const ringRadius = cellSize * 0.6 * (1 + ringProgress * 1.5);
                const ringAlpha = (1 - ringProgress) * 0.8;

                const ringGradient = ctx.createRadialGradient(
                    explosion.x, explosion.y, ringRadius * 0.3,
                    explosion.x, explosion.y, ringRadius
                );
                ringGradient.addColorStop(0, `rgba(255, 255, 255, ${ringAlpha * 0.3})`);
                ringGradient.addColorStop(0.4, `rgba(255, 200, 0, ${ringAlpha * 0.8})`);
                ringGradient.addColorStop(0.7, `rgba(255, 69, 0, ${ringAlpha * 0.6})`);
                ringGradient.addColorStop(1, `rgba(139, 0, 0, 0)`);

                ctx.fillStyle = ringGradient;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, ringRadius, 0, Math.PI * 2);
                ctx.fill();

            } else {
                const smokeProgress = (progress - phase2) / (phase3 - phase2);
                const smokeRadius = cellSize * 0.8;
                const smokeAlpha = (1 - smokeProgress) * 0.6;

                const smokeGradient = ctx.createRadialGradient(
                    explosion.x, explosion.y, cellSize * 0.2 * (1 - explosion.holeFadeIn * 0.5),
                    explosion.x, explosion.y, smokeRadius
                );
                smokeGradient.addColorStop(0, `rgba(20, 20, 20, ${smokeAlpha * (1 - explosion.holeFadeIn)})`);
                smokeGradient.addColorStop(0.5, `rgba(40, 40, 40, ${smokeAlpha * (1 - explosion.holeFadeIn * 0.5)})`);
                smokeGradient.addColorStop(1, `rgba(60, 60, 60, 0)`);

                ctx.fillStyle = smokeGradient;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, smokeRadius, 0, Math.PI * 2);
                ctx.fill();

                if (explosion.holeFadeIn > 0) {
                    const holeRadius = cellSize * 0.35 * explosion.holeFadeIn;
                    const holeGradient = ctx.createRadialGradient(
                        explosion.x, explosion.y, 0,
                        explosion.x, explosion.y, holeRadius
                    );
                    holeGradient.addColorStop(0, `rgba(0, 0, 0, ${explosion.holeFadeIn})`);
                    holeGradient.addColorStop(0.5, `rgba(10, 10, 10, ${explosion.holeFadeIn * 0.8})`);
                    holeGradient.addColorStop(1, `rgba(30, 30, 30, ${explosion.holeFadeIn * 0.5})`);

                    ctx.fillStyle = holeGradient;
                    ctx.beginPath();
                    ctx.arc(explosion.x, explosion.y, holeRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
            return true;
        });
        
        if (hadExplosions && GameState.explosionAnimations.length === 0) {
            if (!Renderer.hasActiveAnimations()) {
                Renderer.stopRenderLoop();
            }
        }
    }
};
