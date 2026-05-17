# 🎲 Snakes & Ladders - Multiplayer Game 🪜

A modern, fully functional multiplayer Snakes and Ladders game that works seamlessly on mobile, tablet, and desktop devices. Play with friends over your local network!

## ✨ Features

- 🎮 **Single & Multiplayer** - Play solo or with 2-6 friends simultaneously
- 🌐 **Cross-Platform** - Works on mobile phones, tablets, and desktop computers
- 🎨 **Modern UI** - Beautiful, responsive design with smooth animations
- 🔄 **Real-time Sync** - All players see moves instantly using WebSocket technology
- 🐍 **Classic Gameplay** - Traditional snakes and ladders with 10x10 board
- 🎯 **Easy to Use** - Simple room creation and joining system
- 📱 **Mobile Optimized** - Touch-friendly interface for mobile devices
- 🔌 **Auto-Reconnect** - Refresh the page without losing your game session
- 🚪 **Manual Disconnect** - Leave game button for intentional exits

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### One-Line Install

**Termux:**
```bash
pkg update -y && pkg install -y curl && curl -fsSL https://raw.githubusercontent.com/Bradderz65/Snakes-Ladders/main/install.sh | sh
```

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Bradderz65/Snakes-Ladders/main/install.sh | sh
```

To install and start the server immediately on Termux:
```bash
pkg update -y && pkg install -y curl && curl -fsSL https://raw.githubusercontent.com/Bradderz65/Snakes-Ladders/main/install.sh | sh -s -- --start
```

To install and start the server immediately on Linux / macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/Bradderz65/Snakes-Ladders/main/install.sh | sh -s -- --start
```

If you already cloned the repo:
```bash
sh install.sh
```

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access the game:**
   - On the host computer: Open `http://localhost:3000` in your browser
   - On other devices: Open `http://<host-ip-address>:3000` in your browser

### Finding Your Local IP Address

**On Linux/Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```

Look for your local IP address (usually starts with 192.168.x.x or 10.x.x.x)

## 🎮 How to Play

### Starting a Game

1. **Create a Room:**
   - Enter your name
   - Click "Create Room"
   - Share the room code with your friends

2. **Join a Room:**
   - Enter your name
   - Click "Join Room"
   - Enter the room code shared by your friend
   - Click "Join"

3. **Get Ready:**
   - Wait for all players to join (1-6 players)
   - Click "Ready" when you're ready to play
   - Once all players are ready, you can start the game

4. **Playing:**
   - Players take turns rolling the dice
   - Your piece moves forward by the number rolled
   - Land on a ladder to climb up 🪜
   - Land on a snake to slide down 🐍
   - First player to reach square 100 wins! 🏆

### Game Rules

- **Winning:** First player to land exactly on square 100 wins
- **Overshooting:** If your roll would take you past 100, you stay in place
- **Snakes:** Automatically slide down to a lower square
- **Ladders:** Automatically climb up to a higher square
- **Turns:** Players take turns in order, indicated by the highlighted player

### Reconnection & Disconnection

- **Auto-Reconnect:** If you refresh the page or accidentally close the browser, the game will automatically reconnect you when you return
- **Leave Game Button:** Use the red "Leave Game" button in the lobby or game screen to permanently leave
- **Session Storage:** Your game session is saved locally, so you can refresh without losing your spot
- **Other Players:** If a player disconnects, they remain in the game and can reconnect. Only manual "Leave Game" removes them

## 🛠️ Technical Details

### Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS3
- **Real-time Communication:** WebSockets via Socket.IO

### Project Structure

```
snakes-and-ladders/
├── server.js           # Backend server with game logic
├── package.json        # Project dependencies
├── public/
│   ├── index.html     # Main HTML file
│   ├── style.css      # Styling and responsive design
│   └── game.js        # Client-side game logic and rendering
└── README.md          # This file
```

### Game Configuration

The game includes:
- **Board Size:** 10x10 (100 squares)
- **Snakes:** 10 snakes at various positions
- **Ladders:** 9 ladders at various positions
- **Players:** 1-6 players per game
- **Unique Player Colors:** Each player gets a distinct color

### Snakes Positions
- 16 → 6
- 47 → 26
- 49 → 11
- 56 → 53
- 62 → 19
- 64 → 60
- 87 → 24
- 93 → 73
- 95 → 75
- 98 → 78

### Ladders Positions
- 1 → 38
- 4 → 14
- 9 → 31
- 21 → 42
- 28 → 84
- 36 → 44
- 51 → 67
- 71 → 91
- 80 → 100

## 📱 Device Compatibility

### Tested and Working On:
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile, Firefox Mobile)
- ✅ Tablets (iPad, Android tablets)
- ✅ Various screen sizes (from 320px to 4K)

## 🔧 Troubleshooting

### Can't Connect to Server
- Make sure all devices are on the same WiFi network
- Check if your firewall is blocking port 3000
- Verify you're using the correct IP address

### Game Not Loading
- Clear your browser cache
- Make sure JavaScript is enabled
- Try a different browser

### Players Can't Join
- Verify the room code is correct (case-sensitive)
- Make sure the game hasn't started yet
- Check if the room is full (max 6 players)

### Mobile Display Issues
- Rotate your device to landscape mode for better view
- Zoom out if the board appears too large
- Refresh the page if elements don't load properly

## 🎯 Advanced Usage

### Custom Port
To run on a different port, set the PORT environment variable:
```bash
PORT=8080 npm start
```

### Development Mode
The server automatically serves static files from the `public` directory. Any changes to client-side files will be reflected on page refresh.

## 🤝 Contributing

Feel free to fork this project and add your own features! Some ideas:
- Custom board themes
- Sound effects
- Chat functionality
- Player avatars
- Game statistics
- Multiple board layouts

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🎉 Enjoy!

Have fun playing Snakes & Ladders with your friends! If you encounter any issues or have suggestions, feel free to reach out.

---

**Made with ❤️ for game lovers everywhere**
