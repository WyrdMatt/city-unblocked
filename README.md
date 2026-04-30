# Make It Liveable

A browser-based city planning puzzle where you improve a congested city by placing urban interventions within a budget and turn limit. Every playthrough generates a new random city layout.

## How to play

You start with a congested city: **Congestion 55**, **Happiness 45**, **Carbon 35** — and all three meters are slowly getting worse every turn. You have a budget and a turn limit depending on difficulty.

**Goal:** hit the win thresholds for your randomly assigned City Profile before time or money runs out. Each profile has different targets (see below).

Tap any eligible tile on the map — a radial fan menu springs open showing predicted effect values. Choose an action to place it. Each action costs money and affects congestion, happiness, and carbon — but placing the same type repeatedly gives diminishing returns.

| Action | Cost | Valid tile | Effect |
|---|---|---|---|
| 🚌 Bus Stop | £80 | road | –10 cong, +6 hap, –3 carbon |
| 🚲 Bike Lane | £40 | road | –6 cong, +8 hap, –5 carbon |
| 🅿️ Parking Garage | £120 | building | –8 cong, +4 hap, +4 carbon |
| 🌳 Park | £60 | empty lot | –4 cong, +12 hap, –6 carbon |
| 🚧 Road Widening | £90 | road | –15 cong, –5 hap, +8 carbon; **refunds £25 per adjacent building** |
| 🔋 EV Charging | £70 | road | –3 cong, +2 hap, –8 carbon |
| 🤖 Self-Driving Taxi | £110 | road | –8 cong, +10 hap, –4 carbon |
| 🏗️ Industrial Dev | free | building | **+£80 budget**; +5 cong, –10 hap, +12 carbon |

## City Profiles

Each game randomly assigns one of five city profiles with different win targets:

| Profile | Goal |
|---|---|
| 🏙️ Standard | Cong ≤ 25, Hap ≥ 75 |
| 🌿 Green City | Cong ≤ 35, Hap ≥ 65, Carbon ≤ 30 |
| 🚌 Transit Hub | Cong ≤ 20, Hap ≥ 60 |
| 🎉 Vibrant City | Cong ≤ 40, Hap ≥ 85 |
| ♻️ Eco Warriors | Hap ≥ 70, Carbon ≤ 20 |

## Difficulty

| Level | Budget | Turns | Extras |
|---|---|---|---|
| Easy | £900 | 25 | 1 generator tile |
| Normal | £650 | 20 | 2 generators, some blockers |
| Hard | £480 | 15 | 2 generators, more blockers |
| Expert | £300 | 10 | 3 generators, heavy blockers |

## Puzzle mechanics

**Passive decay:** Every turn, congestion rises +1.5, happiness falls –1.5, and carbon rises +1.0. You must overcome this decay with your placements.

**Diminishing returns:** `effect × 0.85^(n-1)` where n is how many of the same action type you've already placed.

**Congestion surcharge:** Road actions (bus stop, bike lane, road widening, EV charging, self-driving taxi) cost **+10%** when congestion > 70, and **+20%** when > 85. Shown with ⚠️ in the cost display.

**Adjacency bonuses:**
- Park next to a building: +3 happiness per adjacent building
- Bus Stop next to a building: –2 congestion per adjacent building
- Road Widening next to a building: refunds £25 per adjacent building

**Combo bonuses:** Placing certain action pairs next to each other triggers extra bonuses — 11 combos including Transit Hub, Pedestrian Zone, Active Streets, Clean Commute, Seamless Network, and more. Diagonal adjacency gives 50% bonus.

**Generator tiles 🏭:** Industrial buildings that add +3 congestion and +2 carbon every turn unless suppressed by an adjacent road action (bus stop, bike lane, or road widening). Pulse red when active.

**Blocker tiles 🚧:** Impassable construction sites — demolish for £50 to convert them to empty lots.

**Zone caps:** You can only place 2 of the same action type per city block, keeping strategy spread across the map.

**Single-step undo:** The ↩ button (or Ctrl+Z) reverses your last placement.

**Automatic loss:** Congestion ≥ 100, Happiness ≤ 0, or Carbon ≥ 100 — any meter hitting its limit ends the game immediately.

## Weather

Each game starts with a randomly chosen weather condition that modifies action effectiveness:

| Weather | Notable effects |
|---|---|
| ☀️ Sunny | EV charging and self-driving taxis at peak performance |
| 🌧️ Rainy | Bike lanes and parks weaker; bus stops busier; EVs/taxis mildly reduced |
| ☁️ Overcast | Slight happiness penalty; self-driving taxi sensors less accurate |
| ❄️ Snowy | Bike lanes/EVs severely impaired; bus stops critical; taxis unreliable |
| ⛈️ Stormy | Only infrastructure works well; EVs and autonomous vehicles near-useless |

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

Pure game logic is also extracted to `src/game-logic.js` (ES module) and tested with Vitest — 389 tests across 8 suites.

## Roadmap / future ideas

- Larger map sizes (configurable via `MAP_CONFIG`)
- Multiple scenarios / campaign mode
- Weather zones that reduce action impact in specific areas
