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
        game.setPlayerReady('sock-1', true);
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
        game.setPlayerReady('sock-1', true);
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
        assert.deepEqual(move.movementPath, [99, 100, 99, 98]);
        assert.deepEqual(move.snake, { from: 98, to: 78 });
        assert.equal(move.newPosition, 78);
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

    it('resolves ladder mines immediately and turns them into reusable voids', () => {
        const game = new Game('MINES1');
        const { player } = game.addPlayer('alice', 'Alice');
        game.started = true;
        game.mines = [14];
        game.rollDice = () => [4];
        const move = game.movePlayer('alice');
        assert.deepEqual(move.ladder, { from: 4, to: 14 });
        assert.deepEqual(move.mine, { position: 14 });
        assert.equal(player.position, 1);
        assert.deepEqual(game.mines, []);
        assert.deepEqual(game.voids, [14]);
        game.unlockTurn();
        player.position = 0;
        const again = game.movePlayer('alice');
        assert.deepEqual(again.voidFall, { from: 14, to: 2 });
        assert.equal(player.position, 2);
    });

    it('resolves direct mines and limits void fallback to tile one', () => {
        const game = new Game('MINES2');
        game.addPlayer('alice', 'Alice');
        game.started = true;
        game.mines = [3];
        game.rollDice = () => [3];
        assert.equal(game.movePlayer('alice').newPosition, 1);
        game.unlockTurn();
        game.rollDice = () => [2];
        const move = game.movePlayer('alice');
        assert.deepEqual(move.voidFall, { from: 3, to: 1 });
    });

    it('does not animate an overshoot in stay mode', () => {
        const game = new Game('STAY01');
        const { player } = game.addPlayer('alice', 'Alice');
        game.started = true;
        player.position = 99;
        game.rollDice = () => [5];
        const move = game.movePlayer('alice');
        assert.equal(move.newPosition, 99);
        assert.deepEqual(move.movementPath, []);
        assert.equal(game.winner, null);
    });

    it('gives another turn for two-dice doubles, including an overshoot', () => {
        const game = new Game('DICE02', false, 2);
        const { player } = game.addPlayer('a', 'Alice');
        game.addPlayer('b', 'Bob');
        game.started = true;
        player.position = 99;
        game.rollDice = () => [3, 3];
        const move = game.movePlayer('a');
        assert.equal(move.anotherTurn, true);
        assert.equal(game.currentTurn, 0);
        assert.deepEqual(move.movementPath, []);
    });

    it('accepts either die showing six for entry without granting a non-double extra turn', () => {
        const game = new Game('ENTRY2', false, 2, 3, false, 5, false, false, true);
        game.addPlayer('a', 'Alice');
        game.addPlayer('b', 'Bob');
        game.started = true;
        game.rollDice = () => [2, 6];
        const move = game.movePlayer('a');
        assert.equal(move.enteredBoard, true);
        assert.equal(move.newPosition, 1);
        assert.equal(move.anotherTurn, false);
        assert.equal(game.currentTurn, 1);
    });

    it('preserves the active seat when an earlier player leaves', () => {
        const game = new Game('SEATS1');
        game.addPlayer('a', 'Alice');
        game.addPlayer('b', 'Bob');
        const { player } = game.addPlayer('c', 'Cara');
        game.currentTurn = 2;
        game.removePlayer('a');
        assert.equal(game.players[game.currentTurn], player);
        game.removePlayer('c');
        assert.equal(game.players[game.currentTurn].id, 'b');
        assert.equal(Object.keys(game.playerRollCounts).length, 1);
    });

    it('reuses free default customizations after a seat is removed', () => {
        const game = new Game('STYLE1');
        game.addPlayer('a', 'Alice');
        game.addPlayer('b', 'Bob');
        game.removePlayer('a');
        assert.equal(game.addPlayer('c', 'Cara').success, true);
        assert.equal(new Set(game.players.map(p => p.color)).size, 2);
    });

    it('normalizes option types and chooses supported customization values', () => {
        const game = new Game('INPUT1', 'yes', '2', 2.5, 'true', Infinity);
        assert.equal(game.diceCount, 1);
        assert.equal(game.snakeThreshold, 3);
        assert.equal(game.minesCount, 5);
        assert.equal(game.minesEnabled, false);
        assert.equal(game.discoverable, false);
        const { player } = game.addPlayer('a', 'Alice', null, 'unsupported', 'unknown');
        assert.equal(player.color, '#FF6B6B');
        assert.equal(player.icon, '🎮');
    });

    it('bounds mine generation by the number of available tiles', () => {
        const game = new Game('MINES3');
        game.voids = Array.from({ length: 98 }, (_, i) => i + 2);
        game.generateMines();
        assert.deepEqual(game.mines, []);
    });

    it('requires ready players and does not restart an active game', () => {
        const game = new Game('START1');
        game.addPlayer('a', 'Alice');
        assert.equal(game.movePlayer('a').success, false);
        assert.equal(game.startGame(), false);
        game.setPlayerReady('a', true);
        assert.equal(game.startGame(), true);
        assert.equal(game.startGame(), false);
    });

    it('grants revenge once, keeps the choice private, and consumes it on a roll', () => {
        const game = new Game('POWER1', false, 1, 2);
        const { player: alice } = game.addPlayer('a', 'Alice');
        const { player: bob } = game.addPlayer('b', 'Bob');
        game.started = true;
        alice.snakeHits = 2;
        assert.equal(game.maybeGrantRevengePower(alice), true);
        assert.equal(game.setControlledDice('a', bob.persistentId, [1.5]).success, false);
        assert.equal(game.setControlledDice('a', bob.persistentId, [2]).success, true);
        assert.equal(game.getState().players[0].controlledDiceRoll, undefined);
        game.currentTurn = 1;
        const move = game.movePlayer('b');
        assert.deepEqual(move.diceRolls, [2]);
        assert.equal(move.wasControlled, true);
        assert.equal(alice.controlledDiceRoll, null);
        assert.equal(game.maybeGrantRevengePower(alice), false);
    });

    it('resets hazards, power, scores and locks without reusing turn identifiers', () => {
        const game = new Game('RESET1');
        const { player } = game.addPlayer('a', 'Alice');
        game.started = true;
        game.rollDice = () => [6];
        game.movePlayer('a');
        const turnId = game.turnId;
        game.voids = [20];
        player.hasUsedPower = true;
        game.reset();
        assert.equal(game.started, false);
        assert.equal(game.turnLocked, false);
        assert.equal(player.position, 0);
        assert.equal(player.hasUsedPower, false);
        assert.deepEqual(game.voids, []);
        game.setPlayerReady('a', true);
        game.startGame();
        assert.ok(game.movePlayer('a').turnId > turnId);
    });
});
