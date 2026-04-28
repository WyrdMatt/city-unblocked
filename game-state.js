/**
 * game-state.js
 *
 * Core game state and logic for City Unblocked.
 *
 * Depends on (must already exist when this script runs):
 *   window.cityGrid          — array of tile objects { row, col, type, congestion, element }
 *   window.refreshHUD()      — updates the DOM meters          (hud.js)
 *   window.refreshTile()     — redraws a single road tile      (city-map.html)
 *   window.showWinScreen()   — shows the win overlay           (hud.js)
 *   window.showGameOverScreen() — shows the lose overlay       (hud.js)
 *
 * Load order: include AFTER hud.js — this file overrides the updateMeters and
 * checkWinLose stubs that hud.js sets.
 *
 * Exposes:
 *   window.gameState        — { congestion, happiness, budget, turn, won }
 *   window.updateMeters()   — recalculate state from the grid, then refresh HUD
 *   window.checkWinLose()   — returns "win" | "lose" | "playing"
 *   window.restartGame()    — reset everything to initial values
 */

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────

  const INITIAL = {
    congestion: 80,
    happiness:  20,
    budget:     500,
    turn:       0,
    won:        false,
  };

  /**
   * Per-tile effect of each placed action on global congestion and happiness.
   *
   * Balance target: spending the full £500 wisely should just reach win.
   *   e.g. 3× bus-stop (£240) + 2× bike-lane (£80) + 1× park (£60) + 1× parking-garage (£120) = £500
   *        congestion: 80 − 30 − 12 − 4 − 8  = 26  ✓ (≤ 30)
   *        happiness:  20 + 18 + 16 + 12 + 4  = 70  ✓ (≥ 70)
   */
  const EFFECTS = {
    "bus-stop":       { congestion: -10, happiness: +6  },
    "bike-lane":      { congestion:  -6, happiness: +8  },
    "parking-garage": { congestion:  -8, happiness: +4  },
    "park":           { congestion:  -4, happiness: +12 },
  };

  const WIN_HAPPINESS  = 70;  // happiness must reach this
  const WIN_CONGESTION = 30;  // congestion must fall to this

  // ── Initial state ──────────────────────────────────────────────────────────

  window.gameState = Object.assign({}, INITIAL);

  // ── updateMeters ───────────────────────────────────────────────────────────

  /**
   * Scan window.cityGrid for every placed action, recalculate congestion and
   * happiness from the base values, write the result into window.gameState,
   * sync road tile colours on the city map, and refresh the HUD.
   *
   * Called automatically by actions-panel.js after every tile placement.
   */
  window.updateMeters = function updateMeters() {
    if (!Array.isArray(window.cityGrid)) return;

    var congestionDelta = 0;
    var happinessDelta  = 0;

    window.cityGrid.forEach(function (tile) {
      var action = tile.element && tile.element.dataset.placedAction;
      if (!action) return;
      var effect = EFFECTS[action];
      if (!effect) return;
      congestionDelta += effect.congestion;
      happinessDelta  += effect.happiness;
    });

    var gs = window.gameState;
    gs.congestion = Math.max(0, Math.min(100, INITIAL.congestion + congestionDelta));
    gs.happiness  = Math.max(0, Math.min(100, INITIAL.happiness  + happinessDelta));
    gs.turn++;

    syncRoadCongestion(gs.congestion);

    if (typeof window.refreshHUD === "function") window.refreshHUD();
  };

  // ── checkWinLose ───────────────────────────────────────────────────────────

  /**
   * Evaluate win / lose conditions against the current gameState.
   *
   *   Win:  happiness >= 70  AND  congestion <= 30
   *   Lose: budget <= 0  AND  win conditions not met
   *
   * Triggers the appropriate HUD overlay when a terminal state is first reached.
   *
   * @returns {"win" | "lose" | "playing"}
   */
  window.checkWinLose = function checkWinLose() {
    var gs = window.gameState;
    if (!gs) return "playing";

    // Don't re-evaluate after the game is already won
    if (gs.won) return "win";

    var happiness  = gs.happiness  ?? 0;
    var congestion = gs.congestion ?? 0;
    var budget     = gs.budget     ?? 0;

    if (happiness >= WIN_HAPPINESS && congestion <= WIN_CONGESTION) {
      gs.won = true;
      if (typeof window.showWinScreen === "function") window.showWinScreen();
      return "win";
    }

    if (budget <= 0) {
      if (typeof window.showGameOverScreen === "function") window.showGameOverScreen();
      return "lose";
    }

    return "playing";
  };

  // ── restartGame ────────────────────────────────────────────────────────────

  /**
   * Reset gameState to initial values and clear all placed-action overlays
   * from every tile in window.cityGrid.
   *
   * hud.js restart buttons call this automatically if it is defined.
   */
  window.restartGame = function restartGame() {
    Object.assign(window.gameState, INITIAL);

    if (Array.isArray(window.cityGrid)) {
      window.cityGrid.forEach(function (tile) {
        var el = tile.element;
        if (!el) return;
        delete el.dataset.placedAction;
        delete el.dataset.placedCost;
        el.style.removeProperty("--tile-placed-color");
        el.classList.remove("tile--placed");
        el.textContent = "";
        el.removeAttribute("aria-label");
      });
    }

    syncRoadCongestion(INITIAL.congestion);

    if (typeof window.refreshHUD === "function") window.refreshHUD();
  };

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Map the global congestion score (0–100) onto every road tile's per-tile
   * congestion (0–1), then call window.refreshTile() to update road colours.
   */
  function syncRoadCongestion(globalCongestion) {
    if (!Array.isArray(window.cityGrid)) return;
    if (typeof window.refreshTile !== "function") return;

    var perTile = globalCongestion / 100;

    window.cityGrid
      .filter(function (t) { return t.type === "road"; })
      .forEach(function (t) {
        t.congestion = perTile;
        window.refreshTile(t);
      });
  }

})();
