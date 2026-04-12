# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kingdom's Last Stand is a browser-based fantasy tower defense game built with vanilla JavaScript ES modules and Three.js for 3D rendering. Players defend a castle against waves of enemies by placing and upgrading towers on a grid-based map.

## Development Commands

**Run locally:**
```bash
# Any static file server works - the game uses ES modules via CDN import maps
npx serve exe4_idea2reality
# or
python -m http.server 8000 --directory exe4_idea2reality
```

**Deployment:** Configured for Netlify via `netlify.toml`. Push to deploy.

## Architecture

### Core Game Loop (`js/game.js`)
The `Game` class orchestrates all gameplay:
- `_tick()` runs the main loop via requestAnimationFrame
- `_update(dt)` processes enemies, towers, projectiles, and wave completion each frame
- Speed multiplier (1x/2x) affects the `dt` passed to update

### Module Dependencies
```
main.js
  └── Game (game.js)
        ├── Renderer (renderer.js)  - Three.js scene, camera, all visuals
        ├── UI (ui.js)              - DOM-based HUD, panels, overlays
        ├── WaveManager (waves.js)  - Spawns enemies per wave config
        ├── Tower (towers.js)       - Tower instances with upgrade system
        ├── Enemy (enemies.js)      - Enemy instances with movement/HP
        ├── Projectile (projectiles.js) - Homing projectile logic
        └── constants.js            - All game data (towers, enemies, waves)
        └── map.js                  - Grid/path utilities
```

### Key Data Structures (`js/constants.js`)

**TOWER_DEFS:** Each tower type has:
- Base stats (damage, range, fireRate, damageType)
- `unlockWave` - wave when tower becomes available
- `paths[]` - 2 upgrade paths with 3 tiers each; tiers have `apply(tower)` functions that mutate live stats

**ENEMY_DEFS:** Each enemy type has:
- Stats (hp, speed, reward, damage, size)
- Resistances: `physResist`, `magicResist`, `slowResist` (0-1 scale)

**WAVES:** Array of 20 waves, each containing spawn groups with type, count, and interval.

### Upgrade System Cross-Path Rule
Towers use a Bloons-style upgrade restriction: both paths cannot be at tier 2+ simultaneously. Valid combos: 3-0, 0-3, 3-1, 1-3, 2-1, 1-2. Enforced in `Tower.canUpgradePath()`.

### Rendering (`js/renderer.js`)
- Uses Three.js OrthographicCamera for top-down view
- Sprite-based rendering for towers/enemies when assets exist in `assets/sprites/`
- Falls back to procedural 3D geometry when sprites missing
- `pickCell()` does raycasting to convert screen coords to grid coords

### Damage Calculation
- Towers deal either PHYSICAL or MAGIC damage
- Enemies have `physResist` and `magicResist` (0-1)
- Damage = baseDamage * (1 - resistance)
- Slow effectiveness reduced by `slowResist`

### Grid System
- 20x15 grid, CELL_SIZE = 1.5 world units
- Path defined by waypoints in `PATH_WAYPOINTS`
- `PATH_CELLS` (Set) contains all path cell coordinates
- Towers can only be placed on non-path cells

## Asset Conventions

**Sprites:** Place in `assets/sprites/towers/` or `assets/sprites/enemies/`
- Tower sprites: `{type}.png` (e.g., `archer.png`)
- Enemy sprites: `{type}.png` (e.g., `goblin.png`)
- Configure scaling in `TOWER_SPRITE_SCALE` or `ENEMY_SPRITE_SCALE` in renderer.js
