// Keep the mapgen algorithm in sync with the mapgen <script> block in index.html.
import { describe, test, expect } from 'vitest'

// ── Inline mapgen (copy of index.html mapgen block) ────────────────────────

function makeRNG(seed) {
  var s = (seed >>> 0) || 1
  return function () {
    s += 0x6D2B79F5
    var t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEFAULT_CONFIG = {
  rows: 10, cols: 10, minRoads: 2, maxRoads: 3,
  minBlockSize: 2, emptyRate: 0.20, parkCount: 2,
}

function nbValues(grid, r, c, rows, cols) {
  return [[-1,0],[1,0],[0,-1],[0,1]].reduce((acc, o) => {
    const nr = r + o[0], nc = c + o[1]
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) acc.push(grid[nr][nc])
    return acc
  }, [])
}

function pickRoadLines(total, count, minBlockSize, rng) {
  const lines = []
  const segSize = total / count
  for (let i = 0; i < count; i++) {
    let lo = Math.round(i * segSize)
    const hi = Math.round((i + 1) * segSize) - 1
    if (lines.length > 0) lo = Math.max(lo, lines[lines.length - 1] + minBlockSize + 1)
    if (lo > hi) lo = hi
    lines.push(lo + Math.floor(rng() * (hi - lo + 1)))
  }
  return lines
}

function generateMap(userConfig) {
  const cfg  = Object.assign({}, DEFAULT_CONFIG, userConfig || {})
  const seed = (cfg.seed != null) ? (cfg.seed >>> 0) : (Math.random() * 0xFFFFFFFF | 0)
  const rng  = makeRNG(seed)

  const maxR = Math.min(cfg.maxRoads, Math.floor((cfg.rows - 1) / (cfg.minBlockSize + 1)))
  const maxC = Math.min(cfg.maxRoads, Math.floor((cfg.cols - 1) / (cfg.minBlockSize + 1)))
  const roadRowCount = cfg.minRoads + Math.floor(rng() * (maxR - cfg.minRoads + 1))
  const roadColCount = cfg.minRoads + Math.floor(rng() * (maxC - cfg.minRoads + 1))
  const roadRows = pickRoadLines(cfg.rows, roadRowCount, cfg.minBlockSize, rng)
  const roadCols = pickRoadLines(cfg.cols, roadColCount, cfg.minBlockSize, rng)

  const roadRowSet = {}, roadColSet = {}
  roadRows.forEach(r => { roadRowSet[r] = true })
  roadCols.forEach(c => { roadColSet[c] = true })

  const grid = []
  for (let r = 0; r < cfg.rows; r++) {
    const row = []
    for (let c = 0; c < cfg.cols; c++)
      row.push((roadRowSet[r] || roadColSet[c]) ? 'R' : 'B')
    grid.push(row)
  }

  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'B') continue
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(t => t === 'B').length
      if (adjB >= 1 && rng() < cfg.emptyRate) grid[r][c] = 'E'
    }
  }
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'E') continue
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(t => t === 'B').length
      if (adjB === 0) grid[r][c] = 'B'
    }
  }

  const MIN_EMPTY = 4
  let emptyCount = 0
  for (let r = 0; r < cfg.rows; r++)
    for (let c = 0; c < cfg.cols; c++)
      if (grid[r][c] === 'E') emptyCount++

  if (emptyCount < MIN_EMPTY) {
    const extras = []
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        if (grid[r][c] !== 'B') continue
        const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(t => t === 'B').length
        if (adjB >= 1) extras.push([r, c, adjB])
      }
    }
    extras.sort((a, b) => b[2] - a[2])
    for (let i = 0; i < extras.length && emptyCount < MIN_EMPTY; i++) {
      grid[extras[i][0]][extras[i][1]] = 'E'
      emptyCount++
    }
  }

  const parkCandidates = []
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'B') continue
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(t => t === 'B').length
      if (adjB >= 2) parkCandidates.push([r, c, adjB])
    }
  }
  parkCandidates.sort((a, b) => (b[2] - a[2]) + (rng() - 0.5) * 0.6)
  let parksPlaced = 0
  for (let i = 0; i < parkCandidates.length && parksPlaced < cfg.parkCount; i++) {
    const [pr, pc] = parkCandidates[i]
    const adjLive = nbValues(grid, pr, pc, cfg.rows, cfg.cols).filter(t => t === 'B').length
    if (adjLive < 2) continue
    grid[pr][pc] = 'P'
    parksPlaced++
  }

  return { grid, seed, config: cfg, roadRows, roadCols }
}

function validateMap(grid, cfg) {
  const counts = {}
  let emptyWithAdj = 0
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const t = grid[r][c]
      counts[t] = (counts[t] || 0) + 1
      if (t === 'E') {
        const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
          .filter(n => n === 'B' || n === 'P').length
        if (adjB > 0) emptyWithAdj++
      }
    }
  }
  const issues = []
  if ((counts.E || 0) < 4)  issues.push('Too few empty lots: '              + (counts.E || 0))
  if ((counts.R || 0) < 10) issues.push('Too few road tiles: '               + (counts.R || 0))
  if (emptyWithAdj < 3)     issues.push('Too few empty lots adj buildings: ' + emptyWithAdj)
  return { counts, emptyWithAdj, valid: issues.length === 0, issues }
}

function runChecks(map) {
  const { grid, seed, config: cfg, roadRows, roadCols } = map
  const failures = []
  const VALID = { R: true, B: true, E: true, P: true }

  if (grid.length !== cfg.rows)
    failures.push(`grid has ${grid.length} rows, expected ${cfg.rows}`)
  grid.forEach((row, r) => {
    if (row.length !== cfg.cols) failures.push(`row ${r} has ${row.length} cols`)
    row.forEach((t, c) => { if (!VALID[t]) failures.push(`unknown tile "${t}" at (${r},${c})`) })
  })

  const maxR = Math.min(cfg.maxRoads, Math.floor((cfg.rows - 1) / (cfg.minBlockSize + 1)))
  const maxC = Math.min(cfg.maxRoads, Math.floor((cfg.cols - 1) / (cfg.minBlockSize + 1)))
  if (roadRows.length < cfg.minRoads || roadRows.length > maxR)
    failures.push(`roadRows.length=${roadRows.length} outside [${cfg.minRoads},${maxR}]`)
  if (roadCols.length < cfg.minRoads || roadCols.length > maxC)
    failures.push(`roadCols.length=${roadCols.length} outside [${cfg.minRoads},${maxC}]`)

  const checkGaps = (lines, axis) => {
    for (let i = 1; i < lines.length; i++) {
      const gap = lines[i] - lines[i - 1] - 1
      if (gap < cfg.minBlockSize)
        failures.push(`${axis} gap between lines ${lines[i-1]} and ${lines[i]} is ${gap}, min ${cfg.minBlockSize}`)
    }
  }
  checkGaps(roadRows, 'row')
  checkGaps(roadCols, 'col')

  roadRows.forEach((r, i) => {
    if (r < 0 || r >= cfg.rows) failures.push(`roadRows[${i}]=${r} out of bounds`)
    if (i > 0 && r <= roadRows[i-1]) failures.push(`roadRows not strictly ascending at ${i}`)
  })
  roadCols.forEach((c, i) => {
    if (c < 0 || c >= cfg.cols) failures.push(`roadCols[${i}]=${c} out of bounds`)
    if (i > 0 && c <= roadCols[i-1]) failures.push(`roadCols not strictly ascending at ${i}`)
  })

  roadRows.forEach(r => {
    for (let c = 0; c < cfg.cols; c++)
      if (grid[r][c] !== 'R') failures.push(`road row ${r} col ${c} is not R`)
  })
  roadCols.forEach(c => {
    for (let r = 0; r < cfg.rows; r++)
      if (grid[r][c] !== 'R') failures.push(`road col ${c} row ${r} is not R`)
  })

  grid.forEach((row, r) => {
    row.forEach((t, c) => {
      if (t !== 'E') return
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(n => n === 'B' || n === 'P').length
      if (adjB === 0) failures.push(`empty lot at (${r},${c}) has no adjacent building`)
    })
  })

  grid.forEach((row, r) => {
    row.forEach((t, c) => {
      if (t !== 'P') return
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(n => n === 'B').length
      if (adjB < 2) failures.push(`park at (${r},${c}) has only ${adjB} building neighbour(s), need ≥2`)
    })
  })

  const v = validateMap(grid, cfg)
  if (!v.valid) v.issues.forEach(issue => failures.push('validateMap: ' + issue))

  // Determinism check
  const map2 = generateMap({ ...cfg, seed })
  for (let r = 0; r < cfg.rows; r++)
    for (let c = 0; c < cfg.cols; c++)
      if (grid[r][c] !== map2.grid[r][c])
        failures.push(`non-deterministic at (${r},${c})`)

  return failures
}

// ── Tests ──────────────────────────────────────────────────────────────────

const RUNS = 5000

test(`map generation: ${RUNS} random seeds all pass all structural checks`, () => {
  const failedSeeds = []

  for (let i = 0; i < RUNS; i++) {
    const map = generateMap()
    const failures = runChecks(map)
    if (failures.length > 0) failedSeeds.push({ seed: map.seed, failures })
  }

  expect(
    failedSeeds.map(f => `seed=${f.seed}: ${f.failures[0]}`),
    `${failedSeeds.length} of ${RUNS} maps failed`,
  ).toEqual([])
})

describe('specific seeds and invariants', () => {
  test('seed 1 generates a valid 10×10 map', () => {
    const map = generateMap({ seed: 1 })
    expect(runChecks(map)).toEqual([])
  })

  test('seed 0xDEADBEEF generates a valid map', () => {
    const map = generateMap({ seed: 0xDEADBEEF })
    expect(runChecks(map)).toEqual([])
  })

  test('same seed produces identical grid (determinism)', () => {
    const a = generateMap({ seed: 42 })
    const b = generateMap({ seed: 42 })
    expect(a.grid).toEqual(b.grid)
  })

  test('different seeds produce different grids (with high probability)', () => {
    const a = generateMap({ seed: 1 })
    const b = generateMap({ seed: 2 })
    const same = a.grid.every((row, r) => row.every((t, c) => t === b.grid[r][c]))
    expect(same).toBe(false)
  })

  test('grid dimensions match default config', () => {
    const map = generateMap({ seed: 100 })
    expect(map.grid.length).toBe(10)
    map.grid.forEach(row => expect(row.length).toBe(10))
  })

  test('all tile codes are valid', () => {
    const map = generateMap({ seed: 200 })
    const VALID = new Set(['R', 'B', 'E', 'P'])
    map.grid.forEach(row => row.forEach(t => expect(VALID.has(t)).toBe(true)))
  })

  test('at least 4 empty lots per map (MIN_EMPTY floor)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const map = generateMap({ seed })
      const emptyCount = map.grid.flat().filter(t => t === 'E').length
      expect(emptyCount, `seed=${seed}`).toBeGreaterThanOrEqual(4)
    }
  })

  test('road lines within config bounds across 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const map = generateMap({ seed })
      const cfg = map.config
      expect(map.roadRows.length, `seed=${seed} roadRows`).toBeGreaterThanOrEqual(cfg.minRoads)
      expect(map.roadCols.length, `seed=${seed} roadCols`).toBeGreaterThanOrEqual(cfg.minRoads)
    }
  })
})
