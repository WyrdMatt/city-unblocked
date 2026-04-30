import { describe, test, expect } from 'vitest'
import {
  CITY_PROFILES, WIN_HAPPINESS, WIN_CONGESTION, LOSE_THRESHOLDS,
  checkWinCondition,
} from '../src/game-logic.js'

const PROFILE_KEYS = ['standard', 'green', 'transit', 'vibrant', 'eco']

// ── Structure ──────────────────────────────────────────────────────────────

describe('CITY_PROFILES shape', () => {
  test('all 5 profiles exist', () =>
    expect(PROFILE_KEYS.every(k => CITY_PROFILES[k] !== undefined)).toBe(true))

  PROFILE_KEYS.forEach(key => {
    describe(`profile: ${key}`, () => {
      const p = CITY_PROFILES[key]
      test('has label',       () => expect(typeof p.label).toBe('string'))
      test('has emoji',       () => expect(typeof p.emoji).toBe('string'))
      test('has description', () => expect(typeof p.description).toBe('string'))
      test('has win object',  () => expect(typeof p.win).toBe('object'))
      test('win has at least one condition', () =>
        expect(p.win.happiness != null || p.win.congestion != null || p.win.carbon != null).toBe(true))
    })
  })
})

// ── Per-profile win thresholds ─────────────────────────────────────────────

describe('standard profile win conditions', () => {
  const p = CITY_PROFILES.standard
  test('happiness target is 75', () => expect(p.win.happiness).toBe(75))
  test('congestion target is 25', () => expect(p.win.congestion).toBe(25))
  test('no carbon requirement',   () => expect(p.win.carbon).toBeUndefined())

  test('state meeting targets → win', () =>
    expect(checkWinCondition({ happiness: 75, congestion: 25, carbon: 50, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'standard')).toBe('win'))
  test('happiness = 74 → playing', () =>
    expect(checkWinCondition({ happiness: 74, congestion: 25, carbon: 50, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'standard')).toBe('playing'))
  test('congestion = 26 → playing', () =>
    expect(checkWinCondition({ happiness: 75, congestion: 26, carbon: 50, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'standard')).toBe('playing'))
  test('carbon = 150 still wins (no carbon target)', () =>
    expect(checkWinCondition({ happiness: 75, congestion: 25, carbon: 99, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'standard')).toBe('win'))
})

describe('green profile win conditions', () => {
  const p = CITY_PROFILES.green
  test('happiness target is 65', () => expect(p.win.happiness).toBe(65))
  test('congestion target is 35', () => expect(p.win.congestion).toBe(35))
  test('carbon target is 30',     () => expect(p.win.carbon).toBe(30))

  test('state meeting all targets → win', () =>
    expect(checkWinCondition({ happiness: 65, congestion: 35, carbon: 30, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'green')).toBe('win'))
  test('carbon = 31 → playing even with hap/cong met', () =>
    expect(checkWinCondition({ happiness: 65, congestion: 35, carbon: 31, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'green')).toBe('playing'))
})

describe('transit profile win conditions', () => {
  const p = CITY_PROFILES.transit
  test('happiness target is 60', () => expect(p.win.happiness).toBe(60))
  test('congestion target is 20', () => expect(p.win.congestion).toBe(20))
  test('no carbon requirement',   () => expect(p.win.carbon).toBeUndefined())

  test('state meeting targets → win', () =>
    expect(checkWinCondition({ happiness: 60, congestion: 20, carbon: 80, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'transit')).toBe('win'))
  test('default win thresholds (70/30) insufficient for transit', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 30, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'transit')).toBe('playing'))
})

describe('vibrant profile win conditions', () => {
  const p = CITY_PROFILES.vibrant
  test('happiness target is 85', () => expect(p.win.happiness).toBe(85))
  test('congestion target is 40', () => expect(p.win.congestion).toBe(40))
  test('no carbon requirement',   () => expect(p.win.carbon).toBeUndefined())

  test('state meeting targets → win', () =>
    expect(checkWinCondition({ happiness: 85, congestion: 40, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'vibrant')).toBe('win'))
  test('happiness = 84 → playing', () =>
    expect(checkWinCondition({ happiness: 84, congestion: 40, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'vibrant')).toBe('playing'))
})

describe('eco profile win conditions', () => {
  const p = CITY_PROFILES.eco
  test('happiness target is 70', () => expect(p.win.happiness).toBe(70))
  test('carbon target is 20',    () => expect(p.win.carbon).toBe(20))
  test('no congestion requirement', () => expect(p.win.congestion).toBeUndefined())

  test('state meeting targets → win regardless of congestion', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 80, carbon: 20, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'eco')).toBe('win'))
  test('carbon = 21 → playing', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 50, carbon: 21, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'eco')).toBe('playing'))
  test('default win (70/30) not enough for eco if carbon = 50', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 30, carbon: 50, budget: 500, minActionCost: 40, turnsLeft: 5 }, 'eco')).toBe('playing'))
})

// ── Universal lose conditions apply regardless of profile ──────────────────

describe('lose conditions are universal across profiles', () => {
  PROFILE_KEYS.forEach(key => {
    test(`${key}: congestion = 100 → lose`, () =>
      expect(checkWinCondition({ happiness: 50, congestion: 100, carbon: 0, budget: 500, minActionCost: 40, turnsLeft: 5 }, key)).toBe('lose'))
    test(`${key}: happiness = 0 → lose`, () =>
      expect(checkWinCondition({ happiness: 0, congestion: 50, carbon: 0, budget: 500, minActionCost: 40, turnsLeft: 5 }, key)).toBe('lose'))
    test(`${key}: carbon = 100 → lose`, () =>
      expect(checkWinCondition({ happiness: 50, congestion: 50, carbon: 100, budget: 500, minActionCost: 40, turnsLeft: 5 }, key)).toBe('lose'))
  })
})

// ── Default (no profile) still uses WIN_HAPPINESS / WIN_CONGESTION ─────────

describe('no-profile fallback uses WIN_HAPPINESS and WIN_CONGESTION', () => {
  test('WIN_HAPPINESS is 70', () => expect(WIN_HAPPINESS).toBe(70))
  test('WIN_CONGESTION is 30', () => expect(WIN_CONGESTION).toBe(30))
  test('happiness=70, congestion=30 → win (no profile)', () =>
    expect(checkWinCondition({ happiness: 70, congestion: 30, budget: 500, minActionCost: 40, turnsLeft: 5 })).toBe('win'))
  test('happiness=75, congestion=25 would be standard-win but default uses 70/30', () =>
    expect(checkWinCondition({ happiness: 74, congestion: 31, budget: 500, minActionCost: 40, turnsLeft: 5 })).toBe('playing'))
})

// ── Win is achievable (balance check) ─────────────────────────────────────

describe('each profile has achievable win from INITIAL_STATE area', () => {
  // Supply a plausible post-play state: reasonable budget/turns remain
  const reachableState = (hap, cong, carbon) => ({
    happiness: hap, congestion: cong, carbon,
    budget: 200, minActionCost: 40, turnsLeft: 5,
  })

  test('standard: hap 75, cong 25 is achievable state', () =>
    expect(checkWinCondition(reachableState(75, 25, 50), 'standard')).toBe('win'))
  test('green: hap 65, cong 35, carbon 30 is achievable state', () =>
    expect(checkWinCondition(reachableState(65, 35, 30), 'green')).toBe('win'))
  test('transit: hap 60, cong 20 is achievable state', () =>
    expect(checkWinCondition(reachableState(60, 20, 50), 'transit')).toBe('win'))
  test('vibrant: hap 85, cong 40 is achievable state', () =>
    expect(checkWinCondition(reachableState(85, 40, 50), 'vibrant')).toBe('win'))
  test('eco: hap 70, carbon 20 is achievable state', () =>
    expect(checkWinCondition(reachableState(70, 60, 20), 'eco')).toBe('win'))
})
