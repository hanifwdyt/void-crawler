// ============================================================
// VOID CRAWLER - World Generation
// Dungeon BSP, Items, Visibility
// ============================================================

const TileType = { VOID: 0, WALL: 1, FLOOR: 2, STAIRS: 3, SPIKE: 4, POISON: 5 };

// --- BSP Dungeon Generation ---
class BSPNode {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null;
    this.room = null;
  }

  split(depth) {
    if (depth <= 0 || this.w < 12 || this.h < 12) return;
    const horizontal = this.h > this.w ? true : this.w > this.h ? false : Math.random() > 0.5;

    if (horizontal) {
      if (this.h < 14) return;
      const split = randInt(this.y + 5, this.y + this.h - 6);
      this.left = new BSPNode(this.x, this.y, this.w, split - this.y);
      this.right = new BSPNode(this.x, split, this.w, this.y + this.h - split);
    } else {
      if (this.w < 14) return;
      const split = randInt(this.x + 5, this.x + this.w - 6);
      this.left = new BSPNode(this.x, this.y, split - this.x, this.h);
      this.right = new BSPNode(split, this.y, this.x + this.w - split, this.h);
    }

    this.left.split(depth - 1);
    this.right.split(depth - 1);
  }

  getLeaves() {
    if (!this.left && !this.right) return [this];
    let leaves = [];
    if (this.left) leaves = leaves.concat(this.left.getLeaves());
    if (this.right) leaves = leaves.concat(this.right.getLeaves());
    return leaves;
  }
}

class Room {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.cx = Math.floor(x + w / 2);
    this.cy = Math.floor(y + h / 2);
  }
}

class Dungeon {
  constructor(floor) {
    this.floor = floor;
    this.tiles = [];
    this.rooms = [];
    this.spawn = { x: 0, y: 0 };
    this.stairsPos = { x: 0, y: 0 };
    this.enemySpawns = [];
    this.itemSpawns = [];
    this.visibility = [];
    this.explored = [];
    this.specialRooms = [];
    this.hazards = [];
    this.decorations = [];
    this.bossRoom = null;
    this._lastVisTx = -1;
    this._lastVisTy = -1;
    this.generate();
  }

  generate() {
    // Init tiles to VOID
    this.tiles = Array.from({ length: DUNGEON_H }, () => Array(DUNGEON_W).fill(TileType.VOID));
    this.visibility = Array.from({ length: DUNGEON_H }, () => Array(DUNGEON_W).fill(false));
    this.explored = Array.from({ length: DUNGEON_H }, () => Array(DUNGEON_W).fill(false));

    // BSP split
    const root = new BSPNode(1, 1, DUNGEON_W - 2, DUNGEON_H - 2);
    root.split(4);
    const leaves = root.getLeaves();

    // Create rooms in leaves
    for (const leaf of leaves) {
      const padding = 2;
      const rw = randInt(Math.min(5, leaf.w - padding * 2), leaf.w - padding * 2);
      const rh = randInt(Math.min(5, leaf.h - padding * 2), leaf.h - padding * 2);
      if (rw < 4 || rh < 4) continue;
      const rx = randInt(leaf.x + 1, leaf.x + leaf.w - rw - 1);
      const ry = randInt(leaf.y + 1, leaf.y + leaf.h - rh - 1);
      const room = new Room(rx, ry, rw, rh);
      leaf.room = room;
      this.rooms.push(room);
      this.carveRoom(room);
    }

    // Connect rooms via BSP tree
    this.connectBSP(root);

    // Place spawn in first room
    const spawnRoom = this.rooms[0];
    this.spawn = { x: toWorld(spawnRoom.cx), y: toWorld(spawnRoom.cy) };

    // Place stairs in furthest room
    let maxDist = 0, stairsRoom = this.rooms[this.rooms.length - 1];
    for (const room of this.rooms) {
      const d = dist(spawnRoom.cx, spawnRoom.cy, room.cx, room.cy);
      if (d > maxDist) { maxDist = d; stairsRoom = room; }
    }
    this.stairsPos = { x: stairsRoom.cx, y: stairsRoom.cy };
    this.tiles[stairsRoom.cy][stairsRoom.cx] = TileType.STAIRS;

    // Find spawn and stairs room indices
    const spawnRoomIdx = 0;
    const stairsRoomIdx = this.rooms.indexOf(stairsRoom);

    // Assign special rooms
    this.assignSpecialRooms(spawnRoomIdx, stairsRoomIdx);

    // Place environmental hazards (floor 4+)
    this.placeHazards(spawnRoomIdx, stairsRoomIdx);

    // Place enemies
    this.placeEnemies();

    // Place items
    this.placeItems();
  }

  assignSpecialRooms(spawnRoomIdx, stairsRoomIdx) {
    this.specialRooms = [];

    // Collect eligible room indices (not spawn, not stairs)
    const eligible = [];
    for (let i = 0; i < this.rooms.length; i++) {
      if (i !== spawnRoomIdx && i !== stairsRoomIdx) {
        eligible.push(i);
      }
    }

    // Shuffle eligible for random picking
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }

    let pickIdx = 0;

    // Treasure room: 1 per floor (always, if room available)
    if (pickIdx < eligible.length) {
      const roomIndex = eligible[pickIdx++];
      this.specialRooms.push({
        roomIndex,
        type: 'treasure',
        room: this.rooms[roomIndex],
        used: false
      });
    }

    // Shop room: floor 2+
    if (this.floor >= 2 && pickIdx < eligible.length) {
      const roomIndex = eligible[pickIdx++];
      const itemKeys = Object.keys(ITEM_DEFS);
      const shopItems = [];
      const usedItems = new Set();
      for (let i = 0; i < 3; i++) {
        let itemType;
        let attempts = 0;
        do {
          itemType = itemKeys[Math.floor(Math.random() * itemKeys.length)];
          attempts++;
        } while (usedItems.has(itemType) && attempts < 20);
        usedItems.add(itemType);
        shopItems.push(itemType);
      }
      this.specialRooms.push({
        roomIndex,
        type: 'shop',
        room: this.rooms[roomIndex],
        items: shopItems,
        used: false
      });
    }

    // Shrine room: floor 3+, 50% chance
    if (this.floor >= 3 && Math.random() < 0.5 && pickIdx < eligible.length) {
      const roomIndex = eligible[pickIdx++];
      this.specialRooms.push({
        roomIndex,
        type: 'shrine',
        room: this.rooms[roomIndex],
        used: false
      });
    }

    // Healing fountain: floor 4+, 50% chance
    if (this.floor >= 4 && Math.random() < 0.5 && pickIdx < eligible.length) {
      const roomIndex = eligible[pickIdx++];
      this.specialRooms.push({
        roomIndex,
        type: 'fountain',
        room: this.rooms[roomIndex],
        used: false
      });
    }
  }

  placeHazards(spawnRoomIdx, stairsRoomIdx) {
    this.hazards = [];
    if (this.floor < 4) return;

    // Get set of special room indices
    const specialIndices = new Set(this.specialRooms.map(sr => sr.roomIndex));
    specialIndices.add(spawnRoomIdx);
    specialIndices.add(stairsRoomIdx);

    for (let i = 0; i < this.rooms.length; i++) {
      if (specialIndices.has(i)) continue;

      const room = this.rooms[i];

      // Place 3-8 spike tiles
      const spikeCount = randInt(3, 8);
      for (let s = 0; s < spikeCount; s++) {
        const sx = randInt(room.x + 1, room.x + room.w - 2);
        const sy = randInt(room.y + 1, room.y + room.h - 2);
        if (sx >= 0 && sx < DUNGEON_W && sy >= 0 && sy < DUNGEON_H &&
            this.tiles[sy][sx] === TileType.FLOOR) {
          this.tiles[sy][sx] = TileType.SPIKE;
          this.hazards.push({ x: sx, y: sy, type: 'spike', dmgTimer: 0 });
        }
      }

      // Place 2-5 poison tiles
      const poisonCount = randInt(2, 5);
      for (let p = 0; p < poisonCount; p++) {
        const px = randInt(room.x + 1, room.x + room.w - 2);
        const py = randInt(room.y + 1, room.y + room.h - 2);
        if (px >= 0 && px < DUNGEON_W && py >= 0 && py < DUNGEON_H &&
            this.tiles[py][px] === TileType.FLOOR) {
          this.tiles[py][px] = TileType.POISON;
          this.hazards.push({ x: px, y: py, type: 'poison', dmgTimer: 0 });
        }
      }
    }
  }

  carveRoom(room) {
    // Walls around room
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) {
        if (y >= 0 && y < DUNGEON_H && x >= 0 && x < DUNGEON_W) {
          if (this.tiles[y][x] === TileType.VOID) {
            this.tiles[y][x] = TileType.WALL;
          }
        }
      }
    }
    // Floor
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (y >= 0 && y < DUNGEON_H && x >= 0 && x < DUNGEON_W) {
          this.tiles[y][x] = TileType.FLOOR;
        }
      }
    }
  }

  connectBSP(node) {
    if (!node.left || !node.right) return;
    this.connectBSP(node.left);
    this.connectBSP(node.right);

    const leftRoom = this.getClosestRoom(node.left);
    const rightRoom = this.getClosestRoom(node.right);
    if (leftRoom && rightRoom) {
      this.carveCorridor(leftRoom.cx, leftRoom.cy, rightRoom.cx, rightRoom.cy);
    }
  }

  getClosestRoom(node) {
    if (node.room) return node.room;
    const leaves = node.getLeaves();
    for (const l of leaves) {
      if (l.room) return l.room;
    }
    return null;
  }

  carveCorridor(x1, y1, x2, y2) {
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
      if (x >= 0 && x < DUNGEON_W && y >= 0 && y < DUNGEON_H) {
        // Carve 2-wide corridor
        this.setFloor(x, y);
        this.setFloor(x + 1, y);
        this.setFloor(x, y + 1);
      }
      // Move towards target, randomly choose horizontal or vertical
      if (x !== x2 && (y === y2 || Math.random() > 0.5)) {
        x += x < x2 ? 1 : -1;
      } else if (y !== y2) {
        y += y < y2 ? 1 : -1;
      }
    }
    this.setFloor(x, y);
  }

  setFloor(x, y) {
    if (x < 1 || x >= DUNGEON_W - 1 || y < 1 || y >= DUNGEON_H - 1) return;
    if (this.tiles[y][x] === TileType.VOID || this.tiles[y][x] === TileType.WALL) {
      this.tiles[y][x] = TileType.FLOOR;
    }
    // Add walls around floor
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < DUNGEON_W && ny >= 0 && ny < DUNGEON_H) {
          if (this.tiles[ny][nx] === TileType.VOID) {
            this.tiles[ny][nx] = TileType.WALL;
          }
        }
      }
    }
  }

  placeEnemies() {
    const baseCount = 3 + this.floor * 2;
    const maxPerRoom = 2 + Math.floor(this.floor / 2);

    // Build set of special room indices to skip
    const specialIndices = new Set(this.specialRooms.map(sr => sr.roomIndex));

    for (let i = 1; i < this.rooms.length; i++) {
      // Skip special rooms (treasure, shop, shrine, fountain)
      if (specialIndices.has(i)) continue;

      const room = this.rooms[i];
      const count = Math.min(randInt(1, maxPerRoom), baseCount - this.enemySpawns.length);
      if (count <= 0) break;

      for (let j = 0; j < count; j++) {
        const ex = toWorld(randInt(room.x + 1, room.x + room.w - 2));
        const ey = toWorld(randInt(room.y + 1, room.y + room.h - 2));

        let type;
        if (this.floor <= 2) {
          // 60% slime, 40% bat
          type = Math.random() < 0.6 ? 'slime' : 'bat';
        } else if (this.floor <= 4) {
          // 25% slime, 25% bat, 20% shooter, 15% charger, 15% exploder
          const r = Math.random();
          if (r < 0.25) type = 'slime';
          else if (r < 0.50) type = 'bat';
          else if (r < 0.70) type = 'shooter';
          else if (r < 0.85) type = 'charger';
          else type = 'exploder';
        } else if (this.floor <= 6) {
          // 15% slime, 15% bat, 20% shooter, 15% charger, 15% exploder, 10% necromancer, 10% teleporter
          const r = Math.random();
          if (r < 0.15) type = 'slime';
          else if (r < 0.30) type = 'bat';
          else if (r < 0.50) type = 'shooter';
          else if (r < 0.65) type = 'charger';
          else if (r < 0.80) type = 'exploder';
          else if (r < 0.90) type = 'necromancer';
          else type = 'teleporter';
        } else {
          // floor 7+: 10% slime, 10% bat, 20% shooter, 15% charger, 15% exploder,
          // 10% necromancer, 10% teleporter, 5% mimic, 5% extra
          const r = Math.random();
          if (r < 0.10) type = 'slime';
          else if (r < 0.20) type = 'bat';
          else if (r < 0.40) type = 'shooter';
          else if (r < 0.55) type = 'charger';
          else if (r < 0.70) type = 'exploder';
          else if (r < 0.80) type = 'necromancer';
          else if (r < 0.90) type = 'teleporter';
          else if (r < 0.95) {
            // Mimic - place near an item if possible
            type = 'mimic';
            if (this.itemSpawns.length > 0) {
              const nearItem = this.itemSpawns[Math.floor(Math.random() * this.itemSpawns.length)];
              this.enemySpawns.push({
                x: nearItem.x + TILE,
                y: nearItem.y,
                type: 'mimic'
              });
              continue;
            }
          } else {
            // 5% extra of others
            const extraTypes = ['shooter', 'charger', 'exploder', 'necromancer', 'teleporter'];
            type = extraTypes[Math.floor(Math.random() * extraTypes.length)];
          }
        }

        this.enemySpawns.push({ x: ex, y: ey, type });
      }
    }

    // Boss every 5 floors
    if (this.floor % 5 === 0 && this.rooms.length > 1) {
      const bossRoom = this.rooms[this.rooms.length - 1];
      this.bossRoom = bossRoom;
      // Remove stairs enemy overlap
      this.enemySpawns = this.enemySpawns.filter(e => {
        return dist(e.x, e.y, toWorld(bossRoom.cx), toWorld(bossRoom.cy)) > TILE * 3;
      });

      // Boss type selection based on floor
      let bossType;
      if (this.floor % 15 === 0) {
        bossType = 'deathBringer';
      } else if (this.floor % 10 === 0) {
        bossType = 'voidWarden';
      } else {
        bossType = 'slimeKing';
      }

      this.enemySpawns.push({
        x: toWorld(bossRoom.cx),
        y: toWorld(bossRoom.cy - 1),
        type: bossType
      });
    }
  }

  placeDecorations(biome) {
    this.decorations = [];
    if (!biome || !biome.decorations) return;

    const types = biome.decorations;
    const specialIndices = new Set(this.specialRooms.map(sr => sr.roomIndex));
    specialIndices.add(0); // spawn room

    for (let i = 0; i < this.rooms.length; i++) {
      if (specialIndices.has(i)) continue;
      const room = this.rooms[i];
      // Place 2-5 decorations per room, along walls and corners
      const count = randInt(2, 5);
      for (let j = 0; j < count; j++) {
        const type = randChoice(types);
        // Position near walls (edges of room)
        let dx, dy;
        const edge = randInt(0, 3);
        if (edge === 0) { dx = room.x + 1; dy = randInt(room.y + 1, room.y + room.h - 2); }
        else if (edge === 1) { dx = room.x + room.w - 2; dy = randInt(room.y + 1, room.y + room.h - 2); }
        else if (edge === 2) { dx = randInt(room.x + 1, room.x + room.w - 2); dy = room.y + 1; }
        else { dx = randInt(room.x + 1, room.x + room.w - 2); dy = room.y + room.h - 2; }

        this.decorations.push({
          type,
          x: toWorld(dx),
          y: toWorld(dy),
          variant: randInt(0, 3)
        });
      }
    }
  }

  placeItems() {
    const itemCount = Math.min(2 + Math.floor(this.floor / 3), this.rooms.length - 1);
    const usedRooms = new Set([0]); // Don't place in spawn room

    // Place shop items first
    for (const special of this.specialRooms) {
      if (special.type === 'shop') {
        usedRooms.add(special.roomIndex);
        const room = special.room;
        for (let i = 0; i < special.items.length; i++) {
          const offsetX = (i - 1) * 2; // -2, 0, +2 tile offset
          this.itemSpawns.push({
            x: toWorld(room.cx + offsetX),
            y: toWorld(room.cy),
            type: special.items[i],
            collected: false,
            shopItem: true
          });
        }
      }
    }

    // Mark special rooms as used for regular item placement
    for (const special of this.specialRooms) {
      usedRooms.add(special.roomIndex);
    }

    for (let i = 0; i < itemCount; i++) {
      let roomIdx;
      let attempts = 0;
      do {
        roomIdx = randInt(1, this.rooms.length - 1);
        attempts++;
      } while (usedRooms.has(roomIdx) && attempts < 20);

      if (attempts >= 20) continue;
      usedRooms.add(roomIdx);
      const room = this.rooms[roomIdx];

      const itemType = randChoice(Object.keys(ITEM_DEFS));
      this.itemSpawns.push({
        x: toWorld(room.cx),
        y: toWorld(room.cy),
        type: itemType,
        collected: false
      });
    }
  }

  updateVisibility(px, py) {
    const ptx = toTile(px), pty = toTile(py);

    // Cache optimization: only recalculate if player tile changed
    if (ptx === this._lastVisTx && pty === this._lastVisTy) {
      return;
    }
    this._lastVisTx = ptx;
    this._lastVisTy = pty;

    // Reset visibility
    for (let y = 0; y < DUNGEON_H; y++) {
      for (let x = 0; x < DUNGEON_W; x++) {
        this.visibility[y][x] = false;
      }
    }

    const r = VISION_RADIUS;

    for (let y = pty - r; y <= pty + r; y++) {
      for (let x = ptx - r; x <= ptx + r; x++) {
        if (x < 0 || x >= DUNGEON_W || y < 0 || y >= DUNGEON_H) continue;
        if (dist(ptx, pty, x, y) > r) continue;

        // Raycast from player to this tile
        const wx = toWorld(x), wy = toWorld(y);
        if (lineOfSight(px, py, wx, wy, this.tiles) || dist(ptx, pty, x, y) < 1.5) {
          this.visibility[y][x] = true;
          this.explored[y][x] = true;
        }
      }
    }
  }

  isWalkable(x, y) {
    const tx = toTile(x), ty = toTile(y);
    if (tx < 0 || tx >= DUNGEON_W || ty < 0 || ty >= DUNGEON_H) return false;
    return this.tiles[ty][tx] >= TileType.FLOOR;
  }

  canMoveTo(x, y, radius) {
    // Check 4 corners + center
    const points = [
      [x - radius, y - radius], [x + radius, y - radius],
      [x - radius, y + radius], [x + radius, y + radius],
      [x, y]
    ];
    for (const [px, py] of points) {
      if (!this.isWalkable(px, py)) return false;
    }
    return true;
  }
}

// --- Item Definitions ---
const ITEM_DEFS = {
  swiftBoots: {
    name: 'Swift Boots',
    desc: '+25% speed',
    color: '#44aaff',
    symbol: 'S',
    apply: p => { p.speed *= 1.25; }
  },
  ironShield: {
    name: 'Iron Shield',
    desc: '-20% damage taken',
    color: '#aaaacc',
    symbol: 'I',
    apply: p => { p.defense = (p.defense || 0) + 0.2; }
  },
  fireRing: {
    name: 'Fire Ring',
    desc: 'Burn enemies on hit',
    color: '#ff6622',
    symbol: 'F',
    apply: p => { p.burnDmg = (p.burnDmg || 0) + 0.5; }
  },
  splitShot: {
    name: 'Split Shot',
    desc: '3-way shot',
    color: '#66ffcc',
    symbol: 'T',
    apply: p => { p.splitShot = true; }
  },
  vampiricBlade: {
    name: 'Vampiric Fang',
    desc: 'Heal on kill',
    color: '#cc0033',
    symbol: 'V',
    apply: p => { p.vampiric = true; }
  },
  rapidFire: {
    name: 'Rapid Fire',
    desc: '+40% attack speed',
    color: '#ffff44',
    symbol: 'R',
    apply: p => { p.fireRate *= 0.6; }
  },
  piercing: {
    name: 'Piercing Shot',
    desc: 'Shots pierce enemies',
    color: '#44ffaa',
    symbol: 'P',
    apply: p => { p.piercing = true; }
  },
  bigShot: {
    name: 'Big Shot',
    desc: '+80% projectile size',
    color: '#ff88ff',
    symbol: 'B',
    apply: p => { p.projSize *= 1.8; }
  },
  bounceShot: {
    name: 'Bounce Shot',
    desc: 'Shots bounce off walls',
    color: '#88ff88',
    symbol: 'W',
    apply: p => { p.bounce = true; }
  },
  heartContainer: {
    name: 'Heart Container',
    desc: '+2 max HP',
    color: '#ff4466',
    symbol: 'H',
    apply: p => { p.maxHp += 2; p.hp = Math.min(p.hp + 2, p.maxHp); }
  },
  powerUp: {
    name: 'Power Crystal',
    desc: '+50% damage',
    color: '#ff44ff',
    symbol: 'D',
    apply: p => { p.damage *= 1.5; }
  },
  magnetField: {
    name: 'Magnet Field',
    desc: 'Attract items',
    color: '#4488ff',
    symbol: 'M',
    apply: p => { p.magnetRange = (p.magnetRange || 0) + TILE * 4; }
  },
  chainLightning: {
    name: 'Chain Lightning',
    desc: 'Shots jump to nearby enemies',
    color: '#44ddff',
    symbol: 'L',
    apply: p => { p.chainLightning = true; }
  },
  poisonTip: {
    name: 'Poison Tip',
    desc: 'Poison enemies on hit',
    color: '#44cc22',
    symbol: 'X',
    apply: p => { p.poisonDmg = (p.poisonDmg || 0) + 0.3; }
  },
  criticalEye: {
    name: 'Critical Eye',
    desc: '20% chance for 3x damage',
    color: '#ff4488',
    symbol: 'C',
    apply: p => { p.critChance = (p.critChance || 0) + 0.2; }
  },
  seekingShots: {
    name: 'Seeking Shots',
    desc: 'Shots home towards enemies',
    color: '#ffaa44',
    symbol: 'K',
    apply: p => { p.homing = true; }
  },
  dodgeCloak: {
    name: 'Dodge Cloak',
    desc: '15% chance to dodge attacks',
    color: '#aaaaee',
    symbol: 'O',
    apply: p => { p.dodgeChance = (p.dodgeChance || 0) + 0.15; }
  },
  thornArmor: {
    name: 'Thorn Armor',
    desc: 'Reflect damage to melee attackers',
    color: '#88aa44',
    symbol: 'A',
    apply: p => { p.thornDmg = (p.thornDmg || 0) + 1; }
  },
  phantomDash: {
    name: 'Phantom Dash',
    desc: 'Kills reset dash cooldown',
    color: '#aa88ff',
    symbol: 'G',
    apply: p => { p.phantomDash = true; }
  },
  soulVacuum: {
    name: 'Soul Vacuum',
    desc: '+50% score gain',
    color: '#8844ff',
    symbol: 'U',
    apply: p => { p.scoreMultiplier = (p.scoreMultiplier || 1) * 1.5; }
  },
  glassCannon: {
    name: 'Glass Cannon',
    desc: '+100% damage, -50% max HP',
    color: '#ff88aa',
    symbol: 'Z',
    apply: p => { p.damage *= 2; p.maxHp = Math.max(1, Math.ceil(p.maxHp * 0.5)); p.hp = Math.min(p.hp, p.maxHp); }
  },
  shieldBreaker: {
    name: 'Shield Breaker',
    desc: 'Shots ignore enemy armor',
    color: '#ccaa44',
    symbol: 'N',
    apply: p => { p.armorPierce = true; }
  }
};

// --- Synergies ---
const SYNERGIES = [
  {
    req: ['fireRing', 'splitShot'],
    name: 'Inferno',
    desc: 'Explosions on hit!',
    color: '#ff4400',
    apply: p => { p.explodeOnHit = true; }
  },
  {
    req: ['vampiricBlade', 'rapidFire'],
    name: 'Blood Frenzy',
    desc: 'Life steal on hit',
    color: '#ff0044',
    apply: p => { p.lifeStealOnHit = true; }
  },
  {
    req: ['piercing', 'bigShot'],
    name: 'Devastator',
    desc: 'Massive piercing shots',
    color: '#ff88ff',
    apply: p => { p.damage *= 1.5; p.projSize *= 1.3; }
  },
  {
    req: ['bounceShot', 'splitShot'],
    name: 'Chaos',
    desc: 'Bouncing split shots',
    color: '#88ffaa',
    apply: p => { p.projCount = (p.projCount || 3) + 2; }
  },
  {
    req: ['chainLightning', 'criticalEye'],
    name: 'Storm',
    desc: 'Lightning crits chain further!',
    color: '#44ffff',
    apply: p => { p.stormChain = true; p.critChance += 0.1; }
  },
  {
    req: ['poisonTip', 'fireRing'],
    name: 'Toxic Inferno',
    desc: 'Poison + fire = toxic explosions',
    color: '#88ff22',
    apply: p => { p.toxicExplosion = true; }
  },
  {
    req: ['dodgeCloak', 'swiftBoots'],
    name: 'Ghost',
    desc: 'Phase through enemies briefly after dodge',
    color: '#ddddff',
    apply: p => { p.ghostDodge = true; p.dodgeChance += 0.05; }
  },
  {
    req: ['glassCannon', 'vampiricBlade'],
    name: 'Blood Pact',
    desc: 'More damage, more healing',
    color: '#ff0044',
    apply: p => { p.bloodPact = true; p.damage *= 1.3; }
  },
  {
    req: ['seekingShots', 'rapidFire'],
    name: 'Missile Barrage',
    desc: 'Rapid homing shots!',
    color: '#ffcc44',
    apply: p => { p.fireRate *= 0.7; }
  }
];
