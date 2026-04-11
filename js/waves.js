import { WAVES } from './constants.js';
import { Enemy } from './enemies.js';

export class WaveManager {
  constructor() {
    this.waveIndex  = -1;
    this.active     = false;
    this.allSpawned = false;
    this._queue     = [];
    this._timer     = 0;
  }

  get currentWave()  { return this.waveIndex + 1; }
  get totalWaves()   { return WAVES.length; }
  get isLastWave()   { return this.waveIndex >= WAVES.length - 1; }

  startNextWave() {
    if (this.active || this.isLastWave && this.waveIndex >= 0) return false;
    this.waveIndex++;
    if (this.waveIndex >= WAVES.length) return false;

    this.active     = true;
    this.allSpawned = false;
    this._timer     = 0;

    // Build a flat sorted spawn queue: [{ type, time }]
    this._queue = [];
    let t = 0;
    for (const group of WAVES[this.waveIndex]) {
      for (let i = 0; i < group.count; i++) {
        this._queue.push({ type: group.type, time: t });
        t += group.interval;
      }
    }
    this._queue.sort((a, b) => a.time - b.time);
    return true;
  }

  /** Speed multiplier: +15% every 5 waves (W1-5=1.0×, W6-10=1.15×, W11-15=1.30×, W16-20=1.45×). */
  get speedMultiplier() {
    return 1 + Math.floor(this.waveIndex / 5) * 0.15;
  }

  /** Returns array of newly spawned Enemy instances. */
  update(dt) {
    if (!this.active || this.allSpawned) return [];
    this._timer += dt;
    const spawned = [];
    while (this._queue.length > 0 && this._queue[0].time <= this._timer) {
      const enemy = new Enemy(this._queue.shift().type);
      enemy.baseSpeed *= this.speedMultiplier;
      enemy.speed      = enemy.baseSpeed;
      spawned.push(enemy);
    }
    if (this._queue.length === 0) this.allSpawned = true;
    return spawned;
  }

  /** Returns true once the wave is fully spawned and all enemies gone. */
  checkWaveComplete(enemies) {
    if (!this.active || !this.allSpawned) return false;
    const alive = enemies.filter(e => e.alive && !e.reachedEnd);
    if (alive.length === 0) { this.active = false; return true; }
    return false;
  }
}
