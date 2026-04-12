import * as THREE from 'three';
import { GRID_COLS, GRID_ROWS, CELL_SIZE, CASTLE, ENTRANCE } from './constants.js';
import { PATH_CELLS, gridToWorld } from './map.js';

const CS = CELL_SIZE;

/**
 * Tower sprites keyed by [type][upgradeLevel].
 * upgradeLevel = pathLevels[0] + pathLevels[1] (0–6).
 *
 * To add an upgraded sprite, drop the image in assets/sprites/towers/
 * and add an entry here, e.g.:
 *   ARCHER: { 0: '...archer.png', 2: '...archer_t2.png', 4: '...archer_t4.png' }
 *
 * The renderer walks down from the tower's current level to find the
 * nearest available sprite, so gaps are fine — it always falls back to 0.
 */
const TOWER_SPRITE_PATHS = {
  ARCHER: { 0: 'assets/sprites/towers/archer.png' },
  WIZARD: { 0: 'assets/sprites/towers/wizard.png' },
  CANNON: { 0: 'assets/sprites/towers/cannon.png' },
  FROST:  { 0: 'assets/sprites/towers/frost.png'  },
};

// Per-type sprite scale [widthMult, heightMult] (relative to CS * 1.4 base size).
const TOWER_SPRITE_SCALE = {
  ARCHER: [1.0,  1.0],
  WIZARD: [0.6,  0.85],
  CANNON: [1.0,  1.0],
  FROST:  [1.0,  0.85],
};

/** Returns the best sprite path for the given tower type and total upgrade level. */
function _resolveTowerSprite(type, totalLevel) {
  const levels = TOWER_SPRITE_PATHS[type];
  if (!levels) return null;
  for (let lvl = totalLevel; lvl >= 0; lvl--) {
    if (levels[lvl]) return levels[lvl];
  }
  return null;
}

// Map of enemy type -> sprite path.
const ENEMY_SPRITE_PATHS = {
  GOBLIN:     'assets/sprites/enemies/goblin.png',
  ORC:        'assets/sprites/enemies/orc.png',
  SKELETON:   'assets/sprites/enemies/skeleton.png',
  MINI_BOSS1: 'assets/sprites/enemies/mini_boss1.png',
  BOSS:       'assets/sprites/enemies/boss.png',
  WOLF:       'assets/sprites/enemies/wolf.png',
  MEGA_WOLF:  'assets/sprites/enemies/mega_wolf.png',
  MINI_BOSS2: 'assets/sprites/enemies/mini_boss2.png',
  BOSS2:      'assets/sprites/enemies/boss2.png',
};

// Per-enemy sprite scale multiplier (relative to sz * 2.8 base size).
const ENEMY_SPRITE_SCALE = {
  GOBLIN:     1.2,
  ORC:        1.0,
  SKELETON:   1.0,
  MINI_BOSS1: 1.2,
  BOSS:       1.0,
  WOLF:       1.1,
  MEGA_WOLF:  0.85,
  MINI_BOSS2: 1.3,
  BOSS2:      1.4,
};

export class Renderer {
  constructor(canvas, waterCells) {
    this.canvas     = canvas;
    this._waterCells = waterCells; // Set of 'col,row' strings — may be empty for easy mode

    this.scene    = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Texture cache: path -> THREE.Texture (loaded on demand, cached forever)
    this._texCache = new Map();

    this._setupCamera();
    this._setupRenderer();
    this._setupLights();
    this._buildGround();
    this._buildCastle();
    this._buildEntrance();

    this.towerGroups      = new Map(); // towerId  -> THREE.Group
    this.enemyGroups      = new Map(); // enemyId  -> THREE.Group
    this.projectileMeshes = new Map(); // projId   -> THREE.Mesh

    this._rangeCircle = null;
    this._hoverMesh   = this._makeHoverMesh();

    window.addEventListener('resize', () => this._onResize());
  }

  // ─── Texture loading ──────────────────────────────────────────────────────

  /** Returns a cached texture, loading it if needed. */
  _loadTex(path) {
    if (this._texCache.has(path)) return this._texCache.get(path);
    const tex = new THREE.TextureLoader().load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache.set(path, tex);
    return tex;
  }

  /** Build a sprite that always faces the top-down camera. */
  _makeSprite(texPath, size = CS * 0.92) {
    const mat    = new THREE.SpriteMaterial({ map: this._loadTex(texPath), transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.position.y = size / 2; // lift to ground level
    return sprite;
  }

  // ─── Camera ──────────────────────────────────────────────────────────────

  _setupCamera() {
    const w = this.canvas.clientWidth  || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect  = w / h;
    const gridW   = GRID_COLS * CS;
    const gridH   = GRID_ROWS * CS;
    const pad     = 1.1;

    let cW = gridW * pad;
    let cH = gridH * pad;
    if (cW / cH < aspect) cW = cH * aspect; else cH = cW / aspect;

    this.camera = new THREE.OrthographicCamera(-cW/2, cW/2, cH/2, -cH/2, -200, 200);
    const cx = (GRID_COLS - 1) * CS / 2;
    const cz = (GRID_ROWS - 1) * CS / 2;
    this.camera.position.set(cx, 50, cz);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(cx, 0, cz);
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth || window.innerWidth,
                          this.canvas.clientHeight || window.innerHeight, false);
  }

  _onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    const gridW  = GRID_COLS * CS * 1.1;
    const gridH  = GRID_ROWS * CS * 1.1;
    let cW = gridW, cH = gridH;
    if (cW / cH < aspect) cW = cH * aspect; else cH = cW / aspect;

    this.camera.left   = -cW / 2;
    this.camera.right  =  cW / 2;
    this.camera.top    =  cH / 2;
    this.camera.bottom = -cH / 2;
    this.camera.updateProjectionMatrix();
  }

  // ─── Lights ───────────────────────────────────────────────────────────────

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xfff4cc, 0.9);
    dir.position.set(8, 20, -4);
    this.scene.add(dir);
  }

  // ─── Ground / Path tiles ─────────────────────────────────────────────────

  _buildGround() {
    // Grass base
    const gGeo = new THREE.PlaneGeometry((GRID_COLS + 1) * CS, (GRID_ROWS + 1) * CS);
    const gMat = new THREE.MeshLambertMaterial({ color: 0x4A8C28 });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    gMesh.rotation.x = -Math.PI / 2;
    gMesh.position.set((GRID_COLS - 1) * CS / 2, -0.02, (GRID_ROWS - 1) * CS / 2);
    this.scene.add(gMesh);

    // Checkerboard grass tiles
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (PATH_CELLS.has(`${c},${r}`))       continue;
        if (this._waterCells.has(`${c},${r}`)) continue;
        const col = (c + r) % 2 === 0 ? 0x5AA832 : 0x4E9A2C;
        this._addTile(c, r, col, 0.01);
      }
    }

    // Path tiles
    PATH_CELLS.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      this._addTile(c, r, 0xA8855A, 0.02, 0.98);
    });

    // Water tiles — solid light blue, slightly sunken
    this._waterCells.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      this._addTile(c, r, 0x5BB8F5, -0.04, 1.0);
    });
  }

  _addTile(col, row, color, y = 0, scale = 0.96) {
    const geo  = new THREE.BoxGeometry(CS * scale, 0.04, CS * scale);
    const mat  = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    const pos  = gridToWorld(col, row);
    mesh.position.set(pos.x, y, pos.z);
    this.scene.add(mesh);
    return mesh;
  }

  // ─── Castle ───────────────────────────────────────────────────────────────

  _buildCastle() {
    const [col, row] = CASTLE;
    const pos  = gridToWorld(col, row);
    const size = CS * 4; // 4 blocks wide/tall

    // Try sprite first
    const spritePath = 'assets/sprites/environment/castle.png';
    const tex = new THREE.TextureLoader().load(
      spritePath,
      () => {
        // Texture loaded — remove the fallback geometry and show sprite
        this.scene.remove(fallbackGroup);
        this._disposeGroup(fallbackGroup);
        const mat    = new THREE.SpriteMaterial({ map: tex, transparent: true });
        mat.map.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(size, size, 1);
        sprite.position.set(pos.x - CS * 0.3, size / 2, pos.z - CS * 0.8);
        this.scene.add(sprite);
      },
      undefined,
      () => { /* sprite not found — fallback geometry stays */ }
    );

    // Fallback 3D geometry (shown until/unless sprite loads)
    const fallbackGroup = new THREE.Group();
    fallbackGroup.position.set(pos.x, 0, pos.z);

    const keepGeo = new THREE.BoxGeometry(CS * 0.85, 1.4, CS * 0.85);
    const keepMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const keep    = new THREE.Mesh(keepGeo, keepMat);
    keep.position.y = 0.7;
    fallbackGroup.add(keep);

    const turretGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
    const turretMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    for (const [dx, dz] of [[-0.38,-0.38],[0.38,-0.38],[-0.38,0.38],[0.38,0.38]]) {
      const t = new THREE.Mesh(turretGeo, turretMat);
      t.position.set(dx, 1.6, dz);
      fallbackGroup.add(t);
    }

    const flagGeo = new THREE.BoxGeometry(0.12, 0.35, 0.08);
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
    const flag    = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, 2.0, 0);
    fallbackGroup.add(flag);

    this.scene.add(fallbackGroup);
  }

  // ─── Entrance ─────────────────────────────────────────────────────────────

  _buildEntrance() {
    const [col, row] = ENTRANCE;
    const pos = gridToWorld(col, row);
    const g = new THREE.Group();
    g.position.set(pos.x, 0, pos.z);

    // Two stone pillars
    const pillarGeo = new THREE.BoxGeometry(0.18, 1.1, 0.18);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (const dz of [-0.5, 0.5]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(0, 0.55, dz);
      g.add(p);
    }
    this.scene.add(g);
  }

  // ─── Hover highlight ──────────────────────────────────────────────────────

  _makeHoverMesh() {
    const geo  = new THREE.BoxGeometry(CS * 0.97, 0.07, CS * 0.97);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  showHover(col, row) {
    const pos = gridToWorld(col, row);
    this._hoverMesh.position.set(pos.x, 0.05, pos.z);
    this._hoverMesh.visible = true;
  }

  hideHover() { this._hoverMesh.visible = false; }

  // ─── Range circle ─────────────────────────────────────────────────────────

  showRange(x, z, rangeInCells) {
    this.hideRange();
    const r   = rangeInCells * CS;
    const geo = new THREE.RingGeometry(r - 0.06, r + 0.06, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    this._rangeCircle = new THREE.Mesh(geo, mat);
    this._rangeCircle.rotation.x = -Math.PI / 2;
    this._rangeCircle.position.set(x, 0.1, z);
    this.scene.add(this._rangeCircle);
  }

  hideRange() {
    if (this._rangeCircle) {
      this.scene.remove(this._rangeCircle);
      this._rangeCircle.geometry.dispose();
      this._rangeCircle.material.dispose();
      this._rangeCircle = null;
    }
  }

  // ─── Towers ───────────────────────────────────────────────────────────────

  addTower(tower) {
    const g   = new THREE.Group();
    const pos = gridToWorld(tower.col, tower.row);
    g.position.set(pos.x, 0, pos.z);

    const totalLevels = tower.pathLevels[0] + tower.pathLevels[1];
    const spritePath  = _resolveTowerSprite(tower.type, totalLevels);

    if (spritePath) {
      // Sprite-based tower — size controlled per type via TOWER_SPRITE_SCALE
      const [wMult, hMult] = TOWER_SPRITE_SCALE[tower.type] ?? [1.0, 1.0];
      const base = CS * 1.4;
      const sprite = this._makeSprite(spritePath, base);
      sprite.scale.set(base * wMult, base * hMult, 1);
      g.add(sprite);
    } else {
      // Fallback: procedural 3D geometry
      switch (tower.type) {
        case 'ARCHER':  this._buildArcherMesh(g, totalLevels); break;
        case 'WIZARD':  this._buildWizardMesh(g, totalLevels); break;
        case 'CANNON':  this._buildCannonMesh(g, totalLevels); break;
        case 'FROST':   this._buildFrostMesh(g,  totalLevels); break;
      }
    }

    this.scene.add(g);
    this.towerGroups.set(tower.id, g);
  }

  refreshTower(tower) {
    const old = this.towerGroups.get(tower.id);
    if (old) { this.scene.remove(old); this._disposeGroup(old); }
    this.addTower(tower);
  }

  removeTower(towerId) {
    const g = this.towerGroups.get(towerId);
    if (g) { this.scene.remove(g); this._disposeGroup(g); this.towerGroups.delete(towerId); }
  }

  _buildArcherMesh(g, lvl) {
    const baseColor = 0xA0522D;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.35, CS*0.38, 0.45, 8),
      new THREE.MeshLambertMaterial({ color: baseColor })
    );
    base.position.y = 0.22;
    g.add(base);
    // Narrow tower
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.15, CS*0.2, 0.55, 8),
      new THREE.MeshLambertMaterial({ color: 0x7A3B10 })
    );
    tower.position.y = 0.72;
    g.add(tower);
    // Tip (arrow slot)
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(CS*0.16, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x5A2900 })
    );
    tip.position.y = 1.14;
    g.add(tip);
    if (lvl > 0) this._addUpgradeRing(g, 0.9, 0xFFD700, lvl);
  }

  _buildWizardMesh(g, lvl) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.34, CS*0.36, 0.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x4A0080 })
    );
    base.position.y = 0.2;
    g.add(base);
    // Tall spire
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.13, CS*0.22, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x7B2FBE })
    );
    spire.position.y = 0.75;
    g.add(spire);
    // Orb
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xCC66FF, emissive: 0x440055 })
    );
    orb.position.y = 1.25;
    g.add(orb);
    if (lvl > 0) this._addUpgradeRing(g, 0.9, 0xFFD700, lvl);
  }

  _buildCannonMesh(g, lvl) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.36, CS*0.38, 0.45, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    base.position.y = 0.22;
    g.add(base);
    // Barrel (rotated cylinder pointing up slightly)
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.65, 8),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.position.y = 0.78;
    g.add(barrel);
    // Cannonball on top
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    ball.position.y = 1.15;
    g.add(ball);
    if (lvl > 0) this._addUpgradeRing(g, 0.9, 0xFFD700, lvl);
  }

  _buildFrostMesh(g, lvl) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(CS*0.33, CS*0.36, 0.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x006688 })
    );
    base.position.y = 0.2;
    g.add(base);
    // Crystal spire
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(CS*0.22, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.85, emissive: 0x003344 })
    );
    crystal.position.y = 0.85;
    g.add(crystal);
    if (lvl > 0) this._addUpgradeRing(g, 0.9, 0xFFD700, lvl);
  }

  _addUpgradeRing(g, y, color, lvl) {
    for (let i = 0; i < lvl; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(CS * 0.4 + i * 0.05, 0.04, 6, 20),
        new THREE.MeshBasicMaterial({ color })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y + i * 0.12;
      g.add(ring);
    }
  }

  // ─── Enemies ──────────────────────────────────────────────────────────────

  addEnemy(enemy) {
    const g  = new THREE.Group();
    const sz = enemy.size;

    const spritePath = ENEMY_SPRITE_PATHS[enemy.type];

    if (spritePath) {
      // Sprite-based enemy
      const sprite = this._makeSprite(spritePath, sz * 2.8 * (ENEMY_SPRITE_SCALE[enemy.type] ?? 1.0));
      g.add(sprite);
      g.userData.isSprite = true;
      g.userData.body     = sprite; // used for slow tint
    } else {
      // Fallback: procedural geometry
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(sz * 1.2, sz * 1.4, sz * 1.2),
        new THREE.MeshLambertMaterial({ color: enemy.color })
      );
      body.position.y = sz * 0.7;
      g.add(body);
      g.userData.body = body;

      // Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
      for (const ex of [-0.1, 0.1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(ex, sz * 0.85, -(sz * 0.6));
        g.add(eye);
      }
    }

    // HP bar (always shown regardless of sprite/geometry)
    const barY = sz * 1.8;
    const hpBgGeo  = new THREE.BoxGeometry(0.75, 0.03, 0.13);
    const hpBgMesh = new THREE.Mesh(hpBgGeo, new THREE.MeshBasicMaterial({ color: 0x222222 }));
    hpBgMesh.position.set(0, barY, 0);
    hpBgMesh.rotation.x = -Math.PI / 2;
    g.add(hpBgMesh);

    const hpFgGeo  = new THREE.BoxGeometry(0.73, 0.03, 0.11);
    const hpFgMesh = new THREE.Mesh(hpFgGeo, new THREE.MeshBasicMaterial({ color: 0x22DD22 }));
    hpFgMesh.position.set(0, barY + 0.01, 0);
    hpFgMesh.rotation.x = -Math.PI / 2;
    g.add(hpFgMesh);

    g.userData.hpFg = hpFgMesh;
    // Sprites must use white as base so the texture isn't tinted
    g.userData.baseColor = ENEMY_SPRITE_PATHS[enemy.type] ? 0xffffff : enemy.color;

    g.position.set(enemy.x, 0, enemy.z);
    this.scene.add(g);
    this.enemyGroups.set(enemy.id, g);
  }

  updateEnemy(enemy) {
    const g = this.enemyGroups.get(enemy.id);
    if (!g) return;
    g.position.set(enemy.x, 0, enemy.z);

    // HP bar
    const hpFg = g.userData.hpFg;
    if (hpFg) {
      hpFg.scale.x     = Math.max(0, enemy.hpRatio);
      hpFg.position.x  = -(1 - enemy.hpRatio) * 0.365;
      const r = enemy.hpRatio;
      hpFg.material.color.setHex(r > 0.6 ? 0x22DD22 : r > 0.3 ? 0xDDDD22 : 0xDD2222);
    }

    // Slow tint on body / sprite
    const body = g.userData.body;
    if (body && body.material) {
      if (enemy.slowTimer > 0) {
        body.material.color.setHex(blendColors(g.userData.baseColor, 0x00AAFF, 0.45));
      } else {
        body.material.color.setHex(g.userData.baseColor);
      }
    }
  }

  removeEnemy(enemyId) {
    const g = this.enemyGroups.get(enemyId);
    if (g) { this.scene.remove(g); this._disposeGroup(g); this.enemyGroups.delete(enemyId); }
  }

  // ─── Splash effect ────────────────────────────────────────────────────────

  showSplash(x, z, radius, color) {
    const geo  = new THREE.CircleGeometry(radius, 32);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, z);
    this.scene.add(mesh);

    const start    = performance.now();
    const duration = 380;
    const animate  = () => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) {
        this.scene.remove(mesh);
        geo.dispose();
        mat.dispose();
        return;
      }
      mat.opacity = 0.55 * (1 - t);
      const s = 0.6 + t * 0.4; // expand from 60% to 100%
      mesh.scale.set(s, s, 1);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ─── Projectiles ──────────────────────────────────────────────────────────

  addProjectile(proj) {
    const geo  = new THREE.SphereGeometry(0.1, 6, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: proj.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(proj.x, proj.y, proj.z);
    this.scene.add(mesh);
    this.projectileMeshes.set(proj.id, mesh);
  }

  updateProjectile(proj) {
    const mesh = this.projectileMeshes.get(proj.id);
    if (mesh) mesh.position.set(proj.x, proj.y, proj.z);
  }

  removeProjectile(projId) {
    const mesh = this.projectileMeshes.get(projId);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.projectileMeshes.delete(projId);
    }
  }

  // ─── Raycasting ───────────────────────────────────────────────────────────

  /** Returns { col, row } or null. */
  pickCell(clientX, clientY) {
    const rect  = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray   = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt    = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, pt)) return null;

    const col = Math.round(pt.x / CS);
    const row = Math.round(pt.z / CS);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _disposeGroup(g) {
    g.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
}

function blendColors(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (rg << 8) | rb;
}
