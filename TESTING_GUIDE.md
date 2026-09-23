# Testing the game

## Automated checks

```sh
npm ci
npm test
npm audit
```

Tests use isolated local server instances and ephemeral ports. No production server, external service or GitHub login is needed. Timers and sockets are closed after each lifecycle test.

- `test/game-engine.test.js`: rules, hazards, dice control, reset, player order and customization.
- `test/integration.test.js`: room creation/join, readiness, host controls, discovery and reconnect.
- `test/lifecycle.test.js`: multiple animation acknowledgements, timeout recovery, temporary bots, credential handling, stale turns and room expiry.

For backend development use `npm run dev:live`. Changes under `lib/` restart the process; frontend changes only need a browser refresh.

## Browser checks

Start with `npm start`. Use separate browser profiles or a private window for two independent players. Two tabs sharing a saved session will intentionally hand that seat to the newest tab.

1. Create a discoverable room; choose mines, two dice and bounce mode.
2. Copy the invite link and open it in the second profile. Verify the guest supplies their own name and sees the prefilled room code.
3. Select an available color/emblem, join, ready both players, then start as host.
4. Roll on the active player's screen. Both clients should show the same dice, position, turn and score. The next roll stays disabled until both animations complete.
5. Refresh during play. Verify the same seat and board return.
6. Briefly interrupt the connection, then restore it. Controls should disable while offline and the player should rejoin automatically.
7. Disconnect for more than 30 seconds while another player stays connected. Verify temporary bot takeover, then reconnect and reclaim the seat.
8. Reset during an animation. Both players should return to a clean lobby with no delayed dice overlay or winner dialog.
9. Leave a two-human game. Verify a bot takes over and the remaining human gets host controls.
10. Check the winner dialog: host can play again; guests can leave for a new game.
11. Check discovery after a room starts or closes: it should disappear on refresh.
12. Repeat at a narrow phone viewport and a landscape viewport. Ensure the board, roll control and settings remain reachable, with no horizontal overflow.

Check browser console errors and server output throughout. Mine and bounce edge cases are deterministic in the automated suite; the browser needs to present those results without changing the game state.
