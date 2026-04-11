import { TOWER_DEFS, CELL_SIZE } from './constants.js';
import { gridToWorld } from './map.js';

let _idCounter = 0;

export class Tower {
  constructor(type, col, row) {
    this.id   = ++_idCounter;
    this.type = type;
    this.col  = col;
    this.row  = row;

    const pos = gridToWorld(col, row);
    this.x = pos.x;
    this.z = pos.z;

    const def = TOWER_DEFS[type];
    this.name             = def.name;
    this.color            = def.color;
    this.projectileColor  = def.projectileColor;
    this.projectileSpeed  = def.projectileSpeed;
    this.splash           = def.splash;
    this.splashRadius     = def.splashRadius;
    this.slow             = def.slow;
    this.slowFactor       = def.slowFactor;
    this.slowDuration     = def.slowDuration;
    this.damageType       = def.damageType || 'PHYSICAL';
    this.totalSpent       = def.cost;

    // Live stats (mutated by upgrades)
    this.damage   = def.damage;
    this.range    = def.range;
    this.fireRate = def.fireRate;

    // Optional special stats (set by upgrade apply fns)
    this.multiShot   = 1;     // Archer tier-3 path 0
    this.critChance  = 0;     // Archer path 1
    this.critMult    = 2.0;   // Archer path 1
    this.chainCount  = 0;     // Wizard path 1

    /**
     * pathLevels[0] = tiers purchased in path 0
     * pathLevels[1] = tiers purchased in path 1
     *
     * Cross-path rule: you may not have BOTH paths at tier ≥ 2.
     * Valid end-states: 3-0, 0-3, 3-1, 1-3, 2-1, 1-2, 2-0, 0-2, 1-0, 0-1, 0-0
     */
    this.pathLevels = [0, 0];

    this.cooldown = 0;
    this.target   = null;
  }

  getSellValue() { return Math.floor(this.totalSpent * 0.6); }

  // ─── Upgrade helpers ──────────────────────────────────────────────────────

  /** True if path `p` can accept another tier. */
  canUpgradePath(p) {
    const def = TOWER_DEFS[this.type];
    const other = 1 - p;
    if (this.pathLevels[p] >= def.paths[p].tiers.length) return false;  // already maxed
    // Cross-path rule: if the OTHER path is already at tier ≥ 2,
    // this path is locked at tier 1 (may not go to tier 2+).
    if (this.pathLevels[other] >= 2 && this.pathLevels[p] >= 1) return false;
    return true;
  }

  getUpgradeCost(p) {
    if (!this.canUpgradePath(p)) return null;
    return TOWER_DEFS[this.type].paths[p].tiers[this.pathLevels[p]].cost;
  }

  getUpgradeName(p) {
    const def = TOWER_DEFS[this.type];
    const tier = this.pathLevels[p];
    if (tier >= def.paths[p].tiers.length) return 'MAXED';
    return def.paths[p].tiers[tier].name;
  }

  getPathName(p) { return TOWER_DEFS[this.type].paths[p].name; }

  /** Purchase next tier on path `p`. Returns true on success. */
  upgrade(p) {
    if (!this.canUpgradePath(p)) return false;
    const tier = TOWER_DEFS[this.type].paths[p].tiers[this.pathLevels[p]];
    this.totalSpent += tier.cost;
    tier.apply(this);
    this.pathLevels[p]++;
    return true;
  }

  // ─── Combat ───────────────────────────────────────────────────────────────

  /** Returns { tower, target } shoot event or null. */
  update(dt, enemies) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.cooldown > 0) return null;

    const r2 = (this.range * CELL_SIZE) ** 2;
    let best = null;
    for (const e of enemies) {
      if (!e.alive || e.reachedEnd) continue;
      const dx = e.x - this.x, dz = e.z - this.z;
      if (dx*dx + dz*dz <= r2) {
        if (!best || e.distanceTraveled > best.distanceTraveled) best = e;
      }
    }

    this.target = best;
    if (best) {
      this.cooldown = 1.0 / this.fireRate;
      return { tower: this, target: best };
    }
    return null;
  }
}
