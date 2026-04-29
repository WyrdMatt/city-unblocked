# Make It Liveable

A browser-based city planning game where you improve a congested city by placing urban interventions within a budget. Every playthrough generates a new random city layout.

## How to play

You start with a congested city: **Happiness 20**, **Congestion 80**, **Budget £500**.

**Goal:** reduce congestion to **≤ 30** and raise happiness to **≥ 70** before you run out of money.

Select an action from the right panel, then click an eligible tile on the map to place it. Each action costs money and has a different effect on congestion and happiness — but placing the same type repeatedly gives diminishing returns, and parks/bus stops gain bonus effects when placed next to buildings.

| Action | Cost | Effect |
|---|---|---|
| 🚌 Bus Stop | £80 | –10 congestion, +6 happiness (bonus near buildings) |
| 🚲 Bike Lane | £60 | –6 congestion, +8 happiness |
| 🅿️ Parking Garage | £120 | –8 congestion, +4 happiness |
| 🌳 Park | £60 | –4 congestion, +12 happiness (bonus near buildings) |

**Placement rules:** bus stops and parking garages go on road tiles; bike lanes and parks go on empty lots.

**Win rating** is based on budget remaining:
- ⭐⭐⭐ — £200+ left
- ⭐⭐ — £100–199 left
- ⭐ — any win

## Running locally

```bash
npx serve .
# open http://localhost:8080
```

No build step, no dependencies — it's a single `index.html` file.

## Architecture

Everything is in `index.html` — one self-contained file with inline CSS and six `<script>` blocks in load order:

| Block | Responsibility |
|---|---|
| `hud` | DOM refs, `refreshHUD()`, win/lose overlays, music toggle |
| `game-state` | `gameState`, `updateMeters()`, `checkWinLose()`, `restartGame()` |
| `mapgen` | Seeded PRNG, `generateMap()`, `validateMap()`, `MAP_CONFIG` |
| `city-map` | `buildCityGrid(layout)`, tile click handler, road-direction logic |
| `actions-panel` | Button selection, tile placement, popup floaters, `updateActionAvailability()` |
| `animations` | Car / pedestrian `requestAnimationFrame` loop, `spawnParkPeds()` |

### Key globals

| Global | Set by | Description |
|---|---|---|
| `window.gameState` | game-state | `{ congestion, happiness, budget, turn, won }` |
| `window.cityGrid` | city-map | Array of `{ row, col, type, congestion, element }` |
| `window.currentMap` | city-map | `{ seed, grid }` from last `generateMap()` call |
| `window.MAP_CONFIG` | mapgen | `{ rows, cols, roadSpacing, emptyRate, parkCount }` |

### Map generation

`generateMap(userConfig?)` uses a mulberry32 seeded PRNG to produce a 10×10 grid of road/building/empty/park tiles driven by `MAP_CONFIG`. The seed is shown in the info bar below the map for sharing. Every reset generates a fresh map.

### Diminishing returns

Each additional placement of the same action type multiplies the effect by `0.85^(n-1)`, so the first bus stop is full value and each extra is 15% weaker.

### Adjacency bonuses

- **Park** next to a building: +3 happiness per adjacent building tile
- **Bus Stop** next to a building: –2 congestion per adjacent building tile

## Roadmap / future ideas

- Larger map sizes (configurable via `MAP_CONFIG`)
- Difficulty levels via blocker tiles and weather effects that reduce action impact
- Multiple scenarios / campaign mode
