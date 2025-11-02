# Snakes & Ladders - Testing Guide

## Quick Start Testing

### 1. Start the Server
```bash
cd /media/sf_shared/Snakes-Ladders-main
npm start
```

Server should start on: http://localhost:3000

### 2. Open in Browser
Open two browser tabs/windows to test multiplayer:
- Tab 1: http://localhost:3000
- Tab 2: http://localhost:3000

### 3. Basic Smoke Test (5 minutes)

#### Test 1: Create Game
1. Tab 1: Click "Create Game"
2. Enter name: "Player 1"
3. Select a color
4. Select an icon
5. Click "Create Game"
6. Verify: Lobby screen appears with room code

#### Test 2: Join Game
1. Tab 2: Click "Join Game"
2. Enter name: "Player 2"
3. Select different color
4. Select different icon
5. Click "Join Using Room Code"
6. Enter the room code from Tab 1
7. Click "Join →"
8. Verify: Both tabs show 2 players in lobby

#### Test 3: Start Game
1. Tab 1: Click "Ready"
2. Tab 2: Click "Ready"
3. Tab 1: Click "Start Game" (appears when all ready)
4. Verify: Game board appears in both tabs

#### Test 4: Play Game
1. Tab 1: Click "Roll Dice" (your turn)
2. Verify: Dice animation plays
3. Verify: Player moves with animation
4. Verify: Sound effects play
5. Verify: Turn passes to Player 2
6. Tab 2: Click "Roll Dice"
7. Verify: Same animations work
8. Continue playing until someone wins

#### Test 5: Winner
1. Play until a player reaches tile 100
2. Verify: Winner modal appears
3. Verify: Winner stats show
4. Verify: Confetti animation plays
5. Click "Play Again"
6. Verify: Returns to lobby

### 4. Advanced Features Test (10 minutes)

#### Test Mines (if enabled)
1. Create game with mines enabled
2. Set mines count to 10
3. Play until someone hits a mine
4. Verify: Explosion animation
5. Verify: Tile turns black (void)
6. Verify: Player falls to tile 1

#### Test Revenge Power
1. Create game with snake threshold = 2
2. Play until one player hits 2 snakes
3. Verify: Power button appears
4. Click power button
5. Select target player
6. Set dice values
7. Click "Set Controlled Roll"
8. Verify: Target player rolls those exact values

#### Test Mobile Camera (on mobile device)
1. Open game on mobile device
2. Start a game with multiple players
3. Click camera button (📷)
4. Verify: Camera zooms to show all players
5. Move players around
6. Verify: Camera adjusts dynamically
7. Click camera button again
8. Verify: Camera resets

#### Test Reconnection
1. Start a game
2. Refresh the browser
3. Verify: "Reconnecting..." message
4. Verify: Returns to correct screen
5. Verify: Game state preserved

### 5. Feature Matrix

| Feature | Tab 1 | Tab 2 | Notes |
|---------|-------|-------|-------|
| Create room | ✓ | | |
| Join room | | ✓ | |
| Dice roll | ✓ | ✓ | |
| Movement animation | ✓ | ✓ | |
| Snake animation | ✓ | ✓ | Curved path |
| Ladder animation | ✓ | ✓ | Straight climb |
| Sound effects | ✓ | ✓ | All sounds |
| Winner modal | ✓ | ✓ | Both see it |
| Reset game | ✓ | | Host only |
| Leave game | ✓ | ✓ | |
| Reconnect | ✓ | ✓ | On refresh |
| Mobile UI | ✓ | ✓ | On mobile |
| Camera zoom | ✓ | ✓ | Mobile only |

---

## Console Verification

### Expected Console Output

**On Page Load:**
```
Connected to server
🔍 Checking module integrity...
✅ CONFIG loaded
✅ GameState loaded
✅ Utils loaded
✅ DOM loaded
✅ AudioSystem loaded
✅ PerformanceMonitor loaded
✅ Camera loaded
✅ Draw loaded
✅ Explosions loaded
✅ Renderer loaded
✅ Animations loaded
✅ Customization loaded
✅ Discovery loaded
✅ UI loaded
✅ SocketHandlers loaded
✨ All modules loaded successfully!
```

**During Gameplay:**
```
Dice rolled: Player 1 rolled 4, moving 0 → 4
📊 Performance Stats:
   FPS: 60
   Avg Frame Time: 8.23ms
   Max Frame Time: 12.45ms
   Slow Frames: 0
```

### No Errors Expected
- ❌ No "undefined is not a function" errors
- ❌ No "Cannot read property" errors
- ❌ No 404 errors for JavaScript files
- ❌ No socket connection errors

---

## Performance Benchmarks

### Expected Performance
- **FPS:** 55-60 (target: 60)
- **Frame Time:** < 16ms (average)
- **Slow Frames:** < 5 per minute
- **Memory Usage:** Stable, no leaks

### How to Monitor
1. Open browser DevTools (F12)
2. Go to "Performance" tab
3. Start recording
4. Play the game for 1 minute
5. Stop recording
6. Check:
   - FPS graph (should be mostly green)
   - Memory usage (should be stable)
   - No long tasks (> 50ms)

---

## Common Issues & Solutions

### Issue: Modules not loading
**Symptom:** Console shows "Module X not loaded!"
**Solution:** Check script order in index.html

### Issue: No sound
**Symptom:** Game plays but no audio
**Solution:** Click anywhere on page to activate AudioContext

### Issue: Dice animation stuck
**Symptom:** Dice keeps rolling, never stops
**Solution:** Check if dice container has proper CSS

### Issue: Players not moving
**Symptom:** Dice rolls but player stays in place
**Solution:** Check Utils.getPosition() function

### Issue: Camera not working
**Symptom:** Camera button does nothing
**Solution:** Only works on mobile (width <= 768px)

---

## Automated Test Script (Future)

For future automation, here's a test script template:

```javascript
// test.js
const puppeteer = require('puppeteer');

async function runTests() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Navigate to game
  await page.goto('http://localhost:3000');
  
  // Test 1: Create room
  await page.click('#choice-create-btn');
  await page.type('#player-name', 'Test Player');
  await page.click('#create-room-btn');
  await page.waitForSelector('#room-code-display');
  
  const roomCode = await page.$eval('#room-code-display', el => el.textContent);
  console.log('✓ Room created:', roomCode);
  
  // Add more tests...
  
  await browser.close();
}

runTests();
```

---

## Test Results Template

Copy and fill out after each test session:

```
## Test Session

**Date:** YYYY-MM-DD
**Tester:** Your Name
**Browser:** Chrome 120
**Device:** Desktop/Mobile

### Results
- [ ] Basic smoke test: PASS/FAIL
- [ ] Create game: PASS/FAIL
- [ ] Join game: PASS/FAIL
- [ ] Dice roll: PASS/FAIL
- [ ] Movement: PASS/FAIL
- [ ] Snakes: PASS/FAIL
- [ ] Ladders: PASS/FAIL
- [ ] Mines: PASS/FAIL
- [ ] Power: PASS/FAIL
- [ ] Winner: PASS/FAIL
- [ ] Reconnect: PASS/FAIL
- [ ] Mobile UI: PASS/FAIL
- [ ] Camera: PASS/FAIL
- [ ] Performance: PASS/FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Any additional observations]
```

---

## Summary

This testing guide provides:
1. Quick 5-minute smoke test
2. 10-minute advanced features test
3. Performance benchmarks
4. Common issues & solutions
5. Template for test results

**Remember:** Test in multiple browsers and on both desktop and mobile devices for comprehensive coverage.
