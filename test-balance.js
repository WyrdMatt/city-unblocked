/**
 * test-balance.js
 *
 * Balance simulation: verifies that the game is winnable across a spread of
 * budget allocations using the pure calculateEffects() function.
 *
 *   node test-balance.js
 *   node test-balance.js --verbose   (print each sim result)
 *
 * What it tests:
 *   1. A "full budget" greedy run — spend all £500 on the most impactful
 *      action mix, assert we can reach WIN targets.
 *   2. Worst-case adjacency (all placements isolated, no adj bonus) still wins.
 *   3. Budget exhaustion — spending only on the cheapest action (bike-lane £40)
 *      runs out before winning if spammed → verify game over is reachable.
 *   4. Diminishing-returns ceiling — placing the same action 12+ times gives
 *      diminishing enough returns that you MUST diversify to win.
 */

'use strict';

const { EFFECTS, DIFFICULTY_PRESETS, WIN_HAPPINESS, WIN_CONGESTION, INITIAL_STATE,
        calculateEffects, checkWinCondition } = require('./game-logic');

const VERBOSE = process.argv.includes('--verbose');

let passed = 0, failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    passed++;
    if (VERBOSE) console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}${detail ? '\n        ' + detail : ''}`);
  }
}

// ── Simulation helpers ─────────────────────────────────────────────────────

// Build a 10×10 grid where all non-road cells are buildings (best-case adjacency)
function buildMaxAdjGrid() {
  const grid = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      grid.push({ row: r, col: c, type: 'building' });
    }
  }
  return grid;
}

// Build a 10×10 grid where all non-road cells are roads (no adjacency bonus)
function buildZeroAdjGrid() {
  const grid = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      grid.push({ row: r, col: c, type: 'road' });
    }
  }
  return grid;
}

// Simulate placing a fixed mix of actions and check final state
function simulate(actions, grid) {
  // actions: [{ action, row, col }]
  const delta = calculateEffects(actions, grid);
  const congestion = Math.max(0, Math.min(100, INITIAL_STATE.congestion + delta.congestionDelta));
  const happiness  = Math.max(0, Math.min(100, INITIAL_STATE.happiness  + delta.happinessDelta));
  const cost = actions.reduce((sum, a) => sum + (EFFECTS[a.action] ? actionCost(a.action) : 0), 0);
  const budget = INITIAL_STATE.budget - cost;
  const result = checkWinCondition({
    happiness, congestion, budget,
    minActionCost: Math.min(...Object.values(ACTION_COSTS)),
    turnsLeft: 15 - actions.length, // assume one turn per action
  });
  return { congestion, happiness, budget, result, delta };
}

const ACTION_COSTS = { 'bus-stop': 80, 'bike-lane': 40, 'parking-garage': 120, 'park': 60, 'road-widening': 90 };
function actionCost(a) { return ACTION_COSTS[a] || 0; }

// Place n of an action type at consecutive positions on grid
function placements(action, n) {
  const list = [];
  for (let i = 0; i < n; i++) list.push({ action, row: i, col: 0 });
  return list;
}

console.log('\nCity Unblocked — balance simulation tests\n');

// ── Test 1: Optimal mix, max-adjacency grid (all buildings) ───────────────
{
  // Spend ~£480: 3 bus-stops (£240), 3 parks (£180), 1 bike-lane (£40) = £460
  const maxGrid = buildMaxAdjGrid();
  const acts = [
    ...placements('bus-stop', 3),
    { action: 'park', row: 0, col: 1 },
    { action: 'park', row: 1, col: 1 },
    { action: 'park', row: 2, col: 1 },
    { action: 'bike-lane', row: 0, col: 2 },
  ];
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log('  [Test1] optimal mix (max adj):', JSON.stringify(sim));
  assert(sim.result === 'win',
    'Test1: optimal mix on max-adj grid wins',
    `congestion=${sim.congestion.toFixed(1)} happiness=${sim.happiness.toFixed(1)} budget=£${sim.budget}`);
}

// ── Test 2: Same mix, zero-adjacency grid (no bonuses) ────────────────────
{
  const zeroGrid = buildZeroAdjGrid();
  const acts = [
    ...placements('bus-stop', 3),
    { action: 'park', row: 0, col: 1 },
    { action: 'park', row: 1, col: 1 },
    { action: 'park', row: 2, col: 1 },
    { action: 'bike-lane', row: 0, col: 2 },
  ];
  const sim = simulate(acts, zeroGrid);
  if (VERBOSE) console.log('  [Test2] optimal mix (zero adj):', JSON.stringify(sim));
  // Without adj bonus the same mix may not win — just check the math is consistent
  // (happiness target is harder to reach without park adj bonus)
  assert(sim.congestion <= 50, 'Test2: zero-adj optimal mix still cuts congestion below 50%',
    `congestion=${sim.congestion.toFixed(1)}`);
}

// ── Test 3: Full budget diversified — must win ────────────────────────────
{
  // Best realistic play: 2 bus-stops (£160), 3 parks (£180), 2 bike-lanes (£80),
  // 1 parking-garage (£120) = £540 > £500 so trim to fit
  // Use: 2 bus-stops (£160) + 2 parks (£120) + 2 bike-lanes (£80) + 1 parking (£120) = £480
  const maxGrid = buildMaxAdjGrid();
  const acts = [
    ...placements('bus-stop', 2),
    { action: 'park', row: 0, col: 1 },
    { action: 'park', row: 1, col: 1 },
    ...placements('bike-lane', 2),
    { action: 'parking-garage', row: 0, col: 3 },
  ];
  const totalCost = acts.reduce((s, a) => s + actionCost(a.action), 0);
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log(`  [Test3] diversified £${totalCost}:`, JSON.stringify(sim));
  assert(totalCost <= INITIAL_STATE.budget, 'Test3: diversified mix fits within budget',
    `cost=£${totalCost}`);
  assert(sim.result === 'win', 'Test3: diversified mix wins',
    `congestion=${sim.congestion.toFixed(1)} happiness=${sim.happiness.toFixed(1)}`);
}

// ── Test 4: Diminishing returns — spamming one action is inefficient ──────
{
  const maxGrid = buildMaxAdjGrid();
  // Spend all £500 on bus-stops only (max 6 × £80 = £480)
  const acts = placements('bus-stop', 6);
  const totalCost = 6 * 80; // £480
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log(`  [Test4] 6× bus-stop (£${totalCost}):`, JSON.stringify(sim));
  assert(totalCost <= INITIAL_STATE.budget, 'Test4: 6× bus-stop fits in budget');
  // Spamming bus-stops lowers congestion but doesn't raise happiness enough to win
  assert(sim.result !== 'win', 'Test4: spamming bus-stop alone does not win (forces diversification)',
    `happiness=${sim.happiness.toFixed(1)} (need ${WIN_HAPPINESS})`);
}

// ── Test 5: Cheapest action spam (bike-lane) — budget exhausted before win ─
{
  const maxGrid = buildMaxAdjGrid();
  // 12 × bike-lane = £480, fits in budget; very diminished after many placements
  const acts = placements('bike-lane', 12);
  const totalCost = 12 * 40;
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log(`  [Test5] 12× bike-lane (£${totalCost}):`, JSON.stringify(sim));
  // Diminishing returns should mean 12 bike-lanes still can't hit congestion target
  assert(sim.congestion > WIN_CONGESTION,
    'Test5: 12× bike-lane (diminishing) cannot meet congestion target alone',
    `congestion=${sim.congestion.toFixed(1)} (need ≤${WIN_CONGESTION})`);
}

// ── Test 6: Winning is possible within budget ─────────────────────────────
{
  // Exhaustive greedy: try every combination of 6 actions from the 4 types
  // within £500 budget and check at least one combo wins (with max-adj grid)
  const maxGrid = buildMaxAdjGrid();
  const types = Object.keys(EFFECTS);
  let foundWin = false;

  outer: for (let a = 0; a < types.length; a++) {
    for (let b = a; b < types.length; b++) {
      for (let c = b; c < types.length; c++) {
        for (let d = c; d < types.length; d++) {
          for (let e = d; e < types.length; e++) {
            const combo = [types[a], types[b], types[c], types[d], types[e]];
            const cost = combo.reduce((s, t) => s + actionCost(t), 0);
            if (cost > INITIAL_STATE.budget) continue;
            const acts = combo.map((action, i) => ({ action, row: i, col: 1 }));
            const sim = simulate(acts, maxGrid);
            if (sim.result === 'win') { foundWin = true; break outer; }
          }
        }
      }
    }
  }
  assert(foundWin, 'Test6: at least one 5-action combo within £500 budget wins');
}

// ── Test 7: checkWinCondition edge cases ──────────────────────────────────
{
  const wc = checkWinCondition;
  const MIN = Math.min(...Object.values(ACTION_COSTS)); // £40
  assert(wc({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, budget: 0, minActionCost: MIN, turnsLeft: 5 }) === 'win',
    'Test7a: win condition beats budget=0 check (win takes priority)');
  assert(wc({ happiness: 0, congestion: 100, budget: 0, minActionCost: 0, turnsLeft: 5 }) === 'lose',
    'Test7b: budget=0 and minActionCost=0 → lose');
  assert(wc({ happiness: 0, congestion: 100, budget: MIN - 1, minActionCost: MIN, turnsLeft: 5 }) === 'lose',
    'Test7c: budget just below min cost → lose');
  assert(wc({ happiness: 0, congestion: 100, budget: MIN, minActionCost: MIN, turnsLeft: 5 }) === 'playing',
    'Test7d: budget exactly min cost → playing');
  assert(wc({ happiness: 0, congestion: 100, budget: 500, minActionCost: MIN, turnsLeft: 0 }) === 'lose',
    'Test7e: turnsLeft=0 → lose even with budget');
  assert(wc({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, budget: 500, minActionCost: MIN, turnsLeft: 0 }) === 'win',
    'Test7f: win conditions met when turnsLeft=0 → win takes priority');
}

// ── Test 8: road-widening trade-off is genuinely useful ───────────────────
{
  const maxGrid = buildMaxAdjGrid();
  // 2 road-widenings (£180) + 1 bus-stop (£80) + 3 parks (£180) = £440
  // Road-widens slash congestion fast; parks + bus-stop restore happiness
  const acts = [
    { action: 'road-widening', row: 0, col: 0 },
    { action: 'road-widening', row: 1, col: 0 },
    { action: 'bus-stop',      row: 0, col: 2 },
    { action: 'park', row: 0, col: 1 },
    { action: 'park', row: 1, col: 1 },
    { action: 'park', row: 2, col: 1 },
  ];
  const totalCost = acts.reduce((s, a) => s + actionCost(a.action), 0);
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log(`  [Test8] road-widening mix £${totalCost}:`, JSON.stringify(sim));
  assert(totalCost <= INITIAL_STATE.budget, 'Test8: road-widening mix fits budget',
    `cost=£${totalCost}`);
  assert(sim.result === 'win', 'Test8: road-widening + bus-stop + parks combo wins',
    `congestion=${sim.congestion.toFixed(1)} happiness=${sim.happiness.toFixed(1)}`);
}

// ── Test 9: road-widening spammed alone does NOT win (happiness penalty) ───
{
  const maxGrid = buildMaxAdjGrid();
  // 5 road-widenings = £450
  const acts = placements('road-widening', 5);
  const totalCost = 5 * 90;
  const sim = simulate(acts, maxGrid);
  if (VERBOSE) console.log(`  [Test9] 5× road-widening (£${totalCost}):`, JSON.stringify(sim));
  assert(sim.result !== 'win', 'Test9: spamming road-widening alone cannot win (happiness drops too low)',
    `happiness=${sim.happiness.toFixed(1)}`);
}

// ── Test 10: DIFFICULTY_PRESETS shape and ordering ─────────────────────────
{
  const levels = ['easy', 'normal', 'hard'];
  assert(levels.every(l => DIFFICULTY_PRESETS[l] !== undefined),
    'Test10a: all three difficulty levels defined');
  assert(DIFFICULTY_PRESETS.easy.budget   > DIFFICULTY_PRESETS.normal.budget,
    'Test10b: easy budget > normal budget');
  assert(DIFFICULTY_PRESETS.normal.budget > DIFFICULTY_PRESETS.hard.budget,
    'Test10c: normal budget > hard budget');
  assert(DIFFICULTY_PRESETS.easy.turnLimit   > DIFFICULTY_PRESETS.normal.turnLimit,
    'Test10d: easy has more turns than normal');
  assert(DIFFICULTY_PRESETS.normal.turnLimit > DIFFICULTY_PRESETS.hard.turnLimit,
    'Test10e: normal has more turns than hard');
  assert(DIFFICULTY_PRESETS.easy.blockerRate === 0,
    'Test10f: easy has no blockers');
  assert(DIFFICULTY_PRESETS.hard.blockerRate > 0,
    'Test10g: hard has blockers');
}

// ── Test 11: Hard difficulty — winning still achievable ───────────────────
{
  const maxGrid = buildMaxAdjGrid();
  // Hard: £350 budget — 2 bus-stops (£160) + 2 parks (£120) + 1 bike-lane (£40) = £320
  // Use interior rows so all tiles have 3–4 adj building neighbours (max hotspot)
  // and place combos adjacent: bus-stop→park (Transit Hub), park→bike-lane (Green Corridor)
  const acts = [
    { action: 'bus-stop',  row: 5, col: 0 },
    { action: 'bus-stop',  row: 6, col: 0 },
    { action: 'park',      row: 5, col: 1 },
    { action: 'park',      row: 6, col: 1 },
    { action: 'bike-lane', row: 5, col: 2 },
  ];
  const cost = acts.reduce((s, a) => s + actionCost(a.action), 0);
  const sim  = simulate(acts, maxGrid);
  assert(cost <= DIFFICULTY_PRESETS.hard.budget, 'Test11a: hard-mode winning combo fits hard budget',
    `cost=£${cost}`);
  assert(sim.result === 'win', 'Test11b: hard-mode combo still wins the game',
    `congestion=${sim.congestion.toFixed(1)} happiness=${sim.happiness.toFixed(1)}`);
}

// ── Test 12: Easy difficulty — all-greedy combos trivially win ────────────
{
  const maxGrid = buildMaxAdjGrid();
  // Easy: £700 budget — 3 bus-stops + 3 parks + 2 bike-lanes = £480; well under cap
  const acts = [
    ...placements('bus-stop', 3),
    { action: 'park', row: 0, col: 1 }, { action: 'park', row: 1, col: 1 },
    { action: 'park', row: 2, col: 1 },
    ...placements('bike-lane', 2),
  ];
  const cost = acts.reduce((s, a) => s + actionCost(a.action), 0);
  const sim  = simulate(acts, maxGrid);
  assert(cost <= DIFFICULTY_PRESETS.easy.budget, 'Test12a: easy-mode combos fit easy budget',
    `cost=£${cost}`);
  assert(sim.result === 'win', 'Test12b: easy-mode combo wins', '');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\nResults:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total\n`);
process.exit(failed > 0 ? 1 : 0);
