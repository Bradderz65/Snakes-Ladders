// Socket events synchronize authoritative state; animations only present completed moves.
const SocketHandlers = {
    awaitingSnapshot: false,
    lastWinnerId: null,

    leaveSession(message, clearSavedSession = true) {
        Animations.cancel();
        if (clearSavedSession) GameState.clearSession();
        GameState.currentRoom = null;
        GameState.currentPlayer = null;
        GameState.reconnectToken = null;
        GameState.reconnectSuppressed = !clearSavedSession;
        GameState.gameState = null;
        GameState.isHost = false;
        GameState.isReconnecting = false;
        GameState.lastRoomPeek = null;
        this.awaitingSnapshot = false;
        this.lastWinnerId = null;
        DOM.winnerModal.classList.remove('active');
        DOM.diceControlModal.classList.remove('active');
        UI.updateTakenCustomizations({ colors: [], icons: [] });
        UI.switchScreen('welcome');
        if (message) UI.showNotification(message, 'info');
    },

    init(socket) {
        GameState.socket = socket;
        const acceptSession = (event, message) => socket.on(event, ({ roomId, player, reconnectToken, isHost }) => {
            Animations.cancel();
            GameState.currentRoom = roomId;
            GameState.currentPlayer = player;
            GameState.reconnectToken = reconnectToken;
            GameState.reconnectSuppressed = false;
            GameState.isHost = !!isHost;
            GameState.isReconnecting = false;
            GameState.saveSession();
            DOM.roomCodeDisplay.textContent = roomId;
            this.awaitingSnapshot = true;
            UI.showNotification(message, 'success');
            // Remove consumed invite parameters so refresh only restores the session.
            history.replaceState(null, '', window.location.pathname);
        });
        acceptSession('room-created', 'Room created. Share the code or invite link with friends.');
        acceptSession('room-joined', 'Joined room successfully!');
        acceptSession('reconnected', 'Reconnected successfully!');

        socket.on('connect', () => {
            UI.updateConnectionStatus('connected', 'Connected');
            const session = GameState.reconnectSuppressed ? null : GameState.currentRoom && GameState.reconnectToken ? {
                roomId: GameState.currentRoom, persistentId: GameState.currentPlayer.persistentId,
                reconnectToken: GameState.reconnectToken
            } : GameState.loadSession();
            if (session) {
                GameState.isReconnecting = true;
                socket.emit('reconnect-to-room', session);
            } else {
                GameState.isReconnecting = false;
                socket.emit('discover-games');
                const invite = Utils.getUrlParameters();
                if (invite.room && /^[a-z0-9]{6}$/i.test(invite.room)) {
                    GameState.currentMode = 'join';
                    UI.showSetupScreen('join');
                    DOM.roomCodeInput.value = invite.room.toUpperCase();
                    socket.emit('peek-room', { roomId: invite.room });
                }
            }
        });
        socket.on('disconnect', () => {
            Animations.cancel();
            UI.updateConnectionStatus('disconnected', 'Disconnected — reconnecting…');
            if (GameState.gameState?.started) UI.updateGameScreen();
            UI.updateLobby();
        });
        socket.on('connect_error', () => UI.updateConnectionStatus('disconnected', 'Server unavailable — retrying…'));
        socket.io.on('reconnect_attempt', () => UI.updateConnectionStatus('connecting', 'Reconnecting…'));

        socket.on('kicked-from-room', () => this.leaveSession('You were removed from the room'));
        socket.on('session-replaced', () => this.leaveSession('This player session is now open in another tab.', false));
        socket.on('room-closed', ({ message }) => this.leaveSession(message));
        socket.on('disconnected', () => this.leaveSession('You have left the game'));
        socket.on('player-kicked', ({ playerName }) => UI.showNotification(`${playerName} left the lobby`, 'info'));
        socket.on('player-left', ({ playerName }) => UI.showNotification(`${playerName} left the game`, 'info'));
        socket.on('bot-took-over', ({ playerName, temporary }) => UI.showNotification(
            temporary ? `AI is playing for ${playerName} until they reconnect.` : `AI took over for ${playerName}.`, 'info'));
        socket.on('bot-dice-control-set', ({ botName, targetPlayerName }) => UI.showNotification(`${botName} (AI) used revenge power on ${targetPlayerName}`, 'warning'));
        socket.on('dice-control-set', ({ targetPlayerName, diceValues }) => UI.showNotification(`${targetPlayerName} will roll ${diceValues.join('–')} on their next turn.`, 'success'));

        socket.on('room-peek', data => {
            if (data.roomId !== DOM.roomCodeInput.value.trim().toUpperCase()) return;
            GameState.lastRoomPeek = data;
            UI.updateTakenCustomizations(data.takenCustomizations || { colors: [], icons: [] });
        });
        socket.on('game-state', state => {
            if (!GameState.currentRoom || state.roomId !== GameState.currentRoom) return;
            const previousStarted = GameState.gameState?.started;
            GameState.gameState = state;
            GameState.currentDiceCount = state.diceCount;
            GameState.playerRollCounts = { ...state.playerRollCounts };
            GameState.totalRolls = Object.values(state.playerRollCounts).reduce((a, b) => a + b, 0);
            GameState.isHost = GameState.currentPlayer?.persistentId === state.hostPersistentId;
            if (this.awaitingSnapshot || previousStarted !== state.started) {
                UI.switchScreen(state.started ? 'game' : 'lobby');
                this.awaitingSnapshot = false;
            }
            UI.updateLobby();
            if (state.started) UI.updateGameScreen();
            if (!state.winner) this.lastWinnerId = null;
            if (state.winner && !GameState.turnResolutionInProgress) this.showWinner(state.winner);
        });
        socket.on('game-started', () => {
            Animations.cancel();
            this.lastWinnerId = null;
            UI.showNotification('Game started!', 'success');
        });
        socket.on('game-reset', () => {
            Animations.cancel();
            this.lastWinnerId = null;
            DOM.winnerModal.classList.remove('active');
            DOM.diceControlModal.classList.remove('active');
            UI.showNotification('Game reset. Ready up for another round.', 'info');
        });
        socket.on('turn-unlocked', ({ roomId, turnId }) => {
            if (roomId !== GameState.currentRoom || turnId !== GameState.gameState?.turnId) return;
            Animations.cancel();
            UI.updateGameScreen();
        });
        socket.on('dice-rolled', result => {
            if (result.roomId === GameState.currentRoom) this.handleDiceRoll(result);
        });
        socket.on('error', ({ message, code }) => {
            if (GameState.isReconnecting && (code === 'SESSION_EXPIRED' || code === 'ROOM_NOT_FOUND')) {
                this.leaveSession(message);
                return;
            }
            if (code === 'ROLL_REJECTED' || (!GameState.animationInProgress && !GameState.diceAnimationInProgress)) {
                GameState.turnResolutionInProgress = false;
                if (GameState.gameState?.started) UI.updateGameScreen();
            }
            UI.showNotification(message, 'error');
        });
        socket.on('test-explosion-triggered', ({ position }) => {
            AudioSystem.play('mineExplosion');
            Explosions.create(position);
        });
        socket.on('games-discovered', data => {
            GameState.discoveredGames.clear();
            GameState.lastDiscoveryTime = Date.now();
            GameState.discoveredGames.set('local', {
                ...data,
                games: data.games.map(game => ({ ...game, sameServer: true, serverIP: data.serverIP, serverPort: data.serverPort }))
            });
            Discovery.updateLocalGamesList();
        });
    },

    showWinner(winner) {
        if (this.lastWinnerId === winner.persistentId) return;
        this.lastWinnerId = winner.persistentId;
        UI.showWinnerModal(winner);
    },

    handleDiceRoll(result) {
        Animations.cancel();
        const player = result.player;
        if (!player || !Array.isArray(result.movementPath)) return;
        GameState.turnResolutionInProgress = true;
        GameState.diceAnimationInProgress = true;
        GameState.pendingMinePosition = result.mine?.position || null;
        GameState.playerAnimations[player.persistentId] = {
            from: result.oldPosition, to: result.oldPosition, progress: 0, locked: true
        };
        UI.updateGameScreen();
        Renderer.startRenderLoop();
        Animations.animateDiceRoll(result.diceRolls, () => {
            Animations.animateMove(result, () => {
                GameState.turnResolutionInProgress = false;
                GameState.pendingMinePosition = null;
                if (GameState.socket.connected) {
                    GameState.socket.emit('turn-animation-complete', {
                        roomId: result.roomId, playerId: player.persistentId, turnId: result.turnId
                    });
                }
                this.showMoveMessage(result);
                UI.updateGameScreen();
                if (!Renderer.hasActiveAnimations()) Renderer.stopRenderLoop();
                if (result.winner) this.showWinner(result.winner);
            });
        }, { playerName: player.persistentId === GameState.currentPlayer?.persistentId ? '' : player.name });
    },

    showMoveMessage(result) {
        const name = result.player.name;
        if (result.mine) UI.showNotification(`Mine on tile ${result.mine.position}! ${name} falls to tile 1.`, 'error');
        else if (result.voidFall) UI.showNotification(`${name} fell into a void and moved back to ${result.newPosition}.`, 'warning');
        else if (result.snake) UI.showNotification(`Snake! ${name} slides from ${result.snake.from} to ${result.snake.to}.`, 'info');
        else if (result.ladder) UI.showNotification(`Ladder! ${name} climbs from ${result.ladder.from} to ${result.ladder.to}.`, 'success');
        else if (result.needsSixToStart) UI.showNotification(`${name} needs a six to enter the board.`, 'info');
        else if (result.enteredBoard) UI.showNotification(`${name} rolled a six and entered the board.`, 'success');
        else if (result.bouncedBack) UI.showNotification(`${name} bounced back to tile ${result.newPosition}.`, 'info');
        else if (result.anotherTurn && !result.winner) UI.showNotification(`${name} rolls again!`, 'success');
        if (result.powerGranted && result.player.persistentId === GameState.currentPlayer?.persistentId) {
            UI.showNotification('Revenge power unlocked! Choose another player’s next dice roll.', 'success');
        }
    }
};
