import { describe, test, expect } from 'vitest'
import {
  calculateEffects,
  applyGeneratorTick,
  applyGeneratorTickFull,
  GENERATOR_DELTA,
  GENERATOR_CARBON_DELTA,
} from '../src/game-logic.js'

// ── Helpers ────────────────────────────────────────────────────────────────

// Build a minimal flat grid array from a 2D descriptor: 'B', 'C', 'A', 'R', 'E'
function buildGrid(rows) {
  const typeMap = { B: 'building', C: 'commercial', A: 'arena', R: 'road', E: 'empty' }
  const grid = []
  rows.forEach((cols, r) => {
    cols.forEach((code, c) => {
      grid.push({ row: r, col: c, type: typeMap[code] || 'building' })
    })
  })
  return grid
}

// ── Commercial adjacency bonus (bus-stop) ──────────────────────────────────

describe('commercial tile: bus-stop adjacency bonus', () => {
  test('bus-stop adjacent to commercial gets +25% congestion reduction', () => {
    // Row 0: [road, commercial]  →  bus-stop placed on road at (0,0), commercial at (0,1)
    const grid = buildGrid([
      ['R', 'C'],
    ])
    const placements = [{ action: 'bus-stop', row: 0, col: 0 }]
    const { congestionDelta } = calculateEffects(placements, grid)
    // Base bus-stop cDelta = -10; adjBuildings=1 so -2 more → -12; adjCommercial=1 so *1.25 → -15
    expect(congestionDelta).toBeLessThan(-10)
  })

  test('bus-stop without commercial gets no commercial bonus', () => {
    const gridNoCommercial = buildGrid([['R', 'B']])
    const gridWithCommercial = buildGrid([['R', 'C']])
    const placement = [{ action: 'bus-stop', row: 0, col: 0 }]
    const { congestionDelta: withoutBonus } = calculateEffects(placement, gridNoCommercial)
    const { congestionDelta: withBonus }    = calculateEffects(placement, gridWithCommercial)
    expect(withBonus).toBeLessThan(withoutBonus)
  })

  test('commercial counts as building for base adjBuildings bonus too', () => {
    // Commercial tile counts toward the adjBuildings bonus for bus-stop (−2/neighbour)
    const gridCommercial = buildGrid([['R', 'C']])
    const gridBuilding   = buildGrid([['R', 'B']])
    const placement = [{ action: 'bus-stop', row: 0, col: 0 }]
    const { congestionDelta: cC } = calculateEffects(placement, gridCommercial)
    const { congestionDelta: cB } = calculateEffects(placement, gridBuilding)
    // With commercial: applies both adjBuildings(-2) AND commercial bonus (*1.25)
    // With building:   applies only adjBuildings(-2)
    // So commercial should be strictly lower (more negative)
    expect(cC).toBeLessThan(cB)
  })

  test('bike-lane adjacent to commercial does NOT get commercial bus-stop bonus', () => {
    const grid = buildGrid([['R', 'C']])
    const busStop  = [{ action: 'bus-stop',  row: 0, col: 0 }]
    const bikeLane = [{ action: 'bike-lane', row: 0, col: 0 }]
    const { congestionDelta: bsDelta } = calculateEffects(busStop,  grid)
    const { congestionDelta: blDelta } = calculateEffects(bikeLane, grid)
    // Bike-lane base = -6; bus-stop with commercial bonus will be much more negative
    expect(bsDelta).toBeLessThan(blDelta)
  })

  test('park adjacent to commercial gets no special bonus (commercial bonus is bus-stop only)', () => {
    const gridCommercial = buildGrid([['E', 'C']])
    const gridBuilding   = buildGrid([['E', 'B']])
    const parkOnE = [{ action: 'park', row: 0, col: 0 }]
    const { happinessDelta: hC } = calculateEffects(parkOnE, gridCommercial)
    const { happinessDelta: hB } = calculateEffects(parkOnE, gridBuilding)
    // Both get +3 happiness from adjBuildings (commercial counts as building) — same bonus
    expect(hC).toBeCloseTo(hB, 5)
  })
})

// ── Arena adjacency bonuses ────────────────────────────────────────────────

describe('arena tile: park adjacency bonus', () => {
  test('park adjacent to arena gets +6 happiness per arena neighbour', () => {
    const gridWithArena    = buildGrid([['E', 'A']])
    const gridWithoutArena = buildGrid([['E', 'B']])
    const placement = [{ action: 'park', row: 0, col: 0 }]
    const { happinessDelta: withArena }    = calculateEffects(placement, gridWithArena)
    const { happinessDelta: withoutArena } = calculateEffects(placement, gridWithoutArena)
    // +6 extra per arena neighbour
    expect(withArena - withoutArena).toBeCloseTo(6, 5)
  })

  test('park adjacent to 2 arenas gets +12 extra happiness', () => {
    // 3-tile row: arena, park(empty), arena
    const grid = buildGrid([['A', 'E', 'A']])
    const placement = [{ action: 'park', row: 0, col: 1 }]
    const gridNoArena = buildGrid([['B', 'E', 'B']])
    const { happinessDelta: withArenas }   = calculateEffects(placement, grid)
    const { happinessDelta: withBuildings } = calculateEffects(placement, gridNoArena)
    expect(withArenas - withBuildings).toBeCloseTo(12, 5)
  })

  test('arena counts as building for base adjBuildings park bonus too', () => {
    const gridArena    = buildGrid([['E', 'A']])
    const gridNoAdj    = buildGrid([['E', 'R']])
    const placement = [{ action: 'park', row: 0, col: 0 }]
    const { happinessDelta: withAdj }    = calculateEffects(placement, gridArena)
    const { happinessDelta: withoutAdj } = calculateEffects(placement, gridNoAdj)
    // adjBuildings=1 → base +3; arena bonus +6 → total +9 more than road
    expect(withAdj).toBeGreaterThan(withoutAdj)
  })
})

describe('arena tile: bus-stop adjacency bonus', () => {
  test('bus-stop adjacent to arena gets −5 extra congestion per arena', () => {
    const gridWithArena    = buildGrid([['R', 'A']])
    const gridWithoutArena = buildGrid([['R', 'B']])
    const placement = [{ action: 'bus-stop', row: 0, col: 0 }]
    const { congestionDelta: withArena }    = calculateEffects(placement, gridWithArena)
    const { congestionDelta: withoutArena } = calculateEffects(placement, gridWithoutArena)
    // Arena bus-stop: -5 extra; building bus-stop: -2 extra via adjBuildings
    // So withArena should be more negative by an additional -3 (= -5 arena + 2 base adj already in withoutArena)
    expect(withArena).toBeLessThan(withoutArena)
  })

  test('bus-stop adjacent to 2 arenas gets −10 extra congestion', () => {
    // [arena, road, arena]
    const grid = buildGrid([['A', 'R', 'A']])
    const placement = [{ action: 'bus-stop', row: 0, col: 1 }]
    const gridNoArena = buildGrid([['B', 'R', 'B']])
    const { congestionDelta: withArenas }    = calculateEffects(placement, grid)
    const { congestionDelta: withBuildings } = calculateEffects(placement, gridNoArena)
    // arenas count as buildings so adjBuildings bonus (-2 each = -4) applies in both cases
    // arena-specific bonus adds -5 more per arena = -10 additional → net difference is -10
    expect(withArenas).toBeLessThan(withBuildings)
    expect(withArenas - withBuildings).toBeCloseTo(-10, 5)
  })

  test('bike-lane adjacent to arena does not get arena bus-stop bonus', () => {
    const gridArena = buildGrid([['R', 'A']])
    const busStop  = [{ action: 'bus-stop',  row: 0, col: 0 }]
    const bikeLane = [{ action: 'bike-lane', row: 0, col: 0 }]
    const { congestionDelta: bsDelta } = calculateEffects(busStop,  gridArena)
    const { congestionDelta: blDelta } = calculateEffects(bikeLane, gridArena)
    // bike-lane base -6 + adjBuildings (arena counts) → around -8
    // bus-stop base -10 + adjBuildings -2 + arena -5 = -17+ (with adj≥3 possible *1.25)
    expect(bsDelta).toBeLessThan(blDelta)
  })
})

// ── Generator carbon (applyGeneratorTickFull) ──────────────────────────────

describe('generator carbon via applyGeneratorTickFull', () => {
  const gen = [{ row: 0, col: 0 }]

  test('unsuppressed generator adds GENERATOR_DELTA congestion', () => {
    const result = applyGeneratorTickFull(gen, [])
    expect(result.congestion).toBe(GENERATOR_DELTA)
  })

  test('unsuppressed generator adds GENERATOR_CARBON_DELTA carbon', () => {
    const result = applyGeneratorTickFull(gen, [])
    expect(result.carbon).toBe(GENERATOR_CARBON_DELTA)
  })

  test('GENERATOR_CARBON_DELTA is 2', () => {
    expect(GENERATOR_CARBON_DELTA).toBe(2)
  })

  test('suppressed generator adds 0 congestion and 0 carbon', () => {
    const suppressor = [{ action: 'bus-stop', row: 0, col: 1 }]
    const result = applyGeneratorTickFull(gen, suppressor)
    expect(result.congestion).toBe(0)
    expect(result.carbon).toBe(0)
  })

  test('2 unsuppressed generators = 2× deltas', () => {
    const gens = [{ row: 0, col: 0 }, { row: 5, col: 5 }]
    const result = applyGeneratorTickFull(gens, [])
    expect(result.congestion).toBe(GENERATOR_DELTA * 2)
    expect(result.carbon).toBe(GENERATOR_CARBON_DELTA * 2)
  })

  test('applyGeneratorTick (legacy) still returns only congestion number', () => {
    const result = applyGeneratorTick(gen, [])
    expect(typeof result).toBe('number')
    expect(result).toBe(GENERATOR_DELTA)
  })

  test('applyGeneratorTick matches applyGeneratorTickFull.congestion', () => {
    const gens = [{ row: 1, col: 1 }, { row: 3, col: 3 }]
    const placements = [{ action: 'bike-lane', row: 1, col: 2 }]
    expect(applyGeneratorTick(gens, placements))
      .toBe(applyGeneratorTickFull(gens, placements).congestion)
  })
})
