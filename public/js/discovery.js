// Game discovery system
const Discovery = {
    startAutoDiscovery() {
        this.stopAutoDiscovery();
        
        GameState.socket.emit('discover-games');
        
        GameState.autoDiscoveryInterval = setInterval(() => {
            GameState.socket.emit('discover-games');
        }, 8000);
    },
    
    stopAutoDiscovery() {
        if (GameState.autoDiscoveryInterval) {
            clearInterval(GameState.autoDiscoveryInterval);
            GameState.autoDiscoveryInterval = null;
        }
    },
    
    updateLocalGamesList() {
        const allGames = [];

        GameState.discoveredGames.forEach(serverData => {
            serverData.games.forEach(game => {
                allGames.push(game);
            });
        });

        if (allGames.length === 0) {
            DOM.localGamesList.innerHTML = `
                <div class="no-games-message">
                    <span class="no-games-icon">🔍</span>
                    <p>No local games found</p>
                    <p class="no-games-hint">Create a discoverable game to see it here</p>
                </div>
            `;
            return;
        }

        allGames.sort((a, b) => b.createdAt - a.createdAt);

        DOM.localGamesList.innerHTML = '';
        allGames.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'local-game-item';

            const timeAgo = Utils.getTimeAgo(game.createdAt);
            const serverDisplay = `${game.serverIP}:${game.serverPort}`;

            gameItem.innerHTML = `
                <div class="game-info">
                    <div class="game-host">${game.hostname}</div>
                    <div class="game-details">
                        <span class="game-room-code">${game.roomId}</span>
                        <span class="game-players">${game.playerCount}/${game.maxPlayers} players</span>
                    </div>
                    <div class="game-meta">
                        <span class="game-time">${timeAgo}</span>
                        <span class="game-server">${serverDisplay}</span>
                    </div>
                </div>
                <button class="btn btn-small btn-join" onclick="Discovery.joinLocalGame('${game.roomId}', '${game.serverIP}', ${game.serverPort})">
                    Join
                </button>
            `;

            DOM.localGamesList.appendChild(gameItem);
        });
    },
    
    joinLocalGame(roomId, serverIP, serverPort) {
        const name = DOM.playerNameInput.value.trim();
        if (!name) {
            UI.showNotification('Please enter your name first', 'error');
            DOM.playerNameInput.focus();
            return;
        }

        const currentPort = parseInt(window.location.port) || 80;
        const currentHost = window.location.hostname;

        const isSameServer = (serverPort === currentPort) &&
            (serverIP === currentHost ||
             serverIP === 'localhost' ||
             currentHost === 'localhost' ||
             serverIP === '127.0.0.1' ||
             currentHost === '127.0.0.1');

        if (isSameServer) {
            if (GameState.gameState && GameState.gameState.players) {
                const conflicts = Customization.checkForConflicts(GameState.gameState.players);
                if (conflicts.length > 0) {
                    GameState.pendingJoinAction = {
                        type: 'join-room',
                        roomId: roomId,
                        playerName: name
                    };
                    Customization.showConflictModal(conflicts);
                    return;
                }
            }

            UI.showNotification(`Joining game ${roomId}...`, 'info');
            Customization.executeJoinAction({
                type: 'join-room',
                roomId: roomId,
                playerName: name
            });
        } else {
            const url = `http://${serverIP}:${serverPort}/?autoJoin=true&room=${roomId}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(GameState.selectedColor)}&icon=${encodeURIComponent(GameState.selectedIcon)}`;
            window.open(url, '_blank');
            UI.showNotification(`Opening game on ${serverIP}:${serverPort}`, 'info');
        }
    }
};
