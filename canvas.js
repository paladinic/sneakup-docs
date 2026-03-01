export const LOGICAL_W = 900;
export const LOGICAL_H = 540;

export function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();

    const displayW = Math.max(1, Math.floor(rect.width));
    const displayH = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);

    ctx.setTransform(
      canvas.width / LOGICAL_W,
      0,
      0,
      canvas.height / LOGICAL_H,
      0,
      0
    );
  }

  window.addEventListener("resize", resize);
  resize();

  return { ctx, resize };
}
