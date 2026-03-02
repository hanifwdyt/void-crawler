// ============================================================
// VOID CRAWLER - Engine Core
// Utils, Input, Audio, Particles, Camera, Combo, ScreenEffects, HighScore
// ============================================================

const TILE = 32;
const DUNGEON_W = 50;
const DUNGEON_H = 50;
const VISION_RADIUS = 8;

const COLORS = {
  void: '#05050a',
  wall: '#1a1a2e',
  wallTop: '#252545',
  wallEdge: '#2e2e55',
  floor: '#0e0e18',
  floorAlt: '#111122',
  floorDot: '#1a1a30',
  player: '#00ff88',
  playerDark: '#00aa55',
  playerGlow: 'rgba(0,255,136,0.15)',
  dash: 'rgba(0,255,136,0.4)',
  projectile: '#00ccff',
  projGlow: 'rgba(0,204,255,0.3)',
  enemyProjectile: '#ff4466',
  enemyProjGlow: 'rgba(255,68,102,0.3)',
  slime: '#66ff44',
  bat: '#dd55ff',
  shooter: '#ff9944',
  charger: '#ff4444',
  exploder: '#ff8800',
  necromancer: '#aa44ff',
  mimic: '#ffcc00',
  teleporter: '#00ffee',
  boss: '#ff0055',
  bossGlow: 'rgba(255,0,85,0.2)',
  slimeKing: '#44ff22',
  slimeKingGlow: 'rgba(68,255,34,0.2)',
  voidWarden: '#8844ff',
  voidWardenGlow: 'rgba(136,68,255,0.2)',
  deathBringer: '#ff2222',
  deathBringerGlow: 'rgba(255,34,34,0.2)',
  item: '#ffcc00',
  itemGlow: 'rgba(255,204,0,0.2)',
  stairs: '#aa66ff',
  stairsGlow: 'rgba(170,102,255,0.25)',
  hp: '#ff3366',
  hpBg: '#330a15',
  text: '#eeeeff',
  textDim: '#666688',
  ui: '#00ff88',
  uiBg: 'rgba(5,5,15,0.85)',
  uiBorder: '#1a1a3a',
  dmgText: '#ff4444',
  healText: '#44ff88',
  blockedText: '#4488ff',
  comboText: '#ffdd00',
  white: '#ffffff',
  spike: '#888899',
  poison: '#44aa22',
  treasure: '#ffdd44',
  shop: '#44ddff',
  shrine: '#ff66aa',
  fountain: '#44aaff',
};

// --- Math Utilities ---
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function toTile(px) { return Math.floor(px / TILE); }
function toWorld(tile) { return tile * TILE + TILE / 2; }

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return dist(cx, cy, nx, ny) < cr;
}

function lineOfSight(x1, y1, x2, y2, tiles) {
  const d = dist(x1, y1, x2, y2);
  const steps = Math.ceil(d / (TILE / 2));
  if (steps === 0) return true;
  const dx = (x2 - x1) / steps;
  const dy = (y2 - y1) / steps;
  for (let i = 0; i <= steps; i++) {
    const tx = toTile(x1 + dx * i);
    const ty = toTile(y1 + dy * i);
    if (tx < 0 || ty < 0 || tx >= DUNGEON_W || ty >= DUNGEON_H) return false;
    if (tiles[ty][tx] <= 1) return false;
  }
  return true;
}

// --- Input System ---
class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseJustPressed = false;
    this._prevMouse = false;
    this._prevKeys = {};
    this.canvas = canvas;
    this.touchControls = null;

    window.addEventListener('keydown', e => {
      if (['w','a','s','d',' ','enter','escape','m','e'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', e => {
      this.mouseDown = true;
      e.preventDefault();
    });
    canvas.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  update() {
    this.mouseJustPressed = this.mouseDown && !this._prevMouse;
    this._prevMouse = this.mouseDown;

    if (this.touchControls) {
      this.touchControls.update();
      // Merge aim stick into mouse position
      if (this.touchControls.aimStick.active) {
        const a = this.touchControls.aimStick.angle;
        this.mouseX = this.canvas.width / 2 + Math.cos(a) * 200;
        this.mouseY = this.canvas.height / 2 + Math.sin(a) * 200;
      }
      // Merge shooting
      if (this.touchControls.aimStick.isShooting) {
        this.mouseDown = true;
      }
      // Any touch = mouseJustPressed (for menus)
      if (this.touchControls._anyTouchStarted) {
        this.mouseJustPressed = true;
        this.touchControls._anyTouchStarted = false;
      }
    }
  }

  isDown(key) {
    if (this.keys[key]) return true;
    if (!this.touchControls) return false;
    if (key === ' ' && this.touchControls.dashButton.pressed) return true;
    return false;
  }

  justPressed(key) {
    if (this.keys[key] && !this._prevKeys[key]) return true;
    if (!this.touchControls) return false;
    if (key === 'escape' && this.touchControls.pauseButton.justPressed) return true;
    if (key === 'e' && this.touchControls.interactButton.justPressed) return true;
    return false;
  }

  postUpdate() {
    this._prevKeys = {};
    for (const k in this.keys) this._prevKeys[k] = this.keys[k];
  }
}

// --- Audio System ---
class GameAudio {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this._footstepCooldown = 0;
    this.ambientOsc = null;
    this.ambientGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {}
  }

  _play(fn) {
    if (!this.initialized || this.muted) return;
    try { fn(this.ctx); } catch (e) {}
  }

  shoot() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.08);
    });
  }

  hit() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.12);
    });
  }

  enemyHit() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(300, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.06);
    });
  }

  dash() {
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    });
  }

  pickup() {
    this._play(ctx => {
      const t = ctx.currentTime;
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t + i * 0.06);
        g.gain.linearRampToValueAtTime(0.06, t + i * 0.06 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.15);
      });
    });
  }

  death() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.8);
    });
  }

  stairs() {
    this._play(ctx => {
      const t = ctx.currentTime;
      [330, 440, 554, 659].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t + i * 0.1);
        g.gain.linearRampToValueAtTime(0.06, t + i * 0.1 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
        o.connect(g).connect(ctx.destination);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.3);
      });
    });
  }

  enemyDeath() {
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      src.connect(g).connect(ctx.destination);
      src.start();
    });
  }

  bossRoar() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(80, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.5);
    });
  }

  footstep(dt) {
    if (this._footstepCooldown > 0) {
      this._footstepCooldown -= dt;
      return;
    }
    this._footstepCooldown = 0.25;
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    });
  }

  wallHit() {
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    });
  }

  chargerWarning() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.3);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
    });
  }

  explosion() {
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    });
  }

  comboSound(count) {
    this._play(ctx => {
      const t = ctx.currentTime;
      const baseFreq = 440 + count * 60;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(baseFreq, t);
      o.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.1);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.15);
    });
  }

  startAmbient(floor, biome) {
    this.stopAmbient();
    this._play(ctx => {
      const freq = biome ? biome.ambientFreq : Math.max(25, 50 - floor * 2);
      const filterFreq = biome ? biome.ambientFilter : 100;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start();
      this.ambientOsc = osc;
      this.ambientGain = gain;
    });
  }

  stopAmbient() {
    if (this.ambientOsc) {
      try { this.ambientOsc.stop(); } catch (e) {}
      this.ambientOsc = null;
      this.ambientGain = null;
    }
  }
}

// --- Particle System ---
class Particle {
  constructor(x, y, vx, vy, life, color, size, shape = 'rect', rotation = 0, rotSpeed = 0, gravity = 0) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = this.maxLife = life;
    this.color = color;
    this.size = size;
    this.shape = shape;
    this.rotation = rotation;
    this.rotSpeed = rotSpeed;
    this.gravity = gravity;
    this.alive = true;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotSpeed * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count, opts = {}) {
    const {
      speed = 100, spread = Math.PI * 2, angle: dir = 0,
      life = 0.5, color = COLORS.white, size = 3,
      sizeVar = 1, lifeVar = 0.2, speedVar = 0.5,
      shape = 'rect', rotSpeed = 0, gravity = 0
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (1 + (Math.random() - 0.5) * speedVar);
      const l = life + (Math.random() - 0.5) * lifeVar;
      const sz = size + (Math.random() - 0.5) * sizeVar;
      const sh = Array.isArray(shape) ? randChoice(shape) : shape;
      const rs = rotSpeed + (Math.random() - 0.5) * rotSpeed;
      const rot = Math.random() * Math.PI * 2;
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, l, color, sz, sh, rot, rs, gravity));
    }
  }

  trail(x, y, color = COLORS.projectile, size = 2) {
    this.particles.push(new Particle(
      x + rand(-2, 2), y + rand(-2, 2),
      rand(-15, 15), rand(-15, 15),
      rand(0.1, 0.25), color, size
    ));
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) this.particles.splice(i, 1);
    }
  }

  clear() { this.particles = []; }
}

// --- Camera ---
class Camera {
  constructor(canvasW, canvasH) {
    this.x = 0; this.y = 0;
    this.w = canvasW; this.h = canvasH;
    this.targetX = 0; this.targetY = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  follow(x, y, dt) {
    this.targetX = x - this.w / 2;
    this.targetY = y - this.h / 2;
    this.x = lerp(this.x, this.targetX, 8 * dt);
    this.y = lerp(this.y, this.targetY, 8 * dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = this.shakeIntensity * Math.max(0, this.shakeTimer / 0.2);
      this.shakeX = rand(-t, t);
      this.shakeY = rand(-t, t);
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  shake(intensity = 4) {
    this.shakeIntensity = intensity;
    this.shakeTimer = 0.2;
  }

  screenX(wx) { return wx - this.x + this.shakeX; }
  screenY(wy) { return wy - this.y + this.shakeY; }

  resize(w, h) { this.w = w; this.h = h; }
}

// --- Floating Text ---
class FloatingText {
  constructor() { this.texts = []; }

  add(x, y, text, color = COLORS.dmgText) {
    this.texts.push({ x, y, text, color, vy: -60, life: 0.8, maxLife: 0.8 });
  }

  update(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}

// --- Combo System ---
class ComboSystem {
  constructor() {
    this.count = 0;
    this.timer = 0;
    this.window = 3;
    this.multiplier = 1;
    this.score = 0;
    this.bestCombo = 0;
    this.displayTimer = 0;
    this.scorePopTimer = 0;
    this.lastScoreGain = 0;
  }

  registerKill(audio) {
    this.count++;
    this.timer = this.window;
    this.displayTimer = 2;
    if (this.count > this.bestCombo) this.bestCombo = this.count;

    if (this.count >= 10) this.multiplier = 5;
    else if (this.count >= 7) this.multiplier = 3;
    else if (this.count >= 4) this.multiplier = 2;
    else if (this.count >= 2) this.multiplier = 1.5;
    else this.multiplier = 1;

    const points = Math.round(10 * this.multiplier);
    this.score += points;
    this.lastScoreGain = points;
    this.scorePopTimer = 0.5;

    if (audio && this.count >= 2) audio.comboSound(this.count);
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.count = 0;
        this.multiplier = 1;
      }
    }
    if (this.displayTimer > 0) this.displayTimer -= dt;
    if (this.scorePopTimer > 0) this.scorePopTimer -= dt;
  }

  reset() {
    this.count = 0; this.timer = 0; this.multiplier = 1;
    this.score = 0; this.bestCombo = 0;
    this.displayTimer = 0; this.scorePopTimer = 0; this.lastScoreGain = 0;
  }
}

// --- Screen Effects ---
class ScreenEffects {
  constructor() {
    this.flashColor = null;
    this.flashTimer = 0;
    this.flashDuration = 0;
    this.timeScale = 1;
    this.freezeTimer = 0;
  }

  flash(color, duration) {
    this.flashColor = color;
    this.flashTimer = duration;
    this.flashDuration = duration;
  }

  freeze(duration, scale) {
    this.freezeTimer = duration;
    this.timeScale = scale;
  }

  onKill() { this.freeze(0.03, 0.2); }
  onMultiKill() { this.flash('rgba(255,221,0,0.15)', 0.1); this.freeze(0.05, 0.15); }
  onBossKill() { this.flash('rgba(255,255,255,0.3)', 0.15); this.freeze(0.08, 0.1); }
  onPlayerHit() { this.flash('rgba(255,0,0,0.15)', 0.1); }

  update(dt) {
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) this.timeScale = 1;
    }
  }

  getTimeScale() {
    return this.freezeTimer > 0 ? this.timeScale : 1;
  }
}

// --- High Score System ---
class HighScoreSystem {
  constructor() {
    this.scores = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem('voidcrawler_scores');
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  save(entry) {
    this.scores.push(entry);
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 10);
    try {
      localStorage.setItem('voidcrawler_scores', JSON.stringify(this.scores));
    } catch (e) {}
  }

  getScores() { return this.scores; }

  isHighScore(score) {
    return this.scores.length < 10 || score > (this.scores[this.scores.length - 1]?.score || 0);
  }
}
