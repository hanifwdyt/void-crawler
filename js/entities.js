// ============================================================
// VOID CRAWLER - Entities
// Player, Enemies, Projectiles
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 10;
    this.speed = 120;
    this.hp = 5; this.maxHp = 5;
    this.damage = 1;
    this.defense = 0;
    this.fireRate = 0.25; // seconds between shots
    this.fireCooldown = 0;
    this.dashCooldown = 0;
    this.dashMaxCooldown = 1.5;
    this.dashDuration = 0;
    this.dashDirX = 0; this.dashDirY = 0;
    this.invincible = 0;
    this.items = [];
    this.activeSynergies = [];

    // Item effects
    this.splitShot = false;
    this.piercing = false;
    this.bounce = false;
    this.burnDmg = 0;
    this.vampiric = false;
    this.projSize = 4;
    this.projCount = 1;
    this.explodeOnHit = false;
    this.lifeStealOnHit = false;
    this.magnetRange = 0;

    // New item effects
    this.chainLightning = false;
    this.poisonDmg = 0;
    this.critChance = 0;
    this.homing = false;
    this.dodgeChance = 0;
    this.thornDmg = 0;
    this.phantomDash = false;
    this.scoreMultiplier = 1;
    this.armorPierce = false;
    this.stormChain = false;
    this.toxicExplosion = false;
    this.ghostDodge = false;
    this.bloodPact = false;

    this.angle = 0;
    this.kills = 0;
    this.alive = true;

    // Visual
    this.flashTimer = 0;
    this.dashTrail = [];

    // Enhanced visual state
    this.walkCycle = 0;
    this.aimAngle = 0;
    this.breathTimer = 0;
    this.dashAfterimages = [];
    this.vx = 0;
    this.vy = 0;
    this.isMoving = false;

    // Cape/scarf physics (Verlet chain)
    this.capeSegments = [];
    this.capeColor = '#2244aa';
    for (let i = 0; i < 5; i++) {
      this.capeSegments.push({ x: this.x, y: this.y + i * 4 });
    }
  }

  updateCape(dt) {
    if (this.capeSegments.length === 0) return;
    // Anchor to player shoulder
    this.capeSegments[0].x = this.x - Math.cos(this.angle) * 4;
    this.capeSegments[0].y = this.y - Math.sin(this.angle) * 4;

    // Verlet integration - segments trail behind
    for (let i = 1; i < this.capeSegments.length; i++) {
      const seg = this.capeSegments[i];
      const prev = this.capeSegments[i - 1];

      // Push away from movement direction
      seg.x += (-this.vx * 0.3 + (Math.random() - 0.5) * 5) * dt;
      seg.y += (-this.vy * 0.3 + (Math.random() - 0.5) * 5 + 10) * dt;

      // Constrain distance to previous segment
      const dx = seg.x - prev.x;
      const dy = seg.y - prev.y;
      const d = Math.hypot(dx, dy);
      const maxDist = 5;
      if (d > maxDist) {
        const ratio = maxDist / d;
        seg.x = prev.x + dx * ratio;
        seg.y = prev.y + dy * ratio;
      }
    }
  }

  update(dt, input, dungeon, camera) {
    if (!this.alive) return;

    // Breath timer (idle animation)
    this.breathTimer += dt;

    // Aim angle (mouse position to world coordinates)
    const worldMouseX = input.mouseX + camera.x - camera.shakeX;
    const worldMouseY = input.mouseY + camera.y - camera.shakeY;
    this.angle = angle(this.x, this.y, worldMouseX, worldMouseY);
    this.aimAngle = this.angle;

    // Dash
    if (this.dashDuration > 0) {
      this.dashDuration -= dt;
      const dashSpeed = this.speed * 4;
      const dx = this.dashDirX * dashSpeed * dt;
      const dy = this.dashDirY * dashSpeed * dt;
      this.vx = this.dashDirX * dashSpeed;
      this.vy = this.dashDirY * dashSpeed;
      if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
      if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
      // Trail
      this.dashTrail.push({ x: this.x, y: this.y, life: 0.3 });
      // Afterimages for dash
      this.dashAfterimages.push({ x: this.x, y: this.y, angle: this.angle, life: 0.25, maxLife: 0.25 });
      return; // No other movement during dash
    }

    // Movement
    let mx = 0, my = 0;
    if (input.touchControls && input.touchControls.moveJoystick.active) {
      // Analog joystick — already normalized via circular clamping
      mx = input.touchControls.moveJoystick.dx;
      my = input.touchControls.moveJoystick.dy;
    } else {
      // Keyboard — binary -1/0/1
      if (input.isDown('w') || input.isDown('arrowup')) my = -1;
      if (input.isDown('s') || input.isDown('arrowdown')) my = 1;
      if (input.isDown('a') || input.isDown('arrowleft')) mx = -1;
      if (input.isDown('d') || input.isDown('arrowright')) mx = 1;
      if (mx !== 0 && my !== 0) {
        mx *= 0.707; my *= 0.707;
      }
    }

    this.isMoving = mx !== 0 || my !== 0;
    if (this.isMoving) {
      this.walkCycle += dt * 10;
    }

    const dx = mx * this.speed * dt;
    const dy = my * this.speed * dt;
    this.vx = mx * this.speed;
    this.vy = my * this.speed;

    // Slide along walls
    if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
    if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;

    // Dash input
    if (input.isDown(' ') && this.dashCooldown <= 0 && (mx !== 0 || my !== 0)) {
      this.dashDuration = 0.12;
      this.dashCooldown = this.dashMaxCooldown;
      this.invincible = Math.max(this.invincible, 0.2);
      const len = Math.hypot(mx, my) || 1;
      this.dashDirX = mx / len;
      this.dashDirY = my / len;
    }

    // Timers
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // Update dash trail
    for (let i = this.dashTrail.length - 1; i >= 0; i--) {
      this.dashTrail[i].life -= dt;
      if (this.dashTrail[i].life <= 0) this.dashTrail.splice(i, 1);
    }

    // Update dash afterimages
    for (let i = this.dashAfterimages.length - 1; i >= 0; i--) {
      this.dashAfterimages[i].life -= dt;
      if (this.dashAfterimages[i].life <= 0) this.dashAfterimages.splice(i, 1);
    }
  }

  tryShoot(input, projectiles, audio) {
    if (!this.alive || this.dashDuration > 0) return;
    if (input.mouseDown && this.fireCooldown <= 0) {
      this.fireCooldown = this.fireRate;
      audio.shoot();

      if (this.splitShot) {
        const count = this.projCount || 3;
        const spread = 0.25;
        for (let i = 0; i < count; i++) {
          const a = this.angle + (i - (count - 1) / 2) * spread;
          projectiles.push(new Projectile(this.x, this.y, a, this));
        }
      } else {
        projectiles.push(new Projectile(this.x, this.y, this.angle, this));
      }
    }
  }

  takeDamage(amount, particles, floatingText) {
    if (this.invincible > 0) return;
    // Dodge chance
    if (this.dodgeChance && Math.random() < this.dodgeChance) {
      floatingText.add(this.x, this.y - 20, 'DODGE!', '#aaaaee');
      return;
    }
    const defenseRate = Math.min(this.defense, 0.8);
    const actual = Math.round(amount * (1 - defenseRate));
    if (actual <= 0) {
      floatingText.add(this.x, this.y - 20, 'BLOCKED', '#4488ff');
      this.invincible = 0.2;
      return;
    }
    this.hp -= actual;
    this.invincible = 0.5;
    this.flashTimer = 0.15;
    floatingText.add(this.x, this.y - 20, `-${actual}`, COLORS.dmgText);
    particles.emit(this.x, this.y, 8, {
      speed: 80, color: COLORS.hp, size: 3, life: 0.3
    });
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  heal(amount, floatingText) {
    if (this.hp >= this.maxHp) return;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    floatingText.add(this.x, this.y - 20, `+${amount}`, COLORS.healText);
  }

  addItem(itemKey, particles, floatingText) {
    const def = ITEM_DEFS[itemKey];
    if (!def) return;
    this.items.push(itemKey);
    def.apply(this);

    // Check synergies
    for (const syn of SYNERGIES) {
      if (this.activeSynergies.includes(syn.name)) continue;
      if (syn.req.every(r => this.items.includes(r))) {
        syn.apply(this);
        this.activeSynergies.push(syn.name);
        floatingText.add(this.x, this.y - 40, `${syn.name}!`, syn.color);
        particles.emit(this.x, this.y, 20, {
          speed: 120, color: syn.color, size: 4, life: 0.6
        });
      }
    }
  }
}

// --- Projectile ---
class Projectile {
  constructor(x, y, angle, owner) {
    this.x = x; this.y = y;
    this.speed = 280;
    this.angle = angle;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.radius = owner.projSize || 4;
    this.damage = owner.damage || 1;
    this.alive = true;
    this.isPlayerProj = owner instanceof Player;
    this.piercing = owner.piercing || false;
    this.bounce = owner.bounce || false;
    this.bounceCount = 0;
    this.maxBounce = 3;
    this.burnDmg = owner.burnDmg || 0;
    this.explodeOnHit = owner.explodeOnHit || false;
    this.lifeStealOnHit = owner.lifeStealOnHit || false;
    this.homing = owner.homing || false;
    this.critChance = owner.critChance || 0;
    this.armorPierce = owner.armorPierce || false;
    this.chainLightning = owner.chainLightning || false;
    this.poisonDmg = owner.poisonDmg || 0;
    this.life = 2;
    this.hitSet = new Set();
  }

  update(dt, dungeon) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    if (this.life <= 0) { this.alive = false; return; }

    // Wall collision
    const tx = toTile(this.x), ty = toTile(this.y);
    if (tx < 0 || tx >= DUNGEON_W || ty < 0 || ty >= DUNGEON_H ||
        dungeon.tiles[ty][tx] <= TileType.WALL) {
      if (this.bounce && this.bounceCount < this.maxBounce) {
        // Bounce off wall
        const ptx = toTile(this.x - this.vx * dt);
        const pty = toTile(this.y - this.vy * dt);
        if (ptx !== tx) this.vx = -this.vx;
        if (pty !== ty) this.vy = -this.vy;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.bounceCount++;
      } else {
        this.alive = false;
      }
    }
  }
}

// --- Enemy Base ---
class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.radius = 12;
    this.speed = 50;
    this.hp = 2; this.maxHp = 2;
    this.damage = 1;
    this.alive = true;
    this.flashTimer = 0;
    this.squashTimer = 0;
    this.color = COLORS.slime;
    this.stunTimer = 0;
    this.burnTimer = 0;
    this.burnDmg = 0;
    this.seesPlayer = false;
    this.aiTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.attackCooldown = 0;

    // Enhanced visual state
    this.animTimer = Math.random() * Math.PI * 2;
    this.walkCycle = 0;
    this.eyeGlow = 0;
    this.deathTimer = 0; // for dissolve animation
    this.isDying = false;
  }

  update(dt, player, dungeon, projectiles, particles) {
    if (!this.alive) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.squashTimer > 0) this.squashTimer -= dt;
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    this.animTimer += dt;
    this.walkCycle += dt * 6;
    if (this.seesPlayer) this.eyeGlow = Math.min(1, this.eyeGlow + dt * 3);
    else this.eyeGlow = Math.max(0, this.eyeGlow - dt * 2);

    // Burn damage
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      if (Math.random() < dt * 3) {
        particles.emit(this.x, this.y, 2, { speed: 30, color: '#ff6622', size: 3, life: 0.2 });
      }
    }

    // Check line of sight to player
    this.seesPlayer = player.alive &&
      dist(this.x, this.y, player.x, player.y) < TILE * 10 &&
      lineOfSight(this.x, this.y, player.x, player.y, dungeon.tiles);

    this.ai(dt, player, dungeon, projectiles, particles);
  }

  ai(dt, player, dungeon) {
    // Override in subclasses
  }

  moveTowards(tx, ty, dt, dungeon) {
    const a = angle(this.x, this.y, tx, ty);
    const dx = Math.cos(a) * this.speed * dt;
    const dy = Math.sin(a) * this.speed * dt;
    if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
    if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
  }

  wander(dt, dungeon) {
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.aiTimer = rand(1, 3);
    }
    const dx = Math.cos(this.wanderAngle) * this.speed * 0.3 * dt;
    const dy = Math.sin(this.wanderAngle) * this.speed * 0.3 * dt;
    if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
    if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
  }

  takeDamage(amount, particles, floatingText) {
    this.hp -= amount;
    this.flashTimer = 0.1;
    this.squashTimer = 0.1;
    this.stunTimer = 0.05;
    floatingText.add(this.x, this.y - 20, `-${amount}`, COLORS.item);
    particles.emit(this.x, this.y, 5, {
      speed: 60, color: this.color, size: 3, life: 0.2
    });
    if (this.hp <= 0) {
      this.alive = false;
    }
  }
}

// --- Slime ---
class Slime extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'slime');
    this.color = COLORS.slime;
    this.speed = 40 + floor * 3;
    this.hp = this.maxHp = 2 + Math.floor(floor / 3);
    this.radius = 11;
    this.bobTimer = Math.random() * Math.PI * 2;
  }

  ai(dt, player, dungeon) {
    this.bobTimer += dt * 3;
    if (this.seesPlayer) {
      this.moveTowards(player.x, player.y, dt, dungeon);
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Bat ---
class Bat extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'bat');
    this.color = COLORS.bat;
    this.speed = 80 + floor * 5;
    this.hp = this.maxHp = 1 + Math.floor(floor / 4);
    this.radius = 9;
    this.zigTimer = 0;
    this.zigDir = 1;
  }

  ai(dt, player, dungeon) {
    this.zigTimer -= dt;
    if (this.zigTimer <= 0) {
      this.zigDir = -this.zigDir;
      this.zigTimer = rand(0.3, 0.8);
    }

    if (this.seesPlayer) {
      const a = angle(this.x, this.y, player.x, player.y);
      const perpA = a + Math.PI / 2 * this.zigDir;
      const moveA = a + Math.sin(this.zigTimer * 5) * 0.8;
      const dx = Math.cos(moveA) * this.speed * dt;
      const dy = Math.sin(moveA) * this.speed * dt;
      if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
      if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Shooter ---
class Shooter extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'shooter');
    this.color = COLORS.shooter;
    this.speed = 30 + floor * 2;
    this.hp = this.maxHp = 3 + Math.floor(floor / 2);
    this.radius = 12;
    this.shootRate = Math.max(0.8, 2 - floor * 0.1);
    this.attackCooldown = this.shootRate;
    this.preferredDist = TILE * 5;
  }

  ai(dt, player, dungeon, projectiles) {
    if (this.seesPlayer) {
      const d = dist(this.x, this.y, player.x, player.y);

      // Maintain distance
      if (d < this.preferredDist - TILE) {
        // Move away
        const a = angle(player.x, player.y, this.x, this.y);
        const dx = Math.cos(a) * this.speed * dt;
        const dy = Math.sin(a) * this.speed * dt;
        if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
        if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
      } else if (d > this.preferredDist + TILE * 2) {
        this.moveTowards(player.x, player.y, dt, dungeon);
      }

      // Shoot
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.shootRate;
        const a = angle(this.x, this.y, player.x, player.y);
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 5 });
        proj.isPlayerProj = false;
        proj.speed = 160;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        proj.color = COLORS.enemyProjectile;
        projectiles.push(proj);
      }
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Charger ---
class Charger extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'charger');
    this.color = COLORS.charger;
    this.speed = 50;
    this.hp = this.maxHp = 4 + Math.floor(floor / 2);
    this.radius = 13;
    this.damage = 2;
    this.charging = false;
    this.chargeDir = 0;
    this.chargeDuration = 0;
    this.windUp = 0;
    this.chargeCooldown = 0;
    this.chargeSpeed = 300 + floor * 15;
  }

  ai(dt, player, dungeon) {
    if (this.charging) {
      this.chargeDuration -= dt;
      const dx = Math.cos(this.chargeDir) * this.chargeSpeed * dt;
      const dy = Math.sin(this.chargeDir) * this.chargeSpeed * dt;
      const canX = dungeon.canMoveTo(this.x + dx, this.y, this.radius);
      const canY = dungeon.canMoveTo(this.x, this.y + dy, this.radius);
      if (canX) this.x += dx;
      if (canY) this.y += dy;
      if ((!canX && !canY) || this.chargeDuration <= 0) {
        this.charging = false;
        this.stunTimer = 0.6;
        this.chargeCooldown = 2;
      }
      return;
    }

    if (this.windUp > 0) {
      this.windUp -= dt;
      if (this.windUp <= 0) {
        this.charging = true;
        this.chargeDuration = 0.5;
      }
      return;
    }

    if (this.chargeCooldown > 0) this.chargeCooldown -= dt;

    if (this.seesPlayer) {
      const d = dist(this.x, this.y, player.x, player.y);
      if (d < TILE * 7 && this.chargeCooldown <= 0) {
        // Wind up for charge
        this.windUp = 0.5;
        this.chargeDir = angle(this.x, this.y, player.x, player.y);
      } else {
        this.moveTowards(player.x, player.y, dt, dungeon);
      }
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Exploder ---
class Exploder extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'exploder');
    this.color = COLORS.exploder;
    this.speed = 70 + floor * 4;
    this.hp = this.maxHp = 2 + Math.floor(floor / 4);
    this.radius = 10;
    this.damage = 2;
    this.fuseTimer = 0;
    this.fusing = false;
    this.explodeRadius = TILE * 2.5;
  }

  ai(dt, player, dungeon) {
    if (this.fusing) {
      this.fuseTimer -= dt;
      if (this.fuseTimer <= 0) {
        this.alive = false;
        this._explode = true; // Flag for game.js to handle explosion
      }
      return;
    }
    if (this.seesPlayer) {
      const d = dist(this.x, this.y, player.x, player.y);
      if (d < TILE * 2) {
        this.fusing = true;
        this.fuseTimer = 0.8;
      } else {
        this.moveTowards(player.x, player.y, dt, dungeon);
      }
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Necromancer ---
class Necromancer extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'necromancer');
    this.color = COLORS.necromancer;
    this.speed = 25 + floor * 2;
    this.hp = this.maxHp = 5 + Math.floor(floor / 2);
    this.radius = 12;
    this.damage = 1;
    this.summonTimer = 3;
    this.summonMax = 3;
    this.summonCount = 0;
    this._wantsToSummon = false;
    this.preferredDist = TILE * 6;
  }

  ai(dt, player, dungeon, projectiles) {
    this._wantsToSummon = false;
    if (this.seesPlayer) {
      const d = dist(this.x, this.y, player.x, player.y);
      // Keep distance
      if (d < this.preferredDist - TILE) {
        const a = angle(player.x, player.y, this.x, this.y);
        const dx = Math.cos(a) * this.speed * dt;
        const dy = Math.sin(a) * this.speed * dt;
        if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
        if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
      } else if (d > this.preferredDist + TILE * 2) {
        this.moveTowards(player.x, player.y, dt, dungeon);
      }

      // Summon minions
      this.summonTimer -= dt;
      if (this.summonTimer <= 0 && this.summonCount < this.summonMax) {
        this._wantsToSummon = true;
        this.summonTimer = 4;
      }

      // Shoot occasionally
      if (this.attackCooldown <= 0 && d < TILE * 8) {
        this.attackCooldown = 2;
        const a = angle(this.x, this.y, player.x, player.y);
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 6 });
        proj.isPlayerProj = false;
        proj.speed = 120;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        proj.color = COLORS.necromancer;
        projectiles.push(proj);
      }
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Mimic ---
class Mimic extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'mimic');
    this.color = COLORS.mimic;
    this.speed = 100 + floor * 5;
    this.hp = this.maxHp = 4 + Math.floor(floor / 3);
    this.radius = 10;
    this.damage = 3;
    this.disguised = true;
    this.revealRadius = TILE * 2;
    this.aggroTimer = 0;
  }

  ai(dt, player, dungeon) {
    if (this.disguised) {
      // Check if player is close enough to reveal
      if (dist(this.x, this.y, player.x, player.y) < this.revealRadius) {
        this.disguised = false;
        this.aggroTimer = 0.3; // Brief pause before attacking
      }
      return; // Don't move while disguised
    }

    if (this.aggroTimer > 0) {
      this.aggroTimer -= dt;
      return;
    }

    // Aggressive chase
    if (player.alive) {
      this.moveTowards(player.x, player.y, dt, dungeon);
    }
  }
}

// --- Teleporter ---
class Teleporter extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'teleporter');
    this.color = COLORS.teleporter;
    this.speed = 40 + floor * 2;
    this.hp = this.maxHp = 3 + Math.floor(floor / 3);
    this.radius = 10;
    this.damage = 1;
    this.teleportTimer = 2;
    this.teleportCooldown = 3;
    this._wantsToTeleport = false; // game.js spawns particles
    this.shootRate = 1.5;
    this.attackCooldown = this.shootRate;
  }

  ai(dt, player, dungeon, projectiles) {
    this._wantsToTeleport = false;
    if (this.seesPlayer) {
      // Shoot
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.shootRate;
        const a = angle(this.x, this.y, player.x, player.y);
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 4 });
        proj.isPlayerProj = false;
        proj.speed = 180;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        proj.color = COLORS.teleporter;
        projectiles.push(proj);
      }

      // Teleport
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this._wantsToTeleport = true;
        this.teleportTimer = this.teleportCooldown;
        // Find random walkable position near player
        for (let attempt = 0; attempt < 20; attempt++) {
          const tx = this.x + rand(-TILE * 6, TILE * 6);
          const ty = this.y + rand(-TILE * 6, TILE * 6);
          if (dungeon.canMoveTo(tx, ty, this.radius)) {
            this.x = tx;
            this.y = ty;
            break;
          }
        }
      }
    } else {
      this.wander(dt, dungeon);
    }
  }
}

// --- Boss ---
class Boss extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'boss');
    this.color = COLORS.boss;
    this.speed = 35;
    this.hp = this.maxHp = 20 + floor * 8;
    this.radius = 22;
    this.damage = 2;
    this.phase = 1;
    this.attackPattern = 0;
    this.attackTimer = 2;
    this.patternTimer = 0;
    this.floor = floor;
    this.spiralQueue = [];
    this.bossName = 'BOSS';
  }

  ai(dt, player, dungeon, projectiles, particles) {
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      particles.emit(this.x, this.y, 30, {
        speed: 150, color: COLORS.boss, size: 5, life: 0.8
      });
    }

    // Process spiral queue
    for (let i = this.spiralQueue.length - 1; i >= 0; i--) {
      this.spiralQueue[i].delay -= dt;
      if (this.spiralQueue[i].delay <= 0) {
        const a = this.spiralQueue[i].angle;
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 5 });
        proj.isPlayerProj = false;
        proj.speed = 160;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        projectiles.push(proj);
        this.spiralQueue.splice(i, 1);
      }
    }

    if (this.seesPlayer) {
      // Slowly move towards player
      this.moveTowards(player.x, player.y, dt, dungeon);

      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.attack(player, projectiles);
        this.attackTimer = this.phase === 2 ? 1.2 : 2;
      }
    }
  }

  attack(player, projectiles) {
    switch (this.attackPattern) {
      case 0: // Ring of projectiles
        const count = this.phase === 2 ? 16 : 10;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 / count) * i;
          const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 6 });
          proj.isPlayerProj = false;
          proj.speed = 140;
          proj.vx = Math.cos(a) * proj.speed;
          proj.vy = Math.sin(a) * proj.speed;
          projectiles.push(proj);
        }
        break;

      case 1: // Aimed burst
        const burstCount = this.phase === 2 ? 5 : 3;
        const baseAngle = angle(this.x, this.y, player.x, player.y);
        for (let i = 0; i < burstCount; i++) {
          const a = baseAngle + (i - (burstCount - 1) / 2) * 0.15;
          const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 7 });
          proj.isPlayerProj = false;
          proj.speed = 180;
          proj.vx = Math.cos(a) * proj.speed;
          proj.vy = Math.sin(a) * proj.speed;
          projectiles.push(proj);
        }
        break;

      case 2: // Spiral - queue-based
        const baseA = angle(this.x, this.y, player.x, player.y);
        for (let i = 0; i < 8; i++) {
          this.spiralQueue.push({ delay: i * 0.08, angle: baseA + i * 0.4 });
        }
        break;
    }
  }
}

// --- SlimeKing Boss ---
class SlimeKing extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'slimeKing');
    this.color = COLORS.slimeKing;
    this.speed = 30;
    this.hp = this.maxHp = 30 + floor * 5;
    this.radius = 28;
    this.damage = 2;
    this.floor = floor;
    this.attackPattern = 0;
    this.attackTimer = 2;
    this.spiralQueue = [];
    this._splitOnDeath = true;
    this.bossName = 'SLIME KING';
  }

  ai(dt, player, dungeon, projectiles, particles) {
    // Process queued attacks
    for (let i = this.spiralQueue.length - 1; i >= 0; i--) {
      this.spiralQueue[i].delay -= dt;
      if (this.spiralQueue[i].delay <= 0) {
        const a = this.spiralQueue[i].angle;
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 8 });
        proj.isPlayerProj = false;
        proj.speed = 120;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        projectiles.push(proj);
        this.spiralQueue.splice(i, 1);
      }
    }

    if (this.seesPlayer) {
      this.moveTowards(player.x, player.y, dt, dungeon);
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.performAttack(player, projectiles, particles);
        this.attackTimer = 2.5;
      }
    }
  }

  performAttack(player, projectiles, particles) {
    switch (this.attackPattern) {
      case 0: // Ground slam - AoE shockwave ring
        const count = 16;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 / count) * i;
          const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 8 });
          proj.isPlayerProj = false;
          proj.speed = 100;
          proj.vx = Math.cos(a) * proj.speed;
          proj.vy = Math.sin(a) * proj.speed;
          projectiles.push(proj);
        }
        particles.emit(this.x, this.y, 20, { speed: 150, color: COLORS.slimeKing, size: 5, life: 0.5 });
        break;
      case 1: // Slime rain - random projectile splats
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = rand(80, 160);
          this.spiralQueue.push({ delay: i * 0.1, angle: a, speed: spd });
        }
        break;
      case 2: // Summon 2 slimes (handled via _wantsToSummon flag)
        this._wantsToSummon = 2;
        break;
    }
  }
}

// --- VoidWarden Boss ---
class VoidWarden extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'voidWarden');
    this.color = COLORS.voidWarden;
    this.speed = 35;
    this.hp = this.maxHp = 50 + floor * 6;
    this.radius = 24;
    this.damage = 3;
    this.floor = floor;
    this.attackPattern = 0;
    this.attackTimer = 2.5;
    this.spiralQueue = [];
    this.bossName = 'VOID WARDEN';
  }

  ai(dt, player, dungeon, projectiles, particles) {
    // Process queued attacks
    for (let i = this.spiralQueue.length - 1; i >= 0; i--) {
      this.spiralQueue[i].delay -= dt;
      if (this.spiralQueue[i].delay <= 0) {
        const entry = this.spiralQueue[i];
        const a = entry.angle;
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: entry.size || 6 });
        proj.isPlayerProj = false;
        proj.speed = entry.speed || 140;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        projectiles.push(proj);
        this.spiralQueue.splice(i, 1);
      }
    }

    if (this.seesPlayer) {
      this.moveTowards(player.x, player.y, dt, dungeon);
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.performAttack(player, projectiles, particles);
        this.attackTimer = 2;
      }
    }
  }

  performAttack(player, projectiles, particles) {
    switch (this.attackPattern) {
      case 0: // Void orbs - slow homing (handled in game.js)
        for (let i = 0; i < 5; i++) {
          const a = angle(this.x, this.y, player.x, player.y) + (i - 2) * 0.3;
          const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: 7 });
          proj.isPlayerProj = false;
          proj.speed = 80;
          proj.vx = Math.cos(a) * proj.speed;
          proj.vy = Math.sin(a) * proj.speed;
          proj.homing = true; // Slow homing
          proj.life = 4;
          projectiles.push(proj);
        }
        break;
      case 1: // Laser sweep - line of projectiles
        const baseA = angle(this.x, this.y, player.x, player.y) - 0.8;
        for (let i = 0; i < 12; i++) {
          this.spiralQueue.push({ delay: i * 0.06, angle: baseA + i * 0.14, speed: 200, size: 5 });
        }
        break;
      case 2: // Teleport + ring burst
        // Teleport near player
        const tpAngle = Math.random() * Math.PI * 2;
        const tpDist = TILE * 4;
        const nx = player.x + Math.cos(tpAngle) * tpDist;
        const ny = player.y + Math.sin(tpAngle) * tpDist;
        this.x = nx; this.y = ny;
        particles.emit(this.x, this.y, 15, { speed: 100, color: COLORS.voidWarden, size: 4, life: 0.4 });
        // Ring burst
        for (let i = 0; i < 20; i++) {
          const a = (Math.PI * 2 / 20) * i;
          this.spiralQueue.push({ delay: 0.2, angle: a, speed: 160, size: 5 });
        }
        break;
    }
  }
}

// --- DeathBringer Boss ---
class DeathBringer extends Enemy {
  constructor(x, y, floor) {
    super(x, y, 'deathBringer');
    this.color = COLORS.deathBringer;
    this.speed = 50;
    this.hp = this.maxHp = 80 + floor * 8;
    this.radius = 22;
    this.damage = 4;
    this.floor = floor;
    this.phase = 1; // 1: normal(100-60%), 2: enraged(60-30%), 3: desperate(30-0%)
    this.attackPattern = 0;
    this.attackTimer = 1.5;
    this.spiralQueue = [];
    this.dashTimer = 0;
    this.dashDir = 0;
    this.dashing = false;
    this.bossName = 'DEATH BRINGER';
  }

  ai(dt, player, dungeon, projectiles, particles) {
    // Phase transitions
    const hpPct = this.hp / this.maxHp;
    if (hpPct <= 0.3 && this.phase < 3) {
      this.phase = 3;
      this.speed = 80;
      particles.emit(this.x, this.y, 30, { speed: 180, color: COLORS.deathBringer, size: 6, life: 0.8 });
    } else if (hpPct <= 0.6 && this.phase < 2) {
      this.phase = 2;
      this.speed = 65;
      particles.emit(this.x, this.y, 20, { speed: 150, color: COLORS.deathBringer, size: 5, life: 0.6 });
    }

    // Process queued attacks
    for (let i = this.spiralQueue.length - 1; i >= 0; i--) {
      this.spiralQueue[i].delay -= dt;
      if (this.spiralQueue[i].delay <= 0) {
        const entry = this.spiralQueue[i];
        const a = entry.angle;
        const proj = new Projectile(this.x, this.y, a, { damage: this.damage, projSize: entry.size || 6 });
        proj.isPlayerProj = false;
        proj.speed = entry.speed || 180;
        proj.vx = Math.cos(a) * proj.speed;
        proj.vy = Math.sin(a) * proj.speed;
        projectiles.push(proj);
        this.spiralQueue.splice(i, 1);
      }
    }

    // Dash attack
    if (this.dashing) {
      this.dashTimer -= dt;
      const dx = Math.cos(this.dashDir) * 400 * dt;
      const dy = Math.sin(this.dashDir) * 400 * dt;
      if (dungeon.canMoveTo(this.x + dx, this.y, this.radius)) this.x += dx;
      if (dungeon.canMoveTo(this.x, this.y + dy, this.radius)) this.y += dy;
      if (this.dashTimer <= 0) this.dashing = false;
      return;
    }

    if (this.seesPlayer) {
      this.moveTowards(player.x, player.y, dt, dungeon);
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.performAttack(player, projectiles, particles, dungeon);
        const cd = this.phase === 3 ? 0.8 : this.phase === 2 ? 1.2 : 1.8;
        this.attackTimer = cd;
      }
    }
  }

  performAttack(player, projectiles, particles, dungeon) {
    switch (this.attackPattern) {
      case 0: // Dash attack
        this.dashing = true;
        this.dashTimer = 0.3;
        this.dashDir = angle(this.x, this.y, player.x, player.y);
        break;
      case 1: // Scythe sweep - semicircle of projectiles
        const baseA = angle(this.x, this.y, player.x, player.y);
        const sweepCount = this.phase >= 2 ? 10 : 7;
        for (let i = 0; i < sweepCount; i++) {
          const a = baseA - 0.8 + (1.6 / (sweepCount - 1)) * i;
          this.spiralQueue.push({ delay: i * 0.04, angle: a, speed: 200, size: 6 });
        }
        break;
      case 2: // Death spiral
        const spiralCount = this.phase === 3 ? 24 : this.phase === 2 ? 16 : 10;
        for (let i = 0; i < spiralCount; i++) {
          const a = (Math.PI * 2 / spiralCount) * i * 2.5;
          this.spiralQueue.push({ delay: i * 0.06, angle: a, speed: 150, size: 5 });
        }
        break;
    }
  }
}

// --- Enemy Factory ---
function createEnemy(spawn, floor) {
  switch (spawn.type) {
    case 'slime': return new Slime(spawn.x, spawn.y, floor);
    case 'bat': return new Bat(spawn.x, spawn.y, floor);
    case 'shooter': return new Shooter(spawn.x, spawn.y, floor);
    case 'charger': return new Charger(spawn.x, spawn.y, floor);
    case 'exploder': return new Exploder(spawn.x, spawn.y, floor);
    case 'necromancer': return new Necromancer(spawn.x, spawn.y, floor);
    case 'mimic': return new Mimic(spawn.x, spawn.y, floor);
    case 'teleporter': return new Teleporter(spawn.x, spawn.y, floor);
    case 'boss': return new Boss(spawn.x, spawn.y, floor);
    case 'slimeKing': return new SlimeKing(spawn.x, spawn.y, floor);
    case 'voidWarden': return new VoidWarden(spawn.x, spawn.y, floor);
    case 'deathBringer': return new DeathBringer(spawn.x, spawn.y, floor);
    default: return new Slime(spawn.x, spawn.y, floor);
  }
}
