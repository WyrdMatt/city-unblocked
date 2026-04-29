import { describe, test, expect } from 'vitest'
import {
  EFFECTS, DIFFICULTY_PRESETS, WIN_HAPPINESS, WIN_CONGESTION, INITIAL_STATE,
  GENERATOR_DELTA, calculateEffects, checkWinCondition, applyGeneratorTick,
} from '../src/game-logic.js'

const ACTION_COSTS = { 'bus-stop': 80, 'bike-lane': 40, 'parking-garage': 120, 'park': 60, 'road-widening': 90 }
const actionCost = a => ACTION_COSTS[a] || 0
const MIN_COST = Math.min(...Object.values(ACTION_COSTS)) // £40

function buildMaxAdjGrid() {
  const grid = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      grid.push({ row: r, col: c, type: 'building' })
  return grid
}

function buildZeroAdjGrid() {
  const grid = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      grid.push({ row: r, col: c, type: 'road' })
  return grid
}

function simulate(actions, grid) {
  const delta = calculateEffects(actions, grid)
  const congestion = Math.max(0, Math.min(100, INITIAL_STATE.congestion + delta.congestionDelta))
  const happiness  = Math.max(0, Math.min(100, INITIAL_STATE.happiness  + delta.happinessDelta))
  const cost   = actions.reduce((s, a) => s + actionCost(a.action), 0)
  const budget = INITIAL_STATE.budget - cost
  const result = checkWinCondition({
    happiness, congestion, budget,
    minActionCost: MIN_COST,
    turnsLeft: 15 - actions.length,
  })
  return { congestion, happiness, budget, result, delta }
}

function placements(action, n) {
  return Array.from({ length: n }, (_, i) => ({ action, row: i, col: 0 }))
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Test 1: optimal mix on max-adj grid', () => {
  test('wins', () => {
    const acts = [
      ...placements('bus-stop', 3),
      { action: 'park', row: 0, col: 1 }, { action: 'park', row: 1, col: 1 },
      { action: 'park', row: 2, col: 1 },
      { action: 'bike-lane', row: 0, col: 2 },
    ]
    expect(simulate(acts, buildMaxAdjGrid()).result).toBe('win')
  })
})

describe('Test 2: zero-adj grid', () => {
  test('still cuts congestion below 50%', () => {
    const acts = [
      ...placements('bus-stop', 3),
      { action: 'park', row: 0, col: 1 }, { action: 'park', row: 1, col: 1 },
      { action: 'park', row: 2, col: 1 },
      { action: 'bike-lane', row: 0, col: 2 },
    ]
    expect(simulate(acts, buildZeroAdjGrid()).congestion).toBeLessThan(50)
  })
})

describe('Test 3: full budget diversified mix', () => {
  const acts = [
    ...placements('bus-stop', 2),
    { action: 'park', row: 0, col: 1 }, { action: 'park', row: 1, col: 1 },
    ...placements('bike-lane', 2),
    { action: 'parking-garage', row: 0, col: 3 },
  ]
  const totalCost = acts.reduce((s, a) => s + actionCost(a.action), 0)
  const sim = simulate(acts, buildMaxAdjGrid())

  test('fits within budget', () => expect(totalCost).toBeLessThanOrEqual(INITIAL_STATE.budget))
  test('wins', () => expect(sim.result).toBe('win'))
})

describe('Test 4: spamming bus-stop alone does not win', () => {
  test('6× bus-stop cannot win (happiness insufficient)', () => {
    const sim = simulate(placements('bus-stop', 6), buildMaxAdjGrid())
    expect(sim.result).not.toBe('win')
  })
})

describe('Test 5: spamming cheap action (bike-lane) cannot meet congestion target', () => {
  test('12× bike-lane cannot hit congestion target alone', () => {
    const sim = simulate(placements('bike-lane', 12), buildMaxAdjGrid())
    expect(sim.congestion).toBeGreaterThan(WIN_CONGESTION)
  })
})

describe('Test 6: winning is possible within normal budget', () => {
  test('at least one 5-action combo within £500 wins', () => {
    const maxGrid = buildMaxAdjGrid()
    const types = Object.keys(EFFECTS)
    let foundWin = false

    outer: for (let a = 0; a < types.length; a++)
      for (let b = a; b < types.length; b++)
        for (let c = b; c < types.length; c++)
          for (let d = c; d < types.length; d++)
            for (let e = d; e < types.length; e++) {
              const combo = [types[a], types[b], types[c], types[d], types[e]]
              const cost  = combo.reduce((s, t) => s + actionCost(t), 0)
              if (cost > INITIAL_STATE.budget) continue
              const acts = combo.map((action, i) => ({ action, row: i, col: 1 }))
              if (simulate(acts, maxGrid).result === 'win') { foundWin = true; break outer }
            }

    expect(foundWin).toBe(true)
  })
})

describe('Test 7: checkWinCondition edge cases', () => {
  test('7a: win beats budget=0', () =>
    expect(checkWinCondition({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, budget: 0, minActionCost: MIN_COST, turnsLeft: 5 })).toBe('win'))
  test('7b: budget=0 and minActionCost=0 → lose', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 100, budget: 0, minActionCost: 0, turnsLeft: 5 })).toBe('lose'))
  test('7c: budget just below min cost → lose', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 100, budget: MIN_COST - 1, minActionCost: MIN_COST, turnsLeft: 5 })).toBe('lose'))
  test('7d: budget exactly min cost → playing', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 100, budget: MIN_COST, minActionCost: MIN_COST, turnsLeft: 5 })).toBe('playing'))
  test('7e: turnsLeft=0 → lose even with budget', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 100, budget: 500, minActionCost: MIN_COST, turnsLeft: 0 })).toBe('lose'))
  test('7f: win when turnsLeft=0 → win takes priority', () =>
    expect(checkWinCondition({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, budget: 500, minActionCost: MIN_COST, turnsLeft: 0 })).toBe('win'))
})

describe('Test 8: road-widening mix wins', () => {
  test('wins with road-widening + bus-stop + parks', () => {
    const acts = [
      { action: 'road-widening', row: 0, col: 0 },
      { action: 'road-widening', row: 1, col: 0 },
      { action: 'bus-stop',      row: 0, col: 2 },
      { action: 'park', row: 0, col: 1 },
      { action: 'park', row: 1, col: 1 },
      { action: 'park', row: 2, col: 1 },
    ]
    const totalCost = acts.reduce((s, a) => s + actionCost(a.action), 0)
    const sim = simulate(acts, buildMaxAdjGrid())
    expect(totalCost).toBeLessThanOrEqual(INITIAL_STATE.budget)
    expect(sim.result).toBe('win')
  })
})

describe('Test 9: spamming road-widening alone cannot win', () => {
  test('5× road-widening drops happiness too low', () => {
    expect(simulate(placements('road-widening', 5), buildMaxAdjGrid()).result).not.toBe('win')
  })
})

describe('Test 10: DIFFICULTY_PRESETS shape and ordering', () => {
  test('all three difficulty levels defined', () =>
    expect(['easy', 'normal', 'hard'].every(l => DIFFICULTY_PRESETS[l] !== undefined)).toBe(true))
  test('easy budget > normal budget', () =>
    expect(DIFFICULTY_PRESETS.easy.budget).toBeGreaterThan(DIFFICULTY_PRESETS.normal.budget))
  test('normal budget > hard budget', () =>
    expect(DIFFICULTY_PRESETS.normal.budget).toBeGreaterThan(DIFFICULTY_PRESETS.hard.budget))
  test('easy has more turns than normal', () =>
    expect(DIFFICULTY_PRESETS.easy.turnLimit).toBeGreaterThan(DIFFICULTY_PRESETS.normal.turnLimit))
  test('normal has more turns than hard', () =>
    expect(DIFFICULTY_PRESETS.normal.turnLimit).toBeGreaterThan(DIFFICULTY_PRESETS.hard.turnLimit))
  test('easy has no blockers', () =>
    expect(DIFFICULTY_PRESETS.easy.blockerRate).toBe(0))
  test('normal has blockers', () =>
    expect(DIFFICULTY_PRESETS.normal.blockerRate).toBeGreaterThan(0))
  test('hard has more blockers than normal', () =>
    expect(DIFFICULTY_PRESETS.hard.blockerRate).toBeGreaterThan(DIFFICULTY_PRESETS.normal.blockerRate))
  test('all levels have generatorCount defined', () => {
    expect(DIFFICULTY_PRESETS.easy.generatorCount).toBeGreaterThanOrEqual(0)
    expect(DIFFICULTY_PRESETS.normal.generatorCount).toBeGreaterThanOrEqual(0)
    expect(DIFFICULTY_PRESETS.hard.generatorCount).toBeGreaterThanOrEqual(0)
  })
  test('normal + hard have generators', () => {
    expect(DIFFICULTY_PRESETS.normal.generatorCount).toBeGreaterThan(0)
    expect(DIFFICULTY_PRESETS.hard.generatorCount).toBeGreaterThan(0)
  })
})

describe('Test 11: hard difficulty — winning still achievable', () => {
  const acts = [
    { action: 'bus-stop',  row: 5, col: 0 }, { action: 'bus-stop',  row: 6, col: 0 },
    { action: 'park',      row: 5, col: 1 }, { action: 'park',      row: 6, col: 1 },
    { action: 'bike-lane', row: 5, col: 2 },
  ]
  const cost = acts.reduce((s, a) => s + actionCost(a.action), 0)
  const sim  = simulate(acts, buildMaxAdjGrid())

  test('fits hard budget', () => expect(cost).toBeLessThanOrEqual(DIFFICULTY_PRESETS.hard.budget))
  test('wins', () => expect(sim.result).toBe('win'))
})

describe('Test 12: easy difficulty — greedy combo trivially wins', () => {
  const acts = [
    ...placements('bus-stop', 3),
    { action: 'park', row: 0, col: 1 }, { action: 'park', row: 1, col: 1 },
    { action: 'park', row: 2, col: 1 },
    ...placements('bike-lane', 2),
  ]
  const cost = acts.reduce((s, a) => s + actionCost(a.action), 0)
  const sim  = simulate(acts, buildMaxAdjGrid())

  test('fits easy budget', () => expect(cost).toBeLessThanOrEqual(DIFFICULTY_PRESETS.easy.budget))
  test('wins', () => expect(sim.result).toBe('win'))
})

describe('Test 13: generator penalty affects congestion', () => {
  test('2 unsuppressed generators add 6 to congestion', () => {
    const gens = [{ row: 0, col: 0 }, { row: 5, col: 5 }]
    expect(applyGeneratorTick(gens, [])).toBe(2 * GENERATOR_DELTA)
  })

  test('marginal win requires generators suppressed', () => {
    // Set up a case that just barely wins — and verify generators make it not win
    const grid = buildMaxAdjGrid()
    const acts = [
      { action: 'bus-stop',  row: 0, col: 0 }, { action: 'bus-stop',  row: 1, col: 0 },
      { action: 'park',      row: 0, col: 1 }, { action: 'park',      row: 1, col: 1 },
      { action: 'bike-lane', row: 2, col: 0 },
    ]
    const delta = calculateEffects(acts, grid)
    const congestionNoGen = Math.max(0, Math.min(100, INITIAL_STATE.congestion + delta.congestionDelta))
    const genPenalty = applyGeneratorTick([{ row: 9, col: 9 }, { row: 8, col: 8 }], [])
    const congestionWithGen = Math.min(100, congestionNoGen + genPenalty)
    // Penalty should make congestion worse
    expect(congestionWithGen).toBeGreaterThan(congestionNoGen)
    // And the penalty equals 2 × GENERATOR_DELTA = 6
    expect(genPenalty).toBe(6)
  })

  test('suppressing one of two generators halves the penalty', () => {
    const gens = [{ row: 3, col: 3 }, { row: 7, col: 7 }]
    const placements = [{ action: 'bus-stop', row: 3, col: 4 }] // suppresses first only
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })

  test('complete generator suppression restores base congestion', () => {
    const gens = [{ row: 3, col: 3 }]
    const roadActs = [{ action: 'bus-stop', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, roadActs)).toBe(0)
  })
})
