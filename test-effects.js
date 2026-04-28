/**
 * test-effects.js
 *
 * Unit tests for calculateEffects() and checkWinCondition() in game-logic.js.
 *
 *   node test-effects.js
 */

'use strict';

const { EFFECTS, COMBOS, WIN_HAPPINESS, WIN_CONGESTION, DEFAULT_TURN_LIMIT, INITIAL_STATE,
        getGridNeighbours, hotspotScore, calculateEffects, checkWinCondition } = require('./game-logic');

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
assert(EFFECTS['road-widening'].congestion === -15, 'road-widening congestion base = -15');
assert(EFFECTS['road-widening'].happiness  === -5,  'road-widening happiness base = -5 (trade-off)');

// ── WIN / INITIAL constants ────────────────────────────────────────────────
assert(WIN_HAPPINESS  === 70, 'WIN_HAPPINESS = 70');
assert(WIN_CONGESTION === 30, 'WIN_CONGESTION = 30');
assert(DEFAULT_TURN_LIMIT === 15, 'DEFAULT_TURN_LIMIT = 15');
assert(INITIAL_STATE.congestion === 80,  'INITIAL congestion = 80');
assert(INITIAL_STATE.happiness  === 20,  'INITIAL happiness = 20');
assert(INITIAL_STATE.budget     === 500, 'INITIAL budget = 500');
assert(INITIAL_STATE.turnLimit  === 15,  'INITIAL turnLimit = 15');

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

// ── calculateEffects: bus-stop adjacency bonus + hotspot multiplier ────────
{
  // Bus-stop at (5,5) surrounded by 4 building tiles (hotspot score = 4, ≥3 → ×1.25)
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }]);
  const placements = [{ action: 'bus-stop', row: 5, col: 5 }];
  const d = calculateEffects(placements, grid);
  // base -10, adj -2×4=-8 → subtotal -18, then hotspot ×1.25 = -22.5
  assert(approx(d.congestionDelta, -22.5, 0.01), 'bus-stop adj+hotspot: (-10 - 8) × 1.25 = -22.5');
  // happiness: +6 × 1.25 = 7.5
  assert(approx(d.happinessDelta, 7.5, 0.01), 'bus-stop adj+hotspot: +6 × 1.25 = 7.5');
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

// ── calculateEffects: road-widening trade-off ─────────────────────────────
{
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }]);
  const d = calculateEffects([{ action: 'road-widening', row: 5, col: 5 }], grid);
  assert(approx(d.congestionDelta, -15), 'road-widening: congestion -15');
  assert(approx(d.happinessDelta,  -5),  'road-widening: happiness -5 (penalty)');
}

// ── calculateEffects: zero placements ─────────────────────────────────────
{
  const grid = buildGrid();
  const d = calculateEffects([], grid);
  assert(d.congestionDelta === 0, 'no placements: congestionDelta = 0');
  assert(d.happinessDelta  === 0, 'no placements: happinessDelta = 0');
}

// ── hotspotScore ──────────────────────────────────────────────────────────
{
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }]); // all others buildings
  assert(hotspotScore({ row: 5, col: 5 }, grid) === 4, 'hotspotScore: road surrounded by 4 buildings → 4');

  // Corner road tile surrounded by 2 buildings
  const g2 = buildGrid([{ row: 0, col: 0, type: 'road' }, { row: 0, col: 1, type: 'road' }, { row: 1, col: 0, type: 'road' }]);
  assert(hotspotScore({ row: 0, col: 0 }, g2) === 0, 'hotspotScore: corner surrounded by roads → 0');
}

// ── hotspot multiplier: ≥3 adj buildings boosts bus-stop / bike-lane ──────
{
  // Road at (5,5) surrounded by 4 buildings — hotspot 4
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }]);
  const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid);
  // base -10 * 1, adj -2*4=-8, subtotal -18, then hotspot ×1.25 = -22.5
  assert(approx(d.congestionDelta, -22.5, 0.01), 'hotspot bus-stop: ×1.25 amplification on 4-adj-building tile');
  // happiness: +6 * 1.25 = 7.5
  assert(approx(d.happinessDelta, 7.5, 0.01), 'hotspot bus-stop: happiness also amplified');
}

// ── combo bonuses: bus-stop + park adjacent ────────────────────────────────
{
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' },
    { row: 5, col: 6, type: 'empty' },
  ]);
  const d = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 5, col: 6 },
  ], grid);
  // Combo "Transit Hub": +5 happiness, 0 congestion
  // Bus-stop adj: neighbours of (5,5) include (5,6)=empty not building — wait grid has buildings elsewhere
  // Actual adj buildings for bus-stop at (5,5): all 4 neighbours are checked; (5,6) is 'empty', rest are buildings → 3 adj buildings
  // For park at (5,6): neighbours: (5,5)=road, (5,7)=building, (4,6)=building, (6,6)=building → 3 buildings
  // Park adj happiness: +3*3 = +9
  // Bus-stop adj congestion: -2*3 = -6  → base -10 - 6 = -16
  // Hotspot: bus-stop has 3 adj buildings → ×1.25: -16*1.25=-20, +6*1.25=+7.5
  // Combo: +5 happiness
  // Total happiness: (park: -4 cong, +12 happy + 9 adj) + (bus: -20 cong, +7.5 happy) + combo +5
  // = happiness: 12 + 9 + 7.5 + 5 = 33.5

  // Just check combo is included (happiness > without combo)
  const dNoCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
  ], grid);
  const dParkOnly = calculateEffects([
    { action: 'park', row: 5, col: 6 },
  ], grid);
  const sumNoCombo = dNoCombo.happinessDelta + dParkOnly.happinessDelta;
  assert(d.happinessDelta > sumNoCombo, 'combo bus-stop+park: happiness > sum of individual effects (combo bonus applied)');
}

// ── combo bonuses: non-adjacent pair gets no bonus ─────────────────────────
{
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' },
    { row: 5, col: 7, type: 'empty' }, // col 7, not adjacent to col 5
  ]);
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 5, col: 7 },
  ], grid);
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid);
  const d2 = calculateEffects([{ action: 'park',     row: 5, col: 7 }], grid);
  assert(approx(dCombo.happinessDelta, d1.happinessDelta + d2.happinessDelta, 0.01),
    'no combo: non-adjacent bus-stop+park = sum of individual effects');
}

// ── COMBOS constant has expected entries ──────────────────────────────────
assert(Array.isArray(COMBOS) && COMBOS.length >= 5, 'COMBOS: at least 5 combo definitions');
assert(COMBOS.some(c => c.a === 'bus-stop' && c.b === 'park' && c.happiness === 5), 'COMBOS: Transit Hub defined');
assert(COMBOS.some(c => c.a === 'park'     && c.b === 'park'),                       'COMBOS: Green Network defined');

// ── calculateEffects: unknown action silently skipped ─────────────────────
{
  const grid = buildGrid();
  const d = calculateEffects([{ action: 'teleporter', row: 5, col: 5 }], grid);
  assert(d.congestionDelta === 0 && d.happinessDelta === 0, 'unknown action: no effect');
}

// ── checkWinCondition ─────────────────────────────────────────────────────
assert(checkWinCondition({ happiness: 70, congestion: 30, budget: 200, minActionCost: 40, turnsLeft: 5 }) === 'win',
  'checkWinCondition: exact win threshold → win');
assert(checkWinCondition({ happiness: 71, congestion: 29, budget: 100, minActionCost: 40, turnsLeft: 5 }) === 'win',
  'checkWinCondition: over threshold → win');
assert(checkWinCondition({ happiness: 69, congestion: 30, budget: 200, minActionCost: 40, turnsLeft: 5 }) === 'playing',
  'checkWinCondition: happiness just below win → playing');
assert(checkWinCondition({ happiness: 70, congestion: 31, budget: 200, minActionCost: 40, turnsLeft: 5 }) === 'playing',
  'checkWinCondition: congestion just above win → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:   0, minActionCost: 40, turnsLeft: 5 }) === 'lose',
  'checkWinCondition: budget = 0 → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:  39, minActionCost: 40, turnsLeft: 5 }) === 'lose',
  'checkWinCondition: budget < minActionCost → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:  40, minActionCost: 40, turnsLeft: 5 }) === 'playing',
  'checkWinCondition: budget = minActionCost → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 100, minActionCost:  0, turnsLeft: 5 }) === 'playing',
  'checkWinCondition: minActionCost = 0, positive budget → playing');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget:   0, minActionCost:  0, turnsLeft: 5 }) === 'lose',
  'checkWinCondition: budget = 0, minActionCost = 0 → lose');
// Turn limit checks
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft:  0 }) === 'lose',
  'checkWinCondition: turnsLeft = 0 → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft: -1 }) === 'lose',
  'checkWinCondition: turnsLeft negative → lose');
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft:  1 }) === 'playing',
  'checkWinCondition: turnsLeft = 1, not won → playing');
// Win takes priority over turn limit
assert(checkWinCondition({ happiness: 70, congestion: 30, budget: 200, minActionCost: 40, turnsLeft:  0 }) === 'win',
  'checkWinCondition: win conditions met even at turnsLeft=0 → win');
// turnsLeft omitted = no turn limit
assert(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40 }) === 'playing',
  'checkWinCondition: no turnsLeft key = no turn limit → playing');

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`Results:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total\n`);
process.exit(failed > 0 ? 1 : 0);
