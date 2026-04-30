Run the Make It Liveable test suite by executing `npm test` in the project root directory.

Report the number of tests passed and failed across all eight suites:
- effects.test.js (148 tests) — calculateEffects, checkWinCondition, getCongestSurcharge, calculateRoadWideningBonus, weather multipliers, getRoadFaceId, checkBusStopFaceLimit, calculateTransportSubsidy, calculateWinScore
- balance.test.js (47 tests) — balance simulations, commercial engagement design contracts
- mapgen.test.js (30 tests) — map generation fuzzing with 5000 seeds
- radial.test.js (40 tests) — ACTIONS, getValidActions, getRadialPosition, getButtonPositions
- puzzle-mechanics.test.js (32 tests) — ZONE_CAP, GENERATOR_DELTA, DEMOLISH_COST, getBlockId, checkZoneCap, applyGeneratorTick
- decay.test.js (23 tests) — DECAY_RATES, passive meter decay
- profiles.test.js (78 tests) — CITY_PROFILES, city profile win conditions
- building-subtypes.test.js (18 tests) — commercial, arena adjacency bonuses

Total: 416 Vitest tests. If any tests fail, show the failure messages and stop — do not proceed with any further work until the failures are fixed.

To also run the 54 Playwright mobile layout tests: `npm run test:layout` (requires the Vite dev server — it starts automatically).
