/**
 * hud.js
 *
 * Reads window.gameState = { happiness, congestion, budget, turn, won? }
 *
 * Exposes:
 *   window.refreshHUD()        — update meters + budget from gameState
 *   window.updateMeters()      — alias for refreshHUD (called by actions-panel.js)
 *   window.checkWinLose()      — evaluate win/lose conditions and show overlay
 *   window.showWinScreen()     — show win overlay directly
 *   window.showGameOverScreen() — show game-over overlay directly
 */

(function () {
  "use strict";

  // ── DOM refs ───────────────────────────────────────────────────────────────

  const happinessFill  = document.getElementById("happinessFill");
  const happinessBar   = document.getElementById("happinessBar");
  const happinessValue = document.getElementById("happinessValue");

  const congestionFill  = document.getElementById("congestionFill");
  const congestionBar   = document.getElementById("congestionBar");
  const congestionValue = document.getElementById("congestionValue");

  const budgetValueEl = document.getElementById("budgetValue");

  const winOverlay       = document.getElementById("winOverlay");
  const gameOverOverlay  = document.getElementById("gameOverOverlay");

  // Win overlay detail elements
  const winTurns      = document.getElementById("winTurns");
  const winHappiness  = document.getElementById("winHappiness");
  const winCongestion = document.getElementById("winCongestion");
  const winBudget     = document.getElementById("winBudget");

  // Game-over overlay built list
  const gameOverBuiltList = document.getElementById("gameOverBuiltList");

  if (!happinessFill || !congestionFill || !budgetValueEl) {
    console.warn("[hud] Required DOM elements not found. Did you include hud.html?");
    return;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatBudget(n) {
    // £1,234 — always whole pounds
    return "£" + Math.round(n).toLocaleString("en-GB");
  }

  // ── refreshHUD ─────────────────────────────────────────────────────────────

  window.refreshHUD = function refreshHUD() {
    const gs = window.gameState;
    if (!gs) return;

    const happiness  = clamp(gs.happiness  ?? 0, 0, 100);
    const congestion = clamp(gs.congestion ?? 0, 0, 100);
    const budget     = gs.budget ?? 0;

    // Happiness bar
    happinessFill.style.width = happiness + "%";
    happinessValue.textContent = Math.round(happiness);
    happinessBar.setAttribute("aria-valuenow", Math.round(happiness));
    // Critical: happiness very low
    happinessFill.classList.toggle("hud-meter__fill--critical", happiness < 20);

    // Congestion bar
    congestionFill.style.width = congestion + "%";
    congestionValue.textContent = Math.round(congestion);
    congestionBar.setAttribute("aria-valuenow", Math.round(congestion));
    // Critical: congestion very high
    congestionFill.classList.toggle("hud-meter__fill--critical", congestion > 80);

    // Budget
    budgetValueEl.textContent = formatBudget(budget);
    budgetValueEl.classList.toggle("hud__budget-value--low", budget < 80);
  };

  // ── updateMeters — alias called by actions-panel.js ───────────────────────

  window.updateMeters = window.refreshHUD;

  // ── Win / lose detection ───────────────────────────────────────────────────

  /**
   * Called by actions-panel.js after every tile placement.
   * Win condition:  gameState.won === true  OR  happiness >= 80 && congestion <= 20
   * Lose condition: budget <= 0
   *
   * Override either condition in gameState to suit the main game logic.
   */
  window.checkWinLose = function checkWinLose() {
    const gs = window.gameState;
    if (!gs) return;

    // Don't evaluate while an overlay is already showing
    if (!winOverlay.hidden || !gameOverOverlay.hidden) return;

    const happiness  = clamp(gs.happiness  ?? 0, 0, 100);
    const congestion = clamp(gs.congestion ?? 0, 0, 100);
    const budget     = gs.budget ?? 0;

    const explicitWin = gs.won === true;
    const metersWin   = happiness >= 80 && congestion <= 20;

    if (explicitWin || metersWin) {
      window.showWinScreen();
      return;
    }

    if (budget <= 0) {
      window.showGameOverScreen();
    }
  };

  // ── Win screen ─────────────────────────────────────────────────────────────

  window.showWinScreen = function showWinScreen() {
    const gs = window.gameState ?? {};

    if (winTurns)      winTurns.textContent      = gs.turn      ?? "—";
    if (winHappiness)  winHappiness.textContent  = Math.round(clamp(gs.happiness  ?? 0, 0, 100));
    if (winCongestion) winCongestion.textContent = Math.round(clamp(gs.congestion ?? 0, 0, 100));
    if (winBudget)     winBudget.textContent     = formatBudget(gs.budget ?? 0);

    winOverlay.removeAttribute("hidden");
    // Move focus into the overlay for accessibility
    document.getElementById("winRestart")?.focus();
  };

  // ── Game-over screen ───────────────────────────────────────────────────────

  window.showGameOverScreen = function showGameOverScreen() {
    // Tally placed tiles from Person C's actions-panel (data-placed-action attribute)
    const placed = document.querySelectorAll(".tile--placed[data-placed-action]");
    const counts = {};

    placed.forEach(function (tile) {
      const action = tile.dataset.placedAction;
      if (action) counts[action] = (counts[action] ?? 0) + 1;
    });

    const labels = {
      "bus-stop":        "🚌 Bus Stops",
      "bike-lane":       "🚲 Bike Lanes",
      "parking-garage":  "🅿️ Parking Garages",
      "park":            "🌳 Parks",
    };

    if (gameOverBuiltList) {
      gameOverBuiltList.innerHTML = "";
      const entries = Object.entries(counts);

      if (entries.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Nothing was built.";
        gameOverBuiltList.appendChild(li);
      } else {
        entries.forEach(function ([action, count]) {
          const li = document.createElement("li");
          const label = labels[action] ?? action;
          li.innerHTML = label + ": <strong>" + count + "</strong>";
          gameOverBuiltList.appendChild(li);
        });
      }
    }

    gameOverOverlay.removeAttribute("hidden");
    document.getElementById("gameOverRestart")?.focus();
  };

  // ── Restart buttons ────────────────────────────────────────────────────────
  // Hides the overlay and delegates the actual reset to the game engine.
  // If window.restartGame is defined, it will be called; otherwise just hide.

  function onRestart() {
    winOverlay.setAttribute("hidden", "");
    gameOverOverlay.setAttribute("hidden", "");
    if (typeof window.restartGame === "function") {
      window.restartGame();
    }
  }

  document.getElementById("winRestart")?.addEventListener("click", onRestart);
  document.getElementById("gameOverRestart")?.addEventListener("click", onRestart);

  // ── 500 ms polling interval ────────────────────────────────────────────────

  setInterval(window.refreshHUD, 500);

  // Initial render once the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.refreshHUD);
  } else {
    window.refreshHUD();
  }

})();
