/**
 * Unified optical glass displacement map generator.
 * Produces accurate normal derivatives for glass edge refraction and chromatic dispersion.
 * Figma parameters: Refraction (68), Depth (27), Splay (47).
 */
export function generatePillDisplacementMap(
  width: number = 390,
  height: number = 68,
  depth: number = 27,
  splay: number = 47
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const w = Math.max(Math.round(width), 160);
  const h = Math.max(Math.round(height), 48);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  const radius = h / 2;
  const rimThickness = Math.max(8, Math.min(radius, (depth / 100) * radius + (splay / 100) * 12));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      let dx = 0;
      const dy = y - h / 2;
      if (x < radius) {
        dx = x - radius;
      } else if (x > w - radius) {
        dx = x - (w - radius);
      } else {
        dx = 0;
      }

      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const distFromEdge = radius - distFromCenter;

      if (distFromEdge <= 0) {
        // Outside pill boundary
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
      } else if (distFromEdge < rimThickness) {
        // Glass rim refraction zone
        const t = distFromEdge / rimThickness; // 0 at outer edge, 1 at inner flat region
        // Sine wave normal derivative for smooth optical curvature
        const normalMagnitude = Math.sin((1 - t) * Math.PI * 0.5);

        const len = distFromCenter > 0.001 ? distFromCenter : 1;
        const nx = -(dx / len) * normalMagnitude;
        const ny = -(dy / len) * normalMagnitude;

        data[idx] = Math.max(0, Math.min(255, Math.round(128 + nx * 127)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + ny * 127)));
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else {
        // Crystal clear flat center (no displacement)
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}
