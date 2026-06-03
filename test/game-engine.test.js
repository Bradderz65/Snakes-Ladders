const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    Game,
    SNAKES,
    LADDERS,
    WINNING_POSITION,
    sanitizePlayerName
} = require('../lib/game-engine');

describe('sanitizePlayerName', () => {
    it('strips HTML-like characters', () => {
        assert.equal(sanitizePlayerName('<b>XSS</b>'), 'bXSS/b');
    });

    it('falls back to Player for empty input', () => {
        assert.equal(sanitizePlayerName('   '), 'Player');
    });

    it('trims and caps length', () => {
        const long = 'a'.repeat(30);
        assert.equal(sanitizePlayerName(long).length, 15);
    });
});

describe('Game', () => {
    it('assigns first player as host with roll count tracking', () => {
        const game = new Game('TEST01');
        const result = game.addPlayer('sock-1', 'Alice', null, '#FF6B6B', '🎮');

        assert.equal(result.success, true);
        assert.equal(game.hostPersistentId, result.player.persistentId);
        assert.equal(game.playerRollCounts[result.player.persistentId], 0);
    });

    it('rejects duplicate color customization', () => {
        const game = new Game('TEST02');
        game.addPlayer('sock-1', 'Alice', null, '#FF6B6B', '🎮');
        const second = game.addPlayer('sock-2', 'Bob', null, '#FF6B6B', '🎯');

        assert.equal(second.success, false);
        assert.match(second.message, /color/i);
    });

    it('includes rules summary with enabled options', () => {
        const game = new Game('TEST03', false, 2, 4, true, 7, false, false, true, true);
        const summary = game.getRulesSummary();

        assert.match(summary, /2 dice/);
        assert.match(summary, /mines/);
        assert.match(summary, /roll 6 to start/);
        assert.match(summary, /exact roll to win/);
    });

    it('uses default snakes and ladders board', () => {
        const game = new Game('TEST04');
        assert.deepEqual(game.getSnakes(), SNAKES);
        assert.deepEqual(game.getLadders(), LADDERS);
    });

    it('locks and unlocks turns', () => {
        const game = new Game('TEST05');
        let lockedRoom = null;
        game.onTurnLocked = (roomId) => {
            lockedRoom = roomId;
        };

        const { player } = game.addPlayer('sock-1', 'Alice');
        game.lockTurnForPlayer(player);

        assert.equal(game.turnLocked, true);
        assert.equal(lockedRoom, 'TEST05');

        game.unlockTurn();
        assert.equal(game.turnLocked, false);
    });

    it('requireSixToStart keeps player at 0 without a six', () => {
        const game = new Game('TEST06', false, 1, 3, false, 5, false, false, true, false);
        game.addPlayer('sock-1', 'Alice');
        game.startGame();

        game.rollDice = () => [3];
        const move = game.movePlayer('sock-1');

        assert.equal(move.success, true);
        assert.equal(move.newPosition, 0);
        assert.equal(move.needsSixToStart, true);
    });

    it('requireSixToStart enters board on six', () => {
        const game = new Game('TEST07', false, 1, 3, false, 5, false, false, true, false);
        game.addPlayer('sock-1', 'Alice');
        game.startGame();

        game.rollDice = () => [6];
        const move = game.movePlayer('sock-1');

        assert.equal(move.success, true);
        assert.equal(move.newPosition, 1);
        assert.equal(move.enteredBoard, true);
    });

    it('exactRollToWin bounces when overshooting 100', () => {
        const game = new Game('TEST08', false, 1, 3, false, 5, false, false, false, true);
        const { player } = game.addPlayer('sock-1', 'Alice');
        player.position = 98;
        game.started = true;

        game.rollDice = () => [4];
        const move = game.movePlayer('sock-1');

        assert.equal(move.success, true);
        assert.equal(move.bouncedBack, true);
        assert.equal(move.newPosition, 98);
    });

    it('increments player roll counts on move', () => {
        const game = new Game('TEST09');
        const { player } = game.addPlayer('sock-1', 'Alice');
        player.position = 10;
        game.started = true;

        game.rollDice = () => [2];
        game.movePlayer('sock-1');

        assert.equal(game.playerRollCounts[player.persistentId], 1);
    });

    it('detects winner at winning position', () => {
        const game = new Game('TEST10');
        const { player } = game.addPlayer('sock-1', 'Alice');
        player.position = WINNING_POSITION - 1;
        game.started = true;

        game.rollDice = () => [1];
        const move = game.movePlayer('sock-1');

        assert.equal(move.success, true);
        assert.equal(move.newPosition, WINNING_POSITION);
        assert.ok(game.winner);
    });
});