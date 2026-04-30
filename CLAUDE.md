# CLAUDE.md — Make It Liveable

Context for AI sessions working on this project.

## Project overview

Browser game — city planning puzzle. Works on both desktop and mobile. The canonical source is `index.html` (CSS + HTML + JS). Pure logic extracted into `src/` is tested via Vitest.

Run locally: `npm run dev` → http://localhost:5173

## File structure

```
index.html              ← entire game (CSS + HTML + 7 JS blocks)
src/
  game-logic.js         ← pure game logic (ES module, tested)
  radial-logic.js       ← radial menu pure logic (ES module, tested)
tests/
  effects.test.js       ← calculateEffects, checkWinCondition
  balance.test.js       ← balance simulations
  mapgen.test.js        ← map generation fuzzing (5000 seeds)
  radial.test.js        ← ACTIONS, getValidActions, getRadialPosition, getButtonPositions
  puzzle-mechanics.test.js ← ZONE_CAP, GENERATOR_DELTA, DEMOLISH_COST, getBlockId, checkZoneCap, applyGeneratorTick
.claude/commands/
  sync-check.md         ← /sync-check skill: flags value drift between index.html and src/
  mobile-audit.md       ← /mobile-audit skill: checks mobile-readiness of index.html
  animation-audit.md    ← /animation-audit skill: checks reactive animation system
  commit.md             ← /commit skill: runs tests, stages, commits with Conventional Commits
  test.md               ← /test skill: runs full test suite and reports results
README.md               ← player-facing docs
CLAUDE.md               ← this file
```

Legacy reference copies (`game-state.js`, `hud.js`, `actions-panel.js`, etc.) are not used at runtime.

## Script block load order (inside index.html)

1. **hud** — DOM element refs, `refreshHUD()`, `showWinScreen()`, `showGameOverScreen()`, undo logic (`doUndo`), share-score button, music/SFX toggle buttons wired
2. **game-state** — `window.gameState`, `updateMeters()`, `checkWinLose()`, `restartGame()`, difficulty presets, puzzle-mechanic constants
3. **mapgen** — `generateMap()`, `validateMap()`, `window.MAP_CONFIG`; exposes seeded PRNG
4. **city-map** — `buildCityGrid(layout)`, tile click listener, road-direction helper, blocker demolish
5. **actions-panel** — radial fan menu, tile placement, popup floaters, `updateActionAvailability()`, placement preview
6. **animations** — `requestAnimationFrame` loop for cars/pedestrians, ambient music (4-layer city soundscape), SFX system (`window.playSFX`, `window.toggleMusic`, `window.toggleSFX`)
7. **landing-page** — difficulty selection, Play button, audio toggles on landing overlay, tutorial/briefing trigger

Each block depends on the ones above it. Do not reorder.

## Key globals

| Global | Owner | Shape / purpose |
|---|---|---|
| `window.gameState` | game-state | `{ congestion, happiness, budget, turn, turnLimit, won }` |
| `window.cityGrid` | city-map | `Array<{ row, col, type, congestion, element }>` |
| `window.currentMap` | city-map | `{ seed, grid, roadRows, roadCols, config }` |
| `window.MAP_CONFIG` | mapgen | `{ rows, cols, minRoads, maxRoads, emptyRate, parkCount }` |
| `window.currentWeather` | game-state | string — one of `WEATHER_TYPES` |
| `window.currentDifficulty` | game-state | `'easy' \| 'normal' \| 'hard'` |
| `window.DIFFICULTY_PRESETS` | game-state | `{ easy, normal, hard }` — budget, turnLimit, blockerRate, generatorCount |
| `window.GAME_LOGIC` | game-state | exposes EFFECTS, COMBOS, WEATHER_META, WEATHER_MULTIPLIERS, CITY_PROFILES, CONGESTION_SURCHARGE_ACTIONS, ROAD_WIDENING_BUILDING_BONUS, and pure functions: calculateEffects, checkWinCondition, getGridNeighbours, getBlockId, checkZoneCap, applyGeneratorTick, applyGeneratorTickFull, getCongestSurcharge, calculateRoadWideningBonus |
| `window.lastPlacement` | hud | `{ element, action, cost }` — single-step undo snapshot; null when nothing to undo |
| `window.refreshHUD` | hud | updates all meter DOM elements |
| `window.showWinScreen` | hud | renders win overlay with stars + stats |
| `window.showGameOverScreen` | hud | renders game-over overlay (budget or turns exhausted) |
| `window.refreshTile` | city-map | redraws one road tile's congestion colour |
| `window.buildCityGrid` | city-map | tears down tiles, rebuilds from a layout grid |
| `window.generateMap` | mapgen | returns `{ seed, grid, roadRows, roadCols, config }` |
| `window.spawnParkPeds` | animations | spawns wandering pedestrians at park tile coords |
| `window.rebuildAnimations` | animations | clears + rebuilds all animation elements from a map |
| `window.toggleMusic` | animations | toggles ambient music on/off; updates HUD + landing buttons |
| `window.toggleSFX` | animations | toggles SFX on/off; updates HUD + landing buttons |
| `window.playSFX` | animations | `playSFX(type)` — no-op if `sfxEnabled` false; types: `place`, `undo`, `demolish`, `win`, `lose`, `tick` |
| `window.sfxEnabled` | animations | boolean — SFX on/off state (default `false`) |
| `window.updateActionAvailability` | actions-panel | refreshes live effect values in reference panel |
| `window.setDifficulty` | game-state | sets `window.currentDifficulty` and resets presets |

## Game constants (game-state block)

```js
WIN_HAPPINESS  = 70   // happiness must reach this (default profile)
WIN_CONGESTION = 30   // congestion must fall to or below this (default profile)

EFFECTS = {
  "bus-stop":          { congestion: -10, happiness:  +6, carbon:  -3 },
  "bike-lane":         { congestion:  -6, happiness:  +8, carbon:  -5 },
  "parking-garage":    { congestion:  -8, happiness:  +4, carbon:  +4 },
  "park":              { congestion:  -4, happiness: +12, carbon:  -6 },
  "road-widening":     { congestion: -15, happiness:  -5, carbon:  +8 },
  "ev-charging":       { congestion:  -3, happiness:  +2, carbon:  -8 },
  "self-driving-taxi": { congestion:  -8, happiness: +10, carbon:  -4 },
  "industrial-dev":    { congestion:  +5, happiness: -10, carbon: +12 },
}

DIFFICULTY_PRESETS = {
  easy:   { budget: 900, turnLimit: 25, blockerRate: 0,    generatorCount: 1 },
  normal: { budget: 650, turnLimit: 20, blockerRate: 0.03, generatorCount: 2 },
  hard:   { budget: 480, turnLimit: 15, blockerRate: 0.06, generatorCount: 2 },
  expert: { budget: 300, turnLimit: 10, blockerRate: 0.10, generatorCount: 3 },
}

ZONE_CAP                    = 2   // max same-action placements per city block
GENERATOR_DELTA             = 3   // congestion added per unsuppressed generator each tick
DEMOLISH_COST               = 50  // cost to demolish a blocker tile
ROAD_WIDENING_BUILDING_BONUS = 25  // £ income per adjacent building when road-widening placed
CONGESTION_SURCHARGE_ACTIONS = Set of 5 road actions that cost more when congestion > 70/85
```

## Interaction model (desktop + mobile)

**Radial fan menu** — the only way to place actions:
1. Tap/click any unplaced tile → a fan of 5 action buttons springs open above the finger
2. Tap a button → action placed, radial closes
3. Tap the same tile again → radial closes (toggle)
4. Tap a different tile → radial switches immediately to new tile
5. Tap anywhere else (empty space) → radial closes

Buttons show state: available (full opacity), wrong-tile (greyed, 32%), unaffordable (greyed, 50%). Invalid buttons cannot be tapped.

**Actions panel** (desktop sidebar) is **read-only reference** — shows costs and live effect values but has no click handlers. Hidden on mobile (≤640px).

## Actions

| Key | Emoji | Label | Cost | Valid tile | Effect |
|---|---|---|---|---|---|
| `bus-stop` | 🚌 | Bus Stop | £80 | road | –10 cong, +6 hap, –3 carbon |
| `bike-lane` | 🚲 | Bike Lane | £40 | road | –6 cong, +8 hap, –5 carbon |
| `parking-garage` | 🅿️ | Parking | £120 | building | –8 cong, +4 hap, +4 carbon |
| `park` | 🌳 | Park | £60 | empty | –4 cong, +12 hap, –6 carbon |
| `road-widening` | 🚧 | Road Widening | £90 | road | –15 cong, –5 hap, +8 carbon; +£25/adj building returned |
| `ev-charging` | 🔋 | EV Charging | £70 | road | –3 cong, +2 hap, –8 carbon |
| `self-driving-taxi` | 🤖 | Self-Driving Taxi | £110 | road | –8 cong, +10 hap, –4 carbon |
| `industrial-dev` | 🏗️ | Industrial Dev | free | building | +5 cong, –10 hap, +12 carbon; returns +£80 budget |

Road actions (bus-stop, bike-lane, road-widening, ev-charging, self-driving-taxi) cost +10% when congestion >70, +20% when >85.

## Mechanics

**Diminishing returns:** `effect × 0.85^(n-1)` where n is how many of the same action type have already been placed.

**Adjacency bonuses (in updateMeters):**
- Park next to building tile: +3 happiness per neighbour
- Bus stop next to building tile: –2 congestion per neighbour

**Combo bonuses:** Adjacent placements of specific pairs trigger extra effects (11 combos: Transit Hub, Pedestrian Zone, Active Streets, Green Network, Park & Ride, Express Lane, Green Gateway, Commuter Link, Industrial Bypass, Clean Commute, Seamless Network). Checked in `calculateEffects`.

**Zone caps:** Max `ZONE_CAP` (2) placements of the same action type per city block. Cap scales up for large blocks: `max(2, floor(validTiles/2))`.

**Generator tiles (🏭):** Placed on building cells adjacent to roads during mapgen. Each unsuppressed generator adds `GENERATOR_DELTA` (+3) congestion every `updateMeters()` call. Suppressed by any orthogonally adjacent road action (`bus-stop`, `bike-lane`, `road-widening`). Pulses red (`.generator--firing`) when active.

**Demolishable blockers (🚧):** `blockerRate` fraction of empty cells become impassable blockers. Clicking one spends `DEMOLISH_COST` (£50) and converts it to an empty lot.

**Road-widening income (Section H):** Placing road-widening adjacent to building/commercial/arena tiles refunds £25 per adjacent building back to budget. Shown in popup and radial preview.

**Congestion surcharge (Section L):** Road actions (bus-stop, bike-lane, road-widening, ev-charging, self-driving-taxi) cost an extra 10% when congestion >70, or 20% when >85. Shown in radial cost display (⚠️ prefix) and action panel. Surcharge is applied to both the affordability check and the actual deduction.

**Weather system:** Each turn has a weather type (sunny, rainy, overcast, snowy, stormy) that modifies action effectiveness via `WEATHER_MULTIPLIERS`. EV charging and self-driving taxis are strongest in sunny conditions and severely impaired in snow/storms. Bus stops get buffed in bad weather.

**City profiles:** Each game has a city profile (standard, green, transit, vibrant, eco) with different win thresholds. Checked in `checkWinCondition(state, profileKey)`.

**Carbon meter:** Third meter (alongside congestion and happiness). Actions have carbon effects; carbon ≥100 is an automatic loss. Some profiles require carbon ≤30 or ≤20 to win.

**Single-step undo:** `window.lastPlacement` holds the most recent placement snapshot (stores `actualCost` after surcharge, and `totalBudgetGain` including road-widening income). `doUndo()` (↩ button / Ctrl+Z) reverses it and decrements the turn counter.

**Radial preview (Section K):** Preview in radial fan buttons uses `calculateEffects` with a hypothetical placement to show accurate marginal deltas (congestion, happiness, carbon), including combo bonuses and adjacency effects.

**Goal markers** sit at `left: 70%` (happiness bar) and `left: 30%` (congestion bar) — these match WIN_HAPPINESS / WIN_CONGESTION exactly.

## Audio system (animations block)

**Ambient music** (`window.toggleMusic`) — retro 90s arcade chiptune, default OFF:
- 140 BPM scheduler loop; 32-step patterns cycle through 3 melody variations (A: flowing runs, B: syncopated, C: sparse stabs) — never the same phrase twice in a row
- Square-wave melody + filtered sawtooth bass (lowpass 300 Hz) + kick/snare/hi-hat percussion
- Percussion alternates between steady groove and fill pattern (~33% fill chance per loop)
- DynamicsCompressor tames square-wave peaks; master gain 0.20

**SFX** (`window.playSFX(type)`) — default ON, gated by `window.sfxEnabled`:
- `place` — marimba plonk (C5 + G5 triangles)
- `undo` — descending A4→E4 slide
- `demolish` — low sine pitch-drop (floor tom)
- `win` — ascending C-E-G-C arpeggio
- `lose` — descending E4-Db4-A3 minor chord
- `tick` — subtle 880 Hz click; fired on ALL button clicks via delegated listener (except radial-btn which fires 'place', and #hudUndo which fires 'undo')

Both use a shared `sfxCtx` (separate from `audioCtx`). SFX always awaits `ctx.resume()` before scheduling to avoid static on first use.

## Mobile support

- `--tile-size: clamp(30px, calc((100vw - 60px) / 10), 80px)` — grid fills any viewport width
- At ≤640px: action panel hidden, HUD compressed to 2 rows, `#game-area` padding reduced
- No minimum screen-size blocker; game works on all devices
- Animation geometry re-reads `--tile-size` on every `rebuildAnimations()` call and on window resize

## Map generation

`generateMap(userConfig?)` merges `userConfig` into `MAP_CONFIG`, seeds mulberry32, then:
1. Picks 2–3 road rows and 2–3 road columns with minimum block gaps
2. Fills non-road cells with buildings (B)
3. Randomly converts `emptyRate` fraction of building cells adjacent to buildings to empty lots (E)
4. Places `parkCount` parks (P) on high-adjacency building cells
5. Places generator tiles (G) on building cells adjacent to roads (count from difficulty preset)
6. Places blocker tiles (X) on empty cells at `blockerRate` fraction

`validateMap(grid, cfg)` can be called from the browser console to assert counts.

The seed is shown in `#info-bar` below the map. `restartGame()` generates a new map.

## Animation layer

`#city-grid` contains `.tile` elements AND absolutely-positioned animation + weather layers. When rebuilding the grid, always use:
```js
gridEl.querySelectorAll('.tile').forEach(el => el.remove())
```
**Never** use `innerHTML = ''` — it destroys the animation layers.

Tiles animate in with a diagonal stagger (`animation-delay: (row+col)*15ms`) on each `buildCityGrid` call.

## HUD star rating (win screen)

Calculated in `showWinScreen()` from budget remaining:
- ⭐⭐⭐ — £200+
- ⭐⭐ — £80–199
- ⭐ — any win

## Development workflow

**Always run tests before committing:**
```
npm test
```
All **389 Vitest tests** across 8 suites must pass before any commit.

**Toolchain:** Vite (dev server) + Vitest (test runner) + Playwright (layout tests). Run `npm install` once after checkout.

```
npm run dev        # start Vite dev server → http://localhost:5173
npm test           # run all 389 Vitest tests
npm run test:layout  # run 54 Playwright mobile layout tests (needs dev server)
npm run test:all   # run Vitest + Playwright
npm run build      # production build to dist/
```

**Test files:**
- `tests/effects.test.js` — calculateEffects, checkWinCondition, getCongestSurcharge, calculateRoadWideningBonus, weather multipliers (123 tests)
- `tests/balance.test.js` — balance simulations (45 tests)
- `tests/mapgen.test.js`  — map generation fuzzing with 5000 seeds (30 tests)
- `tests/radial.test.js`  — ACTIONS, getValidActions, getRadialPosition, getButtonPositions (40 tests)
- `tests/puzzle-mechanics.test.js` — ZONE_CAP, GENERATOR_DELTA, DEMOLISH_COST, getBlockId, checkZoneCap, applyGeneratorTick (32 tests)
- `tests/decay.test.js`   — DECAY_RATES, passive meter decay (23 tests)
- `tests/profiles.test.js` — CITY_PROFILES, city profile win conditions (78 tests)
- `tests/building-subtypes.test.js` — commercial, arena adjacency bonuses (18 tests)
- `tests/mobile-layout.spec.js` — Playwright layout tests at 3 phone viewports (54 tests, run via `npm run test:layout`)

**Commit convention:** Conventional Commits.
Format: `type: short description` where type is `feat`, `refactor`, `fix`, `test`, or `chore`.
Always append the Co-Authored-By trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Never commit directly to `main`. Never use `--no-verify`.

## After every change — Definition of Done

Before marking any task complete or opening a PR, work through this checklist:

1. **Tests** — run `npm test`; all 389 Vitest tests must be green. If new pure logic was added to `src/`, write tests for it.
2. **CLAUDE.md** — update if: a new global was added, a mechanic changed, a constant changed, the test count changed, a new skill was added, or the audio/UI system changed.
3. **README.md** — update if: action costs/effects changed, new mechanics affect gameplay, win conditions changed, or running instructions changed.
4. **Skill files** (`.claude/commands/`) — update if their grep targets changed (new buttons added to touch-action rule, new constants in sync-check, etc.).
5. **`src/game-logic.js`** — if new pure logic (no DOM, no globals) was written inline in index.html and can be unit-tested, extract it here.
6. **Test count** — keep the count in CLAUDE.md and test.md accurate.

## GitHub

Repo: https://github.com/WyrdMatt/city-unblocked
Active branch: `main` (create feature branches, merge to `main`)
Live: https://idyllic-cannoli-358897.netlify.app/ (auto-deploys from `main`)

## Skills

- `/sync-check` — greps `src/game-logic.js` and `index.html` for key constants and flags any value mismatches
- `/mobile-audit` — checks hardcoded px in animations, touch-action on interactive elements, media query breakpoint, dynamic --tile-size, tap target sizes
- `/animation-audit` — checks the reactive animation system: car speed/stop-go from congestion, ped density/speed from happiness, generator --firing indicator, syncRoadCongestion wiring, weather ped multipliers
- `/commit` — runs tests, stages files, commits with Conventional Commits format
- `/test` — runs full test suite across all 5 suites and reports results

## Future scaling hooks

`MAP_CONFIG` is designed to be extended:
- `weatherZones` — areas where action effects are reduced
- Larger grid sizes by changing `rows`/`cols`
- Multiple scenarios / campaign mode
