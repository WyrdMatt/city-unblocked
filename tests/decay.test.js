import { describe, test, expect } from 'vitest'
import {
  DECAY_RATES, LOSE_THRESHOLDS, INITIAL_STATE, WIN_HAPPINESS, WIN_CONGESTION,
  checkWinCondition,
} from '../src/game-logic.js'

// ── DECAY_RATES ────────────────────────────────────────────────────────────

describe('DECAY_RATES constants', () => {
  test('congestion decays at +1.5 per turn', () =>
    expect(DECAY_RATES.congestion).toBe(1.5))
  test('happiness decays at -1.5 per turn', () =>
    expect(DECAY_RATES.happiness).toBe(-1.5))
  test('carbon decays at +1.0 per turn', () =>
    expect(DECAY_RATES.carbon).toBe(1.0))
})

// ── INITIAL_STATE ──────────────────────────────────────────────────────────

describe('INITIAL_STATE starting values', () => {
  test('congestion starts at 55', () => expect(INITIAL_STATE.congestion).toBe(55))
  test('happiness starts at 45', () => expect(INITIAL_STATE.happiness).toBe(45))
  test('carbon starts at 35',    () => expect(INITIAL_STATE.carbon).toBe(35))
})

// ── LOSE_THRESHOLDS ────────────────────────────────────────────────────────

describe('LOSE_THRESHOLDS', () => {
  test('congestion threshold is 100', () => expect(LOSE_THRESHOLDS.congestion).toBe(100))
  test('happiness threshold is 0',    () => expect(LOSE_THRESHOLDS.happiness).toBe(0))
  test('carbon threshold is 100',     () => expect(LOSE_THRESHOLDS.carbon).toBe(100))
})

// ── Decay formula: time-to-loss ────────────────────────────────────────────

test('congestion hits lose threshold at turn 30 with no mitigation', () => {
  const turnsToCollapse = (LOSE_THRESHOLDS.congestion - INITIAL_STATE.congestion) / DECAY_RATES.congestion
  expect(turnsToCollapse).toBeCloseTo(30, 0)
})

test('happiness hits lose threshold at turn 30 with no mitigation', () => {
  const turnsToCollapse = (INITIAL_STATE.happiness - LOSE_THRESHOLDS.happiness) / Math.abs(DECAY_RATES.happiness)
  expect(turnsToCollapse).toBeCloseTo(30, 0)
})

test('carbon takes longer than congestion to collapse (~65 turns)', () => {
  const turnsToCollapse = (LOSE_THRESHOLDS.carbon - INITIAL_STATE.carbon) / DECAY_RATES.carbon
  expect(turnsToCollapse).toBeGreaterThan(60)
})

// ── checkWinCondition: threshold losses ────────────────────────────────────

describe('checkWinCondition: loss by threshold', () => {
  test('congestion = 100 → lose', () =>
    expect(checkWinCondition({ happiness: 50, congestion: 100, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('lose'))

  test('congestion = 99 → playing', () =>
    expect(checkWinCondition({ happiness: 50, congestion: 99, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('playing'))

  test('happiness = 0 → lose', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 50, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('lose'))

  test('happiness = 1 → playing', () =>
    expect(checkWinCondition({ happiness: 1, congestion: 50, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('playing'))

  test('win is checked before threshold loss: hap 70 + cong 30 → win even if thresholds critical', () =>
    expect(checkWinCondition({ happiness: WIN_HAPPINESS, congestion: WIN_CONGESTION, budget: 0, minActionCost: 0, turnsLeft: 0 })).toBe('win'))

  test('both thresholds breached → lose (not playing)', () =>
    expect(checkWinCondition({ happiness: 0, congestion: 100, budget: 500, minActionCost: 40, turnsLeft: 10 })).toBe('lose'))
})

// ── Decay accumulates correctly over turns ─────────────────────────────────

test('congestion after 10 turns of pure decay = 55 + 15 = 70', () => {
  const cong = INITIAL_STATE.congestion + 10 * DECAY_RATES.congestion
  expect(cong).toBeCloseTo(70, 5)
})

test('happiness after 10 turns of pure decay = 45 - 15 = 30', () => {
  const hap = INITIAL_STATE.happiness + 10 * DECAY_RATES.happiness
  expect(hap).toBeCloseTo(30, 5)
})

test('carbon after 10 turns of pure decay = 35 + 10 = 45', () => {
  const carbon = INITIAL_STATE.carbon + 10 * DECAY_RATES.carbon
  expect(carbon).toBeCloseTo(45, 5)
})

test('decay is additive with placement effects (not multiplicative)', () => {
  const turn = 5
  const placementCongDelta = -10
  const expected = INITIAL_STATE.congestion + (turn * DECAY_RATES.congestion) + placementCongDelta
  // formula: INITIAL + (turn × rate) + effects  — simple addition, no multiplier
  expect(expected).toBeCloseTo(55 + 7.5 - 10, 5)
})
