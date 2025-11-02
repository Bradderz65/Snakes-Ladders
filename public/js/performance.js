// Performance monitoring system
const PerformanceMonitor = {
    enabled: true,
    frameCount: 0,
    lastFpsUpdate: 0,
    currentFps: 0,
    frameTimes: [],
    maxFrameTime: 0,
    avgFrameTime: 0,
    slowFrames: 0,
    frameStartTime: 0,
    
    startFrame() {
        this.frameStartTime = performance.now();
    },
    
    endFrame() {
        if (!this.enabled) return;
        
        const frameTime = performance.now() - this.frameStartTime;
        this.frameTimes.push(frameTime);
        
        if (this.frameTimes.length > 60) {
            this.frameTimes.shift();
        }
        
        this.avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.maxFrameTime = Math.max(...this.frameTimes);
        
        if (frameTime > CONFIG.PERFORMANCE.SLOW_FRAME_THRESHOLD) {
            this.slowFrames++;
            console.warn(`🐌 Slow frame detected: ${frameTime.toFixed(2)}ms`);
        }
        
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            if (Math.floor(now / 5000) % 1 === 0) {
                this.logPerformanceStats();
            }
        }
    },
    
    logPerformanceStats() {
        console.log(`📊 Performance Stats:`);
        console.log(`   FPS: ${this.currentFps}`);
        console.log(`   Avg Frame Time: ${this.avgFrameTime.toFixed(2)}ms`);
        console.log(`   Max Frame Time: ${this.maxFrameTime.toFixed(2)}ms`);
        console.log(`   Slow Frames: ${this.slowFrames}`);
        
        this.slowFrames = 0;
        this.maxFrameTime = 0;
    }
};
