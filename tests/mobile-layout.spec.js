/**
 * Mobile layout tests — rendered at real phone viewport sizes.
 * Each test catches a class of visual bug that previously required a manual screenshot.
 *
 * Run:  npm run test:layout
 * (Vite dev server is started automatically by playwright.config.js)
 */

import { test, expect } from '@playwright/test';

// Three representative phone widths
const VIEWPORTS = [
  { name: 'iPhone SE',  width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'Pixel 7',   width: 412, height: 915 },
];

/** Dismiss the landing overlay and wait for the game grid to be ready. */
async function startGame(page) {
  // Normal difficulty is pre-selected; just click Play
  await page.locator('#landingPlay').click();
  // Wait until at least one tile is rendered
  await page.waitForSelector('#city-grid .tile', { timeout: 8000 });
  // Dismiss the day-briefing overlay if it appears (z-index 750, blocks all clicks)
  const briefing = page.locator('#briefingStart');
  try {
    await briefing.waitFor({ state: 'visible', timeout: 3000 });
    await briefing.click();
  } catch {
    // briefing may not always appear — safe to ignore
  }
  await page.waitForTimeout(200);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await startGame(page);
    });

    // ── Overflow ─────────────────────────────────────────────────────────────

    test('no horizontal page scroll', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth + 1
      );
      expect(overflow, 'body must not scroll horizontally').toBe(false);
    });

    test('game area does not exceed viewport width', async ({ page }) => {
      const box = await page.locator('#game-area').boundingBox();
      expect(box.x, '#game-area must start at or after x=0').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, '#game-area right edge must not exceed viewport').toBeLessThanOrEqual(vp.width + 1);
    });

    // ── HUD ──────────────────────────────────────────────────────────────────

    test('HUD fits within viewport width', async ({ page }) => {
      const box = await page.locator('.hud').boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test('all 3 HUD meters are within viewport', async ({ page }) => {
      const meters = await page.locator('.hud-meter').all();
      expect(meters.length, 'should have 3 meters').toBe(3);
      for (const meter of meters) {
        const box = await meter.boundingBox();
        expect(box.x, 'meter left edge in viewport').toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, 'meter right edge in viewport').toBeLessThanOrEqual(vp.width + 1);
      }
    });

    test('HUD meters do not overlap each other', async ({ page }) => {
      const meters = await page.locator('.hud-meter').all();
      const boxes = await Promise.all(meters.map(m => m.boundingBox()));
      for (let i = 0; i < boxes.length - 1; i++) {
        const a = boxes[i], b = boxes[i + 1];
        const aRight = a.x + a.width;
        expect(aRight, `meter ${i} right must not overlap meter ${i + 1}`).toBeLessThanOrEqual(b.x + 2);
      }
    });

    // ── City grid ────────────────────────────────────────────────────────────

    test('city grid is within viewport', async ({ page }) => {
      const box = await page.locator('#city-grid').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test('city grid is horizontally centred (within 8px)', async ({ page }) => {
      const box = await page.locator('#city-grid').boundingBox();
      const leftGap  = box.x;
      const rightGap = vp.width - (box.x + box.width);
      expect(
        Math.abs(leftGap - rightGap),
        `grid left gap (${leftGap.toFixed(1)}) vs right gap (${rightGap.toFixed(1)}) should be within 8px`
      ).toBeLessThan(8);
    });

    test('grid has 144 tiles (12×12)', async ({ page }) => {
      const count = await page.locator('#city-grid .tile').count();
      expect(count).toBe(144);
    });

    // ── Mobile action strip ───────────────────────────────────────────────────

    test('action strip is visible', async ({ page }) => {
      const strip = page.locator('#mobileActionStrip');
      await expect(strip).toBeVisible();
    });

    test('action strip has 8 cards', async ({ page }) => {
      const count = await page.locator('#mobileActionStrip .mas-card').count();
      expect(count, 'strip should have 8 action cards').toBe(8);
    });

    test('action strip scrolls internally (not the page)', async ({ page }) => {
      const scrollable = await page.locator('#mobileActionStrip').evaluate(
        el => el.scrollWidth > el.clientWidth
      );
      expect(scrollable, 'strip should have hidden overflow — cards extend past visible area').toBe(true);
    });

    test('strip wrapper does not exceed viewport width', async ({ page }) => {
      const box = await page.locator('#stripWrapper').boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test('right scroll arrow is visible at strip start', async ({ page }) => {
      const arrow = page.locator('#stripArrowRight');
      await expect(arrow).not.toHaveClass(/strip-arrow--hidden/);
    });

    test('left scroll arrow is hidden at strip start', async ({ page }) => {
      const arrow = page.locator('#stripArrowLeft');
      await expect(arrow).toHaveClass(/strip-arrow--hidden/);
    });

    test('left arrow appears after scrolling strip right', async ({ page }) => {
      // Scroll the strip to the end
      await page.locator('#mobileActionStrip').evaluate(
        el => { el.scrollLeft = el.scrollWidth; }
      );
      await page.waitForTimeout(300); // arrow transition
      const arrow = page.locator('#stripArrowLeft');
      await expect(arrow).not.toHaveClass(/strip-arrow--hidden/);
    });

    // ── Mobile combos ─────────────────────────────────────────────────────────

    test('all 11 combos are rendered', async ({ page }) => {
      // Open programmatically — avoids overlay blocking a click on the summary
      await page.evaluate(() => { document.getElementById('mobileCombos').open = true; });
      const count = await page.locator('.mobile-combo-item').count();
      expect(count, 'should render all 11 combos').toBe(11);
    });

    test('combo list uses 2-column layout', async ({ page }) => {
      await page.evaluate(() => { document.getElementById('mobileCombos').open = true; });
      const columns = await page.locator('.mobile-combos__list').evaluate(
        el => getComputedStyle(el).gridTemplateColumns
      );
      // 2-col grid resolves to two pixel widths, e.g. "188px 188px"
      const colCount = columns.trim().split(/\s+/).length;
      expect(colCount, `grid-template-columns should be 2 columns, got: "${columns}"`).toBe(2);
    });

    test('combos list does not require internal scrolling (all visible when open)', async ({ page }) => {
      await page.evaluate(() => { document.getElementById('mobileCombos').open = true; });
      const clipped = await page.locator('.mobile-combos__list').evaluate(
        el => el.scrollHeight > el.clientHeight + 2
      );
      expect(clipped, 'combo list should not need internal scroll — remove max-height if this fails').toBe(false);
    });
  });
}
