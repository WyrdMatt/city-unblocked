import { describe, test, expect } from 'vitest'
import {
  EFFECTS, COMBOS, WEATHER_TYPES, WEATHER_META, WEATHER_MULTIPLIERS,
  WIN_HAPPINESS, WIN_CONGESTION, DEFAULT_TURN_LIMIT, INITIAL_STATE,
  LOSE_THRESHOLDS,
  ROAD_WIDENING_BUILDING_BONUS, CONGESTION_SURCHARGE_ACTIONS,
  getGridNeighbours, hotspotScore, calculateEffects, checkWinCondition,
  getCongestSurcharge, calculateRoadWideningBonus,
} from '../src/game-logic.js'

const approx = (a, b, eps = 0.001) => Math.abs(a - b) < eps

function buildGrid(overrides = []) {
  const grid = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      grid.push({ row: r, col: c, type: 'building' })
  overrides.forEach(o => {
    const cell = grid.find(t => t.row === o.row && t.col === o.col)
    if (cell) cell.type = o.type
  })
  return grid
}

// ── EFFECTS constants ──────────────────────────────────────────────────────

describe('EFFECTS constants', () => {
  test('bus-stop base values', () => {
    expect(EFFECTS['bus-stop'].congestion).toBe(-10)
    expect(EFFECTS['bus-stop'].happiness).toBe(6)
  })
  test('bike-lane base values', () => {
    expect(EFFECTS['bike-lane'].congestion).toBe(-6)
    expect(EFFECTS['bike-lane'].happiness).toBe(8)
  })
  test('parking-garage base values', () => {
    expect(EFFECTS['parking-garage'].congestion).toBe(-8)
    expect(EFFECTS['parking-garage'].happiness).toBe(4)
  })
  test('park base values', () => {
    expect(EFFECTS['park'].congestion).toBe(-4)
    expect(EFFECTS['park'].happiness).toBe(12)
  })
  test('road-widening trade-off', () => {
    expect(EFFECTS['road-widening'].congestion).toBe(-15)
    expect(EFFECTS['road-widening'].happiness).toBe(-5)
  })
})

// ── WIN / INITIAL constants ────────────────────────────────────────────────

describe('win / initial constants', () => {
  test('WIN_HAPPINESS = 70', () => expect(WIN_HAPPINESS).toBe(70))
  test('WIN_CONGESTION = 30', () => expect(WIN_CONGESTION).toBe(30))
  test('DEFAULT_TURN_LIMIT = 15', () => expect(DEFAULT_TURN_LIMIT).toBe(15))
  test('INITIAL_STATE shape', () => {
    expect(INITIAL_STATE.congestion).toBe(55)
    expect(INITIAL_STATE.happiness).toBe(45)
    expect(INITIAL_STATE.carbon).toBe(35)
    expect(INITIAL_STATE.budget).toBe(500)
    expect(INITIAL_STATE.turnLimit).toBe(15)
  })
})

// ── getGridNeighbours ──────────────────────────────────────────────────────

describe('getGridNeighbours', () => {
  const grid = buildGrid()
  test('centre cell has 4 neighbours', () =>
    expect(getGridNeighbours(5, 5, grid).length).toBe(4))
  test('corner (0,0) has 2 neighbours', () =>
    expect(getGridNeighbours(0, 0, grid).length).toBe(2))
  test('top edge cell has 3 neighbours', () =>
    expect(getGridNeighbours(0, 5, grid).length).toBe(3))
})

// ── calculateEffects: single placement, no adjacency ──────────────────────

test('single bus-stop (no adj building): congestion -10, happiness +6', () => {
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' }, { row: 4, col: 5, type: 'road' },
    { row: 6, col: 5, type: 'road' }, { row: 5, col: 4, type: 'road' },
    { row: 5, col: 6, type: 'road' },
  ])
  const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -10)).toBe(true)
  expect(approx(d.happinessDelta,  +6)).toBe(true)
})

// ── calculateEffects: park adjacency bonus ─────────────────────────────────

test('park surrounded by 4 buildings: happiness +12 + 4×3 = +24', () => {
  const grid = buildGrid([{ row: 5, col: 5, type: 'empty' }])
  const d = calculateEffects([{ action: 'park', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -4)).toBe(true)
  expect(approx(d.happinessDelta, +24)).toBe(true)
})

// ── calculateEffects: bus-stop adjacency + hotspot ─────────────────────────

test('bus-stop adj+hotspot: (-10 - 8) × 1.25 = -22.5 congestion, +7.5 happiness', () => {
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }])
  const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -22.5, 0.01)).toBe(true)
  expect(approx(d.happinessDelta,    7.5, 0.01)).toBe(true)
})

// ── calculateEffects: diminishing returns ─────────────────────────────────

test('bike-lane ×3 diminishing returns', () => {
  const grid = buildGrid([
    { row: 0, col: 0, type: 'road' }, { row: 1, col: 0, type: 'road' },
    { row: 2, col: 0, type: 'road' }, { row: 0, col: 1, type: 'road' },
    { row: 1, col: 1, type: 'road' }, { row: 2, col: 1, type: 'road' },
    { row: 3, col: 0, type: 'road' },
  ])
  const placements = [
    { action: 'bike-lane', row: 0, col: 0 },
    { action: 'bike-lane', row: 1, col: 0 },
    { action: 'bike-lane', row: 2, col: 0 },
  ]
  const d = calculateEffects(placements, grid)
  const expectedCong = -6 * (1 + 0.85 + 0.85 * 0.85)
  const expectedHapp = +8 * (1 + 0.85 + 0.85 * 0.85)
  expect(approx(d.congestionDelta, expectedCong, 0.01)).toBe(true)
  expect(approx(d.happinessDelta,  expectedHapp, 0.01)).toBe(true)
})

// ── calculateEffects: road-widening ───────────────────────────────────────

test('road-widening: congestion -15, happiness -5', () => {
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }])
  const d = calculateEffects([{ action: 'road-widening', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -15)).toBe(true)
  expect(approx(d.happinessDelta,   -5)).toBe(true)
})

// ── calculateEffects: zero placements ─────────────────────────────────────

test('no placements: both deltas = 0', () => {
  const d = calculateEffects([], buildGrid())
  expect(d.congestionDelta).toBe(0)
  expect(d.happinessDelta).toBe(0)
})

// ── hotspotScore ──────────────────────────────────────────────────────────

describe('hotspotScore', () => {
  test('road surrounded by 4 buildings → 4', () => {
    const g = buildGrid([{ row: 5, col: 5, type: 'road' }])
    expect(hotspotScore({ row: 5, col: 5 }, g)).toBe(4)
  })
  test('corner surrounded by roads → 0', () => {
    const g = buildGrid([
      { row: 0, col: 0, type: 'road' },
      { row: 0, col: 1, type: 'road' },
      { row: 1, col: 0, type: 'road' },
    ])
    expect(hotspotScore({ row: 0, col: 0 }, g)).toBe(0)
  })
})

// ── hotspot multiplier ────────────────────────────────────────────────────

test('hotspot bus-stop ×1.25 amplification on 4-adj-building tile', () => {
  const grid = buildGrid([{ row: 5, col: 5, type: 'road' }])
  const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -22.5, 0.01)).toBe(true)
  expect(approx(d.happinessDelta,    7.5, 0.01)).toBe(true)
})

// ── combo bonuses ─────────────────────────────────────────────────────────

test('combo bus-stop+park (adjacent): happiness > sum of individual effects', () => {
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' },
    { row: 5, col: 6, type: 'empty' },
  ])
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',     row: 5, col: 6 }], grid)
  expect(dCombo.happinessDelta).toBeGreaterThan(d1.happinessDelta + d2.happinessDelta)
})

test('no combo: non-adjacent bus-stop+park = sum of individual effects', () => {
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' },
    { row: 5, col: 7, type: 'empty' },
  ])
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 5, col: 7 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',     row: 5, col: 7 }], grid)
  expect(approx(dCombo.happinessDelta, d1.happinessDelta + d2.happinessDelta, 0.01)).toBe(true)
})

describe('COMBOS constant', () => {
  test('at least 9 combo definitions', () =>
    expect(COMBOS.length).toBeGreaterThanOrEqual(9))
  test('Transit Hub defined', () =>
    expect(COMBOS.some(c => c.a === 'bus-stop' && c.b === 'park' && c.happiness === 5)).toBe(true))
  test('Green Network defined', () =>
    expect(COMBOS.some(c => c.a === 'park' && c.b === 'park')).toBe(true))
  test('Pedestrian Zone defined (bike+park)', () =>
    expect(COMBOS.some(c => c.a === 'bike-lane' && c.b === 'park' && c.congestion === -1 && c.happiness === 5)).toBe(true))
  test('Green Gateway defined (parking+park)', () =>
    expect(COMBOS.some(c => c.a === 'parking-garage' && c.b === 'park' && c.congestion === -2 && c.happiness === 6)).toBe(true))
  test('Commuter Link defined (parking+bike)', () =>
    expect(COMBOS.some(c => c.a === 'parking-garage' && c.b === 'bike-lane' && c.congestion === -3)).toBe(true))
  test('Industrial Bypass defined (road-widening+parking)', () =>
    expect(COMBOS.some(c => c.a === 'road-widening' && c.b === 'parking-garage' && c.congestion === -5)).toBe(true))
})

// ── New combo effects ──────────────────────────────────────────────────────

function isolatedGrid(placements) {
  const grid = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      grid.push({ row: r, col: c, type: 'road' })
  return grid
}

test('Pedestrian Zone (bike-lane adj park): −1 cong, +5 hap combo bonus', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'bike-lane', row: 5, col: 5 },
    { action: 'park',      row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bike-lane', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',      row: 5, col: 6 }], grid)
  expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 1, 0.01)).toBe(true)
  expect(approx(dCombo.happinessDelta,  d1.happinessDelta  + d2.happinessDelta  + 5, 0.01)).toBe(true)
})

test('Green Gateway (parking-garage adj park): −2 cong, +6 hap combo bonus', () => {
  const grid = buildGrid([
    { row: 5, col: 5, type: 'building' },
    { row: 5, col: 6, type: 'empty' },
  ])
  const dCombo = calculateEffects([
    { action: 'parking-garage', row: 5, col: 5 },
    { action: 'park',           row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'parking-garage', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',           row: 5, col: 6 }], grid)
  expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 2, 0.01)).toBe(true)
  expect(approx(dCombo.happinessDelta,  d1.happinessDelta  + d2.happinessDelta  + 6, 0.01)).toBe(true)
})

test('Commuter Link (parking-garage adj bike-lane): −3 cong, +2 hap combo bonus', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'parking-garage', row: 5, col: 5 },
    { action: 'bike-lane',      row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'parking-garage', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'bike-lane',      row: 5, col: 6 }], grid)
  expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 3, 0.01)).toBe(true)
  expect(approx(dCombo.happinessDelta,  d1.happinessDelta  + d2.happinessDelta  + 2, 0.01)).toBe(true)
})

test('Industrial Bypass (road-widening adj parking-garage): −5 cong combo bonus', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'road-widening',  row: 5, col: 5 },
    { action: 'parking-garage', row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'road-widening',  row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'parking-garage', row: 5, col: 6 }], grid)
  expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 5, 0.01)).toBe(true)
  expect(approx(dCombo.happinessDelta,  d1.happinessDelta  + d2.happinessDelta,       0.01)).toBe(true)
})

// ── Diagonal combos ────────────────────────────────────────────────────────

test('diagonal combo fires at 50% (truncated): Transit Hub diagonal gives +2 hap', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 6, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',     row: 6, col: 6 }], grid)
  // Transit Hub: happiness +5 → floor(5×0.5)=2
  expect(approx(dCombo.happinessDelta, d1.happinessDelta + d2.happinessDelta + 2, 0.01)).toBe(true)
})

test('diagonal combo does not fire at distance 2', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 7, col: 7 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',     row: 7, col: 7 }], grid)
  expect(approx(dCombo.happinessDelta, d1.happinessDelta + d2.happinessDelta, 0.01)).toBe(true)
})

test('orthogonal combo still fires at 100% (diagonal logic does not break it)', () => {
  const grid = isolatedGrid()
  const dCombo = calculateEffects([
    { action: 'bus-stop', row: 5, col: 5 },
    { action: 'park',     row: 5, col: 6 },
  ], grid)
  const d1 = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  const d2 = calculateEffects([{ action: 'park',     row: 5, col: 6 }], grid)
  // Transit Hub: happiness +5 at full
  expect(approx(dCombo.happinessDelta, d1.happinessDelta + d2.happinessDelta + 5, 0.01)).toBe(true)
})

// ── Bus stop spacing bonus ─────────────────────────────────────────────────

test('bus stop spacing bonus: two stops ≥3 apart each get −3 congestion', () => {
  const grid = isolatedGrid()
  const dSpaced = calculateEffects([
    { action: 'bus-stop', row: 0, col: 0 },
    { action: 'bus-stop', row: 0, col: 4 },
  ], grid)
  const dClose = calculateEffects([
    { action: 'bus-stop', row: 0, col: 0 },
    { action: 'bus-stop', row: 0, col: 2 },
  ], grid)
  // spaced: each gets −3 bonus = −6 total more than close
  expect(approx(dSpaced.congestionDelta, dClose.congestionDelta - 6, 0.01)).toBe(true)
})

test('bus stop spacing bonus absent when stops are adjacent (Chebyshev < 3)', () => {
  const grid = isolatedGrid()
  const dClose = calculateEffects([
    { action: 'bus-stop', row: 0, col: 0 },
    { action: 'bus-stop', row: 0, col: 1 },
  ], grid)
  const dEach = calculateEffects([{ action: 'bus-stop', row: 0, col: 0 }], grid)
            .congestionDelta
        + calculateEffects([{ action: 'bus-stop', row: 0, col: 1 }], grid)
            .congestionDelta
  // no bonus — close stops give sum of individual effects only (minus diminishing)
  // both stops have diminishing returns so we can't use simple sum, just verify no −3 bonus
  expect(dClose.congestionDelta).toBeGreaterThan(dEach - 6)
})

test('single bus stop: no spacing bonus applied', () => {
  const grid = buildGrid([
    { row: 5, col: 5, type: 'road' }, { row: 4, col: 5, type: 'road' },
    { row: 6, col: 5, type: 'road' }, { row: 5, col: 4, type: 'road' },
    { row: 5, col: 6, type: 'road' },
  ])
  const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], grid)
  expect(approx(d.congestionDelta, -10)).toBe(true)
})

test('unknown action: no effect', () => {
  const d = calculateEffects([{ action: 'teleporter', row: 5, col: 5 }], buildGrid())
  expect(d.congestionDelta).toBe(0)
  expect(d.happinessDelta).toBe(0)
})

// ── checkWinCondition ─────────────────────────────────────────────────────

describe('checkWinCondition', () => {
  test('exact win threshold → win', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 30, budget: 200, minActionCost: 40, turnsLeft: 5 })).toBe('win'))
  test('over threshold → win', () =>
    expect(checkWinCondition({ happiness: 71, congestion: 29, budget: 100, minActionCost: 40, turnsLeft: 5 })).toBe('win'))
  test('happiness just below win → playing', () =>
    expect(checkWinCondition({ happiness: 69, congestion: 30, budget: 200, minActionCost: 40, turnsLeft: 5 })).toBe('playing'))
  test('congestion just above win → playing', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 31, budget: 200, minActionCost: 40, turnsLeft: 5 })).toBe('playing'))
  test('budget = 0 → lose', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget:  0, minActionCost: 40, turnsLeft: 5 })).toBe('lose'))
  test('budget < minActionCost → lose', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 39, minActionCost: 40, turnsLeft: 5 })).toBe('lose'))
  test('budget = minActionCost → playing', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 40, minActionCost: 40, turnsLeft: 5 })).toBe('playing'))
  test('minActionCost = 0, positive budget → playing', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 100, minActionCost: 0, turnsLeft: 5 })).toBe('playing'))
  test('budget = 0, minActionCost = 0 → lose', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 0, minActionCost: 0, turnsLeft: 5 })).toBe('lose'))
  test('turnsLeft = 0 → lose', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft:  0 })).toBe('lose'))
  test('turnsLeft negative → lose', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft: -1 })).toBe('lose'))
  test('turnsLeft = 1, not won → playing', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40, turnsLeft:  1 })).toBe('playing'))
  test('win conditions met even at turnsLeft=0 → win', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 30, budget: 200, minActionCost: 40, turnsLeft:  0 })).toBe('win'))
  test('no turnsLeft key = no turn limit → playing', () =>
    expect(checkWinCondition({ happiness: 20, congestion: 80, budget: 500, minActionCost: 40 })).toBe('playing'))
})

// ── Weather constants ──────────────────────────────────────────────────────

describe('weather constants', () => {
  test('WEATHER_TYPES: 5 entries', () => expect(WEATHER_TYPES.length).toBe(5))
  test('includes sunny', () => expect(WEATHER_TYPES).toContain('sunny'))
  test('includes stormy', () => expect(WEATHER_TYPES).toContain('stormy'))
  test('WEATHER_META.sunny has emoji', () => expect(typeof WEATHER_META.sunny?.emoji).toBe('string'))
  test('WEATHER_META.stormy has hint', () => expect(typeof WEATHER_META.stormy?.hint).toBe('string'))
})

// ── Weather multipliers ────────────────────────────────────────────────────

describe('calculateEffects with weather', () => {
  const fullRoadGrid = () => buildGrid([
    { row: 5, col: 5, type: 'road' }, { row: 4, col: 5, type: 'road' },
    { row: 6, col: 5, type: 'road' }, { row: 5, col: 4, type: 'road' },
    { row: 5, col: 6, type: 'road' },
  ])

  test('sunny = no change from baseline', () => {
    const grid = buildGrid([{ row: 5, col: 5, type: 'empty' }])
    const p = [{ action: 'park', row: 5, col: 5 }]
    const dNone  = calculateEffects(p, grid)
    const dSunny = calculateEffects(p, grid, 'sunny')
    expect(approx(dNone.happinessDelta,  dSunny.happinessDelta,  0.01)).toBe(true)
    expect(approx(dNone.congestionDelta, dSunny.congestionDelta, 0.01)).toBe(true)
  })

  test('rainy: bike-lane congestion ×0.75, happiness ×0.60', () => {
    const grid = fullRoadGrid()
    const p = [{ action: 'bike-lane', row: 5, col: 5 }]
    const dBase  = calculateEffects(p, grid)
    const dRainy = calculateEffects(p, grid, 'rainy')
    expect(approx(dRainy.congestionDelta, dBase.congestionDelta * 0.75, 0.01)).toBe(true)
    expect(approx(dRainy.happinessDelta,  dBase.happinessDelta  * 0.60, 0.01)).toBe(true)
  })

  test('snowy: bus-stop congestion ×1.40, happiness ×1.20', () => {
    const grid = fullRoadGrid()
    const p = [{ action: 'bus-stop', row: 5, col: 5 }]
    const dBase  = calculateEffects(p, grid)
    const dSnowy = calculateEffects(p, grid, 'snowy')
    expect(approx(dSnowy.congestionDelta, dBase.congestionDelta * 1.40, 0.01)).toBe(true)
    expect(approx(dSnowy.happinessDelta,  dBase.happinessDelta  * 1.20, 0.01)).toBe(true)
  })

  test('stormy: bike-lane congestion ×0.30, happiness ×0.25', () => {
    const grid = fullRoadGrid()
    const p = [{ action: 'bike-lane', row: 5, col: 5 }]
    const dBase   = calculateEffects(p, grid)
    const dStormy = calculateEffects(p, grid, 'stormy')
    expect(approx(dStormy.congestionDelta, dBase.congestionDelta * 0.30, 0.01)).toBe(true)
    expect(approx(dStormy.happinessDelta,  dBase.happinessDelta  * 0.25, 0.01)).toBe(true)
  })

  test('null weather: same as no-weather call', () => {
    const grid = buildGrid([{ row: 5, col: 5, type: 'empty' }])
    const p = [{ action: 'park', row: 5, col: 5 }]
    const dNone = calculateEffects(p, grid)
    const dNull = calculateEffects(p, grid, null)
    expect(approx(dNone.happinessDelta, dNull.happinessDelta, 0.01)).toBe(true)
  })
})

// ── Carbon effects ─────────────────────────────────────────────────────────

describe('EFFECTS carbon values', () => {
  test('bus-stop has carbon -3',       () => expect(EFFECTS['bus-stop'].carbon).toBe(-3))
  test('bike-lane has carbon -5',      () => expect(EFFECTS['bike-lane'].carbon).toBe(-5))
  test('parking-garage has carbon +4', () => expect(EFFECTS['parking-garage'].carbon).toBe(4))
  test('park has carbon -6',           () => expect(EFFECTS['park'].carbon).toBe(-6))
  test('road-widening has carbon +8',  () => expect(EFFECTS['road-widening'].carbon).toBe(8))
})

describe('calculateEffects returns carbonDelta', () => {
  const roadGrid = () => buildGrid(
    Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i/10), col: i%10, type: 'road' }))
  )

  test('single park: carbonDelta = -6', () => {
    const d = calculateEffects([{ action: 'park', row: 5, col: 5 }], buildGrid())
    expect(approx(d.carbonDelta, -6, 0.001)).toBe(true)
  })

  test('single road-widening: carbonDelta = +8', () => {
    const d = calculateEffects([{ action: 'road-widening', row: 5, col: 5 }], roadGrid())
    expect(approx(d.carbonDelta, 8, 0.001)).toBe(true)
  })

  test('single bus-stop: carbonDelta = -3', () => {
    const d = calculateEffects([{ action: 'bus-stop', row: 5, col: 5 }], roadGrid())
    expect(approx(d.carbonDelta, -3, 0.001)).toBe(true)
  })

  test('carbon diminishing returns: 2× park = -6 + (-6×0.85) = -11.1', () => {
    const d = calculateEffects(
      [{ action: 'park', row: 0, col: 0 }, { action: 'park', row: 5, col: 5 }],
      buildGrid()
    )
    expect(approx(d.carbonDelta, -6 + (-6 * 0.85), 0.01)).toBe(true)
  })

  test('mixed actions: park + road-widening carbon sums correctly', () => {
    const d = calculateEffects(
      [{ action: 'park', row: 0, col: 0 }, { action: 'road-widening', row: 5, col: 5 }],
      buildGrid([{ row: 5, col: 5, type: 'road' }])
    )
    expect(approx(d.carbonDelta, -6 + 8, 0.01)).toBe(true)
  })
})

// ── Section G: new action EFFECTS ─────────────────────────────────────────

describe('EFFECTS: ev-charging', () => {
  test('congestion = -3', () => expect(EFFECTS['ev-charging'].congestion).toBe(-3))
  test('happiness  = +2', () => expect(EFFECTS['ev-charging'].happiness).toBe(2))
  test('carbon     = -8', () => expect(EFFECTS['ev-charging'].carbon).toBe(-8))
})

describe('EFFECTS: self-driving-taxi', () => {
  test('congestion = -8',  () => expect(EFFECTS['self-driving-taxi'].congestion).toBe(-8))
  test('happiness  = +10', () => expect(EFFECTS['self-driving-taxi'].happiness).toBe(10))
  test('carbon     = -4',  () => expect(EFFECTS['self-driving-taxi'].carbon).toBe(-4))
})

describe('EFFECTS: industrial-dev', () => {
  test('congestion = +5',  () => expect(EFFECTS['industrial-dev'].congestion).toBe(5))
  test('happiness  = -10', () => expect(EFFECTS['industrial-dev'].happiness).toBe(-10))
  test('carbon     = +12', () => expect(EFFECTS['industrial-dev'].carbon).toBe(12))
})

describe('calculateEffects: new actions produce correct deltas', () => {
  const roadGrid = () => buildGrid(
    Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i/10), col: i%10, type: 'road' }))
  )

  test('ev-charging: congestion -3, carbon -8 on all-road grid', () => {
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], roadGrid())
    expect(approx(d.congestionDelta, -3,  0.01)).toBe(true)
    expect(approx(d.carbonDelta,     -8,  0.01)).toBe(true)
  })

  test('self-driving-taxi: congestion -8, happiness +10 on all-road grid', () => {
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], roadGrid())
    expect(approx(d.congestionDelta, -8,  0.01)).toBe(true)
    expect(approx(d.happinessDelta,  +10, 0.01)).toBe(true)
    expect(approx(d.carbonDelta,     -4,  0.01)).toBe(true)
  })

  test('industrial-dev: congestion +5, happiness -10, carbon +12 on building grid', () => {
    const d = calculateEffects([{ action: 'industrial-dev', row: 5, col: 5 }], buildGrid())
    expect(approx(d.congestionDelta, +5,  0.01)).toBe(true)
    expect(approx(d.happinessDelta,  -10, 0.01)).toBe(true)
    expect(approx(d.carbonDelta,     +12, 0.01)).toBe(true)
  })
})

// ── Section G: new combo constants ────────────────────────────────────────

describe('COMBOS: Clean Commute (ev-charging + parking-garage)', () => {
  test('combo exists in COMBOS', () =>
    expect(COMBOS.some(c =>
      (c.a === 'ev-charging' && c.b === 'parking-garage') ||
      (c.a === 'parking-garage' && c.b === 'ev-charging')
    )).toBe(true))

  test('congestion bonus = -4', () => {
    const combo = COMBOS.find(c =>
      (c.a === 'ev-charging' && c.b === 'parking-garage') ||
      (c.a === 'parking-garage' && c.b === 'ev-charging')
    )
    expect(combo.congestion).toBe(-4)
  })

  test('carbon bonus = -5', () => {
    const combo = COMBOS.find(c =>
      (c.a === 'ev-charging' && c.b === 'parking-garage') ||
      (c.a === 'parking-garage' && c.b === 'ev-charging')
    )
    expect(combo.carbon).toBe(-5)
  })

  test('adjacent ev-charging + parking-garage applies -4 cong and -5 carbon', () => {
    const grid = buildGrid([
      { row: 5, col: 5, type: 'road'     },
      { row: 5, col: 6, type: 'building' },
    ])
    const dCombo = calculateEffects([
      { action: 'ev-charging',    row: 5, col: 5 },
      { action: 'parking-garage', row: 5, col: 6 },
    ], grid)
    const d1 = calculateEffects([{ action: 'ev-charging',    row: 5, col: 5 }], grid)
    const d2 = calculateEffects([{ action: 'parking-garage', row: 5, col: 6 }], grid)
    expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 4, 0.01)).toBe(true)
    expect(approx(dCombo.carbonDelta,     d1.carbonDelta     + d2.carbonDelta     - 5, 0.01)).toBe(true)
  })
})

describe('COMBOS: Seamless Network (self-driving-taxi + bus-stop)', () => {
  test('combo exists in COMBOS', () =>
    expect(COMBOS.some(c =>
      (c.a === 'self-driving-taxi' && c.b === 'bus-stop') ||
      (c.a === 'bus-stop' && c.b === 'self-driving-taxi')
    )).toBe(true))

  test('congestion bonus = -3', () => {
    const combo = COMBOS.find(c =>
      (c.a === 'self-driving-taxi' && c.b === 'bus-stop') ||
      (c.a === 'bus-stop' && c.b === 'self-driving-taxi')
    )
    expect(combo.congestion).toBe(-3)
  })

  test('happiness bonus = +4', () => {
    const combo = COMBOS.find(c =>
      (c.a === 'self-driving-taxi' && c.b === 'bus-stop') ||
      (c.a === 'bus-stop' && c.b === 'self-driving-taxi')
    )
    expect(combo.happiness).toBe(4)
  })

  test('adjacent taxi + bus-stop applies -3 cong and +4 hap bonus', () => {
    const grid = buildGrid(
      Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i/10), col: i%10, type: 'road' }))
    )
    const dCombo = calculateEffects([
      { action: 'self-driving-taxi', row: 5, col: 5 },
      { action: 'bus-stop',          row: 5, col: 6 },
    ], grid)
    const d1 = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], grid)
    const d2 = calculateEffects([{ action: 'bus-stop',          row: 5, col: 6 }], grid)
    expect(approx(dCombo.congestionDelta, d1.congestionDelta + d2.congestionDelta - 3, 0.01)).toBe(true)
    expect(approx(dCombo.happinessDelta,  d1.happinessDelta  + d2.happinessDelta  + 4, 0.01)).toBe(true)
  })
})

// ── Weather multipliers: EV Charging ──────────────────────────────────────

describe('weather × ev-charging', () => {
  const roadGrid = () => buildGrid(
    Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i/10), col: i%10, type: 'road' }))
  )
  const base = (g = roadGrid()) => calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g)

  test('sunny: congestion ×1.15, happiness ×1.10', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g, 'sunny')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 1.15, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 1.10, 0.01)).toBe(true)
  })

  test('rainy: congestion ×0.85, happiness ×0.85', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g, 'rainy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.85, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.85, 0.01)).toBe(true)
  })

  test('overcast: no modifier (EV unaffected by overcast)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g, 'overcast')
    expect(approx(d.congestionDelta, base(g).congestionDelta, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta,  0.01)).toBe(true)
  })

  test('snowy: congestion ×0.40 (cold kills battery range)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g, 'snowy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.40, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.45, 0.01)).toBe(true)
  })

  test('stormy: congestion ×0.25 (near-useless in extreme conditions)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'ev-charging', row: 5, col: 5 }], g, 'stormy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.25, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.30, 0.01)).toBe(true)
  })
})

// ── Weather multipliers: Self-Driving Taxi ─────────────────────────────────

describe('weather × self-driving-taxi', () => {
  const roadGrid = () => buildGrid(
    Array.from({ length: 100 }, (_, i) => ({ row: Math.floor(i/10), col: i%10, type: 'road' }))
  )
  const base = (g = roadGrid()) => calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g)

  test('sunny: congestion ×1.10, happiness ×1.05 (optimal sensor conditions)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g, 'sunny')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 1.10, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 1.05, 0.01)).toBe(true)
  })

  test('rainy: congestion ×0.80, happiness ×0.85 (lidar/camera impaired)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g, 'rainy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.80, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.85, 0.01)).toBe(true)
  })

  test('overcast: congestion ×0.90, happiness ×0.90 (reduced camera accuracy)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g, 'overcast')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.90, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.90, 0.01)).toBe(true)
  })

  test('snowy: congestion ×0.45 (lane markings hidden, sensors impaired)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g, 'snowy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.45, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.50, 0.01)).toBe(true)
  })

  test('stormy: congestion ×0.25 (dangerous conditions, near-unusable)', () => {
    const g = roadGrid()
    const d = calculateEffects([{ action: 'self-driving-taxi', row: 5, col: 5 }], g, 'stormy')
    expect(approx(d.congestionDelta, base(g).congestionDelta * 0.25, 0.01)).toBe(true)
    expect(approx(d.happinessDelta,  base(g).happinessDelta  * 0.30, 0.01)).toBe(true)
  })
})

// ── Weather: industrial-dev unaffected ────────────────────────────────────

describe('weather × industrial-dev', () => {
  test('snowy: no weather modifier — construction happens regardless', () => {
    const g = buildGrid()
    const base  = calculateEffects([{ action: 'industrial-dev', row: 5, col: 5 }], g)
    const snowy = calculateEffects([{ action: 'industrial-dev', row: 5, col: 5 }], g, 'snowy')
    expect(approx(snowy.congestionDelta, base.congestionDelta, 0.01)).toBe(true)
    expect(approx(snowy.happinessDelta,  base.happinessDelta,  0.01)).toBe(true)
  })
})

describe('checkWinCondition: carbon lose threshold', () => {
  test('carbon = 100 → lose', () =>
    expect(checkWinCondition({ happiness: 50, congestion: 50, carbon: 100, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('lose'))

  test('carbon = 99 → playing', () =>
    expect(checkWinCondition({ happiness: 50, congestion: 50, carbon: 99, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('playing'))

  test('carbon omitted (undefined) → no lose triggered', () =>
    expect(checkWinCondition({ happiness: 50, congestion: 50, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('playing'))

  test('win takes priority over high carbon', () =>
    expect(checkWinCondition({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, carbon: 100, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('win'))

  test('LOSE_THRESHOLDS.carbon is 100', () => expect(LOSE_THRESHOLDS.carbon).toBe(100))
})

// ── getCongestSurcharge (Section L) ───────────────────────────────────────────

describe('getCongestSurcharge', () => {
  test('congestion < 70 → no surcharge (1.0)', () => {
    expect(getCongestSurcharge(69)).toBe(1.00)
    expect(getCongestSurcharge(55)).toBe(1.00)
    expect(getCongestSurcharge(0)).toBe(1.00)
  })

  test('congestion 70 → +10% surcharge (1.1)', () => {
    expect(getCongestSurcharge(70)).toBe(1.10)
    expect(getCongestSurcharge(84)).toBe(1.10)
  })

  test('congestion 85 → +20% surcharge (1.2)', () => {
    expect(getCongestSurcharge(85)).toBe(1.20)
    expect(getCongestSurcharge(100)).toBe(1.20)
  })

  test('CONGESTION_SURCHARGE_ACTIONS covers all 5 road actions', () => {
    expect(CONGESTION_SURCHARGE_ACTIONS.has('bus-stop')).toBe(true)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('bike-lane')).toBe(true)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('road-widening')).toBe(true)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('ev-charging')).toBe(true)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('self-driving-taxi')).toBe(true)
  })

  test('CONGESTION_SURCHARGE_ACTIONS does not cover building/park actions', () => {
    expect(CONGESTION_SURCHARGE_ACTIONS.has('parking-garage')).toBe(false)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('park')).toBe(false)
    expect(CONGESTION_SURCHARGE_ACTIONS.has('industrial-dev')).toBe(false)
  })
})

// ── calculateRoadWideningBonus (Section H) ────────────────────────────────────

describe('calculateRoadWideningBonus', () => {
  test('ROAD_WIDENING_BUILDING_BONUS constant is 25', () => {
    expect(ROAD_WIDENING_BUILDING_BONUS).toBe(25)
  })

  test('0 adjacent buildings → bonus is 0', () => {
    const grid = buildGrid([
      { row: 5, col: 5, type: 'road' },
      { row: 4, col: 5, type: 'road' },
      { row: 6, col: 5, type: 'road' },
      { row: 5, col: 4, type: 'road' },
      { row: 5, col: 6, type: 'road' },
    ])
    expect(calculateRoadWideningBonus({ row: 5, col: 5 }, grid)).toBe(0)
  })

  test('1 adjacent building → bonus is £25', () => {
    const grid = buildGrid([{ row: 5, col: 5, type: 'road' }])
    // row 4, 6, col 4, 6 are all buildings (default), but we only test 1 building neighbour
    const smallGrid = [
      { row: 5, col: 5, type: 'road' },
      { row: 4, col: 5, type: 'building' },
      { row: 6, col: 5, type: 'road' },
      { row: 5, col: 4, type: 'road' },
      { row: 5, col: 6, type: 'road' },
    ]
    expect(calculateRoadWideningBonus({ row: 5, col: 5 }, smallGrid)).toBe(25)
  })

  test('3 adjacent buildings → bonus is £75', () => {
    const smallGrid = [
      { row: 5, col: 5, type: 'road' },
      { row: 4, col: 5, type: 'building' },
      { row: 6, col: 5, type: 'building' },
      { row: 5, col: 4, type: 'building' },
      { row: 5, col: 6, type: 'road' },
    ]
    expect(calculateRoadWideningBonus({ row: 5, col: 5 }, smallGrid)).toBe(75)
  })

  test('commercial and arena tiles also count as buildings', () => {
    const smallGrid = [
      { row: 5, col: 5, type: 'road' },
      { row: 4, col: 5, type: 'commercial' },
      { row: 6, col: 5, type: 'arena' },
      { row: 5, col: 4, type: 'road' },
      { row: 5, col: 6, type: 'road' },
    ]
    expect(calculateRoadWideningBonus({ row: 5, col: 5 }, smallGrid)).toBe(50)
  })

  test('null cgTile → returns 0', () => {
    expect(calculateRoadWideningBonus(null, [])).toBe(0)
  })

  test('null grid → returns 0', () => {
    expect(calculateRoadWideningBonus({ row: 5, col: 5 }, null)).toBe(0)
  })
})
