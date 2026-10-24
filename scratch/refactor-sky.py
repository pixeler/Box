import io, re

path = 'src/components/layout/DynamicSkyBackground.tsx'
src = io.open(path, encoding='utf-8').read()

# 1. glyphDirty needs to exist before handleResize so a resize can invalidate the layer.
src = src.replace(
"""    // Grid cell size for the ASCII / mosaic matrix overlay
    const charW = 10;
    const charH = 13;
""",
"""    // Grid cell size for the ASCII / mosaic matrix overlay
    const charW = 10;
    const charH = 13;

    // The character matrix is static artwork, so it is painted once into an
    // offscreen canvas and re-used until the size or palette changes.
    let glyphLayer: HTMLCanvasElement | null = null;
    let glyphDirty = true;
""", 1)

src = src.replace(
"""      canvas.width = width;
      canvas.height = height;
    };""",
"""      canvas.width = width;
      canvas.height = height;
      glyphDirty = true;
    };""", 1)

start = src.index("    const render = (time: number) => {")
end_marker = "    animId = requestAnimationFrame(render);"
end = src.index(end_marker)

new_block = """    const paintGlyphs = (
      target: CanvasRenderingContext2D,
      simTime: number,
      totalOffsetX: number,
      totalOffsetY: number
    ) => {
      const glyphs =
        overlayMode === 'mosaic'
          ? MOSAIC_CHARS
          : overlayMode === 'ascii'
          ? ASCII_CHARS
          : HYBRID_CHARS;
      const glyphCount = glyphs.length;

      target.clearRect(0, 0, width, height);
      target.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace';
      target.textAlign = 'center';
      target.textBaseline = 'middle';

      const cols = Math.ceil(width / charW);
      const rows = Math.ceil(height / charH);

      // Render ASCII / Mosaic Overlay across the cloud surfaces
      for (let r = 0; r < rows; r++) {
        const y = r * charH + charH * 0.5;
        const normY = y / height;

        // Optimization: clouds are mainly in lower 65% of screen
        if (normY < 0.28) continue;

        for (let c = 0; c < cols; c++) {
          const x = c * charW + charW * 0.5;
          const normX = x / width;

          // Calculate cloud presence at this cell
          let cloudPresence = 0;
          let edgeGlow = 0;

          for (const zone of cloudZones) {
            // Sway zone center softly with harmonic phase
            const zoneSwayX = (Math.sin(simTime * 0.22 + zone.swayPhase) * 10 + totalOffsetX) / width;
            const zoneSwayY = (Math.cos(simTime * 0.18 + zone.swayPhase) * 5 + totalOffsetY) / height;

            const zx = zone.originX + zoneSwayX;
            const zy = zone.originY + zoneSwayY;

            const dx = (normX - zx) / zone.rx;
            let dy = (normY - zy) / zone.ry;

            // Cumulus shape: flatter base at the bottom
            if (dy > 0) dy *= 1.4;

            // Organic subtle turbulence
            const turb =
              Math.sin(normX * 16 + simTime * 0.15) * 0.05 +
              Math.cos(normY * 18 + zone.swayPhase) * 0.04;

            const dist = Math.hypot(dx, dy) + turb;

            if (dist < 1.0) {
              const val = (1.0 - dist) * zone.strength;
              cloudPresence += val;

              // Cloud crest highlight (near top edge)
              if (dy < 0 && dist > 0.4 && dist < 0.95) {
                edgeGlow = Math.max(edgeGlow, 1.0 - Math.abs(dist - 0.7) * 3);
              }
            }
          }

          // If no cloud here, leave clear sky visible
          if (cloudPresence < 0.06) continue;

          const clampedPresence = Math.min(1.0, cloudPresence);

          // Map presence to glyph
          const glyphIdx = Math.min(
            glyphCount - 1,
            Math.floor(clampedPresence * 0.85 * glyphCount)
          );
          const char = glyphs[glyphIdx];

          // Color & transparency, matched to the painterly clouds underneath
          let rVal: number;
          let gVal: number;
          let bVal: number;
          let alpha: number;

          if (isDark) {
            if (edgeGlow > 0.5) {
              rVal = 250; gVal = 252; bVal = 255;
              alpha = 0.85;
            } else if (clampedPresence > 0.5) {
              rVal = 195; gVal = 210; bVal = 230;
              alpha = 0.6;
            } else {
              rVal = 135; gVal = 150; bVal = 175;
              alpha = 0.35;
            }
          } else {
            if (edgeGlow > 0.4) {
              rVal = 255; gVal = 253; bVal = 240;
              alpha = 0.92;
            } else if (clampedPresence > 0.55) {
              rVal = 250; gVal = 244; bVal = 225;
              alpha = 0.72;
            } else if (clampedPresence > 0.25) {
              rVal = 235; gVal = 228; bVal = 205;
              alpha = 0.52;
            } else {
              rVal = 185; gVal = 205; bVal = 198;
              alpha = 0.32;
            }
          }

          target.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha.toFixed(2)})`;
          target.fillText(char, x, y);
        }
      }
    };

    const buildGlyphLayer = () => {
      if (width <= 0 || height <= 0) return;
      const layer = document.createElement('canvas');
      layer.width = width;
      layer.height = height;
      const layerCtx = layer.getContext('2d');
      if (!layerCtx) return;
      paintGlyphs(layerCtx, 0, 0, 0);
      glyphLayer = layer;
      glyphDirty = false;
    };

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;
      if (time - lastDraw < frameInterval) return;
      lastDraw = time;

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      simTime += dt;

      // Mouse smooth interpolation
      const mouse = mouseRef.current;
      mouse.smoothNormX += (mouse.normX - mouse.smoothNormX) * 0.04;
      mouse.smoothNormY += (mouse.normY - mouse.smoothNormY) * 0.04;

      // SOFT IN-PLACE SWAY: a very slow breathing drift
      const swayX = Math.sin(simTime * 0.25) * 11 + Math.sin(simTime * 0.11) * 4;
      const swayY = Math.cos(simTime * 0.2) * 5 + Math.sin(simTime * 0.09) * 2;

      // Combined sway + smooth mouse parallax
      const totalOffsetX = swayX - mouse.smoothNormX * 12;
      const totalOffsetY = swayY - mouse.smoothNormY * 8;

      // Apply the gentle in-place sway to the realistic base wallpaper image
      if (bgImgRef.current) {
        bgImgRef.current.style.transform = `translate3d(${totalOffsetX.toFixed(2)}px, ${totalOffsetY.toFixed(2)}px, 0) scale(1.05)`;
      }

      if (!glyphLayer || glyphDirty) buildGlyphLayer();

      ctx.clearRect(0, 0, width, height);
      if (glyphLayer) {
        // One blit per frame; the glyphs themselves were already rasterized.
        ctx.drawImage(glyphLayer, totalOffsetX * 0.7, totalOffsetY * 0.7);
      }

      // Subtle atmospheric mouse halo over the clouds
      if (mouse.active) {
        const mx = mouse.x;
        const my = mouse.y;
        const radGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        if (isDark) {
          radGrad.addColorStop(0, 'rgba(200, 225, 255, 0.08)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          radGrad.addColorStop(0, 'rgba(255, 250, 230, 0.14)');
          radGrad.addColorStop(0.5, 'rgba(255, 245, 215, 0.05)');
          radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, width, height);
      }
    };

"""

src = src[:start] + new_block + src[end:]
io.open(path, 'w', encoding='utf-8', newline='').write(src)
print("patched", len(new_block), "chars")
