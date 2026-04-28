# CLAUDE.md — City Unblocked

Context for AI sessions working on this project.

## Project overview

Single-file browser game. All code lives in `index.html` — no build step, no bundler, no npm. Separate source files (`hud.js`, `game-state.js`, `actions-panel.js`, etc.) exist for historical reference but are **not used at runtime**; the canonical source is `index.html`.

Run locally with `npx serve .` — open http://localhost:8080.

## File structure

```
index.html          ← entire game (CSS + HTML + 6 JS blocks)
game-state.js       ← legacy reference copy (not loaded at runtime)
hud.js / hud.css    ← legacy reference copies
actions-panel.js / .css / .html  ← legacy reference copies
city-map.html       ← legacy reference copy
README.md           ← player-facing documentation
CLAUDE.md           ← this file
```

## Script block load order (inside index.html)

1. **hud** — DOM element refs, `refreshHUD()`, `showWinScreen()`, `showGameOverScreen()`, music toggle
2. **game-state** — `window.gameState`, `updateMeters()`, `checkWinLose()`, `restartGame()`
3. **mapgen** — `generateMap()`, `validateMap()`, `window.MAP_CONFIG`; exposes seeded PRNG
4. **city-map** — `buildCityGrid(layout)`, tile click listener, road-direction helper
5. **actions-panel** — button selection, tile placement, popup floaters, `updateActionAvailability()`
6. **animations** — `requestAnimationFrame` loop for cars/pedestrians, `spawnParkPeds(parkTiles)`

Each block depends on the ones above it. Do not reorder.

## Key globals

| Global | Owner | Shape |
|---|---|---|
| `window.gameState` | game-state | `{ congestion, happiness, budget, turn, won }` |
| `window.cityGrid` | city-map | `Array<{ row, col, type, congestion, element }>` |
| `window.currentMap` | city-map | `{ seed: number, grid: string[][] }` |
| `window.MAP_CONFIG` | mapgen | `{ rows, cols, roadSpacing, emptyRate, parkCount }` |
| `window.refreshHUD` | hud | updates all meter DOM elements |
| `window.refreshTile` | city-map | redraws one road tile's congestion colour |
| `window.buildCityGrid` | city-map | tears down tiles, rebuilds from a layout grid |
| `window.generateMap` | mapgen | returns `{ seed, grid }` |
| `window.spawnParkPeds` | animations | spawns wandering pedestrians at park tile coords |
| `window.updateActionAvailability` | actions-panel | updates button disabled state and live effect values |

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
}
```

## Mechanics

**Diminishing returns:** `effect × 0.85^(n-1)` where n is how many of the same action type have already been placed.

**Adjacency bonuses (in updateMeters):**
- Park next to building tile: +3 happiness per neighbour
- Bus stop next to building tile: –2 congestion per neighbour

**Placement rules (data attributes on buttons):**
- `data-valid-tiles="road"` → bus stop, parking garage
- `data-valid-tiles="empty"` → bike lane, park

**Goal markers** sit at `left: 70%` (happiness bar) and `left: 30%` (congestion bar) — these match WIN_HAPPINESS / WIN_CONGESTION exactly.

## Map generation

`generateMap(userConfig?)` merges `userConfig` into `MAP_CONFIG`, seeds mulberry32 with `Date.now()`, then:
1. Lays a road skeleton on every `roadSpacing`-th row and column
2. Fills non-road cells with buildings
3. Randomly converts `emptyRate` fraction of building cells to empty lots
4. Places `parkCount` parks on empty cells

`validateMap(grid, cfg)` can be called from the browser console to assert counts.

The seed is shown in `#info-bar` below the map for reproduction. `restartGame()` calls `generateMap()` to produce a new map on every reset.

## Animation layer

`#city-grid` contains `.tile` elements AND an absolutely-positioned animation layer. When rebuilding the grid, always use:
```js
gridEl.querySelectorAll('.tile').forEach(el => el.remove())
```
**Never** use `innerHTML = ''` — it destroys the animation layer.

## HUD star rating (win screen)

Calculated in `showWinScreen()` from budget remaining:
- ⭐⭐⭐ — £200+
- ⭐⭐ — £100–199
- ⭐ — any win

## GitHub

Repo: https://github.com/WyrdMatt/city-unblocked  
Branch: `main`

## Future scaling hooks

`MAP_CONFIG` is designed to be extended. Planned additions noted in comments:
- `blockerRate` — impassable tiles that force route choices
- `weatherZones` — areas where action effects are reduced
- Larger grid sizes by changing `rows`/`cols`
