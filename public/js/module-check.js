// Module integrity check - add this temporarily to verify all modules loaded
console.log('🔍 Checking module integrity...');

const requiredModules = [
    'CONFIG',
    'GameState',
    'Utils',
    'DOM',
    'AudioSystem',
    'PerformanceMonitor',
    'Camera',
    'Draw',
    'Explosions',
    'Renderer',
    'Animations',
    'Customization',
    'Discovery',
    'UI',
    'SocketHandlers'
];

let allModulesLoaded = true;

requiredModules.forEach(moduleName => {
    if (typeof window[moduleName] === 'undefined') {
        console.error(`❌ Module ${moduleName} not loaded!`);
        allModulesLoaded = false;
    } else {
        console.log(`✅ ${moduleName} loaded`);
    }
});

if (allModulesLoaded) {
    console.log('✨ All modules loaded successfully!');
} else {
    console.error('⚠️ Some modules failed to load. Check the console for details.');
}
