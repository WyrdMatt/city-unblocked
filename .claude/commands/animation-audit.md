Audit index.html for the reactive animation system. Check each item and report PASS or FAIL with the relevant line numbers.

## 1. Car speed reacts to congestion
Grep the tick() function in the animations block for a `factor` variable that uses
`window.gameState.congestion` (or `cong`).
- PASS: `const factor = 1 - (cong / 100) * ...`
- FAIL: factor is hardcoded or not derived from game state

## 2. Stop-and-go probability reacts to congestion
Grep tick() for `stopChance` derived from `cong`.
- PASS: `stopChance = Math.max(0, (cong - N) / M) * K`
- FAIL: stopChance is constant or missing

## 3. Pedestrian speed reacts to happiness
Grep tick() for a `pedScale` (or similar) variable that uses `window.gameState.happiness`
(or `happ`). It should scale between a minimum and maximum across 0–100 happiness.
- PASS: e.g. `pedScale = (0.35 + (happ/100) * 0.9) * weatherScale`
- FAIL: pedScale is hardcoded

## 4. Pedestrian density reacts to happiness (minHapp thresholds)
Grep `addSWPerson` for a `minHapp` property assigned to each sidewalk person.
Grep tick() for a visibility toggle that compares `happ >= p.minHapp`.
- PASS: both present
- FAIL: either missing

## 5. Generator firing indicator
Grep `updateMeters` (game-state block) for logic that toggles
`.generator--firing` class on generator tiles based on whether they are suppressed
by an adjacent road action.
Grep CSS for `.tile.generator--firing` keyframe animation.
- PASS: both present
- FAIL: either missing

## 6. syncRoadCongestion called from updateMeters
Grep the game-state block for `syncRoadCongestion(gs.congestion)` inside `updateMeters`.
- PASS: present
- FAIL: missing (road tiles won't reflect current congestion)

## 7. Weather pedestrian multipliers
Grep the animations block for `WEATHER_PED_SCALE` or equivalent object mapping
weather types to pedestrian speed multipliers.
- PASS: present with at least sunny/rainy/snowy/stormy entries
- FAIL: missing

## Summary
Report one-line status per check. For any FAIL, include the specific location (line number or
function name) and the fix needed.
