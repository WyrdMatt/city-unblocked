import { describe, test, expect } from 'vitest'
import {
  ZONE_CAP, GENERATOR_DELTA, DEMOLISH_COST,
  getBlockId, checkZoneCap, applyGeneratorTick,
} from '../src/game-logic.js'

// ── Constants ─────────────────────────────────────────────────────────────

describe('puzzle-mechanic constants', () => {
  test('ZONE_CAP = 2',        () => expect(ZONE_CAP).toBe(2))
  test('GENERATOR_DELTA = 3', () => expect(GENERATOR_DELTA).toBe(3))
  test('DEMOLISH_COST = 50',  () => expect(DEMOLISH_COST).toBe(50))
})

// ── getBlockId ─────────────────────────────────────────────────────────────

describe('getBlockId', () => {
  const roadRows = [2, 6]
  const roadCols = [3, 7]

  test('top-left block (0:0)', () => {
    expect(getBlockId(0, 0, roadRows, roadCols)).toBe('0:0')
    expect(getBlockId(1, 1, roadRows, roadCols)).toBe('0:0')
    expect(getBlockId(1, 2, roadRows, roadCols)).toBe('0:0')
  })

  test('top-right block (0:1)', () => {
    expect(getBlockId(0, 4, roadRows, roadCols)).toBe('0:1')
    expect(getBlockId(1, 6, roadRows, roadCols)).toBe('0:1')
  })

  test('top-far-right block (0:2)', () => {
    expect(getBlockId(0, 8, roadRows, roadCols)).toBe('0:2')
  })

  test('middle-left block (1:0)', () => {
    expect(getBlockId(3, 0, roadRows, roadCols)).toBe('1:0')
    expect(getBlockId(5, 2, roadRows, roadCols)).toBe('1:0')
  })

  test('middle block (1:1)', () => {
    expect(getBlockId(4, 5, roadRows, roadCols)).toBe('1:1')
  })

  test('bottom-right block (2:2)', () => {
    expect(getBlockId(9, 9, roadRows, roadCols)).toBe('2:2')
  })

  test('road row itself is placed in the band above it', () => {
    // Row 2 is a road row; rows before it are band 0 (0 road rows < 2)
    expect(getBlockId(2, 0, roadRows, roadCols)).toBe('0:0')
  })

  test('single road row / col', () => {
    expect(getBlockId(0, 0, [5], [5])).toBe('0:0')
    expect(getBlockId(6, 6, [5], [5])).toBe('1:1')
  })

  test('no roads → everything in block 0:0', () => {
    expect(getBlockId(9, 9, [], [])).toBe('0:0')
  })
})

// ── checkZoneCap ───────────────────────────────────────────────────────────

describe('checkZoneCap', () => {
  const blockId = '1:1'

  test('zero placements → not capped', () => {
    expect(checkZoneCap([], blockId, 'bus-stop', 6)).toBe(false)
  })

  test('one placement → not capped (cap = max(2, floor(6/2)) = 3)', () => {
    const placements = [{ action: 'bus-stop', blockId }]
    expect(checkZoneCap(placements, blockId, 'bus-stop', 6)).toBe(false)
  })

  test('reaches cap of 2 for small block (validTiles = 2)', () => {
    const placements = [
      { action: 'bus-stop', blockId },
      { action: 'bus-stop', blockId },
    ]
    // cap = max(2, floor(2/2)) = max(2,1) = 2; count = 2 → capped
    expect(checkZoneCap(placements, blockId, 'bus-stop', 2)).toBe(true)
  })

  test('dynamic cap for large block: floor(8/2) = 4 > ZONE_CAP(2)', () => {
    const placements = Array.from({ length: 3 }, () => ({ action: 'park', blockId }))
    // cap = max(2, floor(8/2)) = 4; count = 3 → not capped
    expect(checkZoneCap(placements, blockId, 'park', 8)).toBe(false)
    placements.push({ action: 'park', blockId })
    // count = 4 → capped
    expect(checkZoneCap(placements, blockId, 'park', 8)).toBe(true)
  })

  test('placements in different block do not count', () => {
    const placements = [
      { action: 'bus-stop', blockId: '0:0' },
      { action: 'bus-stop', blockId: '0:0' },
    ]
    expect(checkZoneCap(placements, blockId, 'bus-stop', 4)).toBe(false)
  })

  test('different action in same block does not count', () => {
    const placements = [
      { action: 'bike-lane', blockId },
      { action: 'bike-lane', blockId },
    ]
    expect(checkZoneCap(placements, blockId, 'bus-stop', 4)).toBe(false)
  })

  test('exactly at cap returns true', () => {
    const placements = [
      { action: 'bike-lane', blockId },
      { action: 'bike-lane', blockId },
    ]
    // cap = max(2, floor(4/2)) = 2; count = 2 → capped
    expect(checkZoneCap(placements, blockId, 'bike-lane', 4)).toBe(true)
  })

  test('validTilesInBlock = 0 → cap = ZONE_CAP = 2', () => {
    const placements = [{ action: 'park', blockId }, { action: 'park', blockId }]
    expect(checkZoneCap(placements, blockId, 'park', 0)).toBe(true)
  })
})

// ── applyGeneratorTick ─────────────────────────────────────────────────────

describe('applyGeneratorTick', () => {
  test('no generators → delta = 0', () => {
    expect(applyGeneratorTick([], [])).toBe(0)
  })

  test('one unsuppressed generator → GENERATOR_DELTA', () => {
    const gens = [{ row: 3, col: 3 }]
    expect(applyGeneratorTick(gens, [])).toBe(GENERATOR_DELTA)
  })

  test('two unsuppressed generators → 2 × GENERATOR_DELTA', () => {
    const gens = [{ row: 3, col: 3 }, { row: 7, col: 7 }]
    expect(applyGeneratorTick(gens, [])).toBe(2 * GENERATOR_DELTA)
  })

  test('bus-stop adjacent to generator suppresses it', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'bus-stop', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(0)
  })

  test('bike-lane adjacent suppresses generator', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'bike-lane', row: 4, col: 3 }]
    expect(applyGeneratorTick(gens, placements)).toBe(0)
  })

  test('road-widening adjacent suppresses generator', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'road-widening', row: 2, col: 3 }]
    expect(applyGeneratorTick(gens, placements)).toBe(0)
  })

  test('non-road action (park) adjacent does NOT suppress', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'park', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })

  test('parking-garage adjacent does NOT suppress', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'parking-garage', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })

  test('diagonal road action does NOT suppress (only orthogonal)', () => {
    const gens = [{ row: 3, col: 3 }]
    const placements = [{ action: 'bus-stop', row: 4, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })

  test('two generators: one suppressed, one not', () => {
    const gens = [{ row: 3, col: 3 }, { row: 7, col: 7 }]
    const placements = [{ action: 'bus-stop', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })

  test('one road action can suppress multiple adjacent generators', () => {
    const gens = [{ row: 3, col: 3 }, { row: 3, col: 5 }]
    // Both adjacent to row=3, col=4
    const placements = [{ action: 'bus-stop', row: 3, col: 4 }]
    expect(applyGeneratorTick(gens, placements)).toBe(0)
  })

  test('action suppresses only generators it is orthogonally adjacent to', () => {
    const gens = [{ row: 3, col: 3 }, { row: 7, col: 7 }]
    const placements = [{ action: 'bike-lane', row: 3, col: 2 }]
    expect(applyGeneratorTick(gens, placements)).toBe(GENERATOR_DELTA)
  })
})
