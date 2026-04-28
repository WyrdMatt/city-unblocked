/**
 * actions-panel.js
 *
 * Depends on:
 *   window.cityGrid    — the grid container DOM element (tiles are its children with class .tile)
 *   window.gameState   — object with at least { budget: number }
 *   window.updateMeters()
 *   window.checkWinLose()
 */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────

  /** @type {{ action: string, cost: number, emoji: string, color: string } | null} */
  let selectedAction = null;

  /** @type {HTMLButtonElement | null} */
  let activeButton = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  const panel      = document.getElementById("actionsPanel");
  const actionsList = document.getElementById("actionsList");
  const budgetError = document.getElementById("budgetError");

  if (!panel || !actionsList || !budgetError) {
    console.warn("[actions-panel] Required DOM elements not found. Did you include actions-panel.html?");
    return;
  }

  // ── Button interaction ─────────────────────────────────────────────────────

  actionsList.addEventListener("click", (e) => {
    const btn = e.target.closest(".action-btn");
    if (!btn) return;

    // Toggle off if same button clicked again
    if (btn === activeButton) {
      deselect();
      return;
    }

    select(btn);
  });

  function select(btn) {
    deselect();

    selectedAction = {
      action: btn.dataset.action,
      cost:   Number(btn.dataset.cost),
      emoji:  btn.dataset.emoji,
      color:  btn.dataset.color,
    };

    activeButton = btn;
    btn.classList.add("action-btn--active");
    // Expose the action colour so CSS can use it via var(--action-color)
    btn.style.setProperty("--action-color", selectedAction.color);

    hideBudgetError();
  }

  function deselect() {
    if (activeButton) {
      activeButton.classList.remove("action-btn--active");
      activeButton.style.removeProperty("--action-color");
      activeButton = null;
    }
    selectedAction = null;
  }

  // ── Tile click ─────────────────────────────────────────────────────────────

  // Wait until the grid is available. It may be added to the DOM after this
  // script runs, so we poll briefly then fall back to a MutationObserver.
  function attachGridListener() {
    const grid = window.cityGrid;
    if (!grid) {
      console.warn("[actions-panel] window.cityGrid not found — tile clicks won't be handled.");
      return;
    }

    grid.addEventListener("click", onTileClick);
  }

  function onTileClick(e) {
    const tile = e.target.closest(".tile");
    if (!tile) return;

    if (!selectedAction) return; // nothing selected — ignore

    const budget = window.gameState?.budget ?? Infinity;

    if (budget < selectedAction.cost) {
      showBudgetError();
      return;
    }

    // Apply action to tile
    placeTile(tile, selectedAction);

    // Update game state
    window.gameState.budget -= selectedAction.cost;

    if (typeof window.updateMeters   === "function") window.updateMeters();
    if (typeof window.checkWinLose   === "function") window.checkWinLose();

    hideBudgetError();
  }

  /**
   * Visually marks a tile as having an action placed on it.
   * Stores placed-action metadata on the element for other modules to read.
   */
  function placeTile(tile, action) {
    tile.dataset.placedAction = action.action;
    tile.dataset.placedCost   = action.cost;

    tile.style.setProperty("--tile-placed-color", action.color);
    tile.classList.add("tile--placed");

    // Show the emoji — clear existing content then insert
    tile.textContent = "";
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.textContent = action.emoji;
    tile.appendChild(span);

    // Accessible label
    tile.setAttribute("aria-label", `${action.action} placed`);
  }

  // ── Budget error helpers ───────────────────────────────────────────────────

  let errorTimeout = null;

  function showBudgetError() {
    clearTimeout(errorTimeout);
    // Re-trigger animation by removing/re-adding the element
    budgetError.removeAttribute("hidden");
    // Force reflow so the animation replays even if already visible
    void budgetError.offsetWidth; // eslint-disable-line no-void
    budgetError.style.animation = "none";
    requestAnimationFrame(() => {
      budgetError.style.animation = "";
    });

    errorTimeout = setTimeout(hideBudgetError, 3000);
  }

  function hideBudgetError() {
    clearTimeout(errorTimeout);
    budgetError.setAttribute("hidden", "");
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  // If window.cityGrid is already set, attach immediately.
  // Otherwise wait for it to be assigned (e.g. after grid renders).
  if (window.cityGrid) {
    attachGridListener();
  } else {
    // Proxy assignment so we catch when another script sets window.cityGrid
    let _grid = null;
    Object.defineProperty(window, "cityGrid", {
      get() { return _grid; },
      set(val) {
        _grid = val;
        if (val) attachGridListener();
      },
      configurable: true,
    });
  }
})();
