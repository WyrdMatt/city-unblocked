import { describe, test, expect } from 'vitest'
import { ACTIONS, getValidActions, getRadialPosition, getButtonPositions } from '../src/radial-logic.js'

// ── ACTIONS constant ──────────────────────────────────────────────────────

describe('ACTIONS constant', () => {
  test('has 5 entries', () => expect(ACTIONS.length).toBe(5))
  test('no two actions share the same label', () => {
    const labels = ACTIONS.map(a => a.label)
    expect(new Set(labels).size).toBe(5)
  })
  test('Park and Parking labels are distinct', () => {
    const labels = ACTIONS.map(a => a.label)
    expect(labels).toContain('Park')
    expect(labels).toContain('Parking')
    expect(labels.filter(l => l === 'Park').length).toBe(1)
    expect(labels.filter(l => l === 'Parking').length).toBe(1)
  })
  test('every action has emoji, cost, color, validTiles', () => {
    ACTIONS.forEach(a => {
      expect(typeof a.emoji).toBe('string')
      expect(typeof a.cost).toBe('number')
      expect(typeof a.color).toBe('string')
      expect(Array.isArray(a.validTiles)).toBe(true)
    })
  })
  test('all costs are positive', () => {
    ACTIONS.forEach(a => expect(a.cost).toBeGreaterThan(0))
  })
})

// ── getValidActions: tile type validation ─────────────────────────────────

describe('getValidActions — tile type', () => {
  const BUDGET = 9999

  test('road tile: bus-stop, bike-lane, road-widening available', () => {
    const results = getValidActions('road', BUDGET)
    const avail = results.filter(r => r.state === 'available').map(r => r.action)
    expect(avail).toContain('bus-stop')
    expect(avail).toContain('bike-lane')
    expect(avail).toContain('road-widening')
  })

  test('road tile: park and parking-garage wrong-tile', () => {
    const results = getValidActions('road', BUDGET)
    const wrongTile = results.filter(r => r.state === 'wrong-tile').map(r => r.action)
    expect(wrongTile).toContain('park')
    expect(wrongTile).toContain('parking-garage')
  })

  test('empty tile: park available', () => {
    const results = getValidActions('empty', BUDGET)
    const avail = results.filter(r => r.state === 'available').map(r => r.action)
    expect(avail).toContain('park')
  })

  test('empty tile: bus-stop, bike-lane, parking-garage, road-widening wrong-tile', () => {
    const results = getValidActions('empty', BUDGET)
    const wrongTile = results.filter(r => r.state === 'wrong-tile').map(r => r.action)
    expect(wrongTile).toContain('bus-stop')
    expect(wrongTile).toContain('bike-lane')
    expect(wrongTile).toContain('parking-garage')
    expect(wrongTile).toContain('road-widening')
  })

  test('building tile: parking-garage available', () => {
    const results = getValidActions('building', BUDGET)
    const avail = results.filter(r => r.state === 'available').map(r => r.action)
    expect(avail).toContain('parking-garage')
  })

  test('building tile: all others wrong-tile', () => {
    const results = getValidActions('building', BUDGET)
    const wrongTile = results.filter(r => r.state === 'wrong-tile').map(r => r.action)
    expect(wrongTile).toContain('bus-stop')
    expect(wrongTile).toContain('bike-lane')
    expect(wrongTile).toContain('park')
    expect(wrongTile).toContain('road-widening')
  })

  test('blocker tile: all wrong-tile', () => {
    const results = getValidActions('blocker', BUDGET)
    expect(results.every(r => r.state === 'wrong-tile')).toBe(true)
  })

  test('null tile type: all wrong-tile', () => {
    const results = getValidActions(null, BUDGET)
    expect(results.every(r => r.state === 'wrong-tile')).toBe(true)
  })

  test('park tile: all wrong-tile (already a park)', () => {
    const results = getValidActions('park', BUDGET)
    expect(results.every(r => r.state === 'wrong-tile')).toBe(true)
  })
})

// ── getValidActions: budget ───────────────────────────────────────────────

describe('getValidActions — budget', () => {
  test('zero budget: all unaffordable or wrong-tile, none available', () => {
    const results = getValidActions('road', 0)
    expect(results.filter(r => r.state === 'available').length).toBe(0)
  })

  test('exactly £40 budget: only bike-lane (£40) available on road', () => {
    const results = getValidActions('road', 40)
    const avail = results.filter(r => r.state === 'available').map(r => r.action)
    expect(avail).toEqual(['bike-lane'])
  })

  test('£39 budget: bike-lane unaffordable', () => {
    const result = getValidActions('road', 39).find(r => r.action === 'bike-lane')
    expect(result.state).toBe('unaffordable')
  })

  test('£80 budget: bus-stop and bike-lane available on road', () => {
    const results = getValidActions('road', 80)
    const avail = results.filter(r => r.state === 'available').map(r => r.action)
    expect(avail).toContain('bus-stop')
    expect(avail).toContain('bike-lane')
    expect(avail).not.toContain('road-widening') // £90
  })

  test('wrong-tile takes priority over unaffordable', () => {
    const result = getValidActions('road', 0).find(r => r.action === 'park')
    expect(result.state).toBe('wrong-tile')
  })

  test('all 5 available with large budget on correct tile types', () => {
    const road     = getValidActions('road',     9999).filter(r => r.state === 'available')
    const empty    = getValidActions('empty',    9999).filter(r => r.state === 'available')
    const building = getValidActions('building', 9999).filter(r => r.state === 'available')
    const allAvail = [...road, ...empty, ...building].map(r => r.action)
    expect(new Set(allAvail).size).toBe(5)
  })
})

// ── getValidActions: reason strings ──────────────────────────────────────

describe('getValidActions — reason strings', () => {
  test('available actions have null reason', () => {
    const result = getValidActions('road', 9999).find(r => r.action === 'bus-stop')
    expect(result.reason).toBeNull()
  })

  test('wrong-tile has a non-empty reason string', () => {
    const result = getValidActions('road', 9999).find(r => r.action === 'park')
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  test('unaffordable reason includes the cost', () => {
    const result = getValidActions('road', 0).find(r => r.action === 'bus-stop')
    expect(result.state).toBe('unaffordable')
    expect(result.reason).toContain('80')
  })
})

// ── getRadialPosition ─────────────────────────────────────────────────────

const GRID = { left: 0, top: 0, right: 840, bottom: 840, width: 840, height: 840 }
const RADIUS = 85

function tile(left, top, size = 80) {
  return { left, top, right: left + size, bottom: top + size, width: size, height: size }
}

describe('getRadialPosition', () => {
  test('centre tile: no flips', () => {
    const pos = getRadialPosition(tile(380, 380), GRID, RADIUS)
    expect(pos.flipDown).toBe(false)
    expect(pos.flipLeft).toBe(false)
    expect(pos.flipRight).toBe(false)
  })

  test('top-row tile: flipDown = true', () => {
    const pos = getRadialPosition(tile(380, 0), GRID, RADIUS)
    expect(pos.flipDown).toBe(true)
  })

  test('second-row tile (80px): flipDown = true (not enough space above)', () => {
    const pos = getRadialPosition(tile(380, 80), GRID, RADIUS)
    expect(pos.flipDown).toBe(true)
  })

  test('middle-row tile: flipDown = false', () => {
    const pos = getRadialPosition(tile(380, 420), GRID, RADIUS)
    expect(pos.flipDown).toBe(false)
  })

  test('left-edge tile: flipRight = true', () => {
    const pos = getRadialPosition(tile(0, 380), GRID, RADIUS)
    expect(pos.flipRight).toBe(true)
  })

  test('right-edge tile: flipLeft = true', () => {
    const pos = getRadialPosition(tile(760, 380), GRID, RADIUS)
    expect(pos.flipLeft).toBe(true)
  })

  test('origin is at horizontal centre of tile', () => {
    const t = tile(200, 300)
    const pos = getRadialPosition(t, GRID, RADIUS)
    expect(pos.originX).toBe(240) // 200 + 40
  })

  test('origin is at top edge of tile', () => {
    const t = tile(200, 300)
    const pos = getRadialPosition(t, GRID, RADIUS)
    expect(pos.originY).toBe(300)
  })

  test('top-left corner: flipDown and flipRight both true', () => {
    const pos = getRadialPosition(tile(0, 0), GRID, RADIUS)
    expect(pos.flipDown).toBe(true)
    expect(pos.flipRight).toBe(true)
  })

  test('top-right corner: flipDown and flipLeft both true', () => {
    const pos = getRadialPosition(tile(760, 0), GRID, RADIUS)
    expect(pos.flipDown).toBe(true)
    expect(pos.flipLeft).toBe(true)
  })
})

// ── getButtonPositions ────────────────────────────────────────────────────

describe('getButtonPositions', () => {
  test('returns 5 positions for 5 buttons', () => {
    const positions = getButtonPositions(400, 400, 85, 5, false)
    expect(positions.length).toBe(5)
  })

  test('all positions are above origin when flipDown = false', () => {
    const positions = getButtonPositions(400, 400, 85, 5, false)
    positions.forEach(p => expect(p.y).toBeLessThan(400))
  })

  test('all positions are below origin when flipDown = true', () => {
    const positions = getButtonPositions(400, 400, 85, 5, true)
    positions.forEach(p => expect(p.y).toBeGreaterThan(400))
  })

  test('each position is approximately fanRadius from origin', () => {
    const positions = getButtonPositions(400, 400, 85, 5, false)
    positions.forEach(p => {
      const dist = Math.sqrt((p.x - 400) ** 2 + (p.y - 400) ** 2)
      expect(dist).toBeCloseTo(85, 0)
    })
  })

  test('middle button is directly above origin (x ≈ originX) when not flipped', () => {
    const positions = getButtonPositions(400, 400, 85, 5, false)
    const mid = positions[2]
    expect(Math.abs(mid.x - 400)).toBeLessThan(1)
    expect(mid.y).toBeLessThan(400)
  })

  test('positions spread horizontally (first and last have different x)', () => {
    const positions = getButtonPositions(400, 400, 85, 5, false)
    expect(positions[0].x).toBeLessThan(positions[4].x)
  })

  test('single button lands directly above origin', () => {
    const positions = getButtonPositions(400, 400, 85, 1, false)
    expect(positions.length).toBe(1)
    expect(Math.abs(positions[0].x - 400)).toBeLessThan(1)
    expect(positions[0].y).toBeLessThan(400)
  })
})
