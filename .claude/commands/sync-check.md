Check that src/game-logic.js (ES module) and the inline game-state script block in index.html have not drifted out of sync.

Run these greps and compare the values found in each file:

1. EFFECTS values — check congestion/happiness/carbon for each action:
   - bus-stop, bike-lane, parking-garage, park, road-widening, ev-charging, self-driving-taxi, industrial-dev

2. WIN constants:
   - WIN_HAPPINESS
   - WIN_CONGESTION
   - DEFAULT_TURN_LIMIT

3. DIFFICULTY_PRESETS — budget, turnLimit, blockerRate, generatorCount:
   - easy, normal, hard, expert

4. WEATHER_MULTIPLIERS keys present:
   - sunny, rainy, overcast, snowy, stormy
   - Check ev-charging and self-driving-taxi entries exist in snowy and stormy

5. Puzzle-mechanic constants:
   - ZONE_CAP
   - GENERATOR_DELTA
   - GENERATOR_CARBON_DELTA
   - DEMOLISH_COST
   - ROAD_WIDENING_BUILDING_BONUS
   - CONGESTION_SURCHARGE_ACTIONS (check same 5 actions in both)

6. Puzzle-mechanic functions exist in both files:
   - getBlockId
   - checkZoneCap
   - applyGeneratorTick
   - getCongestSurcharge
   - calculateRoadWideningBonus

7. CITY_PROFILES keys present in both:
   - standard, green, transit, vibrant, eco

8. window.GAME_LOGIC in index.html exposes:
   - getCongestSurcharge
   - calculateRoadWideningBonus
   - CONGESTION_SURCHARGE_ACTIONS
   - ROAD_WIDENING_BUILDING_BONUS

For each item, show the value found in src/game-logic.js and the value found in index.html side by side. Flag any mismatch with ⚠️. If all values match, report ✅ in sync.

Use grep or Read to extract values — do not rely on memory.
