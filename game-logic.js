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
 */
function calculateEffects(placements, grid) {
  // Count placements per type (for diminishing-returns order)
  var placedCount = {};
  placements.forEach(function (p) {
    placedCount[p.action] = (placedCount[p.action] || 0) + 1;
  });

  // Clone for decrement as we process in reverse (last placed = highest n)
  var remaining = Object.assign({}, placedCount);

  var congestionDelta = 0;
  var happinessDelta  = 0;

  placements.forEach(function (p) {
    var effect = EFFECTS[p.action];
    if (!effect) return;

    var nth     = remaining[p.action];
    remaining[p.action]--;
    var diminish = Math.pow(0.85, nth - 1);

    var cDelta = effect.congestion * diminish;
    var hDelta = effect.happiness  * diminish;

    var neighbours = getGridNeighbours(p.row, p.col, grid);

    if (p.action === 'park') {
      var adjB = neighbours.filter(function (n) { return n.type === 'building'; }).length;
      hDelta += adjB * 3;
    }
    if (p.action === 'bus-stop') {
      var adjB2 = neighbours.filter(function (n) { return n.type === 'building'; }).length;
      cDelta -= adjB2 * 2;
    }

    congestionDelta += cDelta;
    happinessDelta  += hDelta;
  });

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
  WIN_HAPPINESS,
  WIN_CONGESTION,
  DEFAULT_TURN_LIMIT,
  INITIAL_STATE,
  getGridNeighbours,
  calculateEffects,
  checkWinCondition,
};
