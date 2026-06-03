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
                    <p class="no-games-title">No sessions found</p>
                    <p class="no-games-hint">Create a discoverable room or refresh the list</p>
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

            const safeHost = Utils.escapeHtml(game.hostname || 'Local Game');
            const safeRules = game.rulesSummary ? Utils.escapeHtml(game.rulesSummary) : '';
            const rulesLine = safeRules
                ? `<div class="game-rules-preview">${safeRules}</div>`
                : '';

            gameItem.innerHTML = `
                <div class="game-info">
                    <div class="game-host">${safeHost}</div>
                    <div class="game-details">
                        <span class="game-room-code">${Utils.escapeHtml(game.roomId)}</span>
                        <span class="game-players">${game.playerCount}/${game.maxPlayers} players</span>
                    </div>
                    ${rulesLine}
                    <div class="game-meta">
                        <span class="game-time">${timeAgo}</span>
                        <span class="game-server">${serverDisplay}</span>
                    </div>
                </div>
                <button class="btn btn-small btn-join" data-room-id="${Utils.escapeHtml(game.roomId)}" data-server-ip="${Utils.escapeHtml(game.serverIP)}" data-server-port="${game.serverPort}">
                    Join
                </button>
            `;

            const joinBtn = gameItem.querySelector('.btn-join');
            joinBtn.addEventListener('click', () => {
                Discovery.joinLocalGame(game.roomId, game.serverIP, game.serverPort);
            });

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
            GameState.socket.emit('peek-room', { roomId });
            UI.showNotification(`Joining game ${roomId}...`, 'info');
            setTimeout(() => {
                Customization.tryJoinWithConflictCheck({
                    type: 'join-room',
                    roomId: roomId,
                    playerName: name
                });
            }, 200);
        } else {
            const url = `http://${serverIP}:${serverPort}/?autoJoin=true&room=${roomId}&name=${encodeURIComponent(name)}&color=${encodeURIComponent(GameState.selectedColor)}&icon=${encodeURIComponent(GameState.selectedIcon)}`;
            window.open(url, '_blank');
            UI.showNotification(`Opening game on ${serverIP}:${serverPort}`, 'info');
        }
    }
};
