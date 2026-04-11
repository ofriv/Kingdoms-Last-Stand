import { TOWER_DEFS, STARTING_GOLD, STARTING_LIVES, WAVE_BONUS, CELL_SIZE } from './constants.js';
import { isPathCell, isValidCell } from './map.js';
import { Tower } from './towers.js';
import { Projectile } from './projectiles.js';
import { WaveManager } from './waves.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.ui       = new UI(
      type  => this._selectTowerType(type),
      ()    => this._startWave(),
      p     => this._upgradeSelected(p),
      ()    => this._sellSelected(),
      ()    => this._endGame(),
      ()    => { this._paused = false; },
    );

    this.gold  = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.score = 0;

    this.towers      = [];
    this.enemies     = [];
    this.projectiles = [];
    this.towerMap    = new Map(); // `${col},${row}` -> Tower

    this.waveManager       = new WaveManager();
    this.highestWave       = 0;  // tracks unlocks (1-based: 1 = after wave 1 starts)
    this.selectedTowerType = null;
    this.selectedTower     = null;

    this._lastTime    = null;
    this._running     = false;
    this._paused      = false;
    this._speedMult   = 1;

    this._dragType  = null;
    this._dragGhost = null;

    this._bindInput(canvas);
    this._bindSpeedBtn();
    this._bindDrag(canvas);
    this._tick = this._tick.bind(this);
  }

  start() {
    this._running = true;
    this.ui.hideOverlay();
    this.ui.refreshUnlocks(0); // initial state: only wave-1 towers unlocked
    requestAnimationFrame(this._tick);
  }

  // ─── Main loop ────────────────────────────────────────────────────────────

  _tick(now) {
    if (!this._running) return;
    if (this._paused) { this._lastTime = now; requestAnimationFrame(this._tick); return; }
    if (this._lastTime === null) this._lastTime = now;
    const dt = Math.min((now - this._lastTime) / 1000, 0.1) * this._speedMult;
    this._lastTime = now;
    this._update(dt);
    this.renderer.render();
    requestAnimationFrame(this._tick);
  }

  _update(dt) {
    // Spawn
    if (this.waveManager.active) {
      for (const e of this.waveManager.update(dt)) {
        this.enemies.push(e);
        this.renderer.addEnemy(e);
      }
    }

    // Move enemies
    for (const e of this.enemies) {
      if (!e.alive || e.reachedEnd) continue;
      e.update(dt);
      this.renderer.updateEnemy(e);
    }

    // Castle damage
    let gameOverTriggered = false;
    for (const e of this.enemies) {
      if (e.reachedEnd && e.alive) {
        e.alive = false;
        this.lives = Math.max(0, this.lives - e.damage);
        this.renderer.removeEnemy(e.id);
        if (this.lives <= 0) gameOverTriggered = true;
      }
    }
    if (gameOverTriggered) { this._gameOver(); return; }

    // Kill rewards
    for (const e of this.enemies) {
      if (!e.alive && !e.reachedEnd) {
        this.renderer.removeEnemy(e.id);
        this.gold  += e.reward;
        this.score += e.reward;
      }
    }
    this.enemies = this.enemies.filter(e => e.alive && !e.reachedEnd);

    // Towers shoot
    for (const tower of this.towers) {
      const shot = tower.update(dt, this.enemies);
      if (!shot) continue;

      // Archer multi-shot: fire tower.multiShot projectiles spread across nearby targets
      const targets = this._getMultiTargets(tower, shot.target);
      for (const tgt of targets) {
        const proj = new Projectile({
          x: tower.x, z: tower.z,
          target:       tgt,
          speed:        tower.projectileSpeed,
          damage:       this._calcDamage(tower),
          color:        tower.projectileColor,
          splash:       tower.splash,
          splashRadius: tower.splashRadius,
          slow:         tower.slow,
          slowFactor:   tower.slowFactor,
          slowDuration: tower.slowDuration,
          damageType:   tower.damageType,
        });
        this.projectiles.push(proj);
        this.renderer.addProjectile(proj);
      }
    }

    // Update projectiles
    const dead = [];
    for (const p of this.projectiles) {
      p.update(dt, this.enemies);
      if (!p.alive) {
        dead.push(p);
        if (p.splash && p.hitPos) {
          this.renderer.showSplash(p.hitPos.x, p.hitPos.z, p.splashRadius, p.color);
        }
      } else {
        this.renderer.updateProjectile(p);
      }
    }
    for (const p of dead) this.renderer.removeProjectile(p.id);
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Wave complete?
    if (this.waveManager.checkWaveComplete(this.enemies)) {
      this.gold += WAVE_BONUS;
      this.highestWave = Math.max(this.highestWave, this.waveManager.currentWave);
      this.ui.refreshUnlocks(this.highestWave);
      this.ui.showMessage(`Wave ${this.waveManager.currentWave} complete! +${WAVE_BONUS}g`);
      if (this.waveManager.isLastWave) { this._victory(); return; }
    }

    // UI sync
    this.ui.update(
      this.gold, this.lives,
      this.waveManager.currentWave, this.waveManager.totalWaves,
      this.score, this.waveManager.active
    );
    this.ui.updateAffordability(this.gold);
    if (this.selectedTower) {
      this.ui.showTowerInfo(this.selectedTower, this.gold);
    }
  }

  // ─── Combat helpers ───────────────────────────────────────────────────────

  _calcDamage(tower) {
    let dmg = tower.damage;
    if (tower.critChance > 0 && Math.random() < tower.critChance) {
      dmg = Math.round(dmg * (tower.critMult || 2));
    }
    return dmg;
  }

  /** Returns array of targets for this shot (handles multiShot). */
  _getMultiTargets(tower, primaryTarget) {
    const count = tower.multiShot || 1;
    if (count <= 1) return [primaryTarget];

    const r2 = (tower.range * 1.5) ** 2; // slightly wider for multi-shot
    const inRange = this.enemies.filter(e => {
      if (!e.alive || e.reachedEnd) return false;
      const dx = e.x - tower.x, dz = e.z - tower.z;
      return dx*dx + dz*dz <= r2;
    });
    // Sort by distance travelled (farthest first)
    inRange.sort((a, b) => b.distanceTraveled - a.distanceTraveled);
    const targets = [primaryTarget];
    for (const e of inRange) {
      if (targets.length >= count) break;
      if (e.id !== primaryTarget.id) targets.push(e);
    }
    return targets;
  }

  // ─── Wave management ──────────────────────────────────────────────────────

  _startWave() {
    if (this.waveManager.active) return;
    if (!this.waveManager.startNextWave()) return;
    // Update highestWave when wave starts (so towers unlock at wave start)
    this.highestWave = Math.max(this.highestWave, this.waveManager.currentWave);
    this.ui.refreshUnlocks(this.highestWave);
    this.ui.showMessage(`Wave ${this.waveManager.currentWave} begins!`);
  }

  // ─── Tower placement / selection ──────────────────────────────────────────

  _selectTowerType(type) {
    this.selectedTowerType = type;
    this._deselectTower();
    if (type) this.renderer.hideRange();
  }

  _deselectTower() {
    this.selectedTower = null;
    this.ui.hideTowerInfo();
    this.renderer.hideRange();
  }

  _clickCell(col, row) {
    const existing = this.towerMap.get(`${col},${row}`);
    if (existing) {
      // Select tower
      this.selectedTowerType = null;
      document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
      this.selectedTower = existing;
      this.ui.showTowerInfo(existing, this.gold);
      this.renderer.showRange(existing.x, existing.z, existing.range);
    } else if (this.selectedTowerType) {
      this._placeTower(col, row);
    } else {
      this._deselectTower();
    }
  }

  _placeTower(col, row) {
    if (!isValidCell(col, row) || isPathCell(col, row)) return;
    if (this.towerMap.has(`${col},${row}`))             return;

    const def = TOWER_DEFS[this.selectedTowerType];
    if (this.gold < def.cost) { this.ui.showMessage('Not enough gold!'); return; }

    this.gold -= def.cost;
    const tower = new Tower(this.selectedTowerType, col, row);
    this.towers.push(tower);
    this.towerMap.set(`${col},${row}`, tower);
    this.renderer.addTower(tower);
    this.renderer.hideHover();
  }

  _upgradeSelected(pathIndex) {
    if (!this.selectedTower) return;
    const t    = this.selectedTower;
    const cost = t.getUpgradeCost(pathIndex);
    if (cost === null) { this.ui.showMessage('Cannot upgrade this path!'); return; }
    if (this.gold < cost) { this.ui.showMessage('Not enough gold!'); return; }

    this.gold -= cost;
    t.upgrade(pathIndex);
    this.renderer.refreshTower(t);
    this.renderer.showRange(t.x, t.z, t.range);
    this.ui.showTowerInfo(t, this.gold);
  }

  _sellSelected() {
    if (!this.selectedTower) return;
    const t = this.selectedTower;
    this.gold += t.getSellValue();
    this.towers = this.towers.filter(tw => tw.id !== t.id);
    this.towerMap.delete(`${t.col},${t.row}`);
    this.renderer.removeTower(t.id);
    this._deselectTower();
    this.ui.showMessage(`Sold for ${t.getSellValue()}g`);
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  _bindSpeedBtn() {
    const btn = document.getElementById('speed-btn');
    btn.addEventListener('click', () => {
      this._speedMult = this._speedMult === 1 ? 2 : 1;
      btn.classList.toggle('active', this._speedMult === 2);
      btn.textContent = this._speedMult === 2 ? '▶ 1×' : '▶▶ 2×';
    });
  }

  // ─── Drag-to-place ────────────────────────────────────────────────────────

  _bindDrag(canvas) {
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        if (btn.classList.contains('locked')) return;
        e.preventDefault();
        this._startDrag(btn.dataset.type, e);
      });
    });
  }

  _startDrag(type, e) {
    this._dragType = type;

    // Deselect any existing selection
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    this._deselectTower();

    // Build the floating ghost element
    const def   = TOWER_DEFS[type];
    const btn   = document.querySelector(`.tower-btn[data-type="${type}"]`);
    const icon  = btn.querySelector('.btn-icon').textContent;

    this._dragGhost = document.createElement('div');
    this._dragGhost.className = 'drag-ghost';
    this._dragGhost.innerHTML = `<span class="drag-ghost-icon">${icon}</span><span>${def.name}</span>`;
    document.body.appendChild(this._dragGhost);
    document.body.classList.add('dragging');
    this._moveDragGhost(e.clientX, e.clientY);

    this._onDragMove = ev => this._handleDragMove(ev);
    this._onDragEnd  = ev => this._handleDragEnd(ev);
    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup',   this._onDragEnd);
  }

  _handleDragMove(e) {
    this._moveDragGhost(e.clientX, e.clientY);

    const cell = this.renderer.pickCell(e.clientX, e.clientY);
    if (cell && !isPathCell(cell.col, cell.row) && !this.towerMap.has(`${cell.col},${cell.row}`)) {
      this.renderer.showHover(cell.col, cell.row);
      const def = TOWER_DEFS[this._dragType];
      this.renderer.showRange(cell.col * CELL_SIZE, cell.row * CELL_SIZE, def.range);
      this._dragGhost.classList.toggle('drag-ghost-invalid', false);
    } else {
      this.renderer.hideHover();
      this.renderer.hideRange();
      this._dragGhost.classList.toggle('drag-ghost-invalid', !!cell); // red only over invalid cells
    }
  }

  _handleDragEnd(e) {
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup',   this._onDragEnd);

    if (this._dragGhost) { this._dragGhost.remove(); this._dragGhost = null; }
    document.body.classList.remove('dragging');
    this.renderer.hideHover();
    this.renderer.hideRange();

    const cell = this.renderer.pickCell(e.clientX, e.clientY);
    if (cell) {
      this.selectedTowerType = this._dragType;
      this._placeTower(cell.col, cell.row);
    }
    this._dragType = null;
  }

  _moveDragGhost(x, y) {
    if (!this._dragGhost) return;
    this._dragGhost.style.left = `${x + 14}px`;
    this._dragGhost.style.top  = `${y - 28}px`;
  }

  _bindInput(canvas) {
    canvas.addEventListener('click', e => {
      const cell = this.renderer.pickCell(e.clientX, e.clientY);
      if (cell) this._clickCell(cell.col, cell.row);
    });

    canvas.addEventListener('mousemove', e => {
      const cell = this.renderer.pickCell(e.clientX, e.clientY);
      if (!cell) { this.renderer.hideHover(); return; }
      const { col, row } = cell;
      if (this.selectedTowerType && !isPathCell(col, row) && !this.towerMap.has(`${col},${row}`)) {
        this.renderer.showHover(col, row);
      } else {
        this.renderer.hideHover();
      }
    });

    canvas.addEventListener('mouseleave', () => this.renderer.hideHover());
  }

  // ─── End states ───────────────────────────────────────────────────────────

  _endGame() {
    if (!this._running || this._paused) return;
    this._paused = true;
    this.ui.showConfirm();
  }

  _gameOver() {
    this._running = false;
    this.ui.showOverlay(
      '☠ Defeat ☠',
      `Your kingdom fell on wave ${this.waveManager.currentWave}. Score: ${this.score}`,
      'Try Again', () => location.reload()
    );
  }

  _victory() {
    this._running = false;
    this.ui.showOverlay(
      '👑 Victory! 👑',
      `All waves defeated! Final score: ${this.score}`,
      'Play Again', () => location.reload()
    );
  }
}
