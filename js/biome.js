// ============================================================
// VOID CRAWLER - Biome System
// BiomeManager, WeatherSystem, Decorations, Lore
// ============================================================

const BIOME_DEFS = {
  corruptedForest: {
    name: 'Corrupted Forest',
    floorColor: '#0a1a0a',
    floorAlt: '#0d1f0b',
    wallColor: '#1a2a12',
    wallTop: '#243518',
    wallEdge: '#2e3d20',
    accent: '#44ff44',
    fog: 'rgba(20,60,10,0.08)',
    particleColors: ['#66ff44', '#33aa22', '#aaff66'],
    weather: 'leaves',
    decorations: ['tree', 'mushroom', 'bush', 'roots'],
    ambientFreq: 45,
    ambientFilter: 120,
  },
  abandonedCity: {
    name: 'Abandoned City',
    floorColor: '#101218',
    floorAlt: '#13161e',
    wallColor: '#1e2030',
    wallTop: '#282c40',
    wallEdge: '#353850',
    accent: '#6688cc',
    fog: 'rgba(30,30,50,0.06)',
    particleColors: ['#8899bb', '#667799', '#aabbdd'],
    weather: 'rain',
    decorations: ['pillar', 'rubble', 'crate', 'lamppost'],
    ambientFreq: 38,
    ambientFilter: 90,
  },
  infernalDepths: {
    name: 'Infernal Depths',
    floorColor: '#1a0a05',
    floorAlt: '#1f0d08',
    wallColor: '#2a1208',
    wallTop: '#3a1a0c',
    wallEdge: '#4a2210',
    accent: '#ff6622',
    fog: 'rgba(60,20,5,0.08)',
    particleColors: ['#ff6622', '#ff4400', '#ffaa44'],
    weather: 'embers',
    decorations: ['stalagmite', 'lavaCrack', 'bone', 'brazier'],
    ambientFreq: 30,
    ambientFilter: 70,
  },
  frozenAbyss: {
    name: 'Frozen Abyss',
    floorColor: '#08101a',
    floorAlt: '#0a1320',
    wallColor: '#152535',
    wallTop: '#1e3548',
    wallEdge: '#284558',
    accent: '#44ccff',
    fog: 'rgba(20,40,60,0.06)',
    particleColors: ['#aaddff', '#88ccff', '#ffffff'],
    weather: 'snow',
    decorations: ['iceCrystal', 'frozenPillar', 'icicle', 'snowDrift'],
    ambientFreq: 55,
    ambientFilter: 150,
  },
  voidCore: {
    name: 'The Void Core',
    floorColor: '#0a0510',
    floorAlt: '#0d0815',
    wallColor: '#18102a',
    wallTop: '#22183a',
    wallEdge: '#2e204a',
    accent: '#aa44ff',
    fog: 'rgba(40,10,60,0.1)',
    particleColors: ['#aa44ff', '#8822dd', '#dd88ff'],
    weather: 'voidStatic',
    decorations: ['voidTendril', 'rune', 'floatingRock', 'voidCrystal'],
    ambientFreq: 22,
    ambientFilter: 60,
  }
};

const BIOME_ORDER = ['corruptedForest', 'abandonedCity', 'infernalDepths', 'frozenAbyss', 'voidCore'];

// --- Lore System ---
const BIOME_LORE = {
  corruptedForest: {
    enter: 'The trees here bleed darkness...\nSomething ancient stirs beneath the roots.',
    death: 'The forest claims another wanderer.',
    bossTitle: 'Guardian of the Rotting Grove',
  },
  abandonedCity: {
    enter: 'Empty streets echo with forgotten screams.\nThe city remembers what you cannot.',
    death: 'Lost among the ruins, forever.',
    bossTitle: 'Warden of the Fallen Spires',
  },
  infernalDepths: {
    enter: 'Heat rises from cracks in reality itself.\nThe air tastes of ash and regret.',
    death: 'Consumed by the eternal flame.',
    bossTitle: 'Keeper of the Burning Deep',
  },
  frozenAbyss: {
    enter: 'Time itself seems frozen here.\nEach breath crystallizes before it fades.',
    death: 'Entombed in ice, waiting to thaw.',
    bossTitle: 'Sovereign of the Endless Winter',
  },
  voidCore: {
    enter: 'Reality unravels at the seams.\nYou are closer to the truth... or the end.',
    death: 'Dissolved into the space between spaces.',
    bossTitle: 'Herald of the Final Void',
  }
};

// --- BiomeManager ---
class BiomeManager {
  constructor() {
    this.currentBiome = null;
    this.currentBiomeKey = null;
    this.transitionTimer = 0;
    this.showLore = false;
    this.loreText = '';
    this.loreBiomeName = '';
    this.loreTimer = 0;
    this.loreMaxTime = 3.5;
    this._lastBiomeKey = null;
  }

  getBiomeKey(floor) {
    const cycle = Math.floor((floor - 1) / 3) % BIOME_ORDER.length;
    return BIOME_ORDER[cycle];
  }

  getBiome(floor) {
    return BIOME_DEFS[this.getBiomeKey(floor)];
  }

  update(floor) {
    const key = this.getBiomeKey(floor);
    if (key !== this.currentBiomeKey) {
      this.currentBiomeKey = key;
      this.currentBiome = BIOME_DEFS[key];

      // Trigger lore on biome change
      if (this._lastBiomeKey !== key) {
        this.showLore = true;
        this.loreBiomeName = this.currentBiome.name;
        this.loreText = BIOME_LORE[key].enter;
        this.loreTimer = this.loreMaxTime;
        this._lastBiomeKey = key;
      }
    }
    return this.currentBiome;
  }

  updateLore(dt) {
    if (this.loreTimer > 0) {
      this.loreTimer -= dt;
      if (this.loreTimer <= 0) {
        this.showLore = false;
      }
    }
  }

  getLore(floor) {
    return BIOME_LORE[this.getBiomeKey(floor)];
  }

  getDeathText(floor) {
    return BIOME_LORE[this.getBiomeKey(floor)].death;
  }

  getBossTitle(floor) {
    return BIOME_LORE[this.getBiomeKey(floor)].bossTitle;
  }

  getColor(type) {
    if (!this.currentBiome) return COLORS[type] || '#ffffff';
    return this.currentBiome[type] || COLORS[type] || '#ffffff';
  }

  // Intensify colors after floor 15 (second cycle+)
  getIntensity(floor) {
    return 1 + Math.floor((floor - 1) / 15) * 0.15;
  }
}

// --- Weather System ---
class WeatherSystem {
  constructor() {
    this.type = 'none';
    this.particles = [];
    this.maxParticles = 80;
    this.timer = 0;
  }

  setType(type) {
    this.type = type || 'none';
    this.particles = [];
  }

  update(dt, canvasW, canvasH) {
    this.timer += dt;

    // Spawn particles
    if (this.particles.length < this.maxParticles) {
      const spawnRate = this.type === 'rain' ? 4 : this.type === 'snow' ? 2 : this.type === 'embers' ? 1.5 : this.type === 'leaves' ? 1 : this.type === 'voidStatic' ? 3 : 0;
      if (Math.random() < spawnRate * dt * 10) {
        this._spawn(canvasW, canvasH);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Type-specific behavior
      if (this.type === 'snow') {
        p.x += Math.sin(this.timer * 2 + p.phase) * 15 * dt;
      } else if (this.type === 'leaves') {
        p.x += Math.sin(this.timer * 1.5 + p.phase) * 20 * dt;
        p.rotation += p.rotSpeed * dt;
      } else if (this.type === 'embers') {
        p.x += Math.sin(this.timer * 3 + p.phase) * 10 * dt;
        p.alpha = 0.5 + Math.sin(this.timer * 5 + p.phase) * 0.3;
      } else if (this.type === 'voidStatic') {
        p.alpha = Math.random() * 0.5;
        p.x = p.ox + (Math.random() - 0.5) * 4;
        p.y = p.oy + (Math.random() - 0.5) * 4;
      }

      if (p.life <= 0 || p.y > canvasH + 20 || p.y < -20 || p.x < -20 || p.x > canvasW + 20) {
        this.particles.splice(i, 1);
      }
    }
  }

  _spawn(w, h) {
    let p;
    switch (this.type) {
      case 'rain':
        p = {
          x: Math.random() * (w + 100) - 50,
          y: -10,
          vx: -20 + Math.random() * 10,
          vy: 300 + Math.random() * 200,
          life: 2,
          size: 1 + Math.random(),
          length: 8 + Math.random() * 12,
          alpha: 0.2 + Math.random() * 0.3,
          color: '#8899cc',
        };
        break;
      case 'snow':
        p = {
          x: Math.random() * (w + 50) - 25,
          y: -10,
          vx: 0,
          vy: 20 + Math.random() * 30,
          life: 8,
          size: 1 + Math.random() * 3,
          alpha: 0.3 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          color: '#ddeeff',
        };
        break;
      case 'embers':
        p = {
          x: Math.random() * w,
          y: h + 10,
          vx: (Math.random() - 0.5) * 30,
          vy: -(40 + Math.random() * 60),
          life: 3 + Math.random() * 2,
          size: 1 + Math.random() * 2,
          alpha: 0.6,
          phase: Math.random() * Math.PI * 2,
          color: Math.random() < 0.5 ? '#ff6622' : '#ffaa44',
        };
        break;
      case 'leaves':
        p = {
          x: Math.random() * (w + 100) - 50,
          y: -10,
          vx: 10 + Math.random() * 20,
          vy: 30 + Math.random() * 40,
          life: 5 + Math.random() * 3,
          size: 3 + Math.random() * 4,
          alpha: 0.3 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 3,
          color: Math.random() < 0.5 ? '#33aa22' : '#557722',
        };
        break;
      case 'voidStatic':
        const ox = Math.random() * w;
        const oy = Math.random() * h;
        p = {
          x: ox, y: oy,
          ox, oy,
          vx: 0, vy: 0,
          life: 0.1 + Math.random() * 0.3,
          size: 2 + Math.random() * 6,
          alpha: Math.random() * 0.3,
          color: Math.random() < 0.5 ? '#aa44ff' : '#6622aa',
        };
        break;
      default:
        return;
    }
    this.particles.push(p);
  }

  render(ctx) {
    if (this.type === 'none') return;

    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha || 0.3;

      if (this.type === 'rain') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + p.length);
        ctx.stroke();
      } else if (this.type === 'snow') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'embers') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.globalAlpha = (p.alpha || 0.3) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'leaves') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (this.type === 'voidStatic') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// --- Decoration Definitions ---
const DECORATION_DEFS = {
  // Forest
  tree: { w: 20, h: 40, draw(ctx, x, y) {
    ctx.fillStyle = '#3a2a15';
    ctx.fillRect(x - 3, y - 20, 6, 24);
    ctx.fillStyle = '#1a4a12';
    ctx.beginPath();
    ctx.moveTo(x, y - 38);
    ctx.lineTo(x - 14, y - 14);
    ctx.lineTo(x + 14, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#226618';
    ctx.beginPath();
    ctx.moveTo(x, y - 32);
    ctx.lineTo(x - 10, y - 18);
    ctx.lineTo(x + 10, y - 18);
    ctx.closePath();
    ctx.fill();
  }},
  mushroom: { w: 12, h: 14, draw(ctx, x, y) {
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(x - 2, y - 4, 4, 8);
    ctx.fillStyle = '#cc4422';
    ctx.beginPath();
    ctx.arc(x, y - 6, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffcc88';
    ctx.beginPath();
    ctx.arc(x - 2, y - 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }},
  bush: { w: 16, h: 12, draw(ctx, x, y) {
    ctx.fillStyle = '#1a3a0e';
    ctx.beginPath();
    ctx.arc(x, y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#225516';
    ctx.beginPath();
    ctx.arc(x - 4, y - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4, y - 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }},
  roots: { w: 18, h: 8, draw(ctx, x, y) {
    ctx.strokeStyle = '#3a2a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.quadraticCurveTo(x - 3, y - 5, x, y - 2);
    ctx.quadraticCurveTo(x + 4, y + 3, x + 9, y - 1);
    ctx.stroke();
  }},
  // City
  pillar: { w: 10, h: 36, draw(ctx, x, y) {
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x - 4, y - 30, 8, 32);
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(x - 6, y - 32, 12, 4);
    ctx.fillRect(x - 5, y, 10, 3);
  }},
  rubble: { w: 16, h: 8, draw(ctx, x, y) {
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(x - 6, y - 2, 8, 5);
    ctx.fillRect(x + 1, y - 4, 6, 7);
    ctx.fillStyle = '#2a2a34';
    ctx.fillRect(x - 3, y - 5, 5, 4);
  }},
  crate: { w: 14, h: 14, draw(ctx, x, y) {
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(x - 6, y - 10, 12, 12);
    ctx.strokeStyle = '#5a4a38';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, y - 10, 12, 12);
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x + 6, y - 4);
    ctx.stroke();
  }},
  lamppost: { w: 6, h: 32, draw(ctx, x, y) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x - 1, y - 26, 3, 28);
    ctx.fillRect(x - 4, y - 28, 9, 3);
    ctx.fillStyle = '#ffcc44';
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.003) * 0.1;
    ctx.beginPath();
    ctx.arc(x + 3, y - 28, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  // Infernal
  stalagmite: { w: 10, h: 24, draw(ctx, x, y) {
    ctx.fillStyle = '#4a2a18';
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x - 6, y + 2);
    ctx.lineTo(x + 6, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 22);
    ctx.lineTo(x + 6, y + 2);
    ctx.lineTo(x + 2, y + 2);
    ctx.closePath();
    ctx.fill();
  }},
  lavaCrack: { w: 20, h: 6, draw(ctx, x, y) {
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 4, y - 2);
    ctx.lineTo(x + 2, y + 1);
    ctx.lineTo(x + 10, y - 1);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }},
  bone: { w: 12, h: 8, draw(ctx, x, y) {
    ctx.fillStyle = '#aaa088';
    ctx.fillRect(x - 5, y - 1, 10, 3);
    ctx.beginPath();
    ctx.arc(x - 5, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 5, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }},
  brazier: { w: 10, h: 16, draw(ctx, x, y) {
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x - 4, y - 6, 8, 8);
    ctx.fillRect(x - 2, y - 8, 4, 2);
    ctx.fillStyle = '#ff6622';
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.006) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x - 4, y - 8);
    ctx.lineTo(x + 4, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  // Frozen
  iceCrystal: { w: 14, h: 22, draw(ctx, x, y) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#88ccff';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x - 6, y - 6);
    ctx.lineTo(x - 3, y + 2);
    ctx.lineTo(x + 3, y + 2);
    ctx.lineTo(x + 6, y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 6, y - 6);
    ctx.lineTo(x + 2, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  frozenPillar: { w: 10, h: 30, draw(ctx, x, y) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#6699bb';
    ctx.fillRect(x - 4, y - 26, 8, 28);
    ctx.fillStyle = '#88bbdd';
    ctx.fillRect(x - 2, y - 26, 3, 28);
    ctx.globalAlpha = 1;
  }},
  icicle: { w: 6, h: 16, draw(ctx, x, y) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 12);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 3, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  snowDrift: { w: 20, h: 8, draw(ctx, x, y) {
    ctx.fillStyle = '#ddeeff';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  // Void
  voidTendril: { w: 10, h: 28, draw(ctx, x, y) {
    const t = Date.now() * 0.002;
    ctx.strokeStyle = '#6622aa';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x + Math.sin(t) * 8, y - 10, x + Math.sin(t + 1) * 5, y - 24);
    ctx.stroke();
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }},
  rune: { w: 16, h: 16, draw(ctx, x, y) {
    const t = Date.now() * 0.001;
    ctx.globalAlpha = 0.2 + Math.sin(t) * 0.1;
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y - 4, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x - 6, y + 2);
    ctx.lineTo(x + 6, y + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }},
  floatingRock: { w: 12, h: 12, draw(ctx, x, y) {
    const bob = Math.sin(Date.now() * 0.002 + x) * 3;
    ctx.fillStyle = '#2a1a3a';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + bob);
    ctx.lineTo(x - 3, y - 6 + bob);
    ctx.lineTo(x + 4, y - 5 + bob);
    ctx.lineTo(x + 6, y + 2 + bob);
    ctx.closePath();
    ctx.fill();
    // Shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }},
  voidCrystal: { w: 10, h: 18, draw(ctx, x, y) {
    const t = Date.now() * 0.003;
    ctx.globalAlpha = 0.5 + Math.sin(t) * 0.15;
    ctx.fillStyle = '#4422aa';
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x - 5, y - 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 5, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8844ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x + 2, y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }}
};
