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

/**
 * Signed distance to a rounded rectangle centred on the origin. Negative inside.
 */
function roundedRectDistance(
  px: number,
  py: number,
  halfWidth: number,
  halfHeight: number,
  radius: number
): number {
  const qx = Math.abs(px) - halfWidth + radius;
  const qy = Math.abs(py) - halfHeight + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

/**
 * Refraction map shaped like the actual card (rounded rectangle), used by the
 * app window. Unlike the pill map it keeps a constant rim thickness on every
 * edge, so a wide window bends light as convincingly as a small dock.
 *
 * R/G encode the normal pointing toward the glass centre (blue is unused).
 * A gentle radial field bows the whole pane and a bell-shaped rim adds the
 * thick curved lip that produces the chromatic fringe.
 */
export function generateLensDisplacementMap(
  width: number,
  height: number,
  radius: number = 24,
  rimScale: number = 0.085,
  maxRim: number = 64
): string {
  if (typeof document === 'undefined') return '';
  const sourceWidth = Math.max(Math.round(width), 120);
  const sourceHeight = Math.max(Math.round(height), 80);

  // Keep the generated bitmap small: the SVG filter stretches it to the card.
  const scale = Math.min(1, 460 / Math.max(sourceWidth, sourceHeight));
  const w = Math.max(96, Math.round(sourceWidth * scale));
  const h = Math.max(96, Math.round(sourceHeight * scale));
  const r = Math.max(6, radius * (w / sourceWidth));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const halfWidth = w / 2;
  const halfHeight = h / 2;
  const rimThickness = Math.max(
    8,
    Math.min(maxRim * (w / sourceWidth), Math.min(halfWidth, halfHeight) * 0.45, Math.min(w, h) * rimScale)
  );

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const px = x + 0.5 - halfWidth;
      const py = y + 0.5 - halfHeight;

      const inside = -roundedRectDistance(px, py, halfWidth, halfHeight, r);

      if (inside <= 0) {
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
        continue;
      }

      // Gentle whole-surface lens curvature: zero at the centre, growing
      // toward the rim so the backdrop bows like a thick glass slab.
      const ex = px / halfWidth;
      const ey = py / halfHeight;
      const radialDistance = Math.min(1, Math.hypot(ex, ey));
      const radialStrength = Math.pow(radialDistance, 2.2) * 0.22;
      let nx = -ex * radialStrength;
      let ny = -ey * radialStrength;

      if (inside < rimThickness) {
        // Gradient of the distance field = outward normal of the nearest edge.
        const eps = 0.75;
        const gx =
          roundedRectDistance(px + eps, py, halfWidth, halfHeight, r) -
          roundedRectDistance(px - eps, py, halfWidth, halfHeight, r);
        const gy =
          roundedRectDistance(px, py + eps, halfWidth, halfHeight, r) -
          roundedRectDistance(px, py - eps, halfWidth, halfHeight, r);
        const len = Math.hypot(gx, gy) || 1;

        const t = inside / rimThickness; // 0 at the outer edge, 1 at the flat centre
        // Bell-shaped bevel: soft at the outer edge, deepest mid-rim, gone at
        // the inner edge. This is the thick curved lip of the glass.
        const strength = Math.sin(t * Math.PI);

        nx += -(gx / len) * strength * 1.25;
        ny += -(gy / len) * strength * 1.25;
      }

      nx = Math.max(-1, Math.min(1, nx));
      ny = Math.max(-1, Math.min(1, ny));

      data[idx] = Math.max(0, Math.min(255, Math.round(128 + nx * 127)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + ny * 127)));
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}
