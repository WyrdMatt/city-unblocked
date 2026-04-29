# Make It Liveable

A browser-based city planning puzzle where you improve a congested city by placing urban interventions within a budget and turn limit. Every playthrough generates a new random city layout.

## How to play

You start with a congested city: **Happiness 20**, **Congestion 80**, and a budget + turn limit that depends on difficulty.

**Goal:** reduce congestion to **≤ 30** and raise happiness to **≥ 70** before you run out of money or turns.

Tap any eligible tile on the map — a radial fan menu springs open. Choose an action to place it. Each action costs money and has different effects on congestion and happiness, but placing the same type repeatedly gives diminishing returns. Parks and bus stops also gain bonus effects when placed next to buildings.

| Action | Cost | Valid tile | Effect |
|---|---|---|---|
| 🚌 Bus Stop | £80 | road | –10 congestion, +6 happiness (bonus near buildings) |
| 🚲 Bike Lane | £40 | road | –6 congestion, +8 happiness |
| 🅿️ Parking Garage | £120 | building | –8 congestion, +4 happiness |
| 🌳 Park | £60 | empty lot | –4 congestion, +12 happiness (bonus near buildings) |
| 🚧 Road Widening | £90 | road | –15 congestion, –5 happiness |

## Difficulty

| Level | Budget | Turns | Extras |
|---|---|---|---|
| Easy | £700 | 20 | 1 generator tile |
| Normal | £500 | 15 | 2 generators, some blockers |
| Hard | £350 | 12 | 2 generators, more blockers |

## Puzzle mechanics

**Diminishing returns:** `effect × 0.85^(n-1)` where n is how many of the same action type you've already placed.

**Adjacency bonuses:**
- Park next to a building: +3 happiness per adjacent building
- Bus Stop next to a building: –2 congestion per adjacent building

**Combo bonuses:** Placing certain action pairs next to each other triggers extra bonuses (Transit Hub, Green Corridor, Active Streets, etc.).

**Generator tiles 🏭:** Industrial buildings that add +3 congestion every recalculation unless suppressed by an adjacent road action (bus stop, bike lane, or road widening). Pulse red when active.

**Blocker tiles 🚧:** Impassable construction sites — demolish for £50 to convert them to buildable empty lots.

**Zone caps:** You can only place 2 of the same action type per city block, keeping strategy spread across the map.

**Single-step undo:** The ↩ button (or Ctrl+Z) reverses your last placement.

## Weather

Each game starts with a randomly chosen weather condition that modifies action effectiveness:

| Weather | Effect |
|---|---|
| ☀️ Sunny | Full effectiveness |
| 🌧️ Rainy | Bike lanes weaker |
| ☁️ Overcast | Slight penalty to all |
| ❄️ Snowy | Bike lanes very weak |
| ⛈️ Stormy | Road actions stronger; green actions weak |

## Win rating

Based on budget remaining when you win:
- ⭐⭐⭐ — £200+ left
- ⭐⭐ — £80–199 left
- ⭐ — any win

## Running locally

```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm test         # run all tests
```

## Architecture

Everything is in `index.html` — one self-contained file with inline CSS and six `<script>` blocks in load order:

| Block | Responsibility |
|---|---|
| `hud` | DOM refs, `refreshHUD()`, win/lose overlays, music toggle, undo |
| `game-state` | `gameState`, `updateMeters()`, `checkWinLose()`, `restartGame()`, difficulty presets |
| `mapgen` | Seeded PRNG, `generateMap()`, `validateMap()`, `MAP_CONFIG` |
| `city-map` | `buildCityGrid(layout)`, tile click handler, road-direction logic |
| `actions-panel` | Radial fan menu, tile placement, placement preview, popup floaters |
| `animations` | Car/pedestrian `requestAnimationFrame` loop, ambient music, SFX |

Pure game logic is also extracted to `src/game-logic.js` (ES module) and tested with Vitest — 175+ tests across 5 suites.

## Roadmap / future ideas

- Larger map sizes (configurable via `MAP_CONFIG`)
- Multiple scenarios / campaign mode
- Weather zones that reduce action impact in specific areas
