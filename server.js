const os = require('node:os');
const { createGameServer, isGameHost, TURN_LOCK_TIMEOUT_MS, ROLL_DEBOUNCE_MS } = require('./lib/game-server');
const { Game, sanitizePlayerName, MAX_PLAYER_NAME_LENGTH } = require('./lib/game-engine');

const runtime = createGameServer();

if (require.main === module) {
    runtime.startServer().then(({ port }) => {
        const address = Object.values(os.networkInterfaces()).flat()
            .find(iface => iface.family === 'IPv4' && !iface.internal)?.address || '127.0.0.1';
        console.log('\n🎲 Snakes and Ladders Server Running 🎲');
        console.log(`\n📡 Local:    http://localhost:${port}`);
        console.log(`📡 Network:  http://${address}:${port}`);
        console.log('\nShare the network URL with friends to play together!\n');
    }).catch(error => {
        console.error(`Unable to start server: ${error.message}`);
        process.exitCode = 1;
    });

    const shutdown = () => runtime.stopServer().then(() => process.exit(0));
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

module.exports = {
    ...runtime, createGameServer, Game, sanitizePlayerName, MAX_PLAYER_NAME_LENGTH,
    isGameHost, TURN_LOCK_TIMEOUT_MS, ROLL_DEBOUNCE_MS
};
