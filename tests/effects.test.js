import { describe, test, expect } from 'vitest'
import {
  EFFECTS, COMBOS, WEATHER_TYPES, WEATHER_META, WEATHER_MULTIPLIERS,
  WIN_HAPPINESS, WIN_CONGESTION, DEFAULT_TURN_LIMIT, INITIAL_STATE,
  getGridNeighbours, hotspotScore, calculateEffects, checkWinCondition,
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
    expect(INITIAL_STATE.congestion).toBe(80)
    expect(INITIAL_STATE.happiness).toBe(20)
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
  test('at least 5 combo definitions', () =>
    expect(COMBOS.length).toBeGreaterThanOrEqual(5))
  test('Transit Hub defined', () =>
    expect(COMBOS.some(c => c.a === 'bus-stop' && c.b === 'park' && c.happiness === 5)).toBe(true))
  test('Green Network defined', () =>
    expect(COMBOS.some(c => c.a === 'park' && c.b === 'park')).toBe(true))
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
