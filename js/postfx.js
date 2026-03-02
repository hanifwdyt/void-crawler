// ============================================================
// VOID CRAWLER - Post-Processing Effects
// Vignette, CRT Scanlines, Chromatic Aberration, Distortion
// All Canvas 2D, no WebGL
// ============================================================

class PostFX {
  constructor() {
    this.vignette = 0.3;
    this.scanlines = true;
    this.aberration = 0;
    this.distortion = 0;
    this._aberrationTimer = 0;
    this._distortionBase = 0;
  }

  // Trigger temporary chromatic aberration (on damage, boss kill, etc.)
  triggerAberration(intensity = 1, duration = 0.2) {
    this.aberration = intensity;
    this._aberrationTimer = duration;
  }

  // Set base distortion from biome
  setDistortion(amount) {
    this._distortionBase = amount;
    this.distortion = amount;
  }

  // Set biome-appropriate defaults
  setBiomeDefaults(biomeKey) {
    switch (biomeKey) {
      case 'corruptedForest':
        this.vignette = 0.35;
        this.scanlines = false;
        this._distortionBase = 0;
        break;
      case 'abandonedCity':
        this.vignette = 0.3;
        this.scanlines = true;
        this._distortionBase = 0;
        break;
      case 'infernalDepths':
        this.vignette = 0.4;
        this.scanlines = false;
        this._distortionBase = 0.02;
        break;
      case 'frozenAbyss':
        this.vignette = 0.25;
        this.scanlines = false;
        this._distortionBase = 0;
        break;
      case 'voidCore':
        this.vignette = 0.5;
        this.scanlines = true;
        this._distortionBase = 0.05;
        break;
      default:
        this.vignette = 0.3;
        this.scanlines = false;
        this._distortionBase = 0;
    }
    this.distortion = this._distortionBase;
  }

  update(dt) {
    // Aberration decay
    if (this._aberrationTimer > 0) {
      this._aberrationTimer -= dt;
      if (this._aberrationTimer <= 0) {
        this.aberration = 0;
        this._aberrationTimer = 0;
      }
    }

    // Distortion subtle variation
    this.distortion = this._distortionBase + Math.sin(Date.now() * 0.001) * this._distortionBase * 0.3;
  }

  apply(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;

    // --- Vignette ---
    if (this.vignette > 0) {
      const gradient = ctx.createRadialGradient(
        w / 2, h / 2, w * 0.25,
        w / 2, h / 2, w * 0.75
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, `rgba(0,0,0,${this.vignette})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // --- CRT Scanlines ---
    if (this.scanlines) {
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
    }

    // --- Chromatic Aberration ---
    if (this.aberration > 0.01) {
      const offset = Math.ceil(this.aberration * 3);
      // Draw screen-edge color fringing
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.aberration * 0.15;
      // Red channel offset
      ctx.fillStyle = 'rgba(255,0,0,0.1)';
      ctx.fillRect(offset, 0, w, h);
      // Blue channel offset opposite
      ctx.fillStyle = 'rgba(0,0,255,0.1)';
      ctx.fillRect(-offset, 0, w, h);
      ctx.restore();
    }

    // --- Screen Distortion (Void Core biome) ---
    if (this.distortion > 0.01) {
      // Horizontal wave lines to simulate distortion
      ctx.save();
      ctx.globalAlpha = this.distortion * 2;
      ctx.globalCompositeOperation = 'overlay';
      const t = Date.now() * 0.002;
      for (let i = 0; i < 3; i++) {
        const yPos = (Math.sin(t + i * 2) * 0.5 + 0.5) * h;
        ctx.fillStyle = `rgba(${i === 0 ? 100 : 40},${i === 1 ? 20 : 10},${i === 2 ? 100 : 60},0.15)`;
        ctx.fillRect(0, yPos - 2, w, 4);
      }
      ctx.restore();
    }
  }
}
