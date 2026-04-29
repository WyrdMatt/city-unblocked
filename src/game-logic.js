// Pure calculation functions — no DOM, no window, no side effects.
// Keep in sync with the corresponding declarations in the game-state
// <script> block in index.html.

// ── Constants ──────────────────────────────────────────────────────────────

export const EFFECTS = {
  'bus-stop':       { congestion: -10, happiness:  +6 },
  'bike-lane':      { congestion:  -6, happiness:  +8 },
  'parking-garage': { congestion:  -8, happiness:  +4 },
  'park':           { congestion:  -4, happiness: +12 },
  'road-widening':  { congestion: -15, happiness:  -5 },
};

export const WIN_HAPPINESS  = 70;
export const WIN_CONGESTION = 30;
export const DEFAULT_TURN_LIMIT = 15;

export const INITIAL_STATE = { congestion: 80, happiness: 20, budget: 500, turn: 0, won: false, turnLimit: DEFAULT_TURN_LIMIT };

export const DIFFICULTY_PRESETS = {
  easy:   { budget: 700, turnLimit: 20, blockerRate: 0,    generatorCount: 1 },
  normal: { budget: 500, turnLimit: 15, blockerRate: 0.03, generatorCount: 2 },
  hard:   { budget: 350, turnLimit: 12, blockerRate: 0.06, generatorCount: 2 },
};

// ── Puzzle-mechanic constants ──────────────────────────────────────────────

export const ZONE_CAP        = 2;   // max of same action type per block zone
export const GENERATOR_DELTA = 3;   // congestion added per unsuppressed generator per recalc
export const DEMOLISH_COST   = 50;  // budget cost to clear a blocker tile

// ── Puzzle-mechanic helpers ────────────────────────────────────────────────

export function getBlockId(row, col, roadRows, roadCols) {
  const rowBand = roadRows.filter(r => r < row).length;
  const colBand = roadCols.filter(c => c < col).length;
  return rowBand + ':' + colBand;
}

export function checkZoneCap(placements, blockId, action, validTilesInBlock) {
  const cap   = Math.max(ZONE_CAP, Math.floor((validTilesInBlock || 0) / 2));
  const count = placements.filter(p => p.blockId === blockId && p.action === action).length;
  return count >= cap;
}

export function applyGeneratorTick(generatorTiles, placements) {
  const ROAD_ACTIONS = new Set(['bus-stop', 'bike-lane', 'road-widening']);
  let delta = 0;
  generatorTiles.forEach(gen => {
    const suppressed = placements.some(p => {
      if (!ROAD_ACTIONS.has(p.action)) return false;
      return (p.row === gen.row && Math.abs(p.col - gen.col) === 1) ||
             (p.col === gen.col && Math.abs(p.row - gen.row) === 1);
    });
    if (!suppressed) delta += GENERATOR_DELTA;
  });
  return delta;
}

// ── Weather system ─────────────────────────────────────────────────────────

export const WEATHER_TYPES = ['sunny', 'rainy', 'overcast', 'snowy', 'stormy'];

export const WEATHER_META = {
  sunny:    { label: 'Sunny',    emoji: '☀️',  hint: 'Perfect conditions. All actions at full effect.' },
  rainy:    { label: 'Rainy',    emoji: '🌧️',  hint: 'Wet roads — bike lanes and parks less effective; bus stops busier.' },
  overcast: { label: 'Overcast', emoji: '☁️',  hint: 'Grey skies — slight reduction in happiness gains.' },
  snowy:    { label: 'Snowy',    emoji: '❄️',  hint: 'Icy conditions — bus stops critical; bikes impractical.' },
  stormy:   { label: 'Stormy',   emoji: '⛈️',  hint: 'Severe weather — only infrastructure actions are effective.' },
};

export const WEATHER_MULTIPLIERS = {
  sunny: {},
  rainy: {
    'bike-lane':  { cong: 0.75, hap: 0.60 },
    'park':       { cong: 1.00, hap: 0.70 },
    'bus-stop':   { cong: 1.30, hap: 1.00 },
  },
  overcast: {
    'bike-lane': { hap: 0.85 },
    'park':      { hap: 0.90 },
  },
  snowy: {
    'bike-lane':     { cong: 0.40, hap: 0.35 },
    'park':          { cong: 0.70, hap: 0.50 },
    'bus-stop':      { cong: 1.40, hap: 1.20 },
    'road-widening': { cong: 1.30 },
  },
  stormy: {
    'bike-lane':      { cong: 0.30, hap: 0.25 },
    'park':           { cong: 0.50, hap: 0.30 },
    'bus-stop':       { cong: 1.50, hap: 1.00 },
    'road-widening':  { cong: 1.25 },
    'parking-garage': { cong: 1.20 },
  },
};

// ── Combo bonuses ──────────────────────────────────────────────────────────

export const COMBOS = [
  { a: 'bus-stop',       b: 'park',           congestion:  0, happiness: +5, label: 'Transit Hub' },
  { a: 'bike-lane',      b: 'park',           congestion: -2, happiness: +3, label: 'Green Corridor' },
  { a: 'bus-stop',       b: 'bike-lane',      congestion: -3, happiness:  0, label: 'Active Streets' },
  { a: 'park',           b: 'park',           congestion:  0, happiness: +3, label: 'Green Network' },
  { a: 'parking-garage', b: 'bus-stop',       congestion: -3, happiness:  0, label: 'Park & Ride' },
  { a: 'road-widening',  b: 'bus-stop',       congestion: -4, happiness:  0, label: 'Express Lane' },
];

// ── Helper: grid neighbours ────────────────────────────────────────────────

export function getGridNeighbours(row, col, grid) {
  const offsets = [[-1,0],[1,0],[0,-1],[0,1]];
  return offsets
    .map(([dr, dc]) => grid.find(t => t.row === row + dr && t.col === col + dc))
    .filter(Boolean);
}

// ── calculateEffects ───────────────────────────────────────────────────────

export function hotspotScore(placement, grid) {
  return getGridNeighbours(placement.row, placement.col, grid)
    .filter(n => n.type === 'building').length;
}

export function calculateEffects(placements, grid, weather) {
  const placedCount = {};
  placements.forEach(p => {
    placedCount[p.action] = (placedCount[p.action] || 0) + 1;
  });

  const remaining = { ...placedCount };
  let congestionDelta = 0;
  let happinessDelta  = 0;

  placements.forEach(p => {
    const effect = EFFECTS[p.action];
    if (!effect) return;

    const nth      = remaining[p.action];
    remaining[p.action]--;
    const diminish = Math.pow(0.85, nth - 1);

    let cDelta = effect.congestion * diminish;
    let hDelta = effect.happiness  * diminish;

    const neighbours   = getGridNeighbours(p.row, p.col, grid);
    const adjBuildings = neighbours.filter(n => n.type === 'building').length;

    if (p.action === 'park')     hDelta += adjBuildings * 3;
    if (p.action === 'bus-stop') cDelta -= adjBuildings * 2;

    if (adjBuildings >= 3 && (p.action === 'bus-stop' || p.action === 'bike-lane')) {
      cDelta *= 1.25;
      hDelta *= 1.25;
    }

    if (weather && WEATHER_MULTIPLIERS[weather]) {
      const wm = WEATHER_MULTIPLIERS[weather][p.action] || {};
      if (wm.cong != null) cDelta *= wm.cong;
      if (wm.hap  != null) hDelta *= wm.hap;
    }

    congestionDelta += cDelta;
    happinessDelta  += hDelta;
  });

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const pi = placements[i], pj = placements[j];
      const adjacent = (pi.row === pj.row && Math.abs(pi.col - pj.col) === 1) ||
                       (pi.col === pj.col && Math.abs(pi.row - pj.row) === 1);
      if (!adjacent) continue;
      const ai = pi.action, aj = pj.action;
      COMBOS.forEach(combo => {
        if ((combo.a === ai && combo.b === aj) || (combo.a === aj && combo.b === ai)) {
          congestionDelta += combo.congestion;
          happinessDelta  += combo.happiness;
        }
      });
    }
  }

  return { congestionDelta, happinessDelta };
}

// ── checkWinCondition ──────────────────────────────────────────────────────

export function checkWinCondition(state) {
  const happiness     = state.happiness     || 0;
  const congestion    = state.congestion    || 0;
  const budget        = state.budget        || 0;
  const minActionCost = state.minActionCost || 0;
  const turnsLeft     = (state.turnsLeft == null) ? Infinity : state.turnsLeft;

  if (happiness >= WIN_HAPPINESS && congestion <= WIN_CONGESTION) return 'win';
  if (budget <= 0 || (minActionCost > 0 && budget < minActionCost)) return 'lose';
  if (turnsLeft <= 0) return 'lose';
  return 'playing';
}
