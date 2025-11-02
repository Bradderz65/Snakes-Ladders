// Configuration and constants
const CONFIG = {
    BOARD_SIZE: 10,
    CANVAS_LOGICAL_SIZE: 800,
    
    // Camera settings
    CAMERA: {
        MIN_ZOOM: 1.2,
        MAX_ZOOM: 2.5,
        DEFAULT_ZOOM: 1.8,
        SMOOTHING: 0.08,
        ZOOM_SMOOTHING: 0.05
    },
    
    // Animation settings
    ANIMATION: {
        DICE_FRAMES: 14,
        DICE_FRAME_DELAY: 70,
        STEP_DURATION_BASE: 300,
        STEP_DURATION_REDUCTION: 8,
        SOUND_INTERVAL: 180,
        SNAKE_DURATION: 1050,
        LADDER_DURATION: 750,
        TRANSITION_DELAY: 200
    },
    
    // Performance settings
    PERFORMANCE: {
        TARGET_FPS: 60,
        TARGET_FRAME_TIME: 16,
        SLOW_FRAME_THRESHOLD: 16,
        CAMERA_UPDATE_THROTTLE: 3
    },
    
    // Sound volumes
    SOUND: {
        DICE_ROLL: 0.5,
        DICE_ROLL2: 0.5,
        PLAYER_MOVE: 0.375,
        PLAYER_MOVE2: 0.375,
        CLIMB_LADDER: 0.3,
        DOWN_SNAKE: 0.3,
        MINE_EXPLOSION: 0.6
    },
    
    // Visual settings
    VISUAL: {
        PLAYER_RADIUS_FACTOR: 0.216,
        PLAYER_BOUNCE_HEIGHT: 15,
        FULL_VISIBILITY_DISTANCE: 5,
        FADE_START_DISTANCE: 8,
        DISTANT_OPACITY: 0.2
    }
};
