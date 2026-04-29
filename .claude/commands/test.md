Run the Make It Liveable test suite by executing `npm test` in the project root directory.

Report the number of tests passed and failed across all five suites:
- effects.test.js (51 tests) — calculateEffects, checkWinCondition
- balance.test.js (33 tests) — balance simulations
- mapgen.test.js (19 tests) — map generation fuzzing with 5000 seeds
- radial.test.js (40 tests) — ACTIONS, getValidActions, getRadialPosition, getButtonPositions
- puzzle-mechanics.test.js (32 tests) — ZONE_CAP, GENERATOR_DELTA, DEMOLISH_COST, getBlockId, checkZoneCap, applyGeneratorTick

Total: 175 tests. If any tests fail, show the failure messages and stop — do not proceed with any further work until the failures are fixed.
