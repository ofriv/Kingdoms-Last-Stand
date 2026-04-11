import { ENEMY_DEFS } from './constants.js';
import { getPathWorldPositions } from './map.js';

let _idCounter = 0;

export class Enemy {
  constructor(type) {
    this.id = ++_idCounter;
    this.type = type;

    const def = ENEMY_DEFS[type];
    this.name        = def.name;
    this.maxHp       = def.hp;
    this.hp          = def.hp;
    this.baseSpeed   = def.speed;
    this.speed       = def.speed;
    this.reward      = def.reward;
    this.damage      = def.damage;
    this.color       = def.color;
    this.size        = def.size;

    // Resistances
    this.physResist  = def.physResist  ?? 0;
    this.magicResist = def.magicResist ?? 0;
    this.slowResist  = def.slowResist  ?? 0;

    // Path state
    const path = getPathWorldPositions();
    this.waypointIndex    = 0;
    this.x                = path[0].x;
    this.z                = path[0].z;
    this.y                = 0;
    this.distanceTraveled = 0;

    // Effect state
    this.slowTimer  = 0;
    this.slowFactor = 1;

    // Lifecycle flags
    this.alive      = true;
    this.reachedEnd = false;
  }

  applySlow(factor, duration) {
    // slowResist blends the factor toward 1 (no slow) and reduces duration
    const effectiveFactor   = factor + (1 - factor) * this.slowResist;
    const effectiveDuration = duration * (1 - this.slowResist * 0.6);
    if (effectiveFactor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = effectiveFactor;
      this.slowTimer  = effectiveDuration;
    }
  }

  update(dt) {
    if (!this.alive || this.reachedEnd) return;

    // Tick slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) { this.slowTimer = 0; this.slowFactor = 1; }
    }
    this.speed = this.baseSpeed * this.slowFactor;

    const path = getPathWorldPositions();
    if (this.waypointIndex >= path.length - 1) { this.reachedEnd = true; return; }

    const target = path[this.waypointIndex + 1];
    const dx   = target.x - this.x;
    const dz   = target.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = this.speed * dt;

    if (step >= dist) {
      this.x = target.x;
      this.z = target.z;
      this.distanceTraveled += dist;
      this.waypointIndex++;
      if (this.waypointIndex >= path.length - 1) this.reachedEnd = true;
    } else {
      this.x += (dx / dist) * step;
      this.z += (dz / dist) * step;
      this.distanceTraveled += step;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }
}
