// Pure calculation functions — no DOM, no window, no side effects.
// Keep in sync with the corresponding declarations in the game-state
// <script> block in index.html.

// ── Constants ──────────────────────────────────────────────────────────────

export const EFFECTS = {
  'bus-stop':          { congestion: -10, happiness:  +6, carbon:  -3 },
  'bike-lane':         { congestion:  -6, happiness:  +8, carbon:  -5 },
  'parking-garage':    { congestion:  -8, happiness:  +4, carbon:  +4 },
  'park':              { congestion:  -4, happiness: +12, carbon:  -6 },
  'road-widening':     { congestion: -15, happiness:  -5, carbon:  +8 },
  'ev-charging':       { congestion:  -3, happiness:  +2, carbon:  -8 },
  'self-driving-taxi': { congestion:  -8, happiness: +10, carbon:  -4 },
  'industrial-dev':    { congestion:  +5, happiness: -10, carbon: +12 },
};

export const WIN_HAPPINESS  = 70;
export const WIN_CONGESTION = 30;
export const DEFAULT_TURN_LIMIT = 15;

// Passive decay applied per turn in updateMeters()
export const DECAY_RATES = {
  congestion: 1.5,   // +1.5 cong/turn  → hits 100 in ~30 turns with no mitigation
  happiness:  -1.5,  // −1.5 hap/turn   → hits 0   in ~30 turns with no mitigation
  carbon:     1.0,   // +1.0 carbon/turn → hits 100 in ~65 turns (slower pressure)
};

// Automatic loss when any meter crosses these thresholds
export const LOSE_THRESHOLDS = { congestion: 100, happiness: 0, carbon: 100 };

export const INITIAL_STATE = { congestion: 55, happiness: 45, carbon: 35, budget: 500, turn: 0, won: false, turnLimit: DEFAULT_TURN_LIMIT };

export const DIFFICULTY_PRESETS = {
  easy:   { budget: 900, turnLimit: 25, blockerRate: 0,    generatorCount: 1 },
  normal: { budget: 650, turnLimit: 20, blockerRate: 0.03, generatorCount: 2 },
  hard:   { budget: 480, turnLimit: 15, blockerRate: 0.06, generatorCount: 2 },
  expert: { budget: 300, turnLimit: 10, blockerRate: 0.10, generatorCount: 3 },
};

export const CITY_PROFILES = {
  standard: {
    label: 'Standard', emoji: '🏙️',
    description: 'Reduce congestion and improve quality of life.',
    win: { happiness: 75, congestion: 25 },
  },
  green: {
    label: 'Green City', emoji: '🌿',
    description: 'Build a sustainable, low-carbon city.',
    win: { happiness: 65, congestion: 35, carbon: 30 },
  },
  transit: {
    label: 'Transit Hub', emoji: '🚌',
    description: 'Create a world-class public transport network.',
    win: { happiness: 60, congestion: 20 },
  },
  vibrant: {
    label: 'Vibrant City', emoji: '🎉',
    description: 'Create a joyful, people-first city.',
    win: { happiness: 85, congestion: 40 },
  },
  eco: {
    label: 'Eco Warriors', emoji: '♻️',
    description: 'Slash carbon emissions to save the planet.',
    win: { happiness: 70, carbon: 20 },
  },
};

// ── Puzzle-mechanic constants ──────────────────────────────────────────────

export const ZONE_CAP               = 2;   // max of same action type per block zone
export const GENERATOR_DELTA        = 3;   // congestion added per unsuppressed generator per recalc
export const GENERATOR_CARBON_DELTA = 2;   // carbon added per unsuppressed generator per recalc
export const DEMOLISH_COST          = 50;  // budget cost to clear a blocker tile
export const ROAD_WIDENING_BUILDING_BONUS    = 25;  // £ returned per adjacent building when road-widening is placed
export const COMMERCIAL_TRANSPORT_SUBSIDY    = 20;  // £ refunded when transport placed adjacent to commercial tile
export const COMMERCIAL_SCORE_BONUS          = 40;  // score bonus per unique commercial block engaged (for star rating)
export const CONGESTION_SURCHARGE_ACTIONS = new Set(['bus-stop', 'bike-lane', 'road-widening', 'ev-charging', 'self-driving-taxi']);

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

export function getCongestSurcharge(congestion) {
  return congestion >= 85 ? 1.20 : congestion >= 70 ? 1.10 : 1.00;
}

export function applyGeneratorTickFull(generatorTiles, placements) {
  const ROAD_ACTIONS = new Set(['bus-stop', 'bike-lane', 'road-widening']);
  let congestion = 0, carbon = 0;
  generatorTiles.forEach(gen => {
    const suppressed = placements.some(p => {
      if (!ROAD_ACTIONS.has(p.action)) return false;
      return (p.row === gen.row && Math.abs(p.col - gen.col) === 1) ||
             (p.col === gen.col && Math.abs(p.row - gen.row) === 1);
    });
    if (!suppressed) { congestion += GENERATOR_DELTA; carbon += GENERATOR_CARBON_DELTA; }
  });
  return { congestion, carbon };
}

export function applyGeneratorTick(generatorTiles, placements) {
  return applyGeneratorTickFull(generatorTiles, placements).congestion;
}

// ── Weather system ─────────────────────────────────────────────────────────

export const WEATHER_TYPES = ['sunny', 'rainy', 'overcast', 'snowy', 'stormy'];

export const WEATHER_META = {
  sunny:    { label: 'Sunny',    emoji: '☀️',  hint: 'Perfect conditions. EVs and autonomous taxis at peak performance.' },
  rainy:    { label: 'Rainy',    emoji: '🌧️',  hint: 'Wet roads — bike lanes and parks less effective; bus stops busier. EV and taxi networks slightly reduced.' },
  overcast: { label: 'Overcast', emoji: '☁️',  hint: 'Grey skies — slight happiness reduction. Autonomous taxi sensors less accurate.' },
  snowy:    { label: 'Snowy',    emoji: '❄️',  hint: 'Icy conditions — bus stops critical; bikes and EVs severely impaired; autonomous taxis unreliable.' },
  stormy:   { label: 'Stormy',   emoji: '⛈️',  hint: 'Severe weather — only infrastructure works well. EVs and autonomous vehicles near-useless.' },
};

export const WEATHER_MULTIPLIERS = {
  sunny: {
    // Warm, clear conditions: EV batteries at peak range; autonomous sensors optimal
    'ev-charging':       { cong: 1.15, hap: 1.10 },
    'self-driving-taxi': { cong: 1.10, hap: 1.05 },
  },
  rainy: {
    'bike-lane':         { cong: 0.75, hap: 0.60 },
    'park':              { cong: 1.00, hap: 0.70 },
    'bus-stop':          { cong: 1.30, hap: 1.00 },
    // Rain mildly reduces EV range; lidar/cameras slightly impaired on taxis
    'ev-charging':       { cong: 0.85, hap: 0.85 },
    'self-driving-taxi': { cong: 0.80, hap: 0.85 },
  },
  overcast: {
    'bike-lane':         { hap: 0.85 },
    'park':              { hap: 0.90 },
    // Reduced visibility affects camera-based taxi systems
    'self-driving-taxi': { cong: 0.90, hap: 0.90 },
  },
  snowy: {
    'bike-lane':         { cong: 0.40, hap: 0.35 },
    'park':              { cong: 0.70, hap: 0.50 },
    'bus-stop':          { cong: 1.40, hap: 1.20 },
    'road-widening':     { cong: 1.30 },
    // Cold kills EV battery range by 30-40%; lane markings hidden impairs taxi sensors
    'ev-charging':       { cong: 0.40, hap: 0.45 },
    'self-driving-taxi': { cong: 0.45, hap: 0.50 },
  },
  stormy: {
    'bike-lane':         { cong: 0.30, hap: 0.25 },
    'park':              { cong: 0.50, hap: 0.30 },
    'bus-stop':          { cong: 1.50, hap: 1.00 },
    'road-widening':     { cong: 1.25 },
    'parking-garage':    { cong: 1.20 },
    // Extreme cold + safety risk; autonomous sensors severely impaired in storm
    'ev-charging':       { cong: 0.25, hap: 0.30 },
    'self-driving-taxi': { cong: 0.25, hap: 0.30 },
  },
};

// ── Combo bonuses ──────────────────────────────────────────────────────────

export const COMBOS = [
  { a: 'bus-stop',       b: 'park',           congestion:  0, happiness: +3, label: 'Transit Hub' },
  { a: 'bike-lane',      b: 'park',           congestion: -1, happiness: +3, label: 'Pedestrian Zone' },
  { a: 'bus-stop',       b: 'bike-lane',      congestion: -3, happiness:  0, label: 'Active Streets' },
  { a: 'park',           b: 'park',           congestion:  0, happiness: +3, label: 'Green Network' },
  { a: 'parking-garage', b: 'bus-stop',       congestion: -3, happiness:  0, label: 'Park & Ride' },
  { a: 'road-widening',  b: 'bus-stop',       congestion: -4, happiness:  0, label: 'Express Lane' },
  { a: 'parking-garage', b: 'park',           congestion: -2, happiness: +6, label: 'Green Gateway' },
  { a: 'parking-garage', b: 'bike-lane',      congestion: -3, happiness: +2, label: 'Commuter Link' },
  { a: 'road-widening',  b: 'parking-garage', congestion: -5, happiness:  0, label: 'Industrial Bypass' },
  { a: 'ev-charging',       b: 'parking-garage', congestion: -4, happiness:  0, carbon: -5, label: 'Clean Commute'    },
  { a: 'self-driving-taxi', b: 'bus-stop',       congestion: -3, happiness: +4, label: 'Seamless Network' },
];

// ── Helper: grid neighbours ────────────────────────────────────────────────

export function getGridNeighbours(row, col, grid) {
  const offsets = [[-1,0],[1,0],[0,-1],[0,1]];
  return offsets
    .map(([dr, dc]) => grid.find(t => t.row === row + dr && t.col === col + dc))
    .filter(Boolean);
}

export function calculateRoadWideningBonus(cgTile, grid) {
  if (!cgTile || !Array.isArray(grid)) return 0;
  const isBldg = t => t.type === 'building' || t.type === 'commercial' || t.type === 'arena';
  return getGridNeighbours(cgTile.row, cgTile.col, grid).filter(isBldg).length * ROAD_WIDENING_BUILDING_BONUS;
}

// ── Bus stop face limit ────────────────────────────────────────────────────

// Returns a string key identifying which road segment (face) a tile belongs to.
// H-road tile → 'H:{row}:{colBand}', V-road tile → 'V:{rowBand}:{col}',
// intersection → 'X:{row}:{col}' (unique — no cross-street constraint at junctions).
// Returns null for non-road tiles.
export function getRoadFaceId(row, col, roadRows, roadCols) {
  const inRoadRow = roadRows.includes(row);
  const inRoadCol = roadCols.includes(col);
  if (inRoadRow && inRoadCol) return `X:${row}:${col}`;
  if (inRoadRow) return `H:${row}:${roadCols.filter(c => c < col).length}`;
  if (inRoadCol) return `V:${roadRows.filter(r => r < row).length}:${col}`;
  return null;
}

// Returns true if a bus stop already exists on the given road face.
export function checkBusStopFaceLimit(placements, faceId, roadRows, roadCols) {
  if (!faceId) return false;
  return placements.some(p =>
    p.action === 'bus-stop' && getRoadFaceId(p.row, p.col, roadRows, roadCols) === faceId
  );
}

// ── Commercial transport subsidy ───────────────────────────────────────────

const TRANSPORT_SUBSIDY_ACTIONS = new Set(['bus-stop', 'bike-lane', 'ev-charging', 'self-driving-taxi']);

// Returns the budget refund for placing a transport action adjacent to a commercial tile.
// Flat £COMMERCIAL_TRANSPORT_SUBSIDY if any commercial neighbour exists, else 0.
export function calculateTransportSubsidy(action, cgTile, grid) {
  if (!TRANSPORT_SUBSIDY_ACTIONS.has(action)) return 0;
  if (!cgTile || !Array.isArray(grid)) return 0;
  const hasCommercial = getGridNeighbours(cgTile.row, cgTile.col, grid)
    .some(n => n.type === 'commercial');
  return hasCommercial ? COMMERCIAL_TRANSPORT_SUBSIDY : 0;
}

// ── Win score (star rating) ────────────────────────────────────────────────

// Counts distinct commercial tile positions that have at least one adjacent placed transport action.
export function countCommercialBlocksEngaged(placements, grid) {
  const engaged = new Set();
  placements
    .filter(p => TRANSPORT_SUBSIDY_ACTIONS.has(p.action))
    .forEach(p => {
      getGridNeighbours(p.row, p.col, grid)
        .filter(n => n.type === 'commercial')
        .forEach(n => engaged.add(`${n.row}:${n.col}`));
    });
  return engaged.size;
}

// Win score = budget + commercial engagement bonus (used for star rating only, not actual budget).
export function calculateWinScore(budget, placements, grid) {
  return budget + countCommercialBlocksEngaged(placements, grid) * COMMERCIAL_SCORE_BONUS;
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
  let carbonDelta     = 0;

  placements.forEach(p => {
    const effect = EFFECTS[p.action];
    if (!effect) return;

    const nth      = remaining[p.action];
    remaining[p.action]--;
    const diminish = Math.pow(0.85, nth - 1);

    let cDelta   = effect.congestion * diminish;
    let hDelta   = effect.happiness  * diminish;
    let cbnDelta = (effect.carbon || 0) * diminish;

    const neighbours    = getGridNeighbours(p.row, p.col, grid);
    const isBldg        = n => n.type === 'building' || n.type === 'commercial' || n.type === 'arena';
    const adjBuildings  = neighbours.filter(isBldg).length;
    const adjCommercial = neighbours.filter(n => n.type === 'commercial').length;
    const adjArena      = neighbours.filter(n => n.type === 'arena').length;

    if (p.action === 'park')     hDelta += adjBuildings * 3;
    if (p.action === 'bus-stop') cDelta -= adjBuildings * 2;

    if (adjBuildings >= 3 && (p.action === 'bus-stop' || p.action === 'bike-lane')) {
      cDelta *= 1.25;
      hDelta *= 1.25;
    }

    // Building sub-type bonuses
    if (p.action === 'bus-stop' && adjCommercial > 0) cDelta *= 1.25;
    if (p.action === 'park'     && adjArena > 0)      hDelta += adjArena * 6;
    if (p.action === 'bus-stop' && adjArena > 0)      cDelta -= adjArena * 5;

    if (weather && WEATHER_MULTIPLIERS[weather]) {
      const wm = WEATHER_MULTIPLIERS[weather][p.action] || {};
      if (wm.cong != null) cDelta *= wm.cong;
      if (wm.hap  != null) hDelta *= wm.hap;
    }

    congestionDelta += cDelta;
    happinessDelta  += hDelta;
    carbonDelta     += cbnDelta;
  });

  // Bus stop network bonus: each stop ≥3 Chebyshev from every other stop gets −3 congestion
  const busStops = placements.filter(p => p.action === 'bus-stop');
  if (busStops.length >= 2) {
    busStops.forEach(bs => {
      const hasNearNeighbour = busStops.some(other =>
        other !== bs && Math.max(Math.abs(other.row - bs.row), Math.abs(other.col - bs.col)) < 3
      );
      if (!hasNearNeighbour) congestionDelta -= 3;
    });
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const pi = placements[i], pj = placements[j];
      const adjacent = (pi.row === pj.row && Math.abs(pi.col - pj.col) === 1) ||
                       (pi.col === pj.col && Math.abs(pi.row - pj.row) === 1);
      const diagonal = Math.abs(pi.row - pj.row) === 1 && Math.abs(pi.col - pj.col) === 1;
      if (!adjacent && !diagonal) continue;
      const multiplier = adjacent ? 1 : 0.5;
      const ai = pi.action, aj = pj.action;
      COMBOS.forEach(combo => {
        if ((combo.a === ai && combo.b === aj) || (combo.a === aj && combo.b === ai)) {
          congestionDelta += Math.trunc(combo.congestion * multiplier);
          happinessDelta  += Math.trunc(combo.happiness  * multiplier);
          if (combo.carbon) carbonDelta += Math.trunc(combo.carbon * multiplier);
        }
      });
    }
  }

  return { congestionDelta, happinessDelta, carbonDelta };
}

// ── checkWinCondition ──────────────────────────────────────────────────────

export function checkWinCondition(state, profileKey) {
  const happiness     = state.happiness     || 0;
  const congestion    = state.congestion    || 0;
  const carbon        = state.carbon        ?? 0;
  const budget        = state.budget        || 0;
  const minActionCost = state.minActionCost || 0;
  const turnsLeft     = (state.turnsLeft == null) ? Infinity : state.turnsLeft;

  // Win check — use profile thresholds when specified, else default constants
  const profile = profileKey ? CITY_PROFILES[profileKey] : null;
  if (profile) {
    const w = profile.win;
    const hapWon  = w.happiness  == null || happiness  >= w.happiness;
    const congWon = w.congestion == null || congestion <= w.congestion;
    const cbnWon  = w.carbon     == null || carbon     <= w.carbon;
    if (hapWon && congWon && cbnWon) return 'win';
  } else {
    if (happiness >= WIN_HAPPINESS && congestion <= WIN_CONGESTION) return 'win';
  }

  // Universal lose checks
  if (congestion >= LOSE_THRESHOLDS.congestion) return 'lose';
  if (happiness <= LOSE_THRESHOLDS.happiness) return 'lose';
  if (carbon >= LOSE_THRESHOLDS.carbon) return 'lose';
  if (budget <= 0 || (minActionCost > 0 && budget < minActionCost)) return 'lose';
  if (turnsLeft <= 0) return 'lose';
  return 'playing';
}
