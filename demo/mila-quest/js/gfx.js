/* v8: shared graphics-quality state (read by game.js, themes.js, worldkit.js).
   level: "low" | "medium" | "high".  scale multiplies the medium ("!high") counts of
   scenery / particles / stars, so LOW gets roughly half of MEDIUM.
   v12.4: "pixel" (מפוקסל) = LOW plus extra savings for very weak school PCs. It reports level "low"
   (so every LOW saving applies) and sets GFX.pixel = true; scenery counts drop to ~30% of MEDIUM. */
export const GFX = { level: "high", scale: 1, pixel: false };
export function setGfxLevel(level) {
  GFX.pixel = level === "pixel";
  GFX.level = GFX.pixel || level === "low" ? "low" : level === "medium" ? "medium" : "high";
  GFX.scale = GFX.pixel ? 0.3 : GFX.level === "low" ? 0.5 : 1;
}
/* N(high, highCount, mediumCount) -> count for the current level */
export function N(high, a, b) {
  return high ? a : Math.max(1, Math.round(b * GFX.scale));
}
/* shared uniform: point-sprite size multiplier = renderer pixel ratio (so stars keep their
   on-screen size when LOW renders at a fraction of the resolution). */
GFX.px = { value: 1 };
