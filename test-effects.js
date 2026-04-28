/**
 * test-effects.js
 *
 * Unit tests for calculateEffects() and checkWinCondition() in game-logic.js.
 *
 *   node test-effects.js
 */

'use strict';

const { EFFECTS, WIN_HAPPINESS, WIN_CONGESTION, INITIAL_STATE,
        getGridNeighbours, calculateEffects, checkWinCondition } = require('./game-logic');

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

function approx(a, b, eps) { return Math.abs(a - b) < (eps || 0.001); }

// Helper: build a flat 10×10 grid of all-building tiles
function buildGrid(overrides) {
  const grid = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      grid.push({ row: r, col: c, type: 'building' });
    }
  }
  (overrides || []).forEach(function (o) {
    const cell = grid.find(t => t.row === o.row && t.col === o.col);
    if (cell) cell.type = o.type;
  });
  return grid;
}

console.log('\nCity Unblocked — effect calculation tests\n');

// ── EFFECTS constants ──────────────────────────────────────────────────────
assert(EFFECTS['bus-stop'].congestion === -10,  'bus-stop congestion base = -10');
assert(EFFECTS['bus-stop'].happiness  === 6,    'bus-stop happiness base = +6');
assert(EFFECTS['bike-lane'].congestion === -6,   'bike-lane congestion base = -6');
assert(EFFECTS['bike-lane'].happiness  === 8,    'bike-lane happiness base = +8');
assert(EFFECTS['parking-garage'].congestion === -8, 'parking-garage congestion base = -8');
assert(EFFECTS['parking-garage'].happiness  === 4,  'parking-garage happiness base = +4');
assert(EFFECTS['park'].congestion === -4,  'park congestion base = -4');
assert(EFFECTS['park'].happiness  === 12,  'park happiness base = +12');

// ── WIN / INITIAL constants ────────────────────────────────────────────────
assert(WIN_HAPPINESS  === 70, 'WIN_HAPPINESS = 70');
assert(WIN_CONGESTION === 30, 'WIN_CONGESTION = 30');
assert(INITIAL_STATE.congestion === 80, 'INITIAL congestion = 80');
assert(INITIAL_STATE.happiness  === 20, 'INITIAL happiness = 20');
assert(INITIAL_STATE.budget     === 500,'INITIAL budget = 500');

// ── getGridNeighbours ──────────────────────────────────────────────────────
{
  const grid = buildGrid();
  const nb = getGridNeighbours(5, 5, grid);
  assert(nb.length === 4, 'centre cell has 4 neighbours');

  const corner = getGridNeighbours(0, 0, grid);
  assert(corner.length === 2, 'corner (0,0) has 2 neighbours');

  const edge = getGridNeighbours(0, 5, grid);
  assert(edge.length === 3, 'top edge cell has 3 neighbours');
}

// ── calculateEffects: single placement, no adjacency ──────────────────────
{
  // Put bus-stop on a road tile surrounded by roads (no building adjacency bonus)
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' },
    { row: 4, col: 5, type: 'road' },
    { row: 6, col: 5, type: 'road' },
    { row: 5, col: 4, type: 'road' },
    { row: 5, col: 6, type: 'road' },
  ]);
  const placements = [{ action: 'bus-stop', row: 5, col: 5 }];
  const d = calculateEffects(placements, grid);
  assert(approx(d.congestionDelta, -10), 'single bus-stop (no adj): congestion -10');
  assert(approx(d.happinessDelta,   +6), 'single bus-stop (no adj): happiness +6');
}

// ── calculateEffects: park adjacency bonus ─────────────────────────────────
{
  // Park at (5,5) surrounded by 4 building tiles
  const grid = buildGrid([{ row: 5, col: 5, type: 'empty' }]);
  const placements = [{ action: 'park', row: 5, col: 5 }];
  const d = calculateEffects(placements, grid);
  // base -4 congestion, base +12 happiness, +3 per adj building (4 neighbours)
  assert(approx(d.congestionDelta, -4),  'park adj: congestion -4');
  assert(approx(d.happinessDelta, +24),  'park adj: happiness +12 + 4×3 = +24');
}

// ── calculateEffects: bus-stop adjacency bonus ─────────────────────────────
{
  // Bus-stop at (5,5) surrounded by 4 building tiles
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }]);
  const placements = [{ action: 'bus-stop', row: 5, col: 5 }];
  const d = calculateEffects(placements, grid);
  // base -10 congestion, -2 per adj building (4 neighbours) = -18
  assert(approx(d.congestionDelta, -18), 'bus-stop adj: congestion -10 - 4×2 = -18');
  assert(approx(d.happinessDelta,   +6), 'bus-stop adj: happiness +6 (no bonus)');
}

// ── calculateEffects: diminishing returns ─────────────────────────────────
{
  const grid = buildGrid([
    { row: 0, col: 0, type: 'road' }, { row: 1, col: 0, type: 'road' },
    { row: 2, col: 0, type: 'road' },
  ]);
  // 3 bike lanes, each surrounded by no buildings (road neighbours)
  // neighbour rows are road too for simplicity
  const placements = [
    { action: 'bike-lane', row: 0, col: 0 },
    { action: 'bike-lane', row: 1, col: 0 },
    { action: 'bike-lane', row: 2, col: 0 },
  ];

  // Override neighbours to be roads
  const roadGrid = buildGrid([
    { row: 0, col: 0, type: 'road' }, { row: 1, col: 0, type: 'road' },
    { row: 2, col: 0, type: 'road' },
    // surroundings for adjacency (bike-lane has no adj bonus, so just need them non-building)
    { row: 0, col: 1, type: 'road' }, { row: 1, col: 1, type: 'road' },
    { row: 2, col: 1, type: 'road' }, { row: 3, col: 0, type: 'road' },
  ]);

  const d = calculateEffects(placements, roadGrid);
  // nth=3,2,1 → diminish factors: 0.85^2, 0.85^1, 0.85^0
  const expected_cong = -6 * (1 + 0.85 + 0.85*0.85);
  const expected_happ = +8 * (1 + 0.85 + 0.85*0.85);
  assert(approx(d.congestionDelta, expected_cong, 0.01), 'bike-lane x3 diminishing returns: congestion');
  assert(approx(d.happinessDelta,  expected_happ, 0.01), 'bike-lane x3 diminishing returns: happiness');
}

// ── calculateEffects: zero placements ─────────────────────────────────────
{
  const grid = buildGrid();
  const d = calculateEffects([], grid);
  assert(d.congestionDelta === 0, 'no placements: congestionDelta = 0');
  assert(d.happinessDelta  === 0, 'no placements: happinessDelta = 0');
}

// ── calculateEffects: unknown action silently skipped ─────────────────────
{
  const grid = buildGrid();
  const d = calculateEffects([{ action: 'teleporter', row: 5, col: 5 }], grid);
  assert(d.congestionDelta === 0 && d.happinessDelta === 0, 'unknown action: no effect');
}

// ── checkWinCondition ─────────────────────────────────────────────────────
assert(checkWinCondition({ happiness: 70, congestion: 30, budget: 200, minActionCost: 40 }) === 'win',
  'checkWinCondition: exact win threshold → win');
assert(checkWinCondition({ happiness: 71, congestion: 29, budget: 100, minActionCost: 40 }) === 'win',
  'checkWinCondition: over threshold → win');
assert(checkWinCondition({ happiness: 69, congestion: 30, budget: 200, minActionCost: 40 }) === 'playing',
  'checkWinCondition: happiness just below win → playing');
assert(checkWinCondition({ happiness: 70, congestion: 31, budget: 200, minActionCost: 40 }) === 'playing',
  'checkWinCondition: congestion just above win → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:   0, minActionCost: 40 }) === 'lose',
  'checkWinCondition: budget = 0 → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:  39, minActionCost: 40 }) === 'lose',
  'checkWinCondition: budget < minActionCost → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:  40, minActionCost: 40 }) === 'playing',
  'checkWinCondition: budget = minActionCost → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 100, minActionCost:  0 }) === 'playing',
  'checkWinCondition: minActionCost = 0, positive budget → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:   0, minActionCost:  0 }) === 'lose',
  'checkWinCondition: budget = 0, minActionCost = 0 → lose');

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`Results:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total\n`);
process.exit(failed > 0 ? 1 : 0);
