Audit index.html for mobile readiness. Check each item below and report PASS or FAIL with the specific line numbers of any issues.

## 1. Hardcoded pixel values in animation code
Grep the animations script block for pixel values that should scale with tile size.
Flag any numeric px values used for positioning (left, top, width, height of animation elements)
that are NOT using calc(var(--tile-size) * N) or a CSS variable.
Expected hardcoded values that are OK: border-radius, border-width, font sizes that use px intentionally.
Flag: car laneOff offsets, sidewalk SW_W constant, traffic light px positions, sign px positions,
park ped top/left positions, wander keyframe pixel offsets in CSS.

## 2. touch-action: manipulation
Grep index.html for all interactive element selectors. Verify each of these has touch-action: manipulation:
- .tile
- .action-btn
- .reset-btn
- .hud__music-btn
- .overlay__btn
- .diff-btn
- Any new radial menu buttons (.radial-btn if present)

## 3. Media queries at mobile breakpoint
Check that at least one @media rule targeting max-width: 600px (or similar ≤640px) exists.
If only the old @media (max-width: 1099px) small-screen overlay exists, flag it as FAIL —
that overlay blocks the game rather than adapting it.

## 4. Dynamic --tile-size
Check :root in the CSS for --tile-size. If it is a fixed value (e.g. 80px) with no clamp()
or responsive override, flag as FAIL with suggestion to use:
  --tile-size: clamp(28px, calc((100vw - 32px) / 10.5), 80px)

## 5. Tap target sizes
Grep for explicit width/height on .action-btn, .diff-btn, .overlay__btn, .reset-btn.
Flag any that are set below 44px in either dimension.

## Summary
Report a one-line status for each of the 5 checks. If any FAIL, list the specific
file location and what needs to change.
