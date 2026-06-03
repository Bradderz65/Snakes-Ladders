// Dev-only script integrity check (localhost)
(function () {
    const script = document.currentScript;
    if (!script?.hasAttribute('data-dev-only')) return;
    if (!/localhost|127\.0\.0\.1/.test(window.location.hostname)) return;

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

    /** Top-level const bindings are not properties of window; probe global scope. */
    function isModuleLoaded(name) {
        if (typeof globalThis[name] !== 'undefined') return true;
        try {
            return new Function(`return typeof ${name} !== 'undefined'`)();
        } catch {
            return false;
        }
    }

    console.log('Checking module integrity...');

    let allModulesLoaded = true;

    requiredModules.forEach(moduleName => {
        if (!isModuleLoaded(moduleName)) {
            console.error(`Module ${moduleName} not loaded!`);
            allModulesLoaded = false;
        } else {
            console.log(`${moduleName} loaded`);
        }
    });

    if (allModulesLoaded) {
        console.log('All modules loaded successfully.');
    } else {
        console.error('Some modules failed to load. Check the Network tab for 404s or syntax errors above.');
    }
})();