// ============================================================
// VOID CRAWLER - AI Narrator (OpenRouter Integration)
// Atmospheric commentary, boss dialogue, death chronicles
// 100% optional — game works perfectly without API key
// ============================================================

class AIManager {
  constructor() {
    // Auto-detect valid config
    this.enabled = typeof AI_CONFIG !== 'undefined'
      && AI_CONFIG.apiKey
      && AI_CONFIG.apiKey.length > 10;

    // Throttling
    this.cooldown = 0;
    this.minCooldown = 8;
    this.pendingRequest = false;

    // Event queue (priority-ordered, max 5)
    this.narratorQueue = [];

    // Rolling run context for AI memory
    this.runContext = [];

    // Narrator display state
    this.narratorFullText = '';
    this.narratorText = '';
    this.narratorReveal = 0;
    this.narratorDisplayTimer = 0;
    this.narratorFadeTimer = 0;

    // Pre-fetched content
    this.bossDialogue = null;
    this.biomeLore = null;
    this.deathChronicle = null;

    // Track DeathBringer phase for phase-change events
    this._lastDeathBringerPhase = 1;
  }

  // --- Event Priority Constants ---
  static get PRIORITY() {
    return {
      DEATH: 0,
      BOSS_ENTER: 1,
      BOSS_PHASE: 2,
      BOSS_DEFEAT: 2,
      BIOME_ENTER: 3,
      SYNERGY: 4,
      COMBO_EPIC: 5,
      ITEM_NOTABLE: 5,
      PLAYER_LOW_HP: 6,
      COMBO_HIGH: 7,
      ITEM_PICKUP: 8,
      KILL_STREAK: 9,
    };
  }

  // --- Static Fallbacks ---
  static get FALLBACKS() {
    return {
      combo_high: [
        'The void trembles at your efficiency.',
        'A chain of destruction, unbroken.',
        'They fall like dominoes in the dark.',
      ],
      combo_epic: [
        'Carnage incarnate. The walls weep.',
        'An artist of annihilation at work.',
        'Even the shadows recoil from your fury.',
      ],
      item_pickup: [
        'Another tool in your arsenal of desperation.',
        'You cling to power like a drowning thing.',
        'The void provides... for now.',
      ],
      boss_enter: [
        'Something ancient stirs ahead.',
        'The air grows thick with malice.',
        'A presence demands your attention.',
      ],
      boss_defeat: [
        'The titan falls. You remain. For now.',
        'Victory tastes like ash down here.',
        'One less guardian between you and the truth.',
      ],
      player_damage: [
        'Pain reminds you that you still exist.',
        'Your mortality is showing.',
        'The void smells your weakness.',
      ],
      biome_enter: [
        'A new realm of suffering awaits.',
        'The scenery changes. The danger does not.',
        'Deeper still you descend.',
      ],
      death_chronicle: [
        'Another crawler consumed by the void. Their echoes join the silence.',
        'They fought bravely, or perhaps desperately. The distinction matters little to the dead.',
        'The darkness claims what was always its own.',
      ],
      synergy: [
        'Power compounds upon power.',
        'The items resonate with terrible harmony.',
        'A dangerous combination takes form.',
      ],
      kill_streak: [
        'The body count speaks for itself.',
        'A trail of destruction marks your passage.',
        'The void keeps score. You are winning.',
      ],
    };
  }

  // --- Biome Personality Overlays ---
  static _biomePersonality(biomeKey) {
    const personalities = {
      corruptedForest: 'Your tone is ancient and knowing. Your words drip with moss and decay. You speak as the forest itself — patient, hungry, eternal.',
      abandonedCity: 'You are a cynical noir detective narrating from the ruins. Dry wit, world-weary observations. The city remembers everything.',
      infernalDepths: 'You are aggressive and demonic. You respect strength and mock weakness. Your words burn. Speak with the authority of hellfire.',
      frozenAbyss: 'You are cold, measured, clinical. The cruelty of absolute zero. Your observations are precise as ice crystals. No warmth in your words.',
      voidCore: 'You are glitching, reality-bending, fourth-wall aware. Existential dread seeps through your words. Reality is a suggestion here. You know things you should not.',
    };
    return personalities[biomeKey] || personalities.corruptedForest;
  }

  // --- System Prompts ---
  _narratorPrompt(biomeKey) {
    return `You are a dark, sardonic narrator for a roguelike dungeon crawler called VOID CRAWLER. You speak in 2nd person ("you"), 1-2 sentences maximum. Never use emojis. Never break character. Never give gameplay advice or tips. Your tone is atmospheric, ominous, darkly poetic. ${AIManager._biomePersonality(biomeKey)}`;
  }

  _bossDialoguePrompt() {
    return 'You are a boss monster in a dark dungeon crawler. Generate a 1-sentence taunt, maximum 15 words. Be arrogant, menacing, speak in first person. No emojis. No quotes around your response.';
  }

  _deathChroniclePrompt() {
    return 'You write elegiac tombstone inscriptions for fallen dungeon crawlers. Write 2-3 sentences in past tense, third person (refer to them as "the crawler"). Style: dark, poetic, like an epitaph carved in obsidian. Reference the specific details provided about their run. No emojis.';
  }

  // --- API Call ---
  async _callAPI(messages, maxTokens) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(AI_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://void-crawler.game',
          'X-Title': 'VOID CRAWLER',
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages,
          max_tokens: maxTokens || AI_CONFIG.maxTokens,
          temperature: AI_CONFIG.temperature,
          stop: ['\n\n'],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch {
      return null;
    }
  }

  // --- Queue Management ---
  queueEvent(type, priority, context) {
    if (!this.enabled) return;

    // Add to run context
    this.runContext.push({ type, ...context, time: Date.now() });
    if (this.runContext.length > 20) this.runContext.shift();

    // Death bypasses everything
    if (priority === AIManager.PRIORITY.DEATH) {
      this.narratorQueue.unshift({ type, priority, context });
    } else {
      // Insert by priority (lower number = higher priority)
      let inserted = false;
      for (let i = 0; i < this.narratorQueue.length; i++) {
        if (priority < this.narratorQueue[i].priority) {
          this.narratorQueue.splice(i, 0, { type, priority, context });
          inserted = true;
          break;
        }
      }
      if (!inserted) this.narratorQueue.push({ type, priority, context });
    }

    // Cap queue size
    if (this.narratorQueue.length > 5) this.narratorQueue.length = 5;
  }

  // --- Update Loop ---
  update(dt) {
    // Typewriter reveal
    if (this.narratorFullText && this.narratorReveal < 1) {
      this.narratorReveal = Math.min(1, this.narratorReveal + dt * 3);
      const len = Math.floor(this.narratorFullText.length * this.narratorReveal);
      this.narratorText = this.narratorFullText.substring(0, len);
    }

    // Display timer (hold text)
    if (this.narratorReveal >= 1 && this.narratorDisplayTimer > 0) {
      this.narratorDisplayTimer -= dt;
    }

    // Fade out
    if (this.narratorDisplayTimer <= 0 && this.narratorFullText) {
      this.narratorFadeTimer -= dt;
      if (this.narratorFadeTimer <= 0) {
        this.narratorFullText = '';
        this.narratorText = '';
      }
    }

    // Process queue when cooldown expires
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown <= 0 && this.narratorQueue.length > 0 && !this.pendingRequest) {
      const event = this.narratorQueue.shift();
      // Death events bypass cooldown
      if (event.priority === AIManager.PRIORITY.DEATH || this.cooldown <= 0) {
        this._processNarrationEvent(event);
      }
    }
  }

  // --- Process Narration Event ---
  async _processNarrationEvent(event) {
    this.pendingRequest = true;
    this.cooldown = this.minCooldown;

    const biomeKey = event.context.biomeKey || 'corruptedForest';
    const runSummary = this._buildRunContext();

    const userMsg = this._buildEventMessage(event, runSummary);

    const result = await this._callAPI([
      { role: 'system', content: this._narratorPrompt(biomeKey) },
      { role: 'user', content: userMsg },
    ], AI_CONFIG.maxTokens);

    if (result) {
      this._showNarration(result);
    } else {
      // Static fallback
      const fallbacks = AIManager.FALLBACKS[event.type] || AIManager.FALLBACKS.item_pickup;
      const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      this._showNarration(fallback);
    }

    this.pendingRequest = false;
  }

  _buildEventMessage(event, runSummary) {
    const ctx = event.context;
    let msg = '';

    switch (event.type) {
      case 'combo_high':
        msg = `The player just killed ${ctx.combo} enemies in rapid succession on floor ${ctx.floor}.`;
        break;
      case 'combo_epic':
        msg = `The player achieved an EPIC ${ctx.combo}-kill combo on floor ${ctx.floor}! Total kills: ${ctx.kills}.`;
        break;
      case 'item_pickup':
        msg = `The player picked up "${ctx.itemName}" (${ctx.itemDesc}) on floor ${ctx.floor}. They now have ${ctx.totalItems} items.`;
        break;
      case 'boss_enter':
        msg = `The player has entered the boss chamber on floor ${ctx.floor}. The boss "${ctx.bossName}" awaits.`;
        break;
      case 'boss_defeat':
        msg = `The player has DEFEATED the boss "${ctx.bossName}" on floor ${ctx.floor}!`;
        break;
      case 'boss_phase':
        msg = `The boss "${ctx.bossName}" has entered phase ${ctx.phase} — it's becoming more dangerous! Floor ${ctx.floor}.`;
        break;
      case 'player_low_hp':
        msg = `The player is critically wounded (${ctx.hp}/${ctx.maxHp} HP) on floor ${ctx.floor}. Death looms.`;
        break;
      case 'biome_enter':
        msg = `The player has entered a new biome: "${ctx.biomeName}" on floor ${ctx.floor}.`;
        break;
      case 'synergy':
        msg = `The player activated the synergy "${ctx.synergyName}" by combining items on floor ${ctx.floor}!`;
        break;
      case 'kill_streak':
        msg = `The player has killed ${ctx.kills} enemies total on this run. Floor ${ctx.floor}.`;
        break;
      default:
        msg = `Something happened on floor ${ctx.floor}.`;
    }

    if (runSummary) msg += `\n\nRun so far: ${runSummary}`;
    return msg;
  }

  _buildRunContext() {
    if (this.runContext.length === 0) return '';
    const recent = this.runContext.slice(-8);
    return recent.map(e => {
      switch (e.type) {
        case 'combo_high':
        case 'combo_epic':
          return `${e.combo}-kill combo`;
        case 'item_pickup':
          return `found ${e.itemName}`;
        case 'boss_enter':
          return `entered boss room`;
        case 'boss_defeat':
          return `defeated ${e.bossName}`;
        case 'biome_enter':
          return `entered ${e.biomeName}`;
        case 'synergy':
          return `activated ${e.synergyName}`;
        case 'player_low_hp':
          return `nearly died (${e.hp}HP)`;
        case 'kill_streak':
          return `${e.kills} total kills`;
        default:
          return e.type;
      }
    }).join(', ');
  }

  // --- Show Narration ---
  _showNarration(text) {
    this.narratorFullText = text;
    this.narratorText = '';
    this.narratorReveal = 0;
    this.narratorDisplayTimer = 5;
    this.narratorFadeTimer = 1;
  }

  // --- Get narrator alpha for rendering ---
  getNarratorAlpha() {
    if (!this.narratorFullText) return 0;
    if (this.narratorDisplayTimer > 0 || this.narratorReveal < 1) return 1;
    return Math.max(0, this.narratorFadeTimer);
  }

  // --- Pre-fetch Boss Dialogue ---
  async prefetchBossDialogue(bossName, biomeKey, floor) {
    if (!this.enabled) return;
    this.bossDialogue = null;

    const sysPrompt = this._bossDialoguePrompt();
    const biomeDesc = AIManager._biomePersonality(biomeKey);

    const [taunt, phaseShift, deathSpeech] = await Promise.all([
      this._callAPI([
        { role: 'system', content: `${sysPrompt} ${biomeDesc}` },
        { role: 'user', content: `You are "${bossName}" on floor ${floor}. Taunt the player who just entered your chamber.` },
      ], AI_CONFIG.bossMaxTokens),
      this._callAPI([
        { role: 'system', content: `${sysPrompt} ${biomeDesc}` },
        { role: 'user', content: `You are "${bossName}". You just entered a more dangerous phase. React with rage and power.` },
      ], AI_CONFIG.bossMaxTokens),
      this._callAPI([
        { role: 'system', content: `${sysPrompt} ${biomeDesc}` },
        { role: 'user', content: `You are "${bossName}". You have been defeated. Deliver your final words — defiant, ominous, or bitter.` },
      ], AI_CONFIG.bossMaxTokens),
    ]);

    this.bossDialogue = {
      taunt: taunt || this._randomFallback('boss_enter'),
      phaseShift: phaseShift || 'You think this is my final form?',
      deathSpeech: deathSpeech || 'This... is not... the end...',
    };
  }

  // --- Pre-fetch Biome Lore ---
  async prefetchBiomeLore(biomeKey, floor) {
    if (!this.enabled) return;
    this.biomeLore = null;

    const biomeNames = {
      corruptedForest: 'Corrupted Forest',
      abandonedCity: 'Abandoned City',
      infernalDepths: 'Infernal Depths',
      frozenAbyss: 'Frozen Abyss',
      voidCore: 'Void Core',
    };
    const biomeName = biomeNames[biomeKey] || biomeKey;

    const result = await this._callAPI([
      { role: 'system', content: `You write atmospheric entrance text for biomes in a dark roguelike dungeon crawler. Write 2 short lines (separated by a newline) describing the player entering a new area. Second person ("you"), ominous, poetic. No emojis. ${AIManager._biomePersonality(biomeKey)}` },
      { role: 'user', content: `The player enters "${biomeName}" on floor ${floor}. Describe the atmosphere as they step in.` },
    ], AI_CONFIG.maxTokens);

    if (result) {
      this.biomeLore = result;
    }
  }

  // --- Generate Death Chronicle ---
  async generateDeathChronicle(player, floor, combo, elapsed, biomeManager) {
    if (!this.enabled) return;
    this.deathChronicle = null;

    const biomeKey = biomeManager?.currentBiomeKey || 'corruptedForest';
    const biomeNames = {
      corruptedForest: 'Corrupted Forest',
      abandonedCity: 'Abandoned City',
      infernalDepths: 'Infernal Depths',
      frozenAbyss: 'Frozen Abyss',
      voidCore: 'Void Core',
    };
    const biomeName = biomeNames[biomeKey] || biomeKey;

    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);

    const itemNames = (player.items || []).map(k => ITEM_DEFS[k]?.name || k).slice(-5).join(', ');

    const result = await this._callAPI([
      { role: 'system', content: this._deathChroniclePrompt() },
      { role: 'user', content: `The crawler died on floor ${floor} in the ${biomeName}. They survived ${minutes}m${seconds}s, killed ${player.kills} enemies, achieved a best combo of ${combo.bestCombo}, collected ${player.items.length} items${itemNames ? ` (including ${itemNames})` : ''}. Write their epitaph.` },
    ], AI_CONFIG.chronicleMaxTokens);

    if (result) {
      this.deathChronicle = result;
    } else {
      const fallbacks = AIManager.FALLBACKS.death_chronicle;
      this.deathChronicle = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  // --- Helpers ---
  _randomFallback(category) {
    const fallbacks = AIManager.FALLBACKS[category];
    if (!fallbacks) return '';
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // --- Reset (called on new game) ---
  reset() {
    this.cooldown = 0;
    this.pendingRequest = false;
    this.narratorQueue = [];
    this.runContext = [];
    this.narratorFullText = '';
    this.narratorText = '';
    this.narratorReveal = 0;
    this.narratorDisplayTimer = 0;
    this.narratorFadeTimer = 0;
    this.bossDialogue = null;
    this.biomeLore = null;
    this.deathChronicle = null;
    this._lastDeathBringerPhase = 1;
    this._lastSynergyName = null;
  }
}
