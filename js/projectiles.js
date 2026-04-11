let _idCounter = 0;

export class Projectile {
  constructor({ x, z, target, speed, damage, color, splash, splashRadius, slow, slowFactor, slowDuration, damageType }) {
    this.id           = ++_idCounter;
    this.x            = x;
    this.y            = 0.4;
    this.z            = z;
    this.target       = target;
    this.speed        = speed;
    this.damage       = damage;
    this.color        = color;
    this.splash       = splash        || false;
    this.splashRadius = splashRadius  || 0;
    this.slow         = slow          || false;
    this.slowFactor   = slowFactor    || 1;
    this.slowDuration = slowDuration  || 0;
    this.damageType   = damageType    || 'PHYSICAL';
    this.alive        = true;
    this.hitPos       = null; // set when it explodes (for VFX)
  }

  update(dt, allEnemies) {
    if (!this.alive) return [];

    // Chase target; if dead, expire silently
    if (!this.target.alive) { this.alive = false; return []; }

    const dx   = this.target.x - this.x;
    const dz   = this.target.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = this.speed * dt;

    if (step >= dist) {
      this.x = this.target.x;
      this.z = this.target.z;
      this.alive  = false;
      this.hitPos = { x: this.x, z: this.z };
      return this._applyDamage(allEnemies);
    }

    this.x += (dx / dist) * step;
    this.z += (dz / dist) * step;
    return [];
  }

  _resistedDamage(enemy) {
    const resist = this.damageType === 'MAGIC' ? (enemy.magicResist ?? 0) : (enemy.physResist ?? 0);
    return Math.max(1, Math.round(this.damage * (1 - resist)));
  }

  _applyDamage(allEnemies) {
    const hit = [];
    if (this.splash) {
      for (const e of allEnemies) {
        if (!e.alive) continue;
        const dx = e.x - this.x;
        const dz = e.z - this.z;
        if (Math.sqrt(dx * dx + dz * dz) <= this.splashRadius) {
          e.takeDamage(this._resistedDamage(e));
          if (this.slow) e.applySlow(this.slowFactor, this.slowDuration);
          hit.push(e);
        }
      }
    } else {
      this.target.takeDamage(this._resistedDamage(this.target));
      if (this.slow) this.target.applySlow(this.slowFactor, this.slowDuration);
      hit.push(this.target);
    }
    return hit;
  }
}
