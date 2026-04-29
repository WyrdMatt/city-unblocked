# CLAUDE.md — Make It Liveable

Context for AI sessions working on this project.

## Project overview

Browser game — city planning puzzle. Works on both desktop and mobile. The canonical source is `index.html` (CSS + HTML + JS). Pure logic extracted into `src/` is tested via Vitest.

Run locally: `npm run dev` → http://localhost:5173

## File structure

```
index.html              ← entire game (CSS + HTML + 6 JS blocks)
src/
  game-logic.js         ← pure game logic (ES module, tested)
  radial-logic.js       ← radial menu pure logic (ES module, tested)
tests/
  effects.test.js       ← calculateEffects, checkWinCondition
  balance.test.js       ← balance simulations
  mapgen.test.js        ← map generation fuzzing (5000 seeds)
  radial.test.js        ← ACTIONS, getValidActions, getRadialPosition, getButtonPositions
.claude/commands/
  sync-check.md         ← /sync-check skill: flags value drift between index.html and src/
  mobile-audit.md       ← /mobile-audit skill: checks mobile-readiness of index.html
README.md               ← player-facing docs
CLAUDE.md               ← this file
```

Legacy reference copies (`game-state.js`, `hud.js`, `actions-panel.js`, etc.) are not used at runtime.

## Script block load order (inside index.html)

1. **hud** — DOM element refs, `refreshHUD()`, `showWinScreen()`, `showGameOverScreen()`, music toggle
2. **game-state** — `window.gameState`, `updateMeters()`, `checkWinLose()`, `restartGame()`
3. **mapgen** — `generateMap()`, `validateMap()`, `window.MAP_CONFIG`; exposes seeded PRNG
4. **city-map** — `buildCityGrid(layout)`, tile click listener, road-direction helper
5. **actions-panel** — radial fan menu, tile placement, popup floaters, `updateActionAvailability()`
6. **animations** — `requestAnimationFrame` loop for cars/pedestrians, `spawnParkPeds(parkTiles)`

Each block depends on the ones above it. Do not reorder.

## Key globals

| Global | Owner | Shape |
|---|---|---|
| `window.gameState` | game-state | `{ congestion, happiness, budget, turn, won }` |
| `window.cityGrid` | city-map | `Array<{ row, col, type, congestion, element }>` |
| `window.currentMap` | city-map | `{ seed, grid, roadRows, roadCols, config }` |
| `window.MAP_CONFIG` | mapgen | `{ rows, cols, minRoads, maxRoads, emptyRate, parkCount }` |
| `window.refreshHUD` | hud | updates all meter DOM elements |
| `window.refreshTile` | city-map | redraws one road tile's congestion colour |
| `window.buildCityGrid` | city-map | tears down tiles, rebuilds from a layout grid |
| `window.generateMap` | mapgen | returns `{ seed, grid, roadRows, roadCols, config }` |
| `window.spawnParkPeds` | animations | spawns wandering pedestrians at park tile coords |
| `window.rebuildAnimations` | animations | clears + rebuilds all animation elements from a map |
| `window.updateActionAvailability` | actions-panel | refreshes live effect values in reference panel |

## Game constants (game-state block)

```js
INITIAL = { congestion: 80, happiness: 20, budget: 500, turn: 0, won: false }
WIN_HAPPINESS  = 70   // happiness must reach this
WIN_CONGESTION = 30   // congestion must fall to or below this
EFFECTS = {
  "bus-stop":       { congestion: -10, happiness: +6  },
  "bike-lane":      { congestion:  -6, happiness: +8  },
  "parking-garage": { congestion:  -8, happiness: +4  },
  "park":           { congestion:  -4, happiness: +12 },
  "road-widening":  { congestion: -15, happiness: -5  },
}
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
| `bus-stop` | 🚌 | Bus Stop | £80 | road | –10 congestion, +6 happiness |
| `bike-lane` | 🚲 | Bike Lane | £40 | road | –6 congestion, +8 happiness |
| `parking-garage` | 🅿️ | Parking | £120 | building | –8 congestion, +4 happiness |
| `park` | 🌳 | Park | £60 | empty | –4 congestion, +12 happiness |
| `road-widening` | 🚧 | Road Widening | £90 | road | –15 congestion, –5 happiness |

## Mechanics

**Diminishing returns:** `effect × 0.85^(n-1)` where n is how many of the same action type have already been placed.

**Adjacency bonuses (in updateMeters):**
- Park next to building tile: +3 happiness per neighbour
- Bus stop next to building tile: –2 congestion per neighbour

**Goal markers** sit at `left: 70%` (happiness bar) and `left: 30%` (congestion bar) — these match WIN_HAPPINESS / WIN_CONGESTION exactly.

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
- ⭐⭐ — £100–199
- ⭐ — any win

## Development workflow

**Always run tests before committing:**
```
npm test
```
All **126 tests** across 4 suites must pass before any commit.

**Toolchain:** Vite (dev server) + Vitest (test runner). Run `npm install` once after checkout.

```
npm run dev      # start Vite dev server → http://localhost:5173
npm test         # run all 126 Vitest tests
npm run build    # production build to dist/
```

**Test files:**
- `tests/effects.test.js` — calculateEffects, checkWinCondition
- `tests/balance.test.js` — balance simulations
- `tests/mapgen.test.js`  — map generation fuzzing with 5000 seeds
- `tests/radial.test.js`  — ACTIONS, getValidActions, getRadialPosition, getButtonPositions (40 tests)

**Commit convention:** Conventional Commits.
Format: `type: short description` where type is `feat`, `refactor`, `fix`, `test`, or `chore`.
Always append the Co-Authored-By trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Never commit directly to `main`. Never use `--no-verify`.

## GitHub

Repo: https://github.com/WyrdMatt/city-unblocked
Active branch: `main` (create feature branches, merge to `main`)
Live: https://idyllic-cannoli-358897.netlify.app/ (auto-deploys from `main`)

## Skills

- `/sync-check` — greps `src/game-logic.js` and `index.html` for key constants and flags any value mismatches
- `/mobile-audit` — checks hardcoded px in animations, touch-action on interactive elements, media query breakpoint, dynamic --tile-size, tap target sizes
- `/animation-audit` — checks the reactive animation system: car speed/stop-go from congestion, ped density/speed from happiness, generator --firing indicator, syncRoadCongestion wiring, weather ped multipliers

## Future scaling hooks

`MAP_CONFIG` is designed to be extended:
- `blockerRate` — impassable tiles that force route choices
- `weatherZones` — areas where action effects are reduced
- Larger grid sizes by changing `rows`/`cols`
