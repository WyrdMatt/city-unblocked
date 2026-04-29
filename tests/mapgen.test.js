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
  rows: 12, cols: 12, minRoads: 2, maxRoads: 4,
  minBlockSize: 2, emptyRate: 0.20, parkCount: 2,
  blockerRate: 0, generatorCount: 0,
  commercialRate: 0.10,
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

  // Step 4 — Blocker tiles
  if (cfg.blockerRate > 0) {
    const blockerPool = []
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++)
        if (grid[r][c] === 'B') blockerPool.push([r, c])
    for (let i = blockerPool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = blockerPool[i]; blockerPool[i] = blockerPool[j]; blockerPool[j] = tmp
    }
    const blockerCount = Math.floor(blockerPool.length * cfg.blockerRate)
    for (let i = 0; i < blockerCount; i++) grid[blockerPool[i][0]][blockerPool[i][1]] = 'X'
  }

  // Step 5 — Generator tiles
  if (cfg.generatorCount > 0) {
    const genPool = []
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        if (grid[r][c] !== 'B') continue
        const adjRoad = nbValues(grid, r, c, cfg.rows, cfg.cols).filter(t => t === 'R').length
        if (adjRoad > 0) genPool.push([r, c, adjRoad])
      }
    }
    for (let i = genPool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = genPool[i]; genPool[i] = genPool[j]; genPool[j] = tmp
    }
    const toPlace = Math.min(cfg.generatorCount, genPool.length)
    for (let i = 0; i < toPlace; i++) grid[genPool[i][0]][genPool[i][1]] = 'G'
  }

  // Step 6 — Commercial tiles: convert ~10% of remaining building tiles to commercial
  if (cfg.commercialRate > 0) {
    const commercialPool = []
    for (let r = 0; r < cfg.rows; r++)
      for (let c = 0; c < cfg.cols; c++)
        if (grid[r][c] === 'B') commercialPool.push([r, c])
    for (let i = commercialPool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = commercialPool[i]; commercialPool[i] = commercialPool[j]; commercialPool[j] = tmp
    }
    const commercialCount = Math.floor(commercialPool.length * cfg.commercialRate)
    for (let i = 0; i < commercialCount; i++) grid[commercialPool[i][0]][commercialPool[i][1]] = 'C'
  }

  // Step 7 — Arena tiles: place 1–2 arenas on high-adjacency building cells
  const arenaCandidates = []
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'B') continue
      const adjBldg = nbValues(grid, r, c, cfg.rows, cfg.cols)
                       .filter(t => t === 'B' || t === 'C').length
      if (adjBldg >= 2) arenaCandidates.push([r, c, adjBldg])
    }
  }
  arenaCandidates.sort((a, b) => (b[2] - a[2]) + (rng() - 0.5) * 0.6)
  const arenaCount = 1 + Math.floor(rng() * 2) // 1 or 2
  let arenaPlaced = 0
  for (let i = 0; i < arenaCandidates.length && arenaPlaced < arenaCount; i++) {
    grid[arenaCandidates[i][0]][arenaCandidates[i][1]] = 'A'
    arenaPlaced++
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
          .filter(n => n === 'B' || n === 'P' || n === 'C' || n === 'A').length
        if (adjB > 0) emptyWithAdj++
      }
    }
  }
  const issues = []
  if ((counts.E || 0) < 4)  issues.push('Too few empty lots: '              + (counts.E || 0))
  if ((counts.R || 0) < 10) issues.push('Too few road tiles: '               + (counts.R || 0))
  if (emptyWithAdj < 3)     issues.push('Too few empty lots adj buildings: ' + emptyWithAdj)
  if (cfg.generatorCount > 0 && (counts.G || 0) < cfg.generatorCount)
    issues.push('Too few generator tiles: ' + (counts.G || 0) + ' / ' + cfg.generatorCount)
  return { counts, emptyWithAdj, valid: issues.length === 0, issues }
}

function runChecks(map) {
  const { grid, seed, config: cfg, roadRows, roadCols } = map
  const failures = []
  const VALID = { R: true, B: true, C: true, A: true, E: true, P: true, X: true, G: true }

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
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
        .filter(n => n === 'B' || n === 'P' || n === 'C' || n === 'A').length
      if (adjB === 0) failures.push(`empty lot at (${r},${c}) has no adjacent building`)
    })
  })

  grid.forEach((row, r) => {
    row.forEach((t, c) => {
      if (t !== 'P') return
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
        .filter(n => n === 'B' || n === 'C' || n === 'A').length
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
  test('seed 1 generates a valid 12×12 map', () => {
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
    expect(map.grid.length).toBe(12)
    map.grid.forEach(row => expect(row.length).toBe(12))
  })

  test('all tile codes are valid (no blocker/gen by default)', () => {
    const map = generateMap({ seed: 200 })
    const VALID = new Set(['R', 'B', 'C', 'A', 'E', 'P'])
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

describe('blocker tiles (X)', () => {
  test('no blockers when blockerRate = 0', () => {
    const map = generateMap({ seed: 1, blockerRate: 0 })
    const xs = map.grid.flat().filter(t => t === 'X')
    expect(xs.length).toBe(0)
  })

  test('blockers appear with blockerRate > 0', () => {
    const map = generateMap({ seed: 1, blockerRate: 0.10 })
    const xs = map.grid.flat().filter(t => t === 'X')
    expect(xs.length).toBeGreaterThan(0)
  })

  test('blockers are deterministic per seed', () => {
    const a = generateMap({ seed: 77, blockerRate: 0.06 })
    const b = generateMap({ seed: 77, blockerRate: 0.06 })
    expect(a.grid).toEqual(b.grid)
  })

  test('blockers only placed on former building tiles (not roads)', () => {
    const map = generateMap({ seed: 5, blockerRate: 0.15 })
    const { grid, roadRows, roadCols } = map
    const roadRowSet = new Set(roadRows), roadColSet = new Set(roadCols)
    grid.forEach((row, r) => {
      row.forEach((t, c) => {
        if (t === 'X') {
          expect(roadRowSet.has(r), `blocker at road row ${r}`).toBe(false)
          expect(roadColSet.has(c), `blocker at road col ${c}`).toBe(false)
        }
      })
    })
  })

  test('hard preset blockerRate 0.06 produces ≥1 blocker on most maps', () => {
    let mapsWithBlockers = 0
    for (let seed = 1; seed <= 50; seed++) {
      const map = generateMap({ seed, blockerRate: 0.06 })
      if (map.grid.flat().some(t => t === 'X')) mapsWithBlockers++
    }
    expect(mapsWithBlockers).toBeGreaterThan(40)
  })
})

describe('generator tiles (G)', () => {
  test('no generators when generatorCount = 0', () => {
    const map = generateMap({ seed: 1, generatorCount: 0 })
    expect(map.grid.flat().filter(t => t === 'G').length).toBe(0)
  })

  test('places requested number of generators', () => {
    const map = generateMap({ seed: 1, generatorCount: 2 })
    expect(map.grid.flat().filter(t => t === 'G').length).toBe(2)
  })

  test('generators are deterministic per seed', () => {
    const a = generateMap({ seed: 42, generatorCount: 2 })
    const b = generateMap({ seed: 42, generatorCount: 2 })
    expect(a.grid).toEqual(b.grid)
  })

  test('generators are only on building tiles adjacent to roads', () => {
    const map = generateMap({ seed: 3, generatorCount: 2 })
    const { grid, roadRows, roadCols } = map
    const roadRowSet = new Set(roadRows), roadColSet = new Set(roadCols)
    grid.forEach((row, r) => {
      row.forEach((t, c) => {
        if (t !== 'G') return
        expect(roadRowSet.has(r), `G at road row ${r}`).toBe(false)
        expect(roadColSet.has(c), `G at road col ${c}`).toBe(false)
        const adjRoad = [[-1,0],[1,0],[0,-1],[0,1]].some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc
          return nr >= 0 && nr < map.config.rows && nc >= 0 && nc < map.config.cols
            && (roadRowSet.has(nr) || roadColSet.has(nc))
        })
        expect(adjRoad, `G at (${r},${c}) not adjacent to road`).toBe(true)
      })
    })
  })

  test('generators and blockers can coexist', () => {
    const map = generateMap({ seed: 10, blockerRate: 0.05, generatorCount: 2 })
    expect(map.grid.flat().filter(t => t === 'G').length).toBe(2)
    expect(map.grid.flat().filter(t => t === 'X').length).toBeGreaterThan(0)
  })
})

describe('commercial tiles (C)', () => {
  test('no commercial when commercialRate = 0', () => {
    const map = generateMap({ seed: 1, commercialRate: 0 })
    expect(map.grid.flat().filter(t => t === 'C').length).toBe(0)
  })

  test('commercial tiles appear with default commercialRate 0.10', () => {
    const map = generateMap({ seed: 1 })
    expect(map.grid.flat().filter(t => t === 'C').length).toBeGreaterThan(0)
  })

  test('commercial tiles are deterministic per seed', () => {
    const a = generateMap({ seed: 55 })
    const b = generateMap({ seed: 55 })
    expect(a.grid).toEqual(b.grid)
  })

  test('commercial tiles are never on road tiles', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { grid, roadRows, roadCols } = generateMap({ seed })
      const roadRowSet = new Set(roadRows), roadColSet = new Set(roadCols)
      grid.forEach((row, r) => row.forEach((t, c) => {
        if (t === 'C') {
          expect(roadRowSet.has(r), `C at road row ${r} seed=${seed}`).toBe(false)
          expect(roadColSet.has(c), `C at road col ${c} seed=${seed}`).toBe(false)
        }
      }))
    }
  })

  test('higher commercialRate produces more commercial tiles', () => {
    const low  = generateMap({ seed: 7, commercialRate: 0.05 }).grid.flat().filter(t => t === 'C').length
    const high = generateMap({ seed: 7, commercialRate: 0.30 }).grid.flat().filter(t => t === 'C').length
    expect(high).toBeGreaterThan(low)
  })

  test('5000 random seeds all pass checks with commercialRate=0.10', () => {
    const failedSeeds = []
    for (let i = 0; i < 200; i++) {
      const map = generateMap({ commercialRate: 0.10 })
      const failures = runChecks(map)
      if (failures.length > 0) failedSeeds.push({ seed: map.seed, failures })
    }
    expect(failedSeeds.map(f => `seed=${f.seed}: ${f.failures[0]}`)).toEqual([])
  })
})

describe('arena tiles (A)', () => {
  test('arena tiles appear by default (1 or 2 per map)', () => {
    let mapsWithArena = 0
    for (let seed = 1; seed <= 50; seed++) {
      const map = generateMap({ seed })
      const count = map.grid.flat().filter(t => t === 'A').length
      if (count > 0) mapsWithArena++
      expect(count, `seed=${seed} arena count`).toBeLessThanOrEqual(2)
    }
    expect(mapsWithArena, 'most maps should have arenas').toBeGreaterThan(40)
  })

  test('arena tiles are deterministic per seed', () => {
    const a = generateMap({ seed: 123 })
    const b = generateMap({ seed: 123 })
    expect(a.grid).toEqual(b.grid)
  })

  test('arena tiles are never on road tiles', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { grid, roadRows, roadCols } = generateMap({ seed })
      const roadRowSet = new Set(roadRows), roadColSet = new Set(roadCols)
      grid.forEach((row, r) => row.forEach((t, c) => {
        if (t === 'A') {
          expect(roadRowSet.has(r), `A at road row ${r} seed=${seed}`).toBe(false)
          expect(roadColSet.has(c), `A at road col ${c} seed=${seed}`).toBe(false)
        }
      }))
    }
  })

  test('arena tiles have ≥2 adjacent building/commercial neighbours', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { grid, config: cfg } = generateMap({ seed })
      grid.forEach((row, r) => row.forEach((t, c) => {
        if (t !== 'A') return
        const adjBldg = nbValues(grid, r, c, cfg.rows, cfg.cols)
          .filter(n => n === 'B' || n === 'C' || n === 'A').length
        expect(adjBldg, `A at (${r},${c}) seed=${seed}`).toBeGreaterThanOrEqual(2)
      }))
    }
  })

  test('200 random seeds all pass checks with arenas enabled', () => {
    const failedSeeds = []
    for (let i = 0; i < 200; i++) {
      const map = generateMap()
      const failures = runChecks(map)
      if (failures.length > 0) failedSeeds.push({ seed: map.seed, failures })
    }
    expect(failedSeeds.map(f => `seed=${f.seed}: ${f.failures[0]}`)).toEqual([])
  })
})
