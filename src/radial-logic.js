// Pure logic for the radial action menu — no DOM, fully testable.

import { EFFECTS } from './game-logic.js'

// Action metadata used by the radial menu UI
export const ACTIONS = [
  { action: 'bus-stop',       emoji: '🚌', label: 'Bus Stop',       cost: 80,  color: '#f59e0b', validTiles: ['road'] },
  { action: 'bike-lane',      emoji: '🚲', label: 'Bike Lane',      cost: 40,  color: '#22c55e', validTiles: ['road'] },
  { action: 'parking-garage', emoji: '🅿️', label: 'Parking',        cost: 120, color: '#6366f1', validTiles: ['building'] },
  { action: 'park',           emoji: '🌳', label: 'Park',           cost: 60,  color: '#86efac', validTiles: ['empty'] },
  { action: 'road-widening',  emoji: '🚧', label: 'Road Widening',  cost: 90,  color: '#f97316', validTiles: ['road'] },
]

/**
 * getValidActions(tileType, budget, placements)
 *
 * Returns the display state for each action given the current tile and budget.
 *
 * tileType:   'road' | 'building' | 'empty' | 'park' | 'blocker' | null
 * budget:     number — remaining budget
 * placements: [{ action }] — already placed tiles (for "already placed" check)
 *
 * Returns: [{ action, emoji, label, cost, color, state, reason }]
 *   state: 'available' | 'wrong-tile' | 'unaffordable' | 'already-placed'
 */
export function getValidActions(tileType, budget, placements = []) {
  return ACTIONS.map(a => {
    // Already placed on this specific tile — handled upstream, not here

    // Wrong tile type
    if (!a.validTiles.includes(tileType)) {
      return { ...a, state: 'wrong-tile', reason: `Place on ${a.validTiles.join(' or ')} only` }
    }

    // Can't afford
    if (budget < a.cost) {
      return { ...a, state: 'unaffordable', reason: `Need £${a.cost}` }
    }

    return { ...a, state: 'available', reason: null }
  })
}

/**
 * getRadialPosition(tileRect, containerRect, fanRadius)
 *
 * Calculates where to anchor the radial fan so buttons appear above the
 * finger and don't overflow the container.
 *
 * tileRect:      { left, top, right, bottom, width, height } — tile bounds in page coords
 * containerRect: { left, top, right, bottom, width, height } — grid/container bounds
 * fanRadius:     number — distance from origin to button centres (px)
 *
 * Returns: {
 *   originX:   number  — fan anchor x in page coords
 *   originY:   number  — fan anchor y in page coords
 *   flipDown:  boolean — true if fan should open downward (tile near top)
 *   flipLeft:  boolean — true if fan should shift left  (tile near right edge)
 *   flipRight: boolean — true if fan should shift right (tile near left edge)
 * }
 */
export function getRadialPosition(tileRect, containerRect, fanRadius) {
  const BUTTON_HALF  = 38  // half of 76px button height — clearance needed above origin
  const EDGE_MARGIN  = 10  // min px from container edge

  // Anchor at the horizontal centre, top edge of tile
  const originX = tileRect.left + tileRect.width / 2
  const originY = tileRect.top

  // Fan needs fanRadius + BUTTON_HALF clear space above origin
  const spaceAbove = originY - containerRect.top
  const flipDown   = spaceAbove < fanRadius + BUTTON_HALF

  // Horizontal overflow: outermost buttons sit fanRadius * sin(60°) ≈ 0.87 * fanRadius left/right
  const sideReach = fanRadius * 0.87
  const flipRight  = (originX - sideReach) < containerRect.left  + EDGE_MARGIN
  const flipLeft   = (originX + sideReach) > containerRect.right - EDGE_MARGIN

  return { originX, originY, flipDown, flipLeft, flipRight }
}

/**
 * getButtonPositions(originX, originY, fanRadius, count, flipDown)
 *
 * Returns [{ x, y }] for each button centre, spread in a fan arc.
 * Arc is 140° wide, centred straight up (or down if flipDown).
 *
 * originX, originY: fan anchor in page coords
 * fanRadius:        distance from origin to button centre
 * count:            number of buttons (5)
 * flipDown:         open downward instead of upward
 */
export function getButtonPositions(originX, originY, fanRadius, count, flipDown) {
  const ARC_DEG  = 160
  const startDeg = flipDown ? 10 : -170   // start angle (degrees from positive x-axis)
  const endDeg   = flipDown ? 170 : -10

  return Array.from({ length: count }, (_, i) => {
    const t   = count === 1 ? 0.5 : i / (count - 1)
    const deg = startDeg + t * (endDeg - startDeg)
    const rad = deg * Math.PI / 180
    return {
      x: originX + fanRadius * Math.cos(rad),
      y: originY + fanRadius * Math.sin(rad),
    }
  })
}
