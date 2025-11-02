// Audio system
const AudioSystem = {
    audioContext: null,
    soundBuffers: {},
    
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSounds();
        }
    },
    
    async loadSounds() {
        const soundFiles = {
            diceRoll: '/sounds/diceroll.mp3',
            diceRoll2: '/sounds/diceroll2.mp3',
            playerMove: '/sounds/playermove.mp3',
            playerMove2: '/sounds/playermove2.mp3',
            climbLadder: '/sounds/climbladder.mp3',
            downSnake: '/sounds/downsnake.mp3',
            mineExplosion: '/sounds/mine.mp3'
        };

        for (const [name, url] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.soundBuffers[name] = audioBuffer;
            } catch (error) {
                console.log(`Failed to load sound ${name}:`, error);
            }
        }
    },
    
    play(soundName, volume = 1.0) {
        const soundStartTime = performance.now();
        
        if (!this.audioContext || !this.soundBuffers[soundName]) {
            console.warn(`⚠️ Sound not available: ${soundName}`);
            return;
        }

        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.soundBuffers[soundName];
            gainNode.gain.value = (CONFIG.SOUND[soundName.toUpperCase().replace(/(\d)/g, '_$1')] || 0.5) * volume;
            
            // Start downSnake sound 0.5 seconds in to skip intro
            if (soundName === 'downSnake') {
                source.start(0, 0.5);
            } else {
                source.start(0);
            }
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Clean up after playback
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
            };
            
            const soundTime = performance.now() - soundStartTime;
            if (soundTime > 5) {
                console.warn(`🔊 Slow sound playback: ${soundName} took ${soundTime.toFixed(2)}ms`);
            }
            
        } catch (error) {
            console.error(`❌ Sound play failed: ${soundName}`, error);
            // Retry once for movement sounds
            if (soundName.includes('playerMove') && this.audioContext && this.soundBuffers[soundName]) {
                try {
                    setTimeout(() => this.play(soundName, volume * 0.8), 50);
                } catch (retryError) {
                    console.error(`❌ Sound retry failed: ${soundName}`, retryError);
                }
            }
        }
    },
    
    selectRandom(baseSound, altSound, baseProbability = 0.7) {
        return Math.random() < baseProbability ? baseSound : altSound;
    }
};
