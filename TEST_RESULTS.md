# Verification results — 23 September 2026

Validated locally on Node.js 20.19.5 with Chromium-based browser automation. GitHub CI is configured for Node.js 22 and 24; those CI runs have not been executed or published from this checkout.

## Automated results

- `npm test`: **49 tests passed**, no failures or skipped tests.
- `npm audit`: **0 reported vulnerabilities**, including development dependencies.
- JavaScript syntax checks passed for the changed backend and client modules.
- Shell syntax checks passed for the installer, launchers and development-watch script.
- `git diff --check`: passed.
- Starting the launcher on an occupied port returned an error while the original game server remained healthy.

## Browser results

- Created a room, joined a second independent player through an invite, readied both players and started a game.
- Both clients showed matching dice results, positions and turn state after moves, including ladder climbs.
- Refresh and a simulated connection interruption restored the saved seat and position.
- A quick host refresh retained host controls on the final backend.
- Opening a saved session in another tab moved control to the new tab. The old tab did not reclaim it after a connection interruption.
- Reset during dice animation returned both clients to the lobby with no dice overlay, player animations or pending animation timers.
- Verified desktop, 390 × 844 phone portrait and 844 × 390 landscape layouts.
- Fixed the mobile status badge overlap and clipped landscape controls; verified no horizontal overflow and a fully visible roll button.
- Verified that a non-host's mobile settings hide reset controls.
- No application errors were reported by the browser error checks.

## Scope

The tests cover local server behavior, game rules and Chromium browser flows. Physical iOS/Android devices, Safari, Firefox, public HTTPS deployment and long-running load behavior were not tested here. Rooms remain in memory and close when the server process restarts.
