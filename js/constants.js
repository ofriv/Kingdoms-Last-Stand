export const GRID_COLS = 20;
export const GRID_ROWS = 15;
export const CELL_SIZE = 1.5;

// Path waypoints [col, row] — winding S-curve left to right
export const PATH_WAYPOINTS = [
  [0, 7],
  [4, 7],
  [4, 2],
  [10, 2],
  [10, 9],
  [15, 9],
  [15, 4],
  [17, 4],
  [17, 12],
  [19, 12],
];

export const ENTRANCE = PATH_WAYPOINTS[0];
export const CASTLE   = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];

/**
 * Each tower has:
 *   unlockWave  — wave number at which the button becomes available (1 = start)
 *   paths       — 2 upgrade paths, each with 3 tiers
 *
 * Bloons-style cross-path rule (enforced in Tower class):
 *   You may not have BOTH paths at tier ≥ 2 simultaneously.
 *   Valid combos: 3-0, 0-3, 2-1, 1-2, 3-1, 1-3  (NOT 2-2, 3-2, etc.)
 *
 * Each tier: { name, cost, desc, apply(tower) }
 *   `apply` mutates the tower's live stats directly, keeping upgrades incremental.
 */
export const TOWER_DEFS = {
  ARCHER: {
    name:            'Archer',
    unlockWave:      1,
    cost:            75,
    damage:          18,
    range:           3.8,
    fireRate:        1.5,
    color:           0xA0522D,
    projectileColor: 0xD2691E,
    projectileSpeed: 9,
    splash: false, splashRadius: 0,
    slow:   false, slowFactor: 1, slowDuration: 0,
    damageType:      'PHYSICAL',
    description: 'Fast, cheap ranged tower',
    paths: [
      {
        name: 'Sharp Arrows',
        tiers: [
          { name: 'Serrated Tips',  cost:  60, desc: '+10 damage, +0.15 attack speed',          apply: t => { t.damage += 10; t.fireRate += 0.15; } },
          { name: 'Rapid Volley',   cost: 100, desc: '+14 damage, +0.25 attack speed',          apply: t => { t.damage += 14; t.fireRate += 0.25; } },
          { name: 'Arrow Storm',    cost: 180, desc: '+22 damage, +0.35 speed, fires 2 arrows', apply: t => { t.damage += 22; t.fireRate += 0.35; t.multiShot = 2; } },
        ],
      },
      {
        name: 'Eagle Eye',
        tiers: [
          { name: 'Long Bow',      cost:  50, desc: '+1.2 range',                              apply: t => { t.range += 1.2; } },
          { name: 'Hawk Sight',    cost:  90, desc: '+1.5 range, 25% crit chance (2× damage)', apply: t => { t.range += 1.5; t.critChance = 0.25; } },
          { name: 'True Sight',    cost: 160, desc: '+2.0 range, 50% crit chance (2.5× damage)',apply: t => { t.range += 2.0; t.critChance = 0.5; t.critMult = 2.5; } },
        ],
      },
    ],
  },

  FROST: {
    name:            'Frost',
    unlockWave:      3,
    cost:            150,
    damage:          12,
    range:           3.2,
    fireRate:        1.0,
    color:           0x00BFFF,
    projectileColor: 0xADD8E6,
    projectileSpeed: 5,
    splash: false, splashRadius: 0,
    slow:   true,  slowFactor: 0.45, slowDuration: 2.5,
    damageType:      'MAGIC',
    description: 'Slows enemies with ice',
    paths: [
      {
        name: 'Deep Freeze',
        tiers: [
          { name: 'Permafrost',    cost:  75, desc: 'Stronger slow, +1s slow duration',               apply: t => { t.slowFactor -= 0.10; t.slowDuration += 1.0; } },
          { name: 'Arctic Wind',   cost: 120, desc: 'Even stronger slow, splash freeze in area',       apply: t => { t.slowFactor -= 0.10; t.slowDuration += 1.5; t.splash = true; t.splashRadius = 1.5; } },
          { name: 'Absolute Zero', cost: 200, desc: 'Maximum slow (85%), +2s duration, bigger splash', apply: t => { t.slowFactor = 0.15;  t.slowDuration += 2.0; t.splashRadius += 1.0; } },
        ],
      },
      {
        name: 'Ice Shards',
        tiers: [
          { name: 'Shard Burst',   cost:  80, desc: '+15 damage, +0.3 attack speed',                    apply: t => { t.damage += 15; t.fireRate += 0.3; } },
          { name: 'Cryo Bolts',    cost: 130, desc: '+25 damage, faster projectiles',                   apply: t => { t.damage += 25; t.fireRate += 0.4; t.projectileSpeed += 3; } },
          { name: 'Glacial Fury',  cost: 220, desc: '+40 damage, +0.6 speed, gains splash damage',      apply: t => { t.damage += 40; t.fireRate += 0.6; t.splash = true; t.splashRadius = (t.splashRadius || 0) + 1.8; } },
        ],
      },
    ],
  },

  WIZARD: {
    name:            'Wizard',
    unlockWave:      5,
    cost:            275,
    damage:          35,
    range:           3.2,
    fireRate:        0.7,
    color:           0x7B2FBE,
    projectileColor: 0xBF00FF,
    projectileSpeed: 6,
    splash: true, splashRadius: 1.8,
    slow:   false, slowFactor: 1, slowDuration: 0,
    damageType:      'MAGIC',
    description: 'Slow but powerful splash magic',
    paths: [
      {
        name: 'Arcane Power',
        tiers: [
          { name: 'Mana Surge',     cost: 110, desc: '+30 damage, bigger splash radius',              apply: t => { t.damage += 30; t.splashRadius += 0.5; } },
          { name: 'Spellweave',     cost: 175, desc: '+50 damage, even bigger splash, +0.15 speed',  apply: t => { t.damage += 50; t.splashRadius += 0.8; t.fireRate += 0.15; } },
          { name: 'Archmage',       cost: 280, desc: '+80 damage, massive splash radius, +0.2 speed', apply: t => { t.damage += 80; t.splashRadius += 1.2; t.fireRate += 0.2; } },
        ],
      },
      {
        name: 'Mystic Reach',
        tiers: [
          { name: 'Far Sight',      cost: 100, desc: '+1.2 range, +0.2 attack speed',                apply: t => { t.range += 1.2; t.fireRate += 0.2; } },
          { name: 'Chain Lightning',cost: 160, desc: '+1.5 range, bolts chain to 3 enemies',         apply: t => { t.range += 1.5; t.chainCount = 3; } },
          { name: 'Storm Caller',   cost: 260, desc: '+2.0 range, chains to 6 enemies, +40 damage',  apply: t => { t.range += 2.0; t.chainCount = 6; t.damage += 40; } },
        ],
      },
    ],
  },

  CANNON: {
    name:            'Cannon',
    unlockWave:      8,
    cost:            1000,
    damage:          70,
    range:           2.8,
    fireRate:        0.45,
    color:           0x2F2F2F,
    projectileColor: 0xFFCC00,
    projectileSpeed: 10,
    splash: true, splashRadius: 2.2,
    slow:   false, slowFactor: 1, slowDuration: 0,
    damageType:      'PHYSICAL',
    description: 'Heavy splash cannon',
    paths: [
      {
        name: 'Heavy Ordnance',
        tiers: [
          { name: 'Iron Shot',      cost: 130, desc: '+55 damage, slightly bigger explosion',          apply: t => { t.damage += 55; t.splashRadius += 0.4; } },
          { name: 'Explosive Shell',cost: 200, desc: '+90 damage, larger explosion radius',           apply: t => { t.damage += 90; t.splashRadius += 0.7; } },
          { name: 'Siege Cannon',   cost: 320, desc: '+150 damage, massive explosion, +0.1 speed',   apply: t => { t.damage += 150; t.splashRadius += 1.2; t.fireRate += 0.1; } },
        ],
      },
      {
        name: 'Rapid Fire',
        tiers: [
          { name: 'Powder Charge',  cost: 120, desc: '+0.2 attack speed, +0.5 range',                apply: t => { t.fireRate += 0.20; t.range += 0.5; } },
          { name: 'Auto Loader',    cost: 190, desc: '+0.35 attack speed, +0.8 range',               apply: t => { t.fireRate += 0.35; t.range += 0.8; } },
          { name: 'Artillery King', cost: 300, desc: '+0.5 speed, +1.5 range, +60 damage',           apply: t => { t.fireRate += 0.50; t.range += 1.5; t.damage += 60; } },
        ],
      },
    ],
  },
};

/**
 * Resistances (0–1):
 *   physResist  — reduces damage from Archer & Cannon
 *   magicResist — reduces damage from Wizard & Frost
 *   slowResist  — reduces slow effectiveness (1 = fully immune)
 */
export const ENEMY_DEFS = {
  // ── Waves 1-10 ────────────────────────────────────────────────────────────
  GOBLIN:     { name: 'Goblin',     hp:   70, speed: 2.8, reward:  12, damage: 1, color: 0x22AA22, size: 0.32,
                physResist: 0,    magicResist: 0,    slowResist: 0 },
  ORC:        { name: 'Orc',        hp:  280, speed: 1.6, reward:  22, damage: 2, color: 0x4A7C2F, size: 0.48,
                physResist: 0,    magicResist: 0,    slowResist: 0 },    // slow and tanky — no resistances, just high HP
  SKELETON:   { name: 'Skeleton',   hp:  130, speed: 1.8, reward:  18, damage: 1, color: 0xDDDDBB, size: 0.38,
                physResist: 0,    magicResist: 0.80, slowResist: 0.80 }, // undead — use Physical towers, can't be slowed
  MINI_BOSS1: { name: 'Mini Boss',  hp:  600, speed: 1.4, reward:  50, damage: 3, color: 0x884400, size: 0.58,
                physResist: 0.50, magicResist: 0.50, slowResist: 0.40 },
  BOSS:       { name: 'Boss',       hp: 2000, speed: 1.2, reward: 100, damage: 5, color: 0xCC0000, size: 0.62,
                physResist: 0.60, magicResist: 0.60, slowResist: 0.50 },
  // ── Waves 11-20 ───────────────────────────────────────────────────────────
  WOLF:       { name: 'Wolf',       hp:  320, speed: 4.2, reward:  25, damage: 2, color: 0x886644, size: 0.40,
                physResist: 0,    magicResist: 0,    slowResist: 0.80 }, // too agile to freeze — burst them down
  MEGA_WOLF:  { name: 'Mega Wolf',  hp:  700, speed: 3.6, reward:  45, damage: 3, color: 0x553322, size: 0.52,
                physResist: 0.80, magicResist: 0,    slowResist: 0.80 }, // dense fur + agile — use Magic, can't slow
  MINI_BOSS2: { name: 'Mini Boss 2',hp: 1800, speed: 1.3, reward: 100, damage: 4, color: 0x220066, size: 0.65,
                physResist: 0.80, magicResist: 0.80, slowResist: 0.60 }, // heavily armoured mage — need all tower types
  BOSS2:      { name: 'Overlord',   hp: 5000, speed: 1.1, reward: 220, damage: 6, color: 0x880000, size: 0.72,
                physResist: 0.80, magicResist: 0.80, slowResist: 0.80 }, // ancient warlord — ultimate resistance
};

export const WAVES = [
  // W1 – Goblins only, gentle opener
  [{ type: 'GOBLIN',    count:  6, interval: 0.6 }],
  // W2 – More goblins
  [{ type: 'GOBLIN',    count:  9, interval: 0.55 }],
  // W3 – Orcs introduced  (Frost unlocks)
  [{ type: 'GOBLIN',    count:  7, interval: 0.5 }, { type: 'ORC',        count:  3, interval: 1.3 }],
  // W4 – Goblins + more Orcs
  [{ type: 'GOBLIN',    count:  9, interval: 0.5 }, { type: 'ORC',        count:  4, interval: 1.1 }],
  // W5 – Skeletons + Mini-Boss 1 debut  (Wizard unlocks)
  [{ type: 'GOBLIN',    count:  6, interval: 0.5 }, { type: 'SKELETON',   count:  5, interval: 0.7 }, { type: 'MINI_BOSS1', count: 1, interval: 0 }],
  // W6 – Skeletons + Orcs, noticeably denser than W5
  [{ type: 'ORC',       count:  8, interval: 0.85 }, { type: 'SKELETON',  count: 12, interval: 0.5 }],
  // W7 – Full early trio, heavy volume
  [{ type: 'GOBLIN',    count: 18, interval: 0.42 }, { type: 'SKELETON',  count: 10, interval: 0.5 }, { type: 'ORC',       count:  6, interval: 0.85 }],
  // W8 – Tight skeleton+orc wall, two Mini-Bosses  (Cannon unlocks)
  [{ type: 'SKELETON',  count: 14, interval: 0.45 }, { type: 'ORC',       count:  9, interval: 0.8 }, { type: 'MINI_BOSS1', count: 2, interval: 5.0 }],
  // W9 – Dense full mix + two Mini-Bosses
  [{ type: 'GOBLIN',    count: 14, interval: 0.38 }, { type: 'SKELETON',  count: 12, interval: 0.45 }, { type: 'ORC',       count:  8, interval: 0.8 }, { type: 'MINI_BOSS1', count: 2, interval: 5.0 }],
  // W10 – BOSS first appearance! Backed by a solid pack
  [{ type: 'GOBLIN',    count: 12, interval: 0.38 }, { type: 'ORC',       count:  8, interval: 0.75 }, { type: 'BOSS',      count:  1, interval: 0 }],
  // W11 – Wolves debut, 3 Bosses return
  [{ type: 'WOLF',      count: 14, interval: 0.38 }, { type: 'GOBLIN',    count: 12, interval: 0.45 }, { type: 'BOSS', count: 3, interval: 2.5 }],
  // W12 – Wolves + Skeletons + Orcs + 4 Bosses
  [{ type: 'WOLF',      count: 15, interval: 0.35 }, { type: 'SKELETON',  count: 12, interval: 0.45 }, { type: 'ORC', count: 7, interval: 0.8 }, { type: 'BOSS', count: 4, interval: 2.5 }],
  // W13 – Mega-Wolf debut + 5 Bosses
  [{ type: 'WOLF',      count: 15, interval: 0.35 }, { type: 'MEGA_WOLF', count:  6, interval: 0.85 }, { type: 'SKELETON', count: 12, interval: 0.45 }, { type: 'BOSS', count: 5, interval: 2.5 }],
  // W14 – Mini-Boss 2 debut + 5 Bosses
  [{ type: 'WOLF',      count: 12, interval: 0.34 }, { type: 'MEGA_WOLF', count:  9, interval: 0.8 }, { type: 'ORC', count: 8, interval: 0.7 }, { type: 'BOSS', count: 5, interval: 2.5 }, { type: 'MINI_BOSS2', count: 1, interval: 0 }],
  // W15 – 6 Bosses + heavy wolf pack
  [{ type: 'WOLF',      count: 15, interval: 0.33 }, { type: 'MEGA_WOLF', count:  7, interval: 0.75 }, { type: 'BOSS', count: 6, interval: 2.0 }],
  // W16 – Dense wolves + 6 Bosses
  [{ type: 'WOLF',      count: 20, interval: 0.3 }, { type: 'MEGA_WOLF',  count: 12, interval: 0.7 }, { type: 'ORC', count: 10, interval: 0.65 }, { type: 'BOSS', count: 6, interval: 2.0 }],
  // W17 – Mini-Boss 2 × 2 + 7 Bosses + thick wolf swarm
  [{ type: 'WOLF',      count: 16, interval: 0.3 }, { type: 'MEGA_WOLF',  count: 12, interval: 0.65 }, { type: 'SKELETON', count: 14, interval: 0.38 }, { type: 'BOSS', count: 7, interval: 2.0 }, { type: 'MINI_BOSS2', count: 2, interval: 3.0 }],
  // W18 – Maximum pressure + 8 Bosses
  [{ type: 'WOLF',      count: 20, interval: 0.28 }, { type: 'MEGA_WOLF', count: 14, interval: 0.6 }, { type: 'ORC', count: 12, interval: 0.55 }, { type: 'BOSS', count: 8, interval: 2.0 }, { type: 'MINI_BOSS2', count: 3, interval: 3.0 }],
  // W19 – 9 Bosses + three Mini-Boss 2 + heavies
  [{ type: 'MEGA_WOLF', count: 14, interval: 0.55 }, { type: 'SKELETON',  count: 18, interval: 0.35 }, { type: 'BOSS', count: 9, interval: 2.0 }, { type: 'MINI_BOSS2', count: 3, interval: 3.0 }],
  // W20 – BOSS2 first (and only) appearance + 10 Bosses. Final wave!
  [{ type: 'WOLF',      count: 18, interval: 0.28 }, { type: 'MEGA_WOLF', count: 14, interval: 0.55 }, { type: 'BOSS', count: 10, interval: 2.0 }, { type: 'MINI_BOSS2', count: 3, interval: 3.0 }, { type: 'BOSS2', count: 1, interval: 0 }],
];

export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;
export const WAVE_BONUS = 25;
