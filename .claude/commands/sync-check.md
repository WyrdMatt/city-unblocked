Check that src/game-logic.js (ES module) and the inline game-state script block in index.html have not drifted out of sync.

Run these greps and compare the values found in each file:

1. EFFECTS values — check congestion/happiness for each action:
   - bus-stop, bike-lane, parking-garage, park, road-widening

2. WIN constants:
   - WIN_HAPPINESS
   - WIN_CONGESTION
   - DEFAULT_TURN_LIMIT

3. DIFFICULTY_PRESETS budgets and turnLimits:
   - easy, normal, hard

4. WEATHER_MULTIPLIERS keys present:
   - sunny, rainy, overcast, snowy, stormy

For each item, show the value found in src/game-logic.js and the value found in index.html side by side. Flag any mismatch with ⚠️. If all values match, report ✅ in sync.

Use grep or Read to extract values — do not rely on memory.
