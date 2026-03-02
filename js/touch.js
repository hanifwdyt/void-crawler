// ============================================================
// VOID CRAWLER - Touch Controls
// Dual virtual joystick + action buttons for mobile
// ============================================================

class TouchControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Move joystick (left side)
    this.moveJoystick = {
      active: false, touchId: null,
      centerX: 0, centerY: 0,
      currentX: 0, currentY: 0,
      dx: 0, dy: 0, maxRadius: 50
    };

    // Aim stick (right side)
    this.aimStick = {
      active: false, touchId: null,
      centerX: 0, centerY: 0,
      currentX: 0, currentY: 0,
      angle: 0, magnitude: 0, isShooting: false,
      maxRadius: 50
    };

    // Buttons (track touch ID per button for multi-touch)
    this.dashButton = { pressed: false, justPressed: false, _prev: false, _touchId: null };
    this.interactButton = { pressed: false, justPressed: false, _prev: false, visible: false, _touchId: null };
    this.pauseButton = { pressed: false, justPressed: false, _prev: false, _touchId: null };

    this._anyTouchStarted = false;
    this.enabled = true;

    // Layout (computed on resize)
    this.layout = {};
    this._computeLayout();

    if (this.isMobile) {
      this._bindEvents();
    }
  }

  _computeLayout() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.moveJoystick.maxRadius = Math.min(50, w * 0.06);
    this.aimStick.maxRadius = Math.min(50, w * 0.06);

    this.layout = {
      // Move zone: left 40%, bottom 70%
      moveZone: { x: 0, y: h * 0.3, w: w * 0.4, h: h * 0.7 },
      // Aim zone: right 40%, full height
      aimZone: { x: w * 0.6, y: 0, w: w * 0.4, h: h },
      // Dead zone: middle 20%
      deadZone: { x: w * 0.4, y: 0, w: w * 0.2, h: h },
      // Buttons
      dashBtn: { x: w - 85, y: h - 150, r: 35 },
      interactBtn: { x: w - 85, y: h - 240, r: 30 },
      pauseBtn: { x: 45, y: 40, r: 20 },
      // HUD offset for mobile
      hudOffset: 80
    };
  }

  _bindEvents() {
    const opts = { passive: false };

    this.canvas.addEventListener('touchstart', e => this._onTouchStart(e), opts);
    this.canvas.addEventListener('touchmove', e => this._onTouchMove(e), opts);
    this.canvas.addEventListener('touchend', e => this._onTouchEnd(e), opts);
    this.canvas.addEventListener('touchcancel', e => this._onTouchEnd(e), opts);
  }

  _getTouchPos(touch) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  }

  _hitCircle(px, py, cx, cy, r) {
    return Math.hypot(px - cx, py - cy) <= r;
  }

  _inRect(px, py, zone) {
    return px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h;
  }

  _onTouchStart(e) {
    e.preventDefault();
    this._anyTouchStarted = true;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this._getTouchPos(touch);
      const id = touch.identifier;

      // Check buttons first
      const { dashBtn, interactBtn, pauseBtn } = this.layout;

      if (this._hitCircle(pos.x, pos.y, pauseBtn.x, pauseBtn.y, pauseBtn.r + 10)) {
        this.pauseButton.pressed = true;
        this.pauseButton._touchId = id;
        continue;
      }

      if (this._hitCircle(pos.x, pos.y, dashBtn.x, dashBtn.y, dashBtn.r + 10)) {
        this.dashButton.pressed = true;
        this.dashButton._touchId = id;
        continue;
      }

      if (this.interactButton.visible &&
          this._hitCircle(pos.x, pos.y, interactBtn.x, interactBtn.y, interactBtn.r + 10)) {
        this.interactButton.pressed = true;
        this.interactButton._touchId = id;
        continue;
      }

      // Move joystick — left zone
      if (!this.moveJoystick.active && this._inRect(pos.x, pos.y, this.layout.moveZone)) {
        this.moveJoystick.active = true;
        this.moveJoystick.touchId = id;
        this.moveJoystick.centerX = pos.x;
        this.moveJoystick.centerY = pos.y;
        this.moveJoystick.currentX = pos.x;
        this.moveJoystick.currentY = pos.y;
        this.moveJoystick.dx = 0;
        this.moveJoystick.dy = 0;
        continue;
      }

      // Aim stick — right zone
      if (!this.aimStick.active && this._inRect(pos.x, pos.y, this.layout.aimZone)) {
        this.aimStick.active = true;
        this.aimStick.touchId = id;
        this.aimStick.centerX = pos.x;
        this.aimStick.centerY = pos.y;
        this.aimStick.currentX = pos.x;
        this.aimStick.currentY = pos.y;
        this.aimStick.angle = 0;
        this.aimStick.magnitude = 0;
        this.aimStick.isShooting = false;
        continue;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this._getTouchPos(touch);
      const id = touch.identifier;

      // Move joystick
      if (this.moveJoystick.active && this.moveJoystick.touchId === id) {
        this.moveJoystick.currentX = pos.x;
        this.moveJoystick.currentY = pos.y;
        this._computeJoystick(this.moveJoystick);
        continue;
      }

      // Aim stick
      if (this.aimStick.active && this.aimStick.touchId === id) {
        this.aimStick.currentX = pos.x;
        this.aimStick.currentY = pos.y;
        this._computeAimStick();
        continue;
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;

      // Move joystick
      if (this.moveJoystick.active && this.moveJoystick.touchId === id) {
        this.moveJoystick.active = false;
        this.moveJoystick.touchId = null;
        this.moveJoystick.dx = 0;
        this.moveJoystick.dy = 0;
        continue;
      }

      // Aim stick
      if (this.aimStick.active && this.aimStick.touchId === id) {
        this.aimStick.active = false;
        this.aimStick.touchId = null;
        this.aimStick.isShooting = false;
        this.aimStick.magnitude = 0;
        continue;
      }

      // Buttons — release only when the specific touch that pressed it ends
      if (this.dashButton._touchId === id) {
        this.dashButton.pressed = false;
        this.dashButton._touchId = null;
      }
      if (this.interactButton._touchId === id) {
        this.interactButton.pressed = false;
        this.interactButton._touchId = null;
      }
      if (this.pauseButton._touchId === id) {
        this.pauseButton.pressed = false;
        this.pauseButton._touchId = null;
      }
    }
  }

  _computeJoystick(stick) {
    const rawDx = stick.currentX - stick.centerX;
    const rawDy = stick.currentY - stick.centerY;
    const distance = Math.hypot(rawDx, rawDy);
    const maxR = stick.maxRadius;
    const clampedDist = Math.min(distance, maxR);
    const a = Math.atan2(rawDy, rawDx);
    const DEAD_ZONE = 0.15;
    if (distance / maxR < DEAD_ZONE) {
      stick.dx = 0;
      stick.dy = 0;
      return;
    }
    const normalized = (clampedDist / maxR - DEAD_ZONE) / (1 - DEAD_ZONE);
    stick.dx = normalized * Math.cos(a);
    stick.dy = normalized * Math.sin(a);
  }

  _computeAimStick() {
    const stick = this.aimStick;
    const rawDx = stick.currentX - stick.centerX;
    const rawDy = stick.currentY - stick.centerY;
    const distance = Math.hypot(rawDx, rawDy);
    const maxR = stick.maxRadius;
    stick.angle = Math.atan2(rawDy, rawDx);
    stick.magnitude = Math.min(distance, maxR) / maxR;
    stick.isShooting = distance > 10; // deadzone
  }

  update() {
    if (!this.enabled) {
      this.dashButton.justPressed = false;
      this.interactButton.justPressed = false;
      this.pauseButton.justPressed = false;
      return;
    }

    // Just-pressed detection
    this.dashButton.justPressed = this.dashButton.pressed && !this.dashButton._prev;
    this.dashButton._prev = this.dashButton.pressed;

    this.interactButton.justPressed = this.interactButton.pressed && !this.interactButton._prev;
    this.interactButton._prev = this.interactButton.pressed;

    this.pauseButton.justPressed = this.pauseButton.pressed && !this.pauseButton._prev;
    this.pauseButton._prev = this.pauseButton.pressed;
  }

  render(ctx, player) {
    if (!this.isMobile) return;

    const { dashBtn, interactBtn, pauseBtn } = this.layout;
    const maxR = this.moveJoystick.maxRadius;
    const aimMaxR = this.aimStick.maxRadius;

    // Move joystick (only when active)
    if (this.moveJoystick.active) {
      const mj = this.moveJoystick;
      // Outer ring
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = COLORS.ui;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mj.centerX, mj.centerY, maxR, 0, Math.PI * 2);
      ctx.stroke();
      // Inner thumb
      const thumbX = mj.centerX + mj.dx * maxR;
      const thumbY = mj.centerY + mj.dy * maxR;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = COLORS.ui;
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aim stick (only when active)
    if (this.aimStick.active) {
      const as = this.aimStick;
      // Outer ring
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = COLORS.projectile;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(as.centerX, as.centerY, aimMaxR, 0, Math.PI * 2);
      ctx.stroke();
      // Direction line
      if (as.isShooting) {
        const lineX = as.centerX + Math.cos(as.angle) * aimMaxR * as.magnitude;
        const lineY = as.centerY + Math.sin(as.angle) * aimMaxR * as.magnitude;
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = COLORS.projectile;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(as.centerX, as.centerY);
        ctx.lineTo(lineX, lineY);
        ctx.stroke();
      }
      // Inner thumb
      const thumbX = as.centerX + Math.cos(as.angle) * aimMaxR * as.magnitude;
      const thumbY = as.centerY + Math.sin(as.angle) * aimMaxR * as.magnitude;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = COLORS.projectile;
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dash button (always visible)
    {
      const ready = player.dashCooldown <= 0;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = ready ? COLORS.ui : '#555555';
      ctx.beginPath();
      ctx.arc(dashBtn.x, dashBtn.y, dashBtn.r, 0, Math.PI * 2);
      ctx.fill();

      // Cooldown arc
      if (!ready && player.dashMaxCooldown > 0) {
        const pct = player.dashCooldown / player.dashMaxCooldown;
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = COLORS.ui;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(dashBtn.x, dashBtn.y, dashBtn.r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
        ctx.stroke();
      }

      // Label
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = ready ? COLORS.text : '#888888';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DASH', dashBtn.x, dashBtn.y);
    }

    // Interact button (only when visible)
    if (this.interactButton.visible) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COLORS.shop;
      ctx.beginPath();
      ctx.arc(interactBtn.x, interactBtn.y, interactBtn.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.7;
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('USE', interactBtn.x, interactBtn.y);
    }

    // Pause button (always visible)
    {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = COLORS.textDim;
      ctx.beginPath();
      ctx.arc(pauseBtn.x, pauseBtn.y, pauseBtn.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('||', pauseBtn.x, pauseBtn.y);
    }

    // Reset
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
