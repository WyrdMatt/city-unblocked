/**
 * game-logic.js
 *
 * Pure calculation functions — no DOM, no window, no side effects.
 * Run in Node for testing:
 *
 *   node test-effects.js
 *   node test-balance.js
 *
 * Keep this file in sync with the corresponding declarations in the
 * game-state <script> block in index.html.
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

var EFFECTS = {
  'bus-stop':       { congestion: -10, happiness:  +6 },
  'bike-lane':      { congestion:  -6, happiness:  +8 },
  'parking-garage': { congestion:  -8, happiness:  +4 },
  'park':           { congestion:  -4, happiness: +12 },
  'road-widening':  { congestion: -15, happiness:  -5 }, // trade-off: fast congestion drop but hurts happiness
};

var WIN_HAPPINESS  = 70;
var WIN_CONGESTION = 30;
var DEFAULT_TURN_LIMIT = 15;

var INITIAL_STATE = { congestion: 80, happiness: 20, budget: 500, turn: 0, won: false, turnLimit: DEFAULT_TURN_LIMIT };

// ── Combo bonuses ──────────────────────────────────────────────────────────
// Pairs of orthogonally adjacent placed actions that unlock a bonus.
// Order-independent: {a,b} matches (a→b) or (b→a).

var COMBOS = [
  { a: 'bus-stop',       b: 'park',           congestion:  0, happiness: +5, label: 'Transit Hub' },
  { a: 'bike-lane',      b: 'park',           congestion: -2, happiness: +3, label: 'Green Corridor' },
  { a: 'bus-stop',       b: 'bike-lane',      congestion: -3, happiness:  0, label: 'Active Streets' },
  { a: 'park',           b: 'park',           congestion:  0, happiness: +3, label: 'Green Network' },
  { a: 'parking-garage', b: 'bus-stop',       congestion: -3, happiness:  0, label: 'Park & Ride' },
  { a: 'road-widening',  b: 'bus-stop',       congestion: -4, happiness:  0, label: 'Express Lane' },
];

// ── Helper: grid neighbours ────────────────────────────────────────────────

/**
 * Returns the up-to-4 orthogonal neighbours of (row, col) from grid.
 * grid: [{ row, col, type, ... }]
 */
function getGridNeighbours(row, col, grid) {
  var offsets = [[-1,0],[1,0],[0,-1],[0,1]];
  return offsets.map(function (o) {
    return grid.find(function (t) { return t.row === row + o[0] && t.col === col + o[1]; });
  }).filter(Boolean);
}

// ── calculateEffects ───────────────────────────────────────────────────────

/**
 * hotspotScore(placement, grid) → 0–4
 * Returns number of adjacent building tiles — used for hotspot visual and
 * amplification of bus-stop and bike-lane effects.
 */
function hotspotScore(placement, grid) {
  return getGridNeighbours(placement.row, placement.col, grid)
    .filter(function (n) { return n.type === 'building'; }).length;
}

/**
 * calculateEffects(placements, grid) → { congestionDelta, happinessDelta }
 *
 * placements: [{ action, row, col }]  — only tiles that have been placed
 * grid:       [{ row, col, type }]    — full 10×10 grid (for adjacency)
 *
 * Applies:
 *   - Base effect per action type (from EFFECTS)
 *   - Diminishing returns: each successive same-type placement × 0.85^(n-1)
 *   - Adjacency bonus: park next to building → +3 happiness per neighbour
 *   - Adjacency bonus: bus-stop next to building → −2 congestion per neighbour
 *   - Hotspot multiplier: bus-stop / bike-lane on a tile with ≥3 adj buildings → ×1.25
 *   - Combo bonuses: adjacent complementary pair (see COMBOS)
 */
function calculateEffects(placements, grid) {
  // Count placements per type (for diminishing-returns order)
  var placedCount = {};
  placements.forEach(function (p) {
    placedCount[p.action] = (placedCount[p.action] || 0) + 1;
  });

  var remaining = Object.assign({}, placedCount);
  var congestionDelta = 0;
  var happinessDelta  = 0;

  placements.forEach(function (p) {
    var effect = EFFECTS[p.action];
    if (!effect) return;

    var nth      = remaining[p.action];
    remaining[p.action]--;
    var diminish = Math.pow(0.85, nth - 1);

    var cDelta = effect.congestion * diminish;
    var hDelta = effect.happiness  * diminish;

    var neighbours = getGridNeighbours(p.row, p.col, grid);
    var adjBuildings = neighbours.filter(function (n) { return n.type === 'building'; }).length;

    // Adjacency bonuses
    if (p.action === 'park')     hDelta += adjBuildings * 3;
    if (p.action === 'bus-stop') cDelta -= adjBuildings * 2;

    // Hotspot multiplier: ≥3 adj buildings amplifies bus-stop and bike-lane
    if (adjBuildings >= 3 && (p.action === 'bus-stop' || p.action === 'bike-lane')) {
      cDelta *= 1.25;
      hDelta *= 1.25;
    }

    congestionDelta += cDelta;
    happinessDelta  += hDelta;
  });

  // Combo bonuses: each orthogonally adjacent pair of placements
  for (var i = 0; i < placements.length; i++) {
    for (var j = i + 1; j < placements.length; j++) {
      var pi = placements[i], pj = placements[j];
      var adjacent = (pi.row === pj.row && Math.abs(pi.col - pj.col) === 1) ||
                     (pi.col === pj.col && Math.abs(pi.row - pj.row) === 1);
      if (!adjacent) continue;
      var ai = pi.action, aj = pj.action;
      COMBOS.forEach(function (combo) {
        if ((combo.a === ai && combo.b === aj) || (combo.a === aj && combo.b === ai)) {
          congestionDelta += combo.congestion;
          happinessDelta  += combo.happiness;
        }
      });
    }
  }

  return { congestionDelta: congestionDelta, happinessDelta: happinessDelta };
}

// ── checkWinCondition ──────────────────────────────────────────────────────

/**
 * checkWinCondition(state) → "win" | "lose" | "playing"
 *
 * state: {
 *   happiness:     number   (current value, 0–100)
 *   congestion:    number   (current value, 0–100)
 *   budget:        number   (remaining £)
 *   minActionCost: number   (cheapest available action, 0 if unknown)
 *   turnsLeft:     number   (turns remaining; Infinity if no limit)
 * }
 */
function checkWinCondition(state) {
  var happiness     = state.happiness     || 0;
  var congestion    = state.congestion    || 0;
  var budget        = state.budget        || 0;
  var minActionCost = state.minActionCost || 0;
  var turnsLeft     = (state.turnsLeft == null) ? Infinity : state.turnsLeft;

  if (happiness >= WIN_HAPPINESS && congestion <= WIN_CONGESTION) return 'win';
  if (budget <= 0 || (minActionCost > 0 && budget < minActionCost)) return 'lose';
  if (turnsLeft <= 0) return 'lose';
  return 'playing';
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  EFFECTS,
  COMBOS,
  WIN_HAPPINESS,
  WIN_CONGESTION,
  DEFAULT_TURN_LIMIT,
  INITIAL_STATE,
  getGridNeighbours,
  hotspotScore,
  calculateEffects,
  checkWinCondition,
};
