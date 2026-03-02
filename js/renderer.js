// ============================================================
// VOID CRAWLER - Renderer (Visual Overhaul)
// Biome-themed dungeon, detailed characters, weather, boss intros,
// lore, decorations, enhanced screens, minimap
// ============================================================

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.biome = null;
    this.biomeKey = null;

    // Ambient dust particles
    this.dustParticles = [];
    this._initDust();
  }

  setBiome(biome, key) {
    this.biome = biome;
    this.biomeKey = key;
  }

  _initDust() {
    this.dustParticles = [];
    for (let i = 0; i < 25; i++) {
      this.dustParticles.push({
        ox: Math.random() * 2000 - 1000,
        oy: Math.random() * 2000 - 1000,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        size: 1 + Math.random() * 1.5,
        alpha: 0.05 + Math.random() * 0.1
      });
    }
  }

  // Noise helper for tile variation
  _tileNoise(tx, ty, range) {
    const seed = (tx * 7919 + ty * 6271) % 256;
    return (seed / 256 - 0.5) * range * 2;
  }

  _colorShift(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = clamp(r + amount, 0, 255);
    const ng = clamp(g + amount, 0, 255);
    const nb = clamp(b + amount, 0, 255);
    return `rgb(${nr},${ng},${nb})`;
  }

  clear() {
    this.ctx.fillStyle = COLORS.void;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ---- Biome-Themed Dungeon ----
  renderDungeon(dungeon, camera) {
    const ctx = this.ctx;
    const b = this.biome;
    const startTX = Math.max(0, toTile(camera.x - camera.shakeX) - 1);
    const startTY = Math.max(0, toTile(camera.y - camera.shakeY) - 1);
    const endTX = Math.min(DUNGEON_W, toTile(camera.x + camera.w - camera.shakeX) + 2);
    const endTY = Math.min(DUNGEON_H, toTile(camera.y + camera.h - camera.shakeY) + 2);

    const floorCol = b ? b.floorColor : COLORS.floor;
    const floorAltCol = b ? b.floorAlt : COLORS.floorAlt;
    const wallCol = b ? b.wallColor : COLORS.wall;
    const wallTopCol = b ? b.wallTop : COLORS.wallTop;
    const wallEdgeCol = b ? b.wallEdge : COLORS.wallEdge;

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const tile = dungeon.tiles[ty][tx];
        if (tile === TileType.VOID) continue;

        const visible = dungeon.visibility[ty][tx];
        const explored = dungeon.explored[ty][tx];
        if (!visible && !explored) continue;

        const sx = camera.screenX(tx * TILE);
        const sy = camera.screenY(ty * TILE);
        ctx.globalAlpha = visible ? 1 : 0.3;

        if (tile === TileType.WALL) {
          // Wall with noise variation
          const n = this._tileNoise(tx, ty, 5);
          ctx.fillStyle = this._colorShift(wallCol, n);
          ctx.fillRect(sx, sy, TILE, TILE);

          const above = ty > 0 ? dungeon.tiles[ty - 1][tx] : TileType.VOID;
          if (above >= TileType.FLOOR) {
            // 3D-ish wall top face
            ctx.fillStyle = wallTopCol;
            ctx.fillRect(sx, sy, TILE, TILE);
            // Darker edge for depth
            ctx.fillStyle = wallEdgeCol;
            ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
            // Wall edge outline
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, TILE, TILE);
          }
        } else if (tile === TileType.FLOOR) {
          // Floor with subtle noise
          const n = this._tileNoise(tx, ty, 5);
          ctx.fillStyle = ((tx + ty) % 2 === 0) ? this._colorShift(floorCol, n) : this._colorShift(floorAltCol, n);
          ctx.fillRect(sx, sy, TILE, TILE);

          // Floor detail scratches
          if ((tx * 7 + ty * 13) % 5 === 0 && visible) {
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            const sx2 = sx + (tx * 3 % 20) + 4;
            const sy2 = sy + (ty * 5 % 20) + 4;
            ctx.moveTo(sx2, sy2);
            ctx.lineTo(sx2 + 8, sy2 + 6);
            ctx.stroke();
          }
        } else if (tile === TileType.STAIRS) {
          ctx.fillStyle = floorCol;
          ctx.fillRect(sx, sy, TILE, TILE);
          if (visible) {
            const glowSize = 20 + Math.sin(this.time * 3) * 5;
            const accent = b ? b.accent : COLORS.stairs;
            const grad = ctx.createRadialGradient(sx + TILE / 2, sy + TILE / 2, 2, sx + TILE / 2, sy + TILE / 2, glowSize);
            grad.addColorStop(0, accent);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(sx - 10, sy - 10, TILE + 20, TILE + 20);
            ctx.fillStyle = accent;
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('\u25BC', sx + TILE / 2, sy + TILE / 2 + 6);
          }
        } else if (tile === TileType.SPIKE) {
          ctx.fillStyle = ((tx + ty) % 2 === 0) ? floorCol : floorAltCol;
          ctx.fillRect(sx, sy, TILE, TILE);
          if (visible) {
            ctx.fillStyle = COLORS.spike;
            const positions = [[sx + 6, sy + 8], [sx + 18, sy + 6], [sx + 10, sy + 20], [sx + 24, sy + 18]];
            for (const [px, py] of positions) {
              ctx.beginPath();
              ctx.moveTo(px, py - 6);
              ctx.lineTo(px - 4, py + 4);
              ctx.lineTo(px + 4, py + 4);
              ctx.closePath();
              ctx.fill();
            }
            ctx.fillStyle = '#aaaabb';
            for (const [px, py] of positions) {
              ctx.beginPath();
              ctx.moveTo(px, py - 6);
              ctx.lineTo(px - 1, py);
              ctx.lineTo(px + 1, py);
              ctx.closePath();
              ctx.fill();
            }
          }
        } else if (tile === TileType.POISON) {
          ctx.fillStyle = ((tx + ty) % 2 === 0) ? floorCol : floorAltCol;
          ctx.fillRect(sx, sy, TILE, TILE);
          if (visible) {
            ctx.fillStyle = 'rgba(68,170,34,0.4)';
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = COLORS.poison;
            const bubbleTime = this.time * 2;
            const bubbles = [
              [sx + 8, sy + 12 + Math.sin(bubbleTime + 1) * 2, 3],
              [sx + 20, sy + 8 + Math.sin(bubbleTime + 2) * 2, 4],
              [sx + 14, sy + 22 + Math.sin(bubbleTime + 3) * 2, 2.5],
              [sx + 26, sy + 18 + Math.sin(bubbleTime + 4) * 1.5, 2],
            ];
            for (const [bx, by, br] of bubbles) {
              ctx.beginPath();
              ctx.arc(bx, by, br, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // Fog overlay
    if (b && b.fog) {
      ctx.fillStyle = b.fog;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Special room overlays
    this._renderSpecialRoomOverlays(dungeon, camera, startTX, startTY, endTX, endTY);
  }

  _renderSpecialRoomOverlays(dungeon, camera, startTX, startTY, endTX, endTY) {
    const ctx = this.ctx;
    if (!dungeon.specialRooms) return;
    for (const special of dungeon.specialRooms) {
      const room = special.room;
      if (!room) continue;
      for (let ty = Math.max(startTY, room.y); ty < Math.min(endTY, room.y + room.h); ty++) {
        for (let tx = Math.max(startTX, room.x); tx < Math.min(endTX, room.x + room.w); tx++) {
          const tile = dungeon.tiles[ty][tx];
          if (tile < TileType.FLOOR) continue;
          if (!dungeon.visibility[ty][tx] && !dungeon.explored[ty][tx]) continue;
          const sx = camera.screenX(tx * TILE);
          const sy = camera.screenY(ty * TILE);
          const visAlpha = dungeon.visibility[ty][tx] ? 1 : 0.3;
          ctx.globalAlpha = visAlpha * 0.12;
          if (special.type === 'treasure') ctx.fillStyle = COLORS.treasure;
          else if (special.type === 'shop') ctx.fillStyle = COLORS.shop;
          else if (special.type === 'shrine') ctx.fillStyle = COLORS.shrine;
          else if (special.type === 'fountain') ctx.fillStyle = COLORS.fountain;
          ctx.fillRect(sx, sy, TILE, TILE);
        }
      }
      // Center effects
      const centerTX = room.cx, centerTY = room.cy;
      if (dungeon.visibility[centerTY] && dungeon.visibility[centerTY][centerTX]) {
        const csx = camera.screenX(toWorld(centerTX));
        const csy = camera.screenY(toWorld(centerTY));
        if (special.type === 'shrine') {
          ctx.globalAlpha = 0.3 + Math.sin(this.time * 2) * 0.1;
          const g = ctx.createRadialGradient(csx, csy, 2, csx, csy, TILE * 1.5);
          g.addColorStop(0, COLORS.shrine);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(csx - TILE * 2, csy - TILE * 2, TILE * 4, TILE * 4);
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = COLORS.shrine;
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('\u2726', csx, csy + 7);
        } else if (special.type === 'fountain') {
          ctx.globalAlpha = 0.4 + Math.sin(this.time * 3) * 0.15;
          const g = ctx.createRadialGradient(csx, csy, 2, csx, csy, TILE * 1.2);
          g.addColorStop(0, COLORS.fountain);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(csx - TILE * 1.5, csy - TILE * 1.5, TILE * 3, TILE * 3);
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = COLORS.fountain;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('\u2668', csx, csy + 6);
        } else if (special.type === 'shop' && !special.used) {
          ctx.globalAlpha = 0.6 + Math.sin(this.time * 3) * 0.2;
          ctx.fillStyle = COLORS.shop;
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('SHOP', csx, csy - TILE - 4);
        } else if (special.type === 'treasure' && !special.used) {
          ctx.globalAlpha = 0.4 + Math.sin(this.time * 2.5) * 0.15;
          const tG = ctx.createRadialGradient(csx, csy, 2, csx, csy, TILE);
          tG.addColorStop(0, COLORS.treasure);
          tG.addColorStop(1, 'transparent');
          ctx.fillStyle = tG;
          ctx.fillRect(csx - TILE, csy - TILE, TILE * 2, TILE * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Decorations ----
  renderDecorations(decorations, camera, dungeon) {
    if (!decorations || decorations.length === 0) return;
    const ctx = this.ctx;
    for (const deco of decorations) {
      const tx = toTile(deco.x), ty = toTile(deco.y);
      if (tx < 0 || ty < 0 || tx >= DUNGEON_W || ty >= DUNGEON_H) continue;
      if (!dungeon.visibility[ty][tx] && !dungeon.explored[ty][tx]) continue;
      ctx.globalAlpha = dungeon.visibility[ty][tx] ? 0.8 : 0.25;
      const sx = camera.screenX(deco.x);
      const sy = camera.screenY(deco.y);
      const def = DECORATION_DEFS[deco.type];
      if (def && def.draw) {
        ctx.save();
        def.draw(ctx, sx, sy);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Items ----
  renderItems(items, camera, dungeon) {
    const ctx = this.ctx;
    for (const item of items) {
      if (item.collected) continue;
      const tx = toTile(item.x), ty = toTile(item.y);
      if (!dungeon.visibility[ty] || !dungeon.visibility[ty][tx]) continue;
      const sx = camera.screenX(item.x);
      const sy = camera.screenY(item.y);
      const def = ITEM_DEFS[item.type];
      const glowSize = 18 + Math.sin(this.time * 4) * 4;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, glowSize);
      grad.addColorStop(0, COLORS.itemGlow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowSize, sy - glowSize, glowSize * 2, glowSize * 2);
      const bob = Math.sin(this.time * 3 + item.x) * 3;
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(this.time * 2);
      ctx.fillStyle = def.color;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.symbol, sx, sy + bob + 4);
    }
  }

  // ---- Detailed Player Rendering ----
  renderPlayer(player, camera) {
    if (!player.alive) return;
    const ctx = this.ctx;
    const sx = camera.screenX(player.x);
    const sy = camera.screenY(player.y);

    // Dash afterimages
    for (const img of player.dashAfterimages) {
      const isx = camera.screenX(img.x);
      const isy = camera.screenY(img.y);
      ctx.globalAlpha = (img.life / img.maxLife) * 0.25;
      this._drawPlayerBody(ctx, isx, isy, img.angle, player, true);
    }
    ctx.globalAlpha = 1;

    // Dash trail
    for (const trail of player.dashTrail) {
      const tsx = camera.screenX(trail.x);
      const tsy = camera.screenY(trail.y);
      ctx.globalAlpha = trail.life / 0.3 * 0.2;
      ctx.fillStyle = COLORS.dash;
      ctx.beginPath();
      ctx.arc(tsx, tsy, player.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player glow
    const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30);
    grad.addColorStop(0, COLORS.playerGlow);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 30, sy - 30, 60, 60);

    // Invincibility flash
    if (player.invincible > 0 && Math.floor(player.invincible * 15) % 2) {
      ctx.globalAlpha = 0.5;
    }

    // Draw full player body
    this._drawPlayerBody(ctx, sx, sy, player.angle, player, false);
    ctx.globalAlpha = 1;

    // Dash cooldown indicator
    if (player.dashCooldown > 0) {
      const pct = 1 - player.dashCooldown / player.dashMaxCooldown;
      ctx.strokeStyle = COLORS.dash;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, player.radius + 8, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawPlayerBody(ctx, sx, sy, angle, player, isGhost) {
    const breathScale = 1 + Math.sin(player.breathTimer * 2) * 0.02;
    const walkBob = player.isMoving ? Math.sin(player.walkCycle) * 2 : 0;
    const legStride = player.isMoving ? Math.sin(player.walkCycle) * 4 : 0;

    ctx.save();
    ctx.translate(sx, sy + walkBob);

    // --- Cape (drawn behind body) ---
    if (player.capeSegments.length > 1 && !isGhost) {
      ctx.strokeStyle = player.capeColor || '#2244aa';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.7;
      ctx.beginPath();
      for (let i = 0; i < player.capeSegments.length; i++) {
        const seg = player.capeSegments[i];
        const csx = seg.x - player.x;
        const csy = seg.y - player.y - walkBob;
        if (i === 0) ctx.moveTo(csx, csy);
        else ctx.lineTo(csx, csy);
        ctx.lineWidth = 6 - i;
      }
      ctx.stroke();
      ctx.globalAlpha = isGhost ? 0.25 : 1;
    }

    const bodyColor = player.flashTimer > 0 ? '#ff4444' : COLORS.player;
    const darkColor = player.flashTimer > 0 ? '#aa2222' : COLORS.playerDark;

    // --- Legs ---
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 3;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-3, 5);
    ctx.lineTo(-3 - legStride * 0.3, 12 + Math.abs(legStride) * 0.3);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(3 + legStride * 0.3, 12 - Math.abs(legStride) * 0.3);
    ctx.stroke();

    // --- Body (torso) ---
    ctx.fillStyle = bodyColor;
    ctx.save();
    ctx.scale(breathScale, 1 / breathScale);
    ctx.fillRect(-5, -6, 10, 12);
    // Shoulders
    ctx.fillRect(-7, -5, 14, 4);
    ctx.restore();

    // --- Arms (extend toward aim) ---
    const armAngle = angle - (Math.PI / 2); // relative to body
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 3;
    // Right arm toward mouse
    const armDx = Math.cos(angle) * 10;
    const armDy = Math.sin(angle) * 10;
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(5 + armDx * 0.8, -2 + armDy * 0.8);
    ctx.stroke();
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.lineTo(-5 + armDx * 0.5, -2 + armDy * 0.5);
    ctx.stroke();

    // --- Weapon (line from arm toward aim) ---
    if (!isGhost) {
      const wpX = 5 + armDx * 0.8;
      const wpY = -2 + armDy * 0.8;
      ctx.strokeStyle = COLORS.projectile;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wpX, wpY);
      ctx.lineTo(wpX + Math.cos(angle) * 8, wpY + Math.sin(angle) * 8);
      ctx.stroke();
      // Weapon glow
      const gwx = wpX + Math.cos(angle) * 8;
      const gwy = wpY + Math.sin(angle) * 8;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = COLORS.projectile;
      ctx.beginPath();
      ctx.arc(gwx, gwy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- Head ---
    ctx.fillStyle = bodyColor;
    // Rounded head
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eyes (glow based on dash cooldown)
    if (!isGhost) {
      const eyeGlow = player.dashCooldown > 0 ? '#ffaa44' : '#00ffcc';
      ctx.fillStyle = eyeGlow;
      // Eyes look toward aim direction
      const lookX = Math.cos(angle) * 1.5;
      const lookY = Math.sin(angle) * 1;
      ctx.fillRect(-3 + lookX, -12 + lookY, 2, 2);
      ctx.fillRect(1 + lookX, -12 + lookY, 2, 2);
    }

    ctx.restore();
  }

  // ---- Enhanced Enemy Rendering ----
  renderEnemies(enemies, camera, dungeon) {
    const ctx = this.ctx;
    for (const e of enemies) {
      if (!e.alive) continue;
      const tx = toTile(e.x), ty = toTile(e.y);
      if (!dungeon.visibility[ty] || !dungeon.visibility[ty][tx]) continue;
      const sx = camera.screenX(e.x);
      const sy = camera.screenY(e.y);
      const squash = e.squashTimer > 0 ? 1 + Math.sin(e.squashTimer * 30) * 0.2 : 1;
      const stretch = e.squashTimer > 0 ? 1 - Math.sin(e.squashTimer * 30) * 0.15 : 1;
      ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;

      switch (e.type) {
        case 'slime': {
          // Squish animation on movement
          const bob = Math.sin(e.bobTimer || 0) * 2;
          const moveSquish = 1 + Math.sin(e.walkCycle * 1.5) * 0.08;
          ctx.save();
          ctx.translate(sx, sy + bob);
          ctx.scale(squash * moveSquish, stretch / moveSquish);
          // Main body
          ctx.beginPath();
          ctx.ellipse(0, 0, e.radius, e.radius * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Drip particles (visual detail)
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(-3, e.radius * 0.6, 2, 3 + Math.sin(this.time * 3) * 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(4, e.radius * 0.5, 1.5, 2 + Math.sin(this.time * 4 + 1) * 1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // Eyes
          ctx.fillStyle = '#000';
          ctx.fillRect(-4, -3, 3, 3);
          ctx.fillRect(2, -3, 3, 3);
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(-3, -4, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'bat': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          const wingPhase = Math.sin(this.time * 12) * 0.4;
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          // Wings with more detail
          ctx.beginPath();
          ctx.moveTo(-5, 0);
          ctx.quadraticCurveTo(-14, -10 + wingPhase * 10, -12, 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.quadraticCurveTo(14, -10 + wingPhase * 10, 12, 2);
          ctx.fill();
          // Wing membrane lines
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(-5, 0);
          ctx.lineTo(-10, -5 + wingPhase * 5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.lineTo(10, -5 + wingPhase * 5);
          ctx.stroke();
          // Glowing eyes
          ctx.fillStyle = '#ff0';
          ctx.fillRect(-3, -2, 2, 2);
          ctx.fillRect(1, -2, 2, 2);
          ctx.restore();
          break;
        }
        case 'shooter': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          // Hexagon body
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 / 6) * i - Math.PI / 6;
            const px = Math.cos(a) * e.radius;
            const py = Math.sin(a) * e.radius;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          // Rotating turret top
          if (e.seesPlayer) {
            const turretAngle = e.animTimer * 2;
            ctx.save();
            ctx.rotate(turretAngle);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -e.radius * 0.5, 4, e.radius);
            ctx.restore();
            // Glowing eye
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        case 'charger': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          // Pulsing body during wind-up
          if (e.windUp > 0) {
            const pulseSize = 1 + Math.sin(this.time * 20) * 0.15;
            ctx.scale(pulseSize, pulseSize);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          }
          // Arrow shape
          ctx.beginPath();
          ctx.moveTo(e.radius + 2, 0);
          ctx.lineTo(-e.radius, -e.radius * 0.8);
          ctx.lineTo(-e.radius * 0.5, 0);
          ctx.lineTo(-e.radius, e.radius * 0.8);
          ctx.closePath();
          ctx.fill();
          // Motion trail when charging
          if (e.charging) {
            ctx.globalAlpha = 0.3;
            for (let t = 1; t <= 3; t++) {
              const trailX = -Math.cos(e.chargeDir) * t * 8;
              const trailY = -Math.sin(e.chargeDir) * t * 8;
              ctx.fillStyle = e.color;
              ctx.beginPath();
              ctx.arc(trailX, trailY, e.radius * (1 - t * 0.2), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          ctx.restore();
          break;
        }
        case 'exploder': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          const pulseRate = e.fusing ? 20 : 4;
          const pulseAmt = e.fusing ? 0.3 : 0.1;
          const pulse = 1 + Math.sin(this.time * pulseRate) * pulseAmt;
          const drawRadius = e.radius * pulse;
          if (e.fusing) {
            const fuseFlash = Math.sin(this.time * 25) > 0;
            ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : (fuseFlash ? '#ff2200' : e.color);
            // Sparking particles
            for (let i = 0; i < 4; i++) {
              const spkA = this.time * 8 + i * 1.5;
              const spkR = drawRadius + 4 + Math.random() * 6;
              ctx.fillStyle = '#ffcc00';
              ctx.globalAlpha = 0.5 + Math.random() * 0.5;
              ctx.fillRect(Math.cos(spkA) * spkR - 1, Math.sin(spkA) * spkR - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : (fuseFlash ? '#ff2200' : e.color);
          }
          ctx.beginPath();
          ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(-2, -2, drawRadius * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (e.fusing) {
            const exAlpha = 0.5 + Math.sin(this.time * 15) * 0.5;
            ctx.globalAlpha = exAlpha;
            ctx.fillStyle = '#ff2200';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', sx, sy - e.radius - 8);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'necromancer': {
          ctx.save();
          ctx.translate(sx, sy);
          // Floating bob
          const necBob = Math.sin(this.time * 2) * 3;
          ctx.translate(0, necBob);
          ctx.scale(squash, stretch);
          // Cloak shape (triangle)
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : '#3a1a5a';
          ctx.beginPath();
          ctx.moveTo(0, -e.radius);
          ctx.lineTo(-e.radius * 0.8, e.radius * 0.5);
          ctx.lineTo(e.radius * 0.8, e.radius * 0.5);
          ctx.closePath();
          ctx.fill();
          // Inner body
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.beginPath();
          ctx.arc(0, -e.radius * 0.2, e.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // Orbiting soul wisps
          for (let i = 0; i < 3; i++) {
            const runeAngle = this.time * 1.5 + (Math.PI * 2 / 3) * i;
            const runeR = e.radius + 12;
            const rx = sx + Math.cos(runeAngle) * runeR;
            const ry = sy + necBob + Math.sin(runeAngle) * runeR;
            ctx.globalAlpha = 0.4 + Math.sin(this.time * 4 + i) * 0.3;
            ctx.fillStyle = '#cc88ff';
            ctx.beginPath();
            ctx.arc(rx, ry, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          // Eye
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(sx, sy + Math.sin(this.time * 2) * 3 - e.radius * 0.2, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'mimic': {
          if (e.disguised) {
            const bob = Math.sin(this.time * 3 + e.x) * 3;
            ctx.save();
            ctx.translate(sx, sy + bob);
            ctx.rotate(this.time * 2);
            ctx.fillStyle = COLORS.mimic;
            ctx.fillRect(-6, -6, 12, 12);
            ctx.restore();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('?', sx, sy + bob + 4);
            const glowSize = 18 + Math.sin(this.time * 4) * 4;
            const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, glowSize);
            grad.addColorStop(0, COLORS.itemGlow);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(sx - glowSize, sy - glowSize, glowSize * 2, glowSize * 2);
          } else {
            // Shaking reveal
            const shakeX = e.aggroTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
            const shakeY = e.aggroTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
            ctx.save();
            ctx.translate(sx + shakeX, sy + shakeY);
            ctx.scale(squash, stretch);
            ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : '#cc2200';
            ctx.fillRect(-e.radius, -e.radius * 0.7, e.radius * 2, e.radius * 1.4);
            // Teeth
            ctx.fillStyle = '#ffffff';
            const teethCount = 6;
            const teethW = (e.radius * 2) / teethCount;
            for (let i = 0; i < teethCount; i++) {
              const tox = -e.radius + i * teethW;
              ctx.beginPath();
              ctx.moveTo(tox, -e.radius * 0.7);
              ctx.lineTo(tox + teethW / 2, -e.radius * 0.7 - 5);
              ctx.lineTo(tox + teethW, -e.radius * 0.7);
              ctx.closePath();
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(tox, e.radius * 0.7);
              ctx.lineTo(tox + teethW / 2, e.radius * 0.7 + 5);
              ctx.lineTo(tox + teethW, e.radius * 0.7);
              ctx.closePath();
              ctx.fill();
            }
            // Eyes
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath(); ctx.arc(-4, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -2, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          break;
        }
        case 'teleporter': {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          const flicker = 0.4 + Math.random() * 0.4 + Math.sin(this.time * 8) * 0.2;
          ctx.globalAlpha = flicker;
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          ctx.fill();
          // Glitch effect lines
          if (Math.random() < 0.3) {
            ctx.fillStyle = e.color;
            ctx.globalAlpha = 0.4;
            ctx.fillRect(-e.radius, (Math.random() - 0.5) * e.radius, e.radius * 2, 2);
          }
          ctx.strokeStyle = 'rgba(0,255,238,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'boss': {
          const bossGlow = ctx.createRadialGradient(sx, sy, e.radius * 0.5, sx, sy, e.radius * 2);
          bossGlow.addColorStop(0, COLORS.bossGlow);
          bossGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = bossGlow;
          ctx.fillRect(sx - e.radius * 2, sy - e.radius * 2, e.radius * 4, e.radius * 4);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.beginPath();
          for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 / 12) * i + this.time * 0.5;
            const r = i % 2 === 0 ? e.radius : e.radius * 0.75;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'slimeKing': {
          const skGlow = ctx.createRadialGradient(sx, sy, e.radius * 0.5, sx, sy, e.radius * 2.5);
          skGlow.addColorStop(0, COLORS.slimeKingGlow);
          skGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = skGlow;
          ctx.fillRect(sx - e.radius * 3, sy - e.radius * 3, e.radius * 6, e.radius * 6);
          const skBob = Math.sin(this.time * 2) * 4;
          const sizePulse = 1 + Math.sin(this.time * 1.5) * 0.03;
          ctx.save();
          ctx.translate(sx, sy + skBob);
          ctx.scale(squash * sizePulse, stretch * sizePulse);
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          ctx.fill();
          // Slime trails (dripping)
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.ellipse(-e.radius * 0.5, e.radius * 0.8, 4, 6 + Math.sin(this.time * 2) * 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(e.radius * 0.3, e.radius * 0.9, 3, 5 + Math.sin(this.time * 3 + 1) * 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // Crown
          ctx.fillStyle = COLORS.treasure;
          const crownPoints = 5;
          const crownW = e.radius * 1.2;
          const crownBaseY = -e.radius * 0.7;
          const crownTopY = -e.radius - 12;
          for (let i = 0; i < crownPoints; i++) {
            const cx0 = -crownW / 2 + (crownW / crownPoints) * i;
            const cx1 = cx0 + crownW / crownPoints / 2;
            const cx2 = cx0 + crownW / crownPoints;
            ctx.beginPath();
            ctx.moveTo(cx0, crownBaseY);
            ctx.lineTo(cx1, crownTopY + Math.sin(this.time * 3 + i) * 2);
            ctx.lineTo(cx2, crownBaseY);
            ctx.closePath();
            ctx.fill();
          }
          // Eyes
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(-8, -4, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 4, 8, 0.1, Math.PI - 0.1);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'voidWarden': {
          const vwGlow = ctx.createRadialGradient(sx, sy, e.radius * 0.5, sx, sy, e.radius * 2.5);
          vwGlow.addColorStop(0, COLORS.voidWardenGlow);
          vwGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = vwGlow;
          ctx.fillRect(sx - e.radius * 3, sy - e.radius * 3, e.radius * 6, e.radius * 6);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          // Rotating void rings
          ctx.strokeStyle = 'rgba(136,68,255,0.3)';
          ctx.lineWidth = 2;
          for (let ring = 0; ring < 2; ring++) {
            ctx.save();
            ctx.rotate(this.time * (1 + ring * 0.5));
            ctx.beginPath();
            ctx.ellipse(0, 0, e.radius * 1.4 + ring * 6, e.radius * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : e.color;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
            const px = Math.cos(a) * e.radius;
            const py = Math.sin(a) * e.radius;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          // Eye that tracks player
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#220044';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'deathBringer': {
          const phaseIntensity = e.phase || 1;
          const dbGlow = ctx.createRadialGradient(sx, sy, e.radius * 0.5, sx, sy, e.radius * 2.5);
          dbGlow.addColorStop(0, COLORS.deathBringerGlow);
          dbGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = dbGlow;
          ctx.globalAlpha = 0.5 + (phaseIntensity - 1) * 0.2;
          ctx.fillRect(sx - e.radius * 3, sy - e.radius * 3, e.radius * 6, e.radius * 6);
          ctx.globalAlpha = 1;
          // Phase aura
          if (phaseIntensity >= 2) {
            ctx.strokeStyle = phaseIntensity >= 3 ? 'rgba(0,0,0,0.5)' : 'rgba(255,50,0,0.3)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy, e.radius + 8 + Math.sin(this.time * 4) * 3, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          const redShift = Math.min(1, (phaseIntensity - 1) * 0.3);
          ctx.fillStyle = e.flashTimer > 0 ? COLORS.white : `rgb(255,${Math.max(0, 34 - redShift * 34)},${Math.max(0, 34 - redShift * 34)})`;
          // Scythe blade
          ctx.beginPath();
          ctx.moveTo(-e.radius * 0.3, e.radius);
          ctx.lineTo(0, -e.radius * 0.3);
          ctx.quadraticCurveTo(e.radius * 1.2, -e.radius * 0.8, e.radius * 0.3, -e.radius);
          ctx.lineTo(-e.radius * 0.1, -e.radius * 0.5);
          ctx.quadraticCurveTo(-e.radius * 0.6, -e.radius * 0.3, -e.radius * 0.3, e.radius);
          ctx.closePath();
          ctx.fill();
          // Blade edge glow
          ctx.strokeStyle = 'rgba(255,100,0,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
          // Phase particles
          const particleCount = phaseIntensity * 3;
          for (let i = 0; i < particleCount; i++) {
            const pa = this.time * (1 + phaseIntensity * 0.5) + (Math.PI * 2 / particleCount) * i;
            const pr = e.radius * 0.8 + Math.sin(this.time * 3 + i * 2) * 5;
            ctx.globalAlpha = 0.3 + Math.sin(this.time * 5 + i) * 0.2;
            ctx.fillStyle = COLORS.deathBringer;
            ctx.beginPath();
            ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
          break;
        }
        default: {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(squash, stretch);
          ctx.beginPath();
          ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
      }

      // Burn visual
      if (e.burnTimer > 0) {
        ctx.fillStyle = '#ff6622';
        ctx.globalAlpha = 0.3 + Math.sin(this.time * 10) * 0.1;
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // HP bar for non-boss enemies
      if (e.hp < e.maxHp && !['boss', 'slimeKing', 'voidWarden', 'deathBringer'].includes(e.type)) {
        const bw = e.radius * 2, bh = 3;
        ctx.fillStyle = COLORS.hpBg;
        ctx.fillRect(sx - bw / 2, sy - e.radius - 8, bw, bh);
        ctx.fillStyle = COLORS.hp;
        ctx.fillRect(sx - bw / 2, sy - e.radius - 8, bw * (e.hp / e.maxHp), bh);
      }

      // Stun indicator
      if (e.stunTimer > 0) {
        ctx.fillStyle = '#ffff44';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u2605', sx, sy - e.radius - 5);
      }
    }
  }

  // ---- Boss HP Bar (Full-Width Bottom) ----
  renderBossHPBar(enemies, biomeManager, floor, mobileOffset = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const boss = enemies.find(e => e.alive && ['boss', 'slimeKing', 'voidWarden', 'deathBringer'].includes(e.type));
    if (!boss) return;

    const barH = 20;
    const barY = this.canvas.height - barH - 8 - mobileOffset;
    const barX = w * 0.15;
    const barW = w * 0.7;

    // Background
    ctx.fillStyle = 'rgba(5,5,15,0.85)';
    ctx.fillRect(barX - 5, barY - 22, barW + 10, barH + 28);
    ctx.strokeStyle = boss.color || COLORS.boss;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 5, barY - 22, barW + 10, barH + 28);

    // Boss name + title
    const bossTitle = biomeManager ? biomeManager.getBossTitle(floor) : '';
    ctx.fillStyle = boss.color || COLORS.boss;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${boss.bossName || 'BOSS'}`, barX, barY - 8);
    if (bossTitle) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '10px monospace';
      ctx.fillText(`- ${bossTitle}`, barX + (boss.bossName || 'BOSS').length * 8 + 8, barY - 8);
    }

    // HP numbers
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${boss.hp} / ${boss.maxHp}`, barX + barW, barY - 8);

    // HP bar
    ctx.fillStyle = COLORS.hpBg;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = boss.color || COLORS.hp;
    ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH);

    // Phase notches for DeathBringer
    if (boss.type === 'deathBringer') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      [0.6, 0.3].forEach(pct => {
        const nx = barX + barW * pct;
        ctx.beginPath();
        ctx.moveTo(nx, barY);
        ctx.lineTo(nx, barY + barH);
        ctx.stroke();
      });
    }

    // Bar border
    ctx.strokeStyle = boss.color || COLORS.boss;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.textAlign = 'left';
  }

  // ---- Boss Intro Overlay ----
  renderBossIntro(boss, timer, maxTime, biomeManager, floor) {
    if (!boss) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const progress = 1 - timer / maxTime;

    // Dark vignette
    const vignetteAlpha = 0.7 * (progress < 0.8 ? 1 : (1 - progress) * 5);
    ctx.fillStyle = `rgba(0,0,0,${vignetteAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Spotlight on boss area
    const spotGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 200);
    spotGrad.addColorStop(0, `rgba(0,0,0,0)`);
    spotGrad.addColorStop(1, `rgba(0,0,0,${vignetteAlpha * 0.5})`);
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, w, h);

    // Boss name + title
    const fadeIn = Math.min(1, progress * 3);
    ctx.globalAlpha = fadeIn;

    const bossTitle = biomeManager ? biomeManager.getBossTitle(floor) : '';

    ctx.save();
    ctx.shadowColor = boss.color || COLORS.boss;
    ctx.shadowBlur = 30;
    ctx.fillStyle = boss.color || COLORS.boss;
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.bossName || 'BOSS', w / 2, h / 2 - 20);
    ctx.restore();

    if (bossTitle) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`- ${bossTitle} -`, w / 2, h / 2 + 15);
    }

    ctx.globalAlpha = 1;
  }

  // ---- Lore Text Display ----
  renderLoreText(biomeName, loreText, timer, maxTime) {
    if (!loreText) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const progress = 1 - timer / maxTime;
    // Fade in for first 30%, hold, fade out for last 20%
    let alpha;
    if (progress < 0.3) alpha = progress / 0.3;
    else if (progress > 0.8) alpha = (1 - progress) / 0.2;
    else alpha = 1;

    ctx.globalAlpha = alpha * 0.9;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // Biome name
    ctx.fillStyle = this.biome ? this.biome.accent : COLORS.ui;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(biomeName, w / 2, h / 2 - 30);

    // Lore text with typewriter effect
    const lines = loreText.split('\n');
    const totalChars = loreText.replace(/\n/g, '').length;
    const charsToShow = Math.floor(progress * 2.5 * totalChars);
    let charCount = 0;

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px monospace';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineCharsToShow = Math.max(0, Math.min(line.length, charsToShow - charCount));
      const visibleText = line.substring(0, lineCharsToShow);
      ctx.fillText(visibleText, w / 2, h / 2 + 10 + i * 22);
      charCount += line.length;
    }

    ctx.globalAlpha = 1;
  }

  // ---- Weather Layer ----
  renderWeather(weatherSystem) {
    if (!weatherSystem) return;
    weatherSystem.render(this.ctx);
  }

  // ---- Projectiles ----
  renderProjectiles(projectiles, camera) {
    const ctx = this.ctx;
    for (const p of projectiles) {
      if (!p.alive) continue;
      const sx = camera.screenX(p.x);
      const sy = camera.screenY(p.y);
      const glowColor = p.isPlayerProj ? COLORS.projGlow : COLORS.enemyProjGlow;
      const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, p.radius * 3);
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - p.radius * 3, sy - p.radius * 3, p.radius * 6, p.radius * 6);
      ctx.fillStyle = p.isPlayerProj ? COLORS.projectile : (p.color || COLORS.enemyProjectile);
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Particles ----
  renderParticles(particles, camera) {
    const ctx = this.ctx;
    for (const p of particles.particles) {
      const sx = camera.screenX(p.x);
      const sy = camera.screenY(p.y);
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Floating Text ----
  renderFloatingText(floatingText, camera) {
    const ctx = this.ctx;
    for (const t of floatingText.texts) {
      const sx = camera.screenX(t.x);
      const sy = camera.screenY(t.y);
      ctx.globalAlpha = t.life / t.maxLife;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Lighting ----
  renderLighting(player, camera) {
    const ctx = this.ctx;
    const sx = camera.screenX(player.x);
    const sy = camera.screenY(player.y);
    const flicker = 1 + Math.sin(this.time * 7.3) * 0.02 + Math.sin(this.time * 13.7) * 0.01;
    const lightRadius = VISION_RADIUS * TILE * flicker;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const grad = ctx.createRadialGradient(sx, sy, lightRadius * 0.3, sx, sy, lightRadius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  // ---- Enhanced Minimap ----
  renderMinimap(dungeon, player, enemies, camera) {
    const ctx = this.ctx;
    const scale = 3;
    const mx = this.canvas.width - DUNGEON_W * scale - 15;
    const my = 15;
    const accent = this.biome ? this.biome.accent : COLORS.ui;

    ctx.fillStyle = 'rgba(5,5,15,0.7)';
    ctx.fillRect(mx - 3, my - 3, DUNGEON_W * scale + 6, DUNGEON_H * scale + 6);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 3, my - 3, DUNGEON_W * scale + 6, DUNGEON_H * scale + 6);

    // Determine current room for highlight
    const ptx = toTile(player.x), pty = toTile(player.y);
    let currentRoom = null;
    for (const room of dungeon.rooms) {
      if (ptx >= room.x && ptx < room.x + room.w && pty >= room.y && pty < room.y + room.h) {
        currentRoom = room;
        break;
      }
    }

    // Room shapes
    for (const room of dungeon.rooms) {
      const isCurrentRoom = room === currentRoom;
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (!dungeon.explored[y] || !dungeon.explored[y][x]) continue;
          const vis = dungeon.visibility[y] && dungeon.visibility[y][x];
          ctx.globalAlpha = vis ? 0.9 : 0.35;
          ctx.fillStyle = isCurrentRoom && vis ? accent : '#556';
          ctx.fillRect(mx + x * scale, my + y * scale, scale, scale);
        }
      }
    }

    // Walls (explored only)
    for (let y = 0; y < DUNGEON_H; y++) {
      for (let x = 0; x < DUNGEON_W; x++) {
        if (!dungeon.explored[y][x]) continue;
        if (dungeon.tiles[y][x] !== TileType.WALL) continue;
        ctx.globalAlpha = dungeon.visibility[y][x] ? 0.6 : 0.2;
        ctx.fillStyle = '#334';
        ctx.fillRect(mx + x * scale, my + y * scale, scale, scale);
      }
    }

    // Special room markers
    for (const special of dungeon.specialRooms) {
      const room = special.room;
      if (!room) continue;
      if (!dungeon.explored[room.cy] || !dungeon.explored[room.cy][room.cx]) continue;
      const smx = mx + room.cx * scale;
      const smy = my + room.cy * scale;
      ctx.globalAlpha = 0.8;
      if (special.type === 'treasure') ctx.fillStyle = COLORS.treasure;
      else if (special.type === 'shop') ctx.fillStyle = COLORS.shop;
      else if (special.type === 'shrine') ctx.fillStyle = COLORS.shrine;
      else if (special.type === 'fountain') ctx.fillStyle = COLORS.fountain;
      ctx.fillRect(smx - 1, smy - 1, scale + 2, scale + 2);
    }

    // Boss room marker
    if (dungeon.bossRoom) {
      const br = dungeon.bossRoom;
      if (dungeon.explored[br.cy] && dungeon.explored[br.cy][br.cx]) {
        ctx.fillStyle = COLORS.boss;
        ctx.globalAlpha = 0.8 + Math.sin(this.time * 3) * 0.2;
        const brmx = mx + br.cx * scale;
        const brmy = my + br.cy * scale;
        // Skull-like indicator (X shape)
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u2620', brmx + 1, brmy + 5);
      }
    }

    // Stairs
    const stx = dungeon.stairsPos.x, sty = dungeon.stairsPos.y;
    if (dungeon.explored[sty] && dungeon.explored[sty][stx]) {
      ctx.fillStyle = COLORS.stairs;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(mx + stx * scale - 1, my + sty * scale - 1, scale + 2, scale + 2);
    }

    // Enemies
    ctx.globalAlpha = 1;
    for (const e of enemies) {
      if (!e.alive) continue;
      const etx = toTile(e.x), ety = toTile(e.y);
      if (!dungeon.visibility[ety] || !dungeon.visibility[ety][etx]) continue;
      ctx.fillStyle = e.color;
      const eSize = ['boss', 'slimeKing', 'voidWarden', 'deathBringer'].includes(e.type) ? scale + 1 : scale;
      ctx.fillRect(mx + etx * scale, my + ety * scale, eSize, eSize);
    }

    // Player
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(mx + ptx * scale - 1, my + pty * scale - 1, scale + 2, scale + 2);
    ctx.globalAlpha = 1;
  }

  // ---- HUD ----
  renderHUD(player, floor, notifications, mobileOffset = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const hbx = 20, hby = h - 45 - mobileOffset;
    const hbw = 200, hbh = 20;

    ctx.fillStyle = COLORS.uiBg;
    ctx.fillRect(hbx - 5, hby - 25, hbw + 10, 55);
    ctx.strokeStyle = COLORS.uiBorder;
    ctx.strokeRect(hbx - 5, hby - 25, hbw + 10, 55);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HP', hbx, hby - 8);
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`${player.hp}/${player.maxHp}`, hbx + 25, hby - 8);

    ctx.fillStyle = COLORS.hpBg;
    ctx.fillRect(hbx, hby, hbw, hbh);
    const hpPct = player.hp / player.maxHp;
    const hpColor = hpPct > 0.5 ? COLORS.player : hpPct > 0.25 ? '#ffaa00' : COLORS.hp;
    ctx.fillStyle = hpColor;
    ctx.fillRect(hbx, hby, hbw * hpPct, hbh);
    ctx.strokeStyle = COLORS.uiBorder;
    ctx.strokeRect(hbx, hby, hbw, hbh);

    // Floor + biome name
    const biomeName = this.biome ? this.biome.name : '';
    const floorLabel = biomeName ? `F${floor} ${biomeName}` : `FLOOR ${floor}`;
    const floorLabelW = Math.max(90, floorLabel.length * 8 + 16);
    ctx.fillStyle = COLORS.uiBg;
    ctx.fillRect(hbx - 5, hby - 55, floorLabelW, 25);
    ctx.strokeStyle = COLORS.uiBorder;
    ctx.strokeRect(hbx - 5, hby - 55, floorLabelW, 25);
    ctx.fillStyle = this.biome ? this.biome.accent : COLORS.ui;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(floorLabel, hbx, hby - 38);

    // Items
    if (player.items.length > 0) {
      const ix = hbx + hbw + 20;
      const iy = hby;
      ctx.fillStyle = COLORS.uiBg;
      ctx.fillRect(ix - 5, iy - 25, player.items.length * 28 + 10, 55);
      ctx.strokeStyle = COLORS.uiBorder;
      ctx.strokeRect(ix - 5, iy - 25, player.items.length * 28 + 10, 55);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px monospace';
      ctx.fillText('ITEMS', ix, iy - 8);
      for (let i = 0; i < player.items.length; i++) {
        const def = ITEM_DEFS[player.items[i]];
        if (!def) continue;
        ctx.fillStyle = def.color;
        ctx.fillRect(ix + i * 28, iy, 22, 20);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.symbol, ix + i * 28 + 11, iy + 14);
      }
      ctx.textAlign = 'left';
    }

    // Synergies
    if (player.activeSynergies.length > 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      for (let i = 0; i < player.activeSynergies.length; i++) {
        ctx.fillText(`\u2726 ${player.activeSynergies[i]}`, hbx, hby - 65 - i * 16);
      }
    }

    // Dash (hidden on mobile — replaced by visual button)
    if (mobileOffset === 0) {
      const dashX = hbx, dashY = hby + 24;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText('[SPACE] Dash', dashX, dashY);
      if (player.dashCooldown > 0) {
        ctx.fillText(` (${player.dashCooldown.toFixed(1)}s)`, dashX + 85, dashY);
      } else {
        ctx.fillStyle = COLORS.ui;
        ctx.fillText(' READY', dashX + 85, dashY);
      }
    }

    // Notifications
    if (notifications.length > 0) {
      for (let i = 0; i < notifications.length; i++) {
        const n = notifications[i];
        ctx.globalAlpha = Math.min(1, n.life / 0.5);
        ctx.fillStyle = n.color || COLORS.item;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.text, w / 2, 80 + i * 25);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Kill count
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Kills: ${player.kills}`, w - 20, h - 20 - mobileOffset);
    ctx.textAlign = 'left';
  }

  // ---- Combo UI ----
  renderComboUI(combo) {
    if (!combo) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const scoreScale = combo.scorePopTimer > 0 ? 1 + combo.scorePopTimer * 0.5 : 1;
    ctx.save();
    ctx.translate(80, 30);
    ctx.scale(scoreScale, scoreScale);
    ctx.fillStyle = COLORS.comboText;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${combo.score}`, -60, 0);
    if (combo.scorePopTimer > 0 && combo.lastScoreGain > 0) {
      ctx.globalAlpha = combo.scorePopTimer * 2;
      ctx.fillStyle = COLORS.ui;
      ctx.font = '12px monospace';
      ctx.fillText(`+${combo.lastScoreGain}`, 60, 0);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (combo.displayTimer > 0 && combo.count >= 2) {
      const comboAlpha = Math.min(1, combo.displayTimer);
      ctx.globalAlpha = comboAlpha;
      const hitScale = combo.displayTimer > 1.8 ? 1 + (2 - combo.displayTimer) * 2 : 1;
      ctx.save();
      ctx.translate(w / 2, 60);
      ctx.scale(hitScale, hitScale);
      ctx.fillStyle = COLORS.comboText;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`x${combo.count}`, 0, 0);
      ctx.restore();
      ctx.fillStyle = COLORS.comboText;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${combo.multiplier}x COMBO`, w / 2, 85);
      const barW = 100, barH = 4;
      const barX = w / 2 - barW / 2, barY = 92;
      ctx.fillStyle = 'rgba(255,221,0,0.2)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = COLORS.comboText;
      ctx.fillRect(barX, barY, barW * (combo.timer / combo.window), barH);
      ctx.globalAlpha = 1;
    }
  }

  // ---- Pause Menu ----
  renderPauseMenu(player, floor, combo, elapsed) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = 'rgba(5,5,15,0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.shadowColor = COLORS.ui;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.ui;
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h / 2 - 140);
    ctx.restore();
    const statY = h / 2 - 85;
    const lineH = 24;
    ctx.fillStyle = COLORS.text;
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    const timeMin = Math.floor(elapsed / 60);
    const timeSec = Math.floor(elapsed % 60);
    const timeStr = `${timeMin}:${timeSec.toString().padStart(2, '0')}`;
    ctx.fillText(`Floor: ${floor}`, w / 2, statY);
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, w / 2, statY + lineH);
    ctx.fillText(`Kills: ${player.kills}`, w / 2, statY + lineH * 2);
    ctx.fillText(`Score: ${combo ? combo.score : 0}`, w / 2, statY + lineH * 3);
    ctx.fillText(`Time: ${timeStr}`, w / 2, statY + lineH * 4);
    if (player.items.length > 0) {
      const itemStartY = statY + lineH * 5 + 15;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px monospace';
      ctx.fillText('-- ITEMS --', w / 2, itemStartY);
      for (let i = 0; i < player.items.length; i++) {
        const def = ITEM_DEFS[player.items[i]];
        if (!def) continue;
        ctx.fillStyle = def.color;
        ctx.font = '13px monospace';
        ctx.fillText(`${def.name}: ${def.desc}`, w / 2, itemStartY + 18 + i * 18);
      }
      if (player.activeSynergies.length > 0) {
        const synY = itemStartY + 18 + player.items.length * 18 + 10;
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '12px monospace';
        ctx.fillText('-- SYNERGIES --', w / 2, synY);
        for (let i = 0; i < player.activeSynergies.length; i++) {
          const syn = SYNERGIES.find(s => s.name === player.activeSynergies[i]);
          ctx.fillStyle = syn ? syn.color : COLORS.text;
          ctx.font = '13px monospace';
          ctx.fillText(syn ? `${syn.name}: ${syn.desc}` : player.activeSynergies[i], w / 2, synY + 18 + i * 18);
        }
      }
    }
    const ctrlY = h - 90;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WASD - Move  |  Mouse - Aim  |  Click - Shoot  |  Space - Dash', w / 2, ctrlY);
    ctx.fillText('E - Interact  |  M - Mute', w / 2, ctrlY + 18);
    const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.text;
    ctx.font = '15px monospace';
    ctx.fillText('[ESC] Resume  |  [M] Mute', w / 2, h - 40);
    ctx.globalAlpha = 1;
  }

  // ---- Screen Flash ----
  renderScreenFlash(screenEffects) {
    if (!screenEffects || screenEffects.flashTimer <= 0) return;
    const ctx = this.ctx;
    const alpha = screenEffects.flashTimer / screenEffects.flashDuration;
    ctx.fillStyle = screenEffects.flashColor;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
  }

  // ---- Item Tooltips ----
  renderItemTooltips(items, player, camera, dungeon) {
    if (!items || !player.alive) return;
    const ctx = this.ctx;
    for (const item of items) {
      if (item.collected) continue;
      const tx = toTile(item.x), ty = toTile(item.y);
      if (!dungeon.visibility[ty] || !dungeon.visibility[ty][tx]) continue;
      if (dist(player.x, player.y, item.x, item.y) > TILE * 2) continue;
      const def = ITEM_DEFS[item.type];
      if (!def) continue;
      const sx = camera.screenX(item.x);
      const sy = camera.screenY(item.y);
      ctx.font = 'bold 12px monospace';
      const nameWidth = ctx.measureText(def.name).width;
      ctx.font = '11px monospace';
      const descWidth = ctx.measureText(def.desc).width;
      const boxW = Math.max(nameWidth, descWidth) + 20;
      const boxH = 42;
      const boxX = sx - boxW / 2;
      const boxY = sy - 45 - boxH;
      ctx.fillStyle = COLORS.uiBg;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = def.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, sx, boxY + 16);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px monospace';
      ctx.fillText(def.desc, sx, boxY + 32);
      if (item.shopItem) {
        ctx.fillStyle = COLORS.shop;
        ctx.font = '10px monospace';
        ctx.fillText('[E] Pick Up', sx, boxY + boxH + 12);
      }
    }
    ctx.textAlign = 'left';
  }

  // ---- Tutorial Hints ----
  renderTutorialHints(tutorialState, isMobile = false) {
    if (!tutorialState) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const yOffset = isMobile ? 80 : 0;
    let hintText = null;
    if (tutorialState.showMove) hintText = isMobile ? 'Left stick to Move' : 'WASD to Move';
    else if (tutorialState.showShoot) hintText = isMobile ? 'Right side to Aim & Shoot' : 'Click to Shoot';
    else if (tutorialState.showDash) hintText = isMobile ? 'Tap DASH to Dash' : 'Space to Dash';
    else if (tutorialState.showPickup) hintText = 'Walk over items to pick up';
    if (!hintText) return;
    const pulse = 0.5 + Math.sin(this.time * 2) * 0.3;
    ctx.globalAlpha = pulse;
    const textW = ctx.measureText(hintText).width || hintText.length * 9;
    ctx.fillStyle = COLORS.uiBg;
    ctx.fillRect(w / 2 - textW / 2 - 20, h - 120 - yOffset, textW + 40, 30);
    ctx.strokeStyle = COLORS.uiBorder;
    ctx.strokeRect(w / 2 - textW / 2 - 20, h - 120 - yOffset, textW + 40, 30);
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hintText, w / 2, h - 101 - yOffset);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ---- Ambient Dust ----
  renderAmbientDust(camera) {
    const ctx = this.ctx;
    const dustColor = this.biome ? this.biome.particleColors[0] : '#444466';
    for (const dust of this.dustParticles) {
      const worldX = camera.x + camera.w / 2 + dust.ox + Math.sin(this.time * dust.speed + dust.phase) * 40;
      const worldY = camera.y + camera.h / 2 + dust.oy + Math.cos(this.time * dust.speed * 0.7 + dust.phase) * 30;
      const sx = camera.screenX(worldX);
      const sy = camera.screenY(worldY);
      if (sx < -10 || sx > camera.w + 10 || sy < -10 || sy > camera.h + 10) continue;
      ctx.globalAlpha = dust.alpha + Math.sin(this.time * 1.5 + dust.phase) * 0.03;
      ctx.fillStyle = dustColor;
      ctx.fillRect(sx, sy, dust.size, dust.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Enhanced Title Screen ----
  renderTitleScreen(time, highScores) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, w, h);

    // Animated void background particles from random biome
    const biomeColors = [['#66ff44', '#33aa22'], ['#8899bb', '#667799'], ['#ff6622', '#ffaa44'], ['#aaddff', '#88ccff'], ['#aa44ff', '#8822dd']];
    const colorSet = biomeColors[Math.floor(time * 0.1) % biomeColors.length];
    for (let i = 0; i < 60; i++) {
      const px = (Math.sin(time * 0.3 + i * 1.3) * 0.5 + 0.5) * w;
      const py = (Math.cos(time * 0.2 + i * 0.9) * 0.5 + 0.5) * h;
      const alpha = Math.sin(time + i) * 0.3 + 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? colorSet[0] : colorSet[1];
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;

    // CRT scanlines on title
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Title with glow pulse
    const glowIntensity = Math.sin(time * 2) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 30 * glowIntensity;
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VOID CRAWLER', w / 2, h / 2 - 60);
    ctx.restore();

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '16px monospace';
    ctx.fillText('A Procedural Dungeon Crawler', w / 2, h / 2 - 20);

    const pulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.fillText('[ Press ENTER or CLICK to Start ]', w / 2, h / 2 + 40);
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    ctx.fillText('WASD - Move  |  Mouse - Aim  |  Click - Shoot  |  Space - Dash', w / 2, h / 2 + 100);
    ctx.fillText('M - Toggle Mute  |  ESC - Pause  |  Survive as deep as you can', w / 2, h / 2 + 125);

    // High scores panel
    if (highScores && highScores.length > 0) {
      const hsY = h / 2 + 155;
      const panelW = 320;
      const panelH = Math.min(highScores.length, 5) * 18 + 30;
      ctx.fillStyle = 'rgba(5,5,15,0.8)';
      ctx.fillRect(w / 2 - panelW / 2, hsY - 10, panelW, panelH);
      ctx.strokeStyle = COLORS.comboText;
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - panelW / 2, hsY - 10, panelW, panelH);

      ctx.fillStyle = COLORS.comboText;
      ctx.font = 'bold 14px monospace';
      ctx.fillText('-- HIGH SCORES --', w / 2, hsY + 8);
      const displayCount = Math.min(5, highScores.length);
      for (let i = 0; i < displayCount; i++) {
        const entry = highScores[i];
        ctx.fillStyle = i === 0 ? COLORS.comboText : COLORS.textDim;
        ctx.font = '13px monospace';
        ctx.fillText(`${i + 1}. Score: ${entry.score}  Floor: ${entry.floor || '?'}  Kills: ${entry.kills || '?'}`, w / 2, hsY + 26 + i * 18);
      }
    }

    ctx.fillStyle = '#333';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('v3.0', w / 2, h - 30);
  }

  // ---- Enhanced Death Screen ----
  renderDeathScreen(player, floor, time, elapsed, score, highScores, biomeManager, aiManager) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Biome-themed background
    const deathColor = this.biome ? this.biome.accent : COLORS.hp;
    ctx.fillStyle = 'rgba(5,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);

    // Biome fog
    if (this.biome && this.biome.fog) {
      ctx.fillStyle = this.biome.fog;
      ctx.fillRect(0, 0, w, h);
    }

    // Death text
    ctx.save();
    ctx.shadowColor = deathColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = deathColor;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', w / 2, h / 2 - 110);
    ctx.restore();

    // Death flavor text — AI chronicle or static fallback
    const chronicle = aiManager && aiManager.deathChronicle;
    if (chronicle) {
      ctx.fillStyle = '#9999bb';
      ctx.font = 'italic 13px monospace';
      ctx.textAlign = 'center';
      this._renderWrappedText(ctx, `"${chronicle}"`, w / 2, h / 2 - 80, w * 0.6, 18);
    } else {
      const deathText = biomeManager ? biomeManager.getDeathText(floor) : '';
      if (deathText) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = 'italic 14px monospace';
        ctx.fillText(`"${deathText}"`, w / 2, h / 2 - 75);
      }
    }

    // Animated stat count-up
    const countUpProgress = Math.min(1, time / 1.5);
    const animFloor = Math.floor(floor * countUpProgress);
    const animKills = Math.floor(player.kills * countUpProgress);
    const animItems = Math.floor(player.items.length * countUpProgress);
    const animTime = Math.floor(elapsed * countUpProgress);
    const animScore = Math.floor((score || 0) * countUpProgress);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '16px monospace';
    ctx.fillText(`Floor Reached: ${animFloor}`, w / 2, h / 2 - 40);
    ctx.fillText(`Enemies Killed: ${animKills}`, w / 2, h / 2 - 10);
    ctx.fillText(`Items Collected: ${animItems}`, w / 2, h / 2 + 20);
    ctx.fillText(`Time Survived: ${animTime}s`, w / 2, h / 2 + 50);

    ctx.fillStyle = COLORS.comboText;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`SCORE: ${animScore}`, w / 2, h / 2 + 85);

    // New high score check
    let isNewHighScore = false;
    if (highScores && score > 0) {
      if (highScores.length === 0 || score >= (highScores[0]?.score || 0)) {
        isNewHighScore = true;
      }
    }
    if (isNewHighScore && countUpProgress >= 1) {
      const nhsPulse = Math.sin(time * 4) * 0.3 + 0.7;
      ctx.globalAlpha = nhsPulse;
      ctx.fillStyle = COLORS.comboText;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('NEW HIGH SCORE!', w / 2, h / 2 + 108);
      ctx.globalAlpha = 1;
    }

    // Top scores
    if (highScores && highScores.length > 0) {
      const hsY = h / 2 + 135;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px monospace';
      ctx.fillText('-- TOP SCORES --', w / 2, hsY);
      const displayCount = Math.min(3, highScores.length);
      for (let i = 0; i < displayCount; i++) {
        const entry = highScores[i];
        ctx.fillStyle = i === 0 ? COLORS.comboText : COLORS.textDim;
        ctx.font = '12px monospace';
        ctx.fillText(`${i + 1}. ${entry.score} pts (Floor ${entry.floor || '?'})`, w / 2, hsY + 18 + i * 16);
      }
    }

    const pulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.fillText('[ Press ENTER or CLICK to Retry ]', w / 2, h - 50);
    ctx.globalAlpha = 1;
  }

  // ---- Floor Transition ----
  renderFloorTransition(floor, progress) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = `rgba(5,5,10,${1 - Math.abs(progress - 0.5) * 2})`;
    ctx.fillRect(0, 0, w, h);
    if (progress > 0.3 && progress < 0.7) {
      ctx.fillStyle = this.biome ? this.biome.accent : COLORS.ui;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`FLOOR ${floor}`, w / 2, h / 2);
      if (floor % 5 === 0) {
        ctx.fillStyle = COLORS.boss;
        ctx.font = '18px monospace';
        ctx.fillText('\u26A0 BOSS FLOOR \u26A0', w / 2, h / 2 + 40);
      }
    }
  }

  // ---- AI Narrator Box ----
  renderNarrator(aiManager) {
    if (!aiManager || !aiManager.narratorText) return;
    const alpha = aiManager.getNarratorAlpha();
    if (alpha <= 0) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const boxW = Math.min(600, w * 0.6);
    const boxH = 50;
    const boxX = (w - boxW) / 2;
    const boxY = h - 130;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Dark background
    ctx.fillStyle = 'rgba(5,5,15,0.75)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Left accent bar (biome color)
    const accent = this.biome ? this.biome.accent : COLORS.ui;
    ctx.fillStyle = accent;
    ctx.fillRect(boxX, boxY, 3, boxH);

    // "NARRATOR" label
    ctx.fillStyle = 'rgba(150,150,170,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NARRATOR', boxX + 10, boxY + 12);

    // Narrator text (italic, word-wrapped)
    ctx.fillStyle = '#ccccdd';
    ctx.font = 'italic 13px monospace';
    const textX = boxX + 10;
    const textMaxW = boxW - 20;
    const words = aiManager.narratorText.split(' ');
    let line = '';
    let lineY = boxY + 28;
    const lineH = 16;

    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > textMaxW && line) {
        ctx.fillText(line, textX, lineY);
        line = word;
        lineY += lineH;
        if (lineY > boxY + boxH - 4) break;
      } else {
        line = test;
      }
    }
    if (line && lineY <= boxY + boxH - 4) {
      ctx.fillText(line, textX, lineY);
    }

    // Blinking typewriter cursor while revealing
    if (aiManager.narratorReveal < 1 && Math.floor(this.time * 4) % 2 === 0) {
      const cursorX = textX + ctx.measureText(line).width + 2;
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(cursorX, lineY - 10, 7, 12);
    }

    ctx.restore();
  }

  // ---- Boss Dialogue (shown during boss intro) ----
  renderBossDialogue(text, bossColor) {
    if (!text) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = bossColor || COLORS.boss;
    ctx.font = 'italic 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`"${text}"`, w / 2, h / 2 + 45);
    ctx.restore();
  }

  // ---- Wrapped Text Helper (center-aligned) ----
  _renderWrappedText(ctx, text, cx, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, y + i * lineHeight);
    }
    return lines.length;
  }

  updateTime(dt) {
    this.time += dt;
  }
}
