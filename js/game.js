// ============================================================
// VOID CRAWLER - Game Logic
// Main loop, state management, collisions
// ============================================================

const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  DEAD: 'dead',
  TRANSITION: 'transition',
  PAUSED: 'paused',
  BOSS_INTRO: 'bossIntro'
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.input = new Input(this.canvas);
    this.touchControls = typeof TouchControls !== 'undefined' ? new TouchControls(this.canvas) : null;
    if (this.touchControls) this.input.touchControls = this.touchControls;
    this.audio = new GameAudio();
    this.renderer = new Renderer(this.canvas);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.particles = new ParticleSystem();
    this.floatingText = new FloatingText();
    this.combo = new ComboSystem();
    this.screenEffects = new ScreenEffects();
    this.highScores = new HighScoreSystem();
    this.biomeManager = new BiomeManager();
    this.weatherSystem = new WeatherSystem();
    this.postfx = new PostFX();
    this.ai = typeof AIManager !== 'undefined' ? new AIManager() : null;

    this.state = GameState.MENU;
    this.floor = 1;
    this.dungeon = null;
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.notifications = [];
    this.showMinimap = true;
    this.elapsed = 0;

    this.transitionPhase = 0; // 0=not transitioning, 1=fading out, 2=loading, 3=fading in
    this.transitionTimer = 0;
    this.impactMarks = []; // floor splat marks { x, y, color, life, maxLife }
    this.tutorialState = { moved: false, shot: false, dashed: false, itemSeen: false };

    // Boss intro state
    this.bossIntroTimer = 0;
    this.bossIntroMaxTime = 1.5;
    this.bossIntroTarget = null;
    this.bossIntroTriggered = false;

    this.lastTime = 0;
    this.menuTime = 0;

    // Start loop
    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) this.camera.resize(this.canvas.width, this.canvas.height);
    if (this.touchControls) this.touchControls._computeLayout();
  }

  startGame() {
    this.audio.init();
    this.floor = 1;
    this.elapsed = 0;
    this.notifications = [];
    this.combo.reset();
    this.impactMarks = [];
    this.tutorialState = { moved: false, shot: false, dashed: false, itemSeen: false };
    this.bossIntroTimer = 0;
    this.bossIntroTarget = null;
    this.bossIntroTriggered = false;
    this.biomeManager._lastBiomeKey = null;
    this.biomeManager.currentBiomeKey = null;
    if (this.ai) this.ai.reset();
    this.loadFloor();
    this.state = GameState.PLAYING;
  }

  loadFloor() {
    this.dungeon = new Dungeon(this.floor);
    this.projectiles = [];
    this.particles.clear();
    this.floatingText = new FloatingText();

    // Biome update
    const biome = this.biomeManager.update(this.floor);
    const biomeKey = this.biomeManager.currentBiomeKey;
    this.renderer.setBiome(biome, biomeKey);
    this.dungeon.placeDecorations(biome);
    this.weatherSystem.setType(biome.weather);
    this.postfx.setBiomeDefaults(biomeKey);

    // Inject AI biome lore if available
    if (this.ai && this.ai.biomeLore && this.biomeManager.showLore) {
      this.biomeManager.loreText = this.ai.biomeLore;
      this.ai.biomeLore = null;
    }

    if (!this.player || !this.player.alive) {
      this.player = new Player(this.dungeon.spawn.x, this.dungeon.spawn.y);
    } else {
      this.player.x = this.dungeon.spawn.x;
      this.player.y = this.dungeon.spawn.y;
      this.player.dashTrail = [];
    }

    // Spawn enemies
    this.enemies = this.dungeon.enemySpawns.map(s => createEnemy(s, this.floor));

    // Center camera immediately
    this.camera.x = this.player.x - this.canvas.width / 2;
    this.camera.y = this.player.y - this.canvas.height / 2;

    // Boss intro tracking
    this.bossIntroTriggered = false;

    // Boss notification
    if (this.floor % 5 === 0) {
      this.addNotification('!! BOSS FLOOR !!', COLORS.boss, 3);
      this.audio.bossRoar();
    }

    // Ambient sound (biome-aware)
    this.audio.startAmbient(this.floor, biome);
  }

  nextFloor() {
    this.state = GameState.TRANSITION;
    this.transitionPhase = 1;
    this.transitionTimer = 0;
    this.floor++;
    this.audio.stairs();

    // AI pre-fetch for next floor
    if (this.ai) {
      const nextBiomeKey = this.biomeManager.getBiomeKey(this.floor);
      const currentBiomeKey = this.biomeManager.currentBiomeKey;
      // Pre-fetch biome lore if biome is changing
      if (nextBiomeKey !== currentBiomeKey) {
        this.ai.prefetchBiomeLore(nextBiomeKey, this.floor);
      }
      // Pre-fetch boss dialogue if boss floor
      if (this.floor % 5 === 0) {
        const bossNames = { 1: 'SLIME KING', 2: 'VOID WARDEN', 3: 'DEATH BRINGER' };
        const bossIdx = Math.ceil(this.floor / 5);
        const bossName = bossNames[bossIdx] || bossNames[((bossIdx - 1) % 3) + 1];
        this.ai.prefetchBossDialogue(bossName, nextBiomeKey, this.floor);
      }
    }
  }

  addNotification(text, color = COLORS.item, duration = 2) {
    this.notifications.push({ text, color, life: duration, maxLife: duration });
  }

  loop(time) {
    const rawDt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;

    if (this.touchControls) {
      this.touchControls.enabled = (this.state === GameState.PLAYING || this.state === GameState.PAUSED);
    }

    this.input.update();
    this.renderer.updateTime(rawDt);

    switch (this.state) {
      case GameState.MENU:
        this.menuTime += rawDt;
        this.audio.stopAmbient();
        this.renderer.renderTitleScreen(this.menuTime, this.highScores.getScores());
        if (this.input.isDown('enter') || this.input.mouseJustPressed) {
          this.startGame();
        }
        break;

      case GameState.PLAYING: {
        // Pause check
        if (this.input.justPressed('escape')) {
          this.state = GameState.PAUSED;
          break;
        }

        // Screen effects time scale
        const effectiveDt = rawDt * this.screenEffects.getTimeScale();
        this.screenEffects.update(rawDt); // update effects with real dt

        this.update(effectiveDt);
        this.render();
        break;
      }

      case GameState.BOSS_INTRO: {
        this.bossIntroTimer -= rawDt;
        // Camera ease toward boss
        if (this.bossIntroTarget) {
          const tx = this.bossIntroTarget.x - this.canvas.width / 2;
          const ty = this.bossIntroTarget.y - this.canvas.height / 2;
          this.camera.x += (tx - this.camera.x) * 3 * rawDt;
          this.camera.y += (ty - this.camera.y) * 3 * rawDt;
        }
        // Still update weather/postfx for visual effect
        this.weatherSystem.update(rawDt, this.canvas.width, this.canvas.height);
        this.postfx.update(rawDt);

        this.render();
        this.renderer.renderBossIntro(
          this.bossIntroTarget, this.bossIntroTimer, this.bossIntroMaxTime,
          this.biomeManager, this.floor
        );
        // AI boss dialogue taunt
        if (this.ai && this.ai.bossDialogue) {
          this.renderer.renderBossDialogue(
            this.ai.bossDialogue.taunt,
            this.bossIntroTarget ? this.bossIntroTarget.color : COLORS.boss
          );
        }
        this.postfx.apply(this.renderer.ctx, this.canvas);

        if (this.bossIntroTimer <= 0) {
          this.state = GameState.PLAYING;
        }
        break;
      }

      case GameState.DEAD:
        this.menuTime += rawDt;
        this.render();
        {
          const finalScore = Math.round(this.combo.score * (this.player.scoreMultiplier || 1));
          this.renderer.renderDeathScreen(this.player, this.floor, this.menuTime, this.elapsed, finalScore, this.highScores.getScores(), this.biomeManager, this.ai);
        }
        if ((this.input.isDown('enter') || this.input.mouseJustPressed) && this.menuTime > 1) {
          this.startGame();
        }
        break;

      case GameState.TRANSITION:
        this.transitionTimer += rawDt;
        if (this.transitionPhase === 1 && this.transitionTimer >= 0.8) {
          this.loadFloor();
          this.transitionPhase = 2;
          this.transitionTimer = 0;
        }
        if (this.transitionPhase === 2 && this.transitionTimer >= 0.7) {
          this.state = GameState.PLAYING;
          this.transitionPhase = 0;
        }
        this.render();
        {
          const progress = this.transitionPhase === 1
            ? this.transitionTimer / 0.8 * 0.5
            : 0.5 + this.transitionTimer / 0.7 * 0.5;
          this.renderer.renderFloorTransition(this.floor, progress);
        }
        break;

      case GameState.PAUSED:
        this.render();
        this.renderer.renderPauseMenu(this.player, this.floor, this.combo, this.elapsed);
        if (this.input.justPressed('escape')) {
          this.state = GameState.PLAYING;
        }
        // Mute toggle
        if (this.input.justPressed('m')) {
          this.audio.muted = !this.audio.muted;
          if (this.audio.muted) this.audio.stopAmbient();
          else this.audio.startAmbient(this.floor, this.biomeManager.currentBiome);
        }
        break;
    }

    this.input.postUpdate();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.elapsed += dt;

    // Toggle minimap
    if (this.input.justPressed('m')) this.showMinimap = !this.showMinimap;

    // Tutorial state tracking
    const touchMoving = this.touchControls && this.touchControls.moveJoystick.active;
    if (!this.tutorialState.moved && (touchMoving || this.input.isDown('w') || this.input.isDown('a') || this.input.isDown('s') || this.input.isDown('d'))) {
      this.tutorialState.moved = true;
    }
    if (!this.tutorialState.shot && this.input.mouseDown && this.tutorialState.moved) {
      this.tutorialState.shot = true;
    }
    if (!this.tutorialState.dashed && this.player.dashDuration > 0) {
      this.tutorialState.dashed = true;
    }

    // Footstep sound
    if ((touchMoving || this.input.isDown('w') || this.input.isDown('s') || this.input.isDown('a') || this.input.isDown('d')) && this.player.dashDuration <= 0) {
      this.audio.footstep(dt);
    }

    // Player update
    this.player.update(dt, this.input, this.dungeon, this.camera);
    this.player.updateCape(dt);
    this.player.tryShoot(this.input, this.projectiles, this.audio);

    // Dash audio
    if (this.player.dashDuration > 0 && this.player.dashDuration > 0.11) {
      this.audio.dash();
    }

    // Combo update
    this.combo.update(dt);

    // Enemies update
    for (const e of this.enemies) {
      e.update(dt, this.player, this.dungeon, this.projectiles, this.particles);
    }

    // Handle necromancer summons
    for (const e of this.enemies) {
      if (e.type === 'necromancer' && e._wantsToSummon && e.alive) {
        e._wantsToSummon = false;
        e.summonCount++;
        const summonX = e.x + rand(-TILE * 2, TILE * 2);
        const summonY = e.y + rand(-TILE * 2, TILE * 2);
        if (this.dungeon.canMoveTo(summonX, summonY, 11)) {
          const minion = new Slime(summonX, summonY, this.floor);
          minion.hp = minion.maxHp = Math.max(1, Math.floor(minion.hp * 0.5));
          this.enemies.push(minion);
          this.particles.emit(summonX, summonY, 10, {
            speed: 60, color: COLORS.necromancer, size: 3, life: 0.3
          });
        }
      }
    }

    // Handle SlimeKing summons
    for (const e of this.enemies) {
      if (e.type === 'slimeKing' && e._wantsToSummon && e.alive) {
        const count = e._wantsToSummon;
        e._wantsToSummon = 0;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sx = e.x + Math.cos(a) * TILE * 2;
          const sy = e.y + Math.sin(a) * TILE * 2;
          const minion = new Slime(sx, sy, this.floor);
          this.enemies.push(minion);
        }
      }
    }

    // Handle teleporter particles
    for (const e of this.enemies) {
      if (e.type === 'teleporter' && e._wantsToTeleport) {
        e._wantsToTeleport = false;
        this.particles.emit(e.x, e.y, 10, {
          speed: 80, color: COLORS.teleporter, size: 3, life: 0.3
        });
      }
    }

    // Projectiles update with wall hit detection
    for (const p of this.projectiles) {
      const wasAlive = p.alive;
      p.update(dt, this.dungeon);
      // Wall hit sound + particles
      if (wasAlive && !p.alive && !p.bounce) {
        this.audio.wallHit();
        this.particles.emit(p.x, p.y, 3, { speed: 40, color: '#666', size: 2, life: 0.15 });
      }
      // Trail particles
      if (p.alive) {
        this.particles.trail(p.x, p.y,
          p.isPlayerProj ? COLORS.projectile : COLORS.enemyProjectile, p.radius * 0.6);
      }
    }

    // Homing projectile logic
    for (const p of this.projectiles) {
      if (p.homing && p.alive && !p.isPlayerProj) {
        // Home towards player
        const targetA = angle(p.x, p.y, this.player.x, this.player.y);
        const turnSpeed = 1.5;
        const currentA = Math.atan2(p.vy, p.vx);
        let diff = targetA - currentA;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const newA = currentA + Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed * dt);
        p.vx = Math.cos(newA) * p.speed;
        p.vy = Math.sin(newA) * p.speed;
      }
      if (p.homing && p.alive && p.isPlayerProj) {
        // Home towards nearest enemy
        let closest = null, closestDist = TILE * 8;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d < closestDist) { closest = e; closestDist = d; }
        }
        if (closest) {
          const targetA = angle(p.x, p.y, closest.x, closest.y);
          const currentA = Math.atan2(p.vy, p.vx);
          let diff = targetA - currentA;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const newA = currentA + Math.sign(diff) * Math.min(Math.abs(diff), 2 * dt);
          p.vx = Math.cos(newA) * p.speed;
          p.vy = Math.sin(newA) * p.speed;
        }
      }
    }

    // Collision: player projectiles vs enemies
    for (const p of this.projectiles) {
      if (!p.alive || !p.isPlayerProj) continue;
      for (const e of this.enemies) {
        if (!e.alive || p.hitSet.has(e)) continue;
        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
          // Critical hit check
          let dmg = p.damage;
          let isCrit = false;
          if (p.critChance && Math.random() < p.critChance) {
            dmg *= 3;
            isCrit = true;
          }

          e.takeDamage(dmg, this.particles, this.floatingText);
          this.audio.enemyHit();
          this.camera.shake(3);

          if (isCrit) {
            this.floatingText.add(e.x, e.y - 30, 'CRIT!', '#ff4488');
            this.camera.shake(5);
          }

          // Burn
          if (p.burnDmg > 0) {
            e.burnTimer = 2;
            e.burnDmg = p.burnDmg;
          }

          // Poison
          if (p.poisonDmg > 0) {
            e.burnTimer = Math.max(e.burnTimer, 3);
            e.burnDmg = Math.max(e.burnDmg, p.poisonDmg);
          }

          // Explode on hit
          if (p.explodeOnHit) {
            this.particles.emit(p.x, p.y, 15, {
              speed: 100, color: '#ff4400', size: 4, life: 0.3
            });
            // Damage nearby enemies
            for (const e2 of this.enemies) {
              if (e2 !== e && e2.alive && dist(p.x, p.y, e2.x, e2.y) < TILE * 2) {
                e2.takeDamage(Math.ceil(p.damage * 0.5), this.particles, this.floatingText);
              }
            }
          }

          // Life steal
          if (p.lifeStealOnHit) {
            this.player.heal(1, this.floatingText);
          }

          if (!e.alive) {
            // Kill tracking
            this.player.kills++;
            this.combo.registerKill(this.audio);
            this.screenEffects.onKill();
            if (this.combo.count >= 3) this.screenEffects.onMultiKill();

            // AI combo events
            if (this.ai) {
              const biomeKey = this.biomeManager.currentBiomeKey;
              if (this.combo.count >= 10) {
                this.ai.queueEvent('combo_epic', AIManager.PRIORITY.COMBO_EPIC, { combo: this.combo.count, floor: this.floor, kills: this.player.kills, biomeKey });
              } else if (this.combo.count >= 5) {
                this.ai.queueEvent('combo_high', AIManager.PRIORITY.COMBO_HIGH, { combo: this.combo.count, floor: this.floor, biomeKey });
              }
              // Kill milestones
              if (this.player.kills === 25 || this.player.kills === 50 || this.player.kills === 100) {
                this.ai.queueEvent('kill_streak', AIManager.PRIORITY.KILL_STREAK, { kills: this.player.kills, floor: this.floor, biomeKey });
              }
            }

            // Boss kill effects
            if (e.type === 'boss' || e.type === 'slimeKing' || e.type === 'voidWarden' || e.type === 'deathBringer') {
              this.screenEffects.onBossKill();
              this.postfx.triggerAberration(1.5, 0.4);
              // AI boss defeat event
              if (this.ai) {
                this.ai.queueEvent('boss_defeat', AIManager.PRIORITY.BOSS_DEFEAT, {
                  bossName: e.bossName || e.type, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
                });
              }
            }

            this.audio.enemyDeath();

            // Enhanced kill particles
            this.particles.emit(e.x, e.y, 20, {
              speed: 100, color: e.color, size: 4, life: 0.5,
              shape: ['rect', 'circle', 'triangle'], rotSpeed: 5, gravity: 100
            });

            // Impact mark
            this.impactMarks.push({ x: e.x, y: e.y, color: e.color, life: 5, maxLife: 5 });

            // Vampiric heal on kill
            if (this.player.vampiric) {
              this.player.heal(1, this.floatingText);
            }

            // Phantom dash reset
            if (this.player.phantomDash) {
              this.player.dashCooldown = 0;
            }

            // Chain lightning
            if (p.chainLightning) {
              let chainTarget = null, chainDist = TILE * 4;
              for (const e2 of this.enemies) {
                if (!e2.alive || e2 === e) continue;
                const d = dist(e.x, e.y, e2.x, e2.y);
                if (d < chainDist) { chainTarget = e2; chainDist = d; }
              }
              if (chainTarget) {
                const chainA = angle(e.x, e.y, chainTarget.x, chainTarget.y);
                const chainProj = new Projectile(e.x, e.y, chainA, this.player);
                chainProj.damage = Math.ceil(p.damage * 0.5);
                chainProj.chainLightning = false; // Don't chain infinitely
                this.projectiles.push(chainProj);
                // Lightning visual
                this.particles.emit(e.x, e.y, 5, { speed: 200, color: '#44ddff', size: 2, life: 0.1, angle: chainA, spread: 0.3 });
              }
            }

            // SlimeKing split on death
            if (e._splitOnDeath) {
              for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 / 3) * i;
                const sx = e.x + Math.cos(a) * TILE;
                const sy = e.y + Math.sin(a) * TILE;
                const minion = new Slime(sx, sy, this.floor);
                this.enemies.push(minion);
              }
            }
          }

          p.hitSet.add(e);
          if (!p.piercing) p.alive = false;
          break;
        }
      }
    }

    // Collision: enemy projectiles vs player
    for (const p of this.projectiles) {
      if (!p.alive || p.isPlayerProj) continue;
      if (dist(p.x, p.y, this.player.x, this.player.y) < p.radius + this.player.radius) {
        this.player.takeDamage(p.damage, this.particles, this.floatingText);
        this.audio.hit();
        this.camera.shake(5);
        this.screenEffects.onPlayerHit();
        this.postfx.triggerAberration(0.8, 0.2);
        p.alive = false;
        // AI low HP event
        if (this.ai && this.player.alive && this.player.hp <= 1) {
          this.ai.queueEvent('player_low_hp', AIManager.PRIORITY.PLAYER_LOW_HP, {
            hp: this.player.hp, maxHp: this.player.maxHp, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
          });
        }
      }
    }

    // Collision: melee enemies vs player
    for (const e of this.enemies) {
      if (!e.alive || !this.player.alive) continue;
      if (dist(e.x, e.y, this.player.x, this.player.y) < e.radius + this.player.radius) {
        this.player.takeDamage(e.damage, this.particles, this.floatingText);
        this.audio.hit();
        this.camera.shake(5);
        this.screenEffects.onPlayerHit();
        this.postfx.triggerAberration(0.8, 0.2);

        // AI low HP event
        if (this.ai && this.player.alive && this.player.hp <= 1) {
          this.ai.queueEvent('player_low_hp', AIManager.PRIORITY.PLAYER_LOW_HP, {
            hp: this.player.hp, maxHp: this.player.maxHp, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
          });
        }

        // Thorn armor
        if (this.player.thornDmg > 0) {
          e.takeDamage(this.player.thornDmg, this.particles, this.floatingText);
          if (!e.alive) {
            this.player.kills++;
            this.combo.registerKill(this.audio);
          }
        }

        // Push enemy back with wall clip fix
        const pushA = angle(this.player.x, this.player.y, e.x, e.y);
        const pushX = e.x + Math.cos(pushA) * 20;
        const pushY = e.y + Math.sin(pushA) * 20;
        if (this.dungeon.canMoveTo(pushX, e.y, e.radius)) e.x = pushX;
        if (this.dungeon.canMoveTo(e.x, pushY, e.radius)) e.y = pushY;
      }
    }

    // Exploder explosion handling
    for (const e of this.enemies) {
      if (!e.alive && e._explode) {
        e._explode = false; // Only process once
        this.audio.explosion();
        this.camera.shake(6);
        this.particles.emit(e.x, e.y, 25, {
          speed: 120, color: COLORS.exploder, size: 5, life: 0.5,
          shape: ['circle', 'rect', 'triangle'], gravity: 80
        });
        // Damage player if in range
        if (dist(e.x, e.y, this.player.x, this.player.y) < e.explodeRadius) {
          this.player.takeDamage(e.damage, this.particles, this.floatingText);
          this.audio.hit();
          this.screenEffects.onPlayerHit();
        }
        // Damage other enemies in range
        for (const e2 of this.enemies) {
          if (e2 !== e && e2.alive && dist(e.x, e.y, e2.x, e2.y) < e.explodeRadius) {
            e2.takeDamage(e.damage, this.particles, this.floatingText);
          }
        }
      }
    }

    // Burn damage tick
    for (const e of this.enemies) {
      if (!e.alive || e.burnTimer <= 0) continue;
      if (Math.random() < dt * 2) {
        e.takeDamage(e.burnDmg, this.particles, this.floatingText);
        if (!e.alive) {
          this.player.kills++;
          this.combo.registerKill(this.audio);
          this.screenEffects.onKill();
          if (this.combo.count >= 3) this.screenEffects.onMultiKill();
          this.audio.enemyDeath();

          // Enhanced kill particles
          this.particles.emit(e.x, e.y, 20, {
            speed: 100, color: e.color, size: 4, life: 0.5,
            shape: ['rect', 'circle', 'triangle'], rotSpeed: 5, gravity: 100
          });

          // Impact mark
          this.impactMarks.push({ x: e.x, y: e.y, color: e.color, life: 5, maxLife: 5 });

          // Phantom dash reset
          if (this.player.phantomDash) {
            this.player.dashCooldown = 0;
          }

          // Vampiric heal
          if (this.player.vampiric) {
            this.player.heal(1, this.floatingText);
          }
        }
      }
    }

    // Hazard collision
    const ptx = toTile(this.player.x), pty = toTile(this.player.y);
    if (ptx >= 0 && pty >= 0 && ptx < DUNGEON_W && pty < DUNGEON_H) {
      const tile = this.dungeon.tiles[pty][ptx];
      if (tile === TileType.SPIKE || tile === TileType.POISON) {
        const hazard = this.dungeon.hazards.find(h => h.x === ptx && h.y === pty);
        if (hazard) {
          hazard.dmgTimer -= dt;
          if (hazard.dmgTimer <= 0) {
            hazard.dmgTimer = 0.5;
            if (tile === TileType.SPIKE) {
              this.player.takeDamage(1, this.particles, this.floatingText);
              this.screenEffects.onPlayerHit();
            } else {
              // Poison: damage + slow
              this.player.takeDamage(1, this.particles, this.floatingText);
              this.screenEffects.onPlayerHit();
              this.player.speed *= 0.95;
            }
          }
        }
      }
    }

    // Mobile: contextual interact button visibility
    if (this.touchControls && this.touchControls.isMobile) {
      let nearInteractable = false;
      // Check shop items
      for (const item of this.dungeon.itemSpawns) {
        if (item.shopItem && !item.collected && dist(item.x, item.y, this.player.x, this.player.y) < TILE * 1.5) {
          nearInteractable = true; break;
        }
      }
      // Check shrines/fountains
      if (!nearInteractable) {
        for (const sr of this.dungeon.specialRooms) {
          if ((sr.type === 'shrine' || sr.type === 'fountain') && !sr.used) {
            const cx = toWorld(sr.room.cx), cy = toWorld(sr.room.cy);
            if (dist(this.player.x, this.player.y, cx, cy) < TILE * 1.5) {
              nearInteractable = true; break;
            }
          }
        }
      }
      this.touchControls.interactButton.visible = nearInteractable;
    }

    // Item pickup (non-shop items)
    for (const item of this.dungeon.itemSpawns) {
      if (item.collected) continue;
      if (item.shopItem) continue; // Shop items handled separately

      // Tutorial: item seen
      if (!this.tutorialState.itemSeen && dist(item.x, item.y, this.player.x, this.player.y) < TILE * 5) {
        this.tutorialState.itemSeen = true;
      }

      // Magnet: move items towards player
      if (this.player.magnetRange > 0) {
        const d = dist(item.x, item.y, this.player.x, this.player.y);
        if (d < this.player.magnetRange && d > TILE) {
          const a = angle(item.x, item.y, this.player.x, this.player.y);
          item.x += Math.cos(a) * 100 * dt;
          item.y += Math.sin(a) * 100 * dt;
        }
      }

      if (dist(item.x, item.y, this.player.x, this.player.y) < TILE) {
        item.collected = true;
        const def = ITEM_DEFS[item.type];
        this.player.addItem(item.type, this.particles, this.floatingText);
        this.audio.pickup();
        this.addNotification(`${def.name}: ${def.desc}`, def.color);
        this.particles.emit(item.x, item.y, 10, {
          speed: 80, color: def.color, size: 3, life: 0.5
        });
        // AI item pickup event
        if (this.ai) {
          const isNotable = item.type === 'glassCannon' || this.player.items.length === 1;
          this.ai.queueEvent('item_pickup', isNotable ? AIManager.PRIORITY.ITEM_NOTABLE : AIManager.PRIORITY.ITEM_PICKUP, {
            itemName: def.name, itemDesc: def.desc, totalItems: this.player.items.length,
            floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
          });
          // Check if a synergy was just activated
          const lastSyn = this.player.activeSynergies[this.player.activeSynergies.length - 1];
          if (lastSyn && lastSyn !== this.ai._lastSynergyName) {
            this.ai.queueEvent('synergy', AIManager.PRIORITY.SYNERGY, {
              synergyName: lastSyn, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
            });
            this.ai._lastSynergyName = lastSyn;
          }
        }
      }
    }

    // Shop interaction
    for (const sr of this.dungeon.specialRooms) {
      if (sr.type === 'shop' && sr.items) {
        // Shop items from dungeon.itemSpawns
        for (const shopItem of this.dungeon.itemSpawns) {
          if (!shopItem.shopItem || shopItem.collected) continue;
          if (dist(shopItem.x, shopItem.y, this.player.x, this.player.y) < TILE * 1.5) {
            if (this.input.justPressed('e')) {
              shopItem.collected = true;
              // Mark all shop items in this room as collected
              for (const si of this.dungeon.itemSpawns) {
                if (si.shopItem) si.collected = true;
              }
              const def = ITEM_DEFS[shopItem.type];
              this.player.addItem(shopItem.type, this.particles, this.floatingText);
              this.audio.pickup();
              this.addNotification(`${def.name}: ${def.desc}`, def.color);
            }
          }
        }
      }
    }

    // Shrine interaction
    for (const sr of this.dungeon.specialRooms) {
      if (sr.type === 'shrine' && !sr.used) {
        const room = sr.room;
        const cx = toWorld(room.cx), cy = toWorld(room.cy);
        if (dist(this.player.x, this.player.y, cx, cy) < TILE * 1.5) {
          if (this.input.justPressed('e') && this.player.hp > 1) {
            sr.used = true;
            this.player.hp -= 1;
            // Random buff
            const buffs = ['speed', 'damage', 'defense'];
            const buff = randChoice(buffs);
            if (buff === 'speed') { this.player.speed *= 1.1; this.addNotification('Shrine: +10% Speed', COLORS.shrine); }
            else if (buff === 'damage') { this.player.damage *= 1.15; this.addNotification('Shrine: +15% Damage', COLORS.shrine); }
            else { this.player.defense = Math.min(0.8, this.player.defense + 0.1); this.addNotification('Shrine: +10% Defense', COLORS.shrine); }
            this.particles.emit(cx, cy, 15, { speed: 80, color: COLORS.shrine, size: 4, life: 0.5 });
          }
        }
      }
    }

    // Fountain interaction
    for (const sr of this.dungeon.specialRooms) {
      if (sr.type === 'fountain' && !sr.used) {
        const room = sr.room;
        const cx = toWorld(room.cx), cy = toWorld(room.cy);
        if (dist(this.player.x, this.player.y, cx, cy) < TILE * 1.5) {
          if (this.input.justPressed('e')) {
            sr.used = true;
            this.player.hp = this.player.maxHp;
            this.floatingText.add(cx, cy - 20, 'FULL HEAL', COLORS.fountain);
            this.particles.emit(cx, cy, 20, { speed: 60, color: COLORS.fountain, size: 3, life: 0.6 });
            this.audio.pickup();
          }
        }
      }
    }

    // Stairs check
    const stx = this.dungeon.stairsPos.x, sty = this.dungeon.stairsPos.y;
    if (dist(this.player.x, this.player.y, toWorld(stx), toWorld(sty)) < TILE) {
      this.nextFloor();
      return;
    }

    // Clean up dead projectiles
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Update impact marks
    for (let i = this.impactMarks.length - 1; i >= 0; i--) {
      this.impactMarks[i].life -= dt;
      if (this.impactMarks[i].life <= 0) this.impactMarks.splice(i, 1);
    }

    // Update systems
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.camera.follow(this.player.x, this.player.y, dt);
    this.dungeon.updateVisibility(this.player.x, this.player.y);

    // Weather + PostFX + Lore
    this.weatherSystem.update(dt, this.canvas.width, this.canvas.height);
    this.postfx.update(dt);
    this.biomeManager.updateLore(dt);

    // Boss intro detection — trigger when player enters boss room
    if (this.floor % 5 === 0 && !this.bossIntroTriggered && this.dungeon.bossRoom) {
      const br = this.dungeon.bossRoom;
      const px = toTile(this.player.x), py = toTile(this.player.y);
      if (px >= br.x && px < br.x + br.w && py >= br.y && py < br.y + br.h) {
        // Find the boss enemy
        const boss = this.enemies.find(e => e.alive && (e.type === 'slimeKing' || e.type === 'voidWarden' || e.type === 'deathBringer'));
        if (boss) {
          this.bossIntroTriggered = true;
          this.bossIntroTarget = boss;
          this.bossIntroTimer = this.bossIntroMaxTime;
          this.state = GameState.BOSS_INTRO;
          // AI boss enter event
          if (this.ai) {
            this.ai.queueEvent('boss_enter', AIManager.PRIORITY.BOSS_ENTER, {
              bossName: boss.bossName || boss.type, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
            });
          }
          return;
        }
      }
    }

    // DeathBringer phase change detection (for AI)
    if (this.ai) {
      const db = this.enemies.find(e => e.alive && e.type === 'deathBringer');
      if (db && db.phase > this.ai._lastDeathBringerPhase) {
        this.ai._lastDeathBringerPhase = db.phase;
        this.ai.queueEvent('boss_phase', AIManager.PRIORITY.BOSS_PHASE, {
          bossName: db.bossName, phase: db.phase, floor: this.floor, biomeKey: this.biomeManager.currentBiomeKey
        });
      }
    }

    // Update notifications
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].life -= dt;
      if (this.notifications[i].life <= 0) this.notifications.splice(i, 1);
    }

    // AI tick
    if (this.ai) this.ai.update(dt);

    // Player death
    if (!this.player.alive) {
      this.audio.death();
      this.audio.stopAmbient();
      this.camera.shake(8);
      this.particles.emit(this.player.x, this.player.y, 30, {
        speed: 120, color: COLORS.player, size: 4, life: 0.6
      });

      // AI death chronicle
      if (this.ai) {
        this.ai.generateDeathChronicle(this.player, this.floor, this.combo, this.elapsed, this.biomeManager);
      }

      // Save high score
      const finalScore = Math.round(this.combo.score * (this.player.scoreMultiplier || 1));
      this.highScores.save({
        score: finalScore,
        floor: this.floor,
        kills: this.player.kills,
        items: this.player.items.length,
        time: Math.floor(this.elapsed),
        bestCombo: this.combo.bestCombo,
        date: new Date().toLocaleDateString()
      });

      this.state = GameState.DEAD;
      this.menuTime = 0;
    }
  }

  render() {
    this.renderer.clear();
    if (!this.dungeon) return;

    this.renderer.renderDungeon(this.dungeon, this.camera);

    // Decorations (on floor, before entities)
    this.renderer.renderDecorations(this.dungeon.decorations, this.camera, this.dungeon);

    // Impact marks (rendered on floor, before entities)
    if (this.impactMarks.length > 0) {
      const ctx = this.renderer.ctx;
      for (const mark of this.impactMarks) {
        const sx = this.camera.screenX(mark.x);
        const sy = this.camera.screenY(mark.y);
        const alpha = (mark.life / mark.maxLife) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = mark.color;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Items
    this.renderer.renderItems(this.dungeon.itemSpawns, this.camera, this.dungeon);

    // Enemies, player, projectiles, particles, floating text
    this.renderer.renderEnemies(this.enemies, this.camera, this.dungeon);
    this.renderer.renderPlayer(this.player, this.camera);
    this.renderer.renderProjectiles(this.projectiles, this.camera);
    this.renderer.renderParticles(this.particles, this.camera);
    this.renderer.renderFloatingText(this.floatingText, this.camera);
    this.renderer.renderLighting(this.player, this.camera);

    // Weather layer (after entities, before UI)
    this.renderer.renderWeather(this.weatherSystem);

    if (this.showMinimap) {
      this.renderer.renderMinimap(this.dungeon, this.player, this.enemies, this.camera);
    }

    const hudOffset = (this.touchControls && this.touchControls.isMobile) ? this.touchControls.layout.hudOffset : 0;
    this.renderer.renderHUD(this.player, this.floor, this.notifications, hudOffset);

    // Boss HP bar
    this.renderer.renderBossHPBar(this.enemies, this.biomeManager, this.floor, hudOffset);

    // Ambient dust
    if (typeof this.renderer.renderAmbientDust === 'function') {
      this.renderer.renderAmbientDust(this.camera);
    }

    // Combo UI
    if (typeof this.renderer.renderComboUI === 'function') {
      const isMobile = this.touchControls && this.touchControls.isMobile;
      this.renderer.renderComboUI(this.combo, isMobile ? 40 : 0);
    }

    // Item tooltips
    if (typeof this.renderer.renderItemTooltips === 'function') {
      this.renderer.renderItemTooltips(this.dungeon.itemSpawns, this.player, this.camera, this.dungeon);
    }

    // Screen flash
    if (typeof this.renderer.renderScreenFlash === 'function') {
      this.renderer.renderScreenFlash(this.screenEffects);
    }

    // Tutorial hints (map tracking booleans to show-* properties)
    if (typeof this.renderer.renderTutorialHints === 'function') {
      const hints = {
        showMove: !this.tutorialState.moved,
        showShoot: this.tutorialState.moved && !this.tutorialState.shot,
        showDash: this.tutorialState.shot && !this.tutorialState.dashed,
        showPickup: this.tutorialState.dashed && this.tutorialState.itemSeen
      };
      this.renderer.renderTutorialHints(hints, this.touchControls && this.touchControls.isMobile);
    }

    // Touch controls overlay (before postfx, only during gameplay)
    if (this.touchControls && this.touchControls.isMobile && this.state === GameState.PLAYING) {
      this.touchControls.render(this.renderer.ctx, this.player);
    }

    // AI Narrator box
    if (this.ai) {
      this.renderer.renderNarrator(this.ai, hudOffset);
    }

    // Lore text overlay (on biome transition)
    if (this.biomeManager.showLore) {
      this.renderer.renderLoreText(
        this.biomeManager.loreBiomeName,
        this.biomeManager.loreText,
        this.biomeManager.loreTimer,
        this.biomeManager.loreMaxTime
      );
    }

    // Post-processing effects (always last)
    this.postfx.apply(this.renderer.ctx, this.canvas);
  }
}

// --- Initialize ---
window.addEventListener('load', () => {
  new Game();
});
