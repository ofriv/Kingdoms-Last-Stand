import { TOWER_DEFS } from './constants.js';

export class UI {
  constructor(onSelectTower, onStartWave, onUpgrade, onSell, onEndGame, onCancelEndGame) {
    this.onSelectTower   = onSelectTower;
    this.onStartWave     = onStartWave;
    this.onUpgrade       = onUpgrade; // (pathIndex) => void
    this.onSell          = onSell;
    this.onEndGame       = onEndGame;
    this.onCancelEndGame = onCancelEndGame;

    this.$gold      = document.getElementById('gold');
    this.$lives     = document.getElementById('lives');
    this.$wave      = document.getElementById('wave');
    this.$score     = document.getElementById('score');
    this.$startBtn  = document.getElementById('start-wave-btn');
    this.$infoPanel = document.getElementById('tower-info');
    this.$overlay        = document.getElementById('overlay');
    this.$overlayTitle   = document.getElementById('overlay-title');
    this.$overlayMsg     = document.getElementById('overlay-msg');
    this.$overlayBtn     = document.getElementById('overlay-btn');

    // Tower buttons
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.onSelectTower(btn.dataset.type);
      });
    });

    this.$startBtn.addEventListener('click', () => this.onStartWave());
    document.getElementById('sell-btn').addEventListener('click', () => this.onSell());
    document.getElementById('end-game-btn').addEventListener('click', () => this.onEndGame());

    this.$confirmOverlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-yes').addEventListener('click', () => location.reload());
    document.getElementById('confirm-no').addEventListener('click', () => {
      this.hideConfirm();
      if (this.onCancelEndGame) this.onCancelEndGame();
    });

    // Path upgrade buttons
    document.getElementById('upgrade-path0').addEventListener('click', () => this.onUpgrade(0));
    document.getElementById('upgrade-path1').addEventListener('click', () => this.onUpgrade(1));

    this._tooltip = document.getElementById('upgrade-tooltip');
    this._bindTooltip('upgrade-path0');
    this._bindTooltip('upgrade-path1');

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        this.onSelectTower(null);
        this.hideTowerInfo();
      }
    });
  }

  // ─── Stats bar ────────────────────────────────────────────────────────────

  update(gold, lives, wave, totalWaves, score, waveActive) {
    this.$gold.textContent  = gold;
    this.$lives.textContent = lives;
    this.$wave.textContent  = `${wave} / ${totalWaves}`;
    this.$score.textContent = score;

    const allDone = wave >= totalWaves && !waveActive;
    this.$startBtn.disabled    = waveActive || allDone;
    this.$startBtn.textContent = waveActive ? 'Wave in progress…'
      : allDone ? 'All Waves Done' : 'Start Wave';
  }

  // ─── Tower unlock state ───────────────────────────────────────────────────

  /** Called each time a wave completes. `highestWave` is 1-based. */
  refreshUnlocks(highestWave) {
    document.querySelectorAll('.tower-btn').forEach(btn => {
      const type = btn.dataset.type;
      const def  = TOWER_DEFS[type];
      const unlocked = highestWave >= def.unlockWave || def.unlockWave === 1;

      btn.classList.toggle('locked', !unlocked);

      // Update or restore the lock badge
      let badge = btn.querySelector('.lock-badge');
      if (!unlocked) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'lock-badge';
          btn.appendChild(badge);
        }
        badge.textContent = `🔒 Wave ${def.unlockWave}`;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // ─── Tower info panel ─────────────────────────────────────────────────────

  showTowerInfo(tower, gold) {
    this.$infoPanel.style.display = 'block';
    document.getElementById('info-name').textContent  = tower.name;
    document.getElementById('info-dmg').textContent   = tower.damage;
    document.getElementById('info-range').textContent = tower.range.toFixed(1);
    document.getElementById('info-rate').textContent  = tower.fireRate.toFixed(2);
    document.getElementById('info-sell').textContent  = tower.getSellValue();
    document.getElementById('sell-btn').textContent   = `Sell (${tower.getSellValue()}g)`;

    const def = TOWER_DEFS[tower.type];

    for (const p of [0, 1]) {
      const btn       = document.getElementById(`upgrade-path${p}`);
      const nameEl    = document.getElementById(`path${p}-name`);
      const tiersEl   = document.getElementById(`path${p}-tiers`);
      const lvls      = tower.pathLevels;

      // Path name
      nameEl.textContent = def.paths[p].name;

      // Tier pips
      tiersEl.innerHTML = '';
      for (let t = 0; t < def.paths[p].tiers.length; t++) {
        const pip = document.createElement('span');
        pip.className = 'tier-pip' + (t < lvls[p] ? ' filled' : '');
        tiersEl.appendChild(pip);
      }

      // Button label
      const canUpgrade = tower.canUpgradePath(p);
      const cost       = tower.getUpgradeCost(p);
      const nextName   = tower.getUpgradeName(p);

      if (lvls[p] >= def.paths[p].tiers.length) {
        btn.textContent          = '✓ MAXED';
        btn.disabled             = true;
        btn.dataset.tooltip      = '';
        btn.dataset.tooltipName  = '';
      } else if (!canUpgrade) {
        btn.textContent          = '🔒 Locked';
        btn.disabled             = true;
        btn.dataset.tooltip      = 'Upgrade the other path to tier 1 first';
        btn.dataset.tooltipName  = 'Locked';
      } else {
        const tierDef            = def.paths[p].tiers[lvls[p]];
        btn.textContent          = `${nextName} (${cost}g)`;
        btn.disabled             = gold < cost;
        btn.dataset.tooltipName  = nextName;
        btn.dataset.tooltip      = tierDef.desc || '';
      }
    }
  }

  hideTowerInfo() {
    this.$infoPanel.style.display = 'none';
    this._tooltip.style.display = 'none';
  }

  _bindTooltip(btnId) {
    const btn = document.getElementById(btnId);
    btn.addEventListener('mouseenter', e => {
      const text = btn.dataset.tooltip;
      if (!text) return;
      this._tooltip.innerHTML = `<div class="tooltip-name">${btn.dataset.tooltipName}</div>${text}`;
      this._tooltip.style.display = 'block';
      this._positionTooltip(e);
    });
    btn.addEventListener('mousemove', e => this._positionTooltip(e));
    btn.addEventListener('mouseleave', () => { this._tooltip.style.display = 'none'; });
  }

  _positionTooltip(e) {
    const pad = 12;
    const tw  = this._tooltip.offsetWidth;
    let x = e.clientX - tw - pad;
    if (x < 4) x = e.clientX + pad;
    this._tooltip.style.left = `${x}px`;
    this._tooltip.style.top  = `${e.clientY - 10}px`;
  }

  // ─── Tower button affordability ───────────────────────────────────────────

  updateAffordability(gold) {
    document.querySelectorAll('.tower-btn:not(.locked)').forEach(btn => {
      const cost = TOWER_DEFS[btn.dataset.type].cost;
      btn.classList.toggle('unaffordable', gold < cost);
    });
  }

  // ─── Confirm dialog ───────────────────────────────────────────────────────

  showConfirm() { this.$confirmOverlay.style.display = 'flex'; }
  hideConfirm() { this.$confirmOverlay.style.display = 'none'; }

  // ─── Overlay ──────────────────────────────────────────────────────────────

  showOverlay(title, msg, btnText, onBtnClick) {
    this.$overlayTitle.textContent = title;
    this.$overlayMsg.textContent   = msg;
    this.$overlayBtn.textContent   = btnText;
    this.$overlayBtn.onclick       = onBtnClick;
    this.$overlay.style.display    = 'flex';
  }

  hideOverlay() { this.$overlay.style.display = 'none'; }

  showMessage(text, duration = 2500) {
    const el = document.getElementById('message');
    el.textContent   = text;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, duration);
  }
}
