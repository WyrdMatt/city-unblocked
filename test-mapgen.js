/**
 * test-mapgen.js
 *
 * Standalone test runner for the map-generation algorithm.
 * No npm install required — run with:
 *
 *   node test-mapgen.js
 *   node test-mapgen.js --runs 50000
 *   node test-mapgen.js --seed 1234567   (test one specific seed)
 *   node test-mapgen.js --config '{"minRoads":3,"maxRoads":4}'  (custom config)
 *
 * Keep this file in sync with the mapgen <script> block in index.html.
 * The functions below are copied verbatim — no DOM required.
 */

'use strict';

// ── Parse CLI args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function argVal(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const RUNS       = parseInt(argVal('--runs')   || '10000', 10);
const FIXED_SEED = argVal('--seed') ? parseInt(argVal('--seed'), 10) : null;
const CFG_PATCH  = argVal('--config') ? JSON.parse(argVal('--config')) : {};

// ── Mapgen code (keep in sync with index.html mapgen block) ───────────────

function makeRNG(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s += 0x6D2B79F5;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var DEFAULT_CONFIG = {
  rows:         10,
  cols:         10,
  minRoads:     2,
  maxRoads:     3,
  minBlockSize: 2,
  emptyRate:    0.20,
  parkCount:    2,
};

function nbValues(grid, r, c, rows, cols) {
  return [[-1,0],[1,0],[0,-1],[0,1]].reduce(function (acc, o) {
    var nr = r + o[0], nc = c + o[1];
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) acc.push(grid[nr][nc]);
    return acc;
  }, []);
}

function pickRoadLines(total, count, minBlockSize, rng) {
  var lines   = [];
  var segSize = total / count;
  for (var i = 0; i < count; i++) {
    var lo = Math.round(i * segSize);
    var hi = Math.round((i + 1) * segSize) - 1;
    if (lines.length > 0) lo = Math.max(lo, lines[lines.length - 1] + minBlockSize + 1);
    if (lo > hi) lo = hi;
    lines.push(lo + Math.floor(rng() * (hi - lo + 1)));
  }
  return lines;
}

function generateMap(userConfig) {
  var cfg  = Object.assign({}, DEFAULT_CONFIG, userConfig || {});
  var seed = (cfg.seed != null) ? (cfg.seed >>> 0) : (Math.random() * 0xFFFFFFFF | 0);
  var rng  = makeRNG(seed);

  var maxR = Math.min(cfg.maxRoads, Math.floor((cfg.rows - 1) / (cfg.minBlockSize + 1)));
  var maxC = Math.min(cfg.maxRoads, Math.floor((cfg.cols - 1) / (cfg.minBlockSize + 1)));
  var roadRowCount = cfg.minRoads + Math.floor(rng() * (maxR - cfg.minRoads + 1));
  var roadColCount = cfg.minRoads + Math.floor(rng() * (maxC - cfg.minRoads + 1));
  var roadRows = pickRoadLines(cfg.rows, roadRowCount, cfg.minBlockSize, rng);
  var roadCols = pickRoadLines(cfg.cols, roadColCount, cfg.minBlockSize, rng);

  var roadRowSet = {}, roadColSet = {};
  roadRows.forEach(function (r) { roadRowSet[r] = true; });
  roadCols.forEach(function (c) { roadColSet[c] = true; });

  var grid = [];
  for (var r = 0; r < cfg.rows; r++) {
    var row = [];
    for (var c = 0; c < cfg.cols; c++) {
      row.push((roadRowSet[r] || roadColSet[c]) ? 'R' : 'B');
    }
    grid.push(row);
  }

  for (var r = 0; r < cfg.rows; r++) {
    for (var c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'B') continue;
      var adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                   .filter(function (t) { return t === 'B'; }).length;
      if (adjB >= 1 && rng() < cfg.emptyRate) grid[r][c] = 'E';
    }
  }
  // Post-process: revert isolated empty lots caused by scan-order conversions
  for (var r = 0; r < cfg.rows; r++) {
    for (var c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'E') continue;
      var adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                   .filter(function (t) { return t === 'B'; }).length;
      if (adjB === 0) grid[r][c] = 'B';
    }
  }

  // Top-up: force-convert best remaining buildings if below minimum
  var MIN_EMPTY = 4;
  var emptyCount = 0;
  for (var r = 0; r < cfg.rows; r++)
    for (var c = 0; c < cfg.cols; c++)
      if (grid[r][c] === 'E') emptyCount++;

  if (emptyCount < MIN_EMPTY) {
    var extras = [];
    for (var r = 0; r < cfg.rows; r++) {
      for (var c = 0; c < cfg.cols; c++) {
        if (grid[r][c] !== 'B') continue;
        var adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                     .filter(function (t) { return t === 'B'; }).length;
        if (adjB >= 1) extras.push([r, c, adjB]);
      }
    }
    extras.sort(function (a, b) { return b[2] - a[2]; });
    for (var i = 0; i < extras.length && emptyCount < MIN_EMPTY; i++) {
      grid[extras[i][0]][extras[i][1]] = 'E';
      emptyCount++;
    }
  }

  var parkCandidates = [];
  for (var r = 0; r < cfg.rows; r++) {
    for (var c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'B') continue;
      var adjB2 = nbValues(grid, r, c, cfg.rows, cfg.cols)
                    .filter(function (t) { return t === 'B'; }).length;
      if (adjB2 >= 2) parkCandidates.push([r, c, adjB2]);
    }
  }
  parkCandidates.sort(function (a, b) {
    return (b[2] - a[2]) + (rng() - 0.5) * 0.6;
  });
  var parksPlaced = 0;
  for (var i = 0; i < parkCandidates.length && parksPlaced < cfg.parkCount; i++) {
    var pr = parkCandidates[i][0], pc = parkCandidates[i][1];
    var adjLive = nbValues(grid, pr, pc, cfg.rows, cfg.cols)
                    .filter(function (t) { return t === 'B'; }).length;
    if (adjLive < 2) continue;
    grid[pr][pc] = 'P';
    parksPlaced++;
  }

  return { grid: grid, seed: seed, config: cfg, roadRows: roadRows, roadCols: roadCols };
}

function validateMap(grid, cfg) {
  var counts = {}, emptyWithAdj = 0;
  for (var r = 0; r < cfg.rows; r++) {
    for (var c = 0; c < cfg.cols; c++) {
      var t = grid[r][c];
      counts[t] = (counts[t] || 0) + 1;
      if (t === 'E') {
        var adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                     .filter(function (n) { return n === 'B' || n === 'P'; }).length;
        if (adjB > 0) emptyWithAdj++;
      }
    }
  }
  var issues = [];
  if ((counts.E || 0) < 4)  issues.push('Too few empty lots: '                + (counts.E || 0));
  if ((counts.R || 0) < 10) issues.push('Too few road tiles: '                 + (counts.R || 0));
  if (emptyWithAdj < 3)     issues.push('Too few empty lots adj buildings: '   + emptyWithAdj);
  return { counts: counts, emptyWithAdj: emptyWithAdj, valid: issues.length === 0, issues: issues };
}

// ── Test suites ────────────────────────────────────────────────────────────

function runTests(map) {
  const { grid, seed, config: cfg, roadRows, roadCols } = map;
  const failures = [];

  // 1. Grid dimensions
  if (grid.length !== cfg.rows)
    failures.push(`grid has ${grid.length} rows, expected ${cfg.rows}`);
  grid.forEach(function (row, r) {
    if (row.length !== cfg.cols)
      failures.push(`row ${r} has ${row.length} cols, expected ${cfg.cols}`);
  });

  // 2. All tiles are valid codes
  const VALID = { R: true, B: true, E: true, P: true };
  grid.forEach(function (row, r) {
    row.forEach(function (t, c) {
      if (!VALID[t]) failures.push(`unknown tile "${t}" at (${r},${c})`);
    });
  });

  // 3. Road count within config bounds
  const maxR = Math.min(cfg.maxRoads, Math.floor((cfg.rows - 1) / (cfg.minBlockSize + 1)));
  const maxC = Math.min(cfg.maxRoads, Math.floor((cfg.cols - 1) / (cfg.minBlockSize + 1)));
  if (roadRows.length < cfg.minRoads || roadRows.length > maxR)
    failures.push(`roadRows.length=${roadRows.length} outside [${cfg.minRoads},${maxR}]`);
  if (roadCols.length < cfg.minRoads || roadCols.length > maxC)
    failures.push(`roadCols.length=${roadCols.length} outside [${cfg.minRoads},${maxC}]`);

  // 4. Minimum block size — every gap between consecutive road lines >= minBlockSize
  function checkGaps(lines, axis) {
    for (let i = 1; i < lines.length; i++) {
      const gap = lines[i] - lines[i - 1] - 1; // non-road tiles between them
      if (gap < cfg.minBlockSize)
        failures.push(`${axis} gap between lines ${lines[i-1]} and ${lines[i]} is ${gap}, min is ${cfg.minBlockSize}`);
    }
  }
  checkGaps(roadRows, 'row');
  checkGaps(roadCols, 'col');

  // 5. Road lines are in-bounds and ascending
  roadRows.forEach(function (r, i) {
    if (r < 0 || r >= cfg.rows) failures.push(`roadRows[${i}]=${r} out of bounds`);
    if (i > 0 && r <= roadRows[i-1]) failures.push(`roadRows not strictly ascending at index ${i}`);
  });
  roadCols.forEach(function (c, i) {
    if (c < 0 || c >= cfg.cols) failures.push(`roadCols[${i}]=${c} out of bounds`);
    if (i > 0 && c <= roadCols[i-1]) failures.push(`roadCols not strictly ascending at index ${i}`);
  });

  // 6. Tile at declared road positions is actually 'R'
  roadRows.forEach(function (r) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== 'R') failures.push(`declared road row ${r} col ${c} is not R`);
    }
  });
  roadCols.forEach(function (c) {
    for (let r = 0; r < cfg.rows; r++) {
      if (grid[r][c] !== 'R') failures.push(`declared road col ${c} row ${r} is not R`);
    }
  });

  // 7. Empty lots always border ≥1 building or park
  grid.forEach(function (row, r) {
    row.forEach(function (t, c) {
      if (t !== 'E') return;
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                     .filter(function (n) { return n === 'B' || n === 'P'; }).length;
      if (adjB === 0) failures.push(`empty lot at (${r},${c}) has no adjacent building`);
    });
  });

  // 8. Parks have ≥2 building neighbours
  grid.forEach(function (row, r) {
    row.forEach(function (t, c) {
      if (t !== 'P') return;
      const adjB = nbValues(grid, r, c, cfg.rows, cfg.cols)
                     .filter(function (n) { return n === 'B'; }).length;
      if (adjB < 2) failures.push(`park at (${r},${c}) has only ${adjB} building neighbour(s), need ≥2`);
    });
  });

  // 9. validateMap reports valid
  const v = validateMap(grid, cfg);
  if (!v.valid) v.issues.forEach(function (issue) { failures.push('validateMap: ' + issue); });

  // 10. Determinism — re-running same seed gives identical grid
  const map2 = generateMap(Object.assign({}, cfg, { seed: seed }));
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[r][c] !== map2.grid[r][c]) {
        failures.push(`non-deterministic at (${r},${c}): first="${grid[r][c]}" second="${map2.grid[r][c]}"`);
      }
    }
  }

  return failures;
}

// ── Run ────────────────────────────────────────────────────────────────────

const cfg = Object.assign({}, CFG_PATCH);

let passed = 0, failed = 0;
const failedSeeds = [];

// Distribution tracking
const rowCounts = {}, colCounts = {};

const isSingleSeed = FIXED_SEED !== null;
const runs = isSingleSeed ? 1 : RUNS;

console.log(`\nCity Unblocked — map generation tests`);
console.log(`Config patch: ${JSON.stringify(CFG_PATCH) || 'none'}`);
console.log(`Running ${runs.toLocaleString()} map(s)...\n`);

for (let i = 0; i < runs; i++) {
  const seed = isSingleSeed ? FIXED_SEED : undefined;
  const map  = generateMap(seed != null ? Object.assign({}, cfg, { seed }) : cfg);

  // Track road count distribution
  const rk = map.roadRows.length, ck = map.roadCols.length;
  rowCounts[rk] = (rowCounts[rk] || 0) + 1;
  colCounts[ck] = (colCounts[ck] || 0) + 1;

  const failures = runTests(map);
  if (failures.length === 0) {
    passed++;
  } else {
    failed++;
    failedSeeds.push({ seed: map.seed, failures });
    if (failedSeeds.length <= 5) {
      console.error(`FAIL  seed=${map.seed}`);
      failures.forEach(f => console.error(`      • ${f}`));
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`Results:  ${passed} passed  /  ${failed} failed  /  ${runs} total`);
console.log('');

if (isSingleSeed && runs === 1) {
  const map = generateMap(Object.assign({}, cfg, { seed: FIXED_SEED }));
  console.log('Grid:');
  map.grid.forEach(row => console.log('  ' + row.join(' ')));
  console.log(`roadRows: [${map.roadRows}]`);
  console.log(`roadCols: [${map.roadCols}]`);
  console.log('');
}

if (!isSingleSeed) {
  console.log('Road row count distribution:');
  Object.keys(rowCounts).sort().forEach(k =>
    console.log(`  ${k} road rows: ${rowCounts[k].toLocaleString()} maps (${(rowCounts[k]/runs*100).toFixed(1)}%)`));
  console.log('Road col count distribution:');
  Object.keys(colCounts).sort().forEach(k =>
    console.log(`  ${k} road cols: ${colCounts[k].toLocaleString()} maps (${(colCounts[k]/runs*100).toFixed(1)}%)`));
}

if (failedSeeds.length > 5) {
  console.log(`\n...and ${failedSeeds.length - 5} more failures. First 5 shown above.`);
  console.log('Failed seeds:', failedSeeds.map(f => f.seed).join(', '));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
