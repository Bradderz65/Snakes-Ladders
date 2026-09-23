# Snakes & Ladders

A real-time board game for one to six players on the same server. Open the host's network URL on phones, tablets or computers, create a room, and share its code or invite link.

## Run the game

Use Node.js 22 or newer (minimum supported runtime: Node.js 20) and npm.

```sh
npm ci
npm start
```

Open `http://localhost:3000` on the host. Other devices use the network URL printed by the server, for example `http://192.168.1.20:3000`. Devices must be able to reach that host and port.

```sh
PORT=8080 npm start       # Use another port
./launch.sh              # Install missing project dependencies and start
npm run dev:live          # Restart when server.js or lib/ changes
```

Frontend files are served directly; refresh the browser to pick up changes. A backend restart closes the current rooms.

The installer supports Linux, macOS and Termux:

```sh
sh install.sh
sh install.sh --start
```

From outside a checkout, download the installer first so you can inspect it:

```sh
curl -fsSLO https://raw.githubusercontent.com/Bradderz65/Snakes-Ladders/main/install.sh
sh install.sh --start
```

The installer can install missing system packages. If the operating system supplies an old Node.js version, install a supported version before running it again.

## Play

1. Choose **Create session**, enter a name, select a piece and configure the rules.
2. Share the room code or **Copy invite link**. Guests choose their own name and an available color and emblem.
3. Each player selects **Ready**. The host starts once everyone is connected and ready.
4. Roll when your name is highlighted. The server keeps every player synchronized.
5. Land exactly on tile 100 to win. The host can reset for another round.

A discoverable room appears in the lobby browser for people connected to the **same game server**. This does not scan for separate servers elsewhere on your network. Private rooms can be joined with their code or link.

## Rules

- **Board:** 100 tiles, 10 snakes and 8 ladders on the classic layout.
- **One die:** rolling six gives another turn.
- **Two dice:** rolling doubles gives another turn.
- **Overshoot:** stay in place by default. Enable **Bounce back on overshoot** to move to 100 and then back by the excess; hazards on the landing tile still apply.
- **Require six:** remain off the board until either die shows a six, then enter at tile 1. Entry does not trigger the ladder on tile 1.
- **Revenge:** after the configured number of snake bites, choose another player's next dice values once per game. The choice stays private until that roll.
- **Mines:** landing on a mine, including at a ladder top, sends the player to tile 1 and destroys the mine.
- **Voids:** destroyed mine tiles send a player back three times their dice total, stopping at tile 1.
- **Random boards:** generate a new snake and ladder layout when a room is created or the game resets.

Colors and emblems must be unique within the room. The conflict dialog can choose available alternatives for you.

## Connections and hosts

Refreshing the page or recovering from a network drop restores the saved seat with a private reconnect credential. If the same session opens in another tab, control moves to that tab.

During a game, a player who stays disconnected for 30 seconds gets a temporary bot when another human is connected. Reconnecting reclaims the seat and its current position. When a player intentionally leaves a two-human game, a permanent bot keeps the remaining player company.

The host role passes to an available human when the host leaves or remains disconnected for 30 seconds. A quick refresh preserves host controls. In the lobby the host can remove absent players. Only the host can start or reset a game. The explosion preview is cosmetic.

Rooms stay in memory on a **single server process**. They survive browser refreshes, not server restarts. Fully disconnected lobbies expire after 30 minutes; games expire after 24 hours without activity. Bots pause when no human is connected. For public hosting, run the process behind an HTTPS reverse proxy that preserves the Host header and supports WebSockets.

## Development and checks

```sh
npm test
npm run test:unit
npm run test:integration
npm run test:watch
npm audit
```

The test suite covers movement, powers, hazards, room membership, host transfer, reconnect credentials, bot takeover, animation acknowledgements, timeout recovery and server shutdown. GitHub Actions runs it on Node.js 22 and 24.

`GET /health` returns server status and the number of rooms. See [TESTING_GUIDE.md](TESTING_GUIDE.md) for browser checks.

## Architecture

- `server.js`: entrypoint, network URLs and graceful shutdown.
- `lib/game-server.js`: isolated server instances, room lifecycle, Socket.IO validation, session credentials, timers and bots.
- `lib/game-engine.js`: game rules, deterministic movement resolution and public snapshots.
- `public/js/`: client state, interface, canvas rendering, sound and cancellable animations.
- `test/`: Node.js unit tests and real Socket.IO integration tests.

The server resolves all movement and board changes before broadcasting them. Browsers acknowledge presentation of a numbered turn; they cannot decide mine outcomes. The next turn waits for connected players' animations, with a 25-second server fallback for inactive browser tabs.

## Troubleshooting

- **Cannot connect:** check the printed network URL, Wi-Fi isolation and the host firewall.
- **Port already in use:** stop your existing game server or choose another `PORT`. The launcher never kills an unrelated service.
- **Cannot join:** check the six-character code, that the game has not started, and that the room has fewer than six players.
- **Saved session expired:** the room may have closed or the server restarted. Create or join another room.
- **Old UI after updating:** refresh every player tab. Protocol changes require the server and browser files from the same checkout.

MIT License.
