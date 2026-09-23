# Kingdom's Last Stand

A browser-based fantasy tower defense game. Place and upgrade towers along a path to protect your castle from 20 waves of goblins, orcs, skeletons, wolves, and bosses. Built with vanilla JavaScript and Three.js, with no build step and no framework.

## Features

- **4 tower types, unlocked as you progress:** Archer (wave 1), Frost (wave 3), Wizard (wave 5), and Cannon (wave 8).
- **Two upgrade paths per tower, three tiers each,** such as Archer's *Sharp Arrows* (damage and multi-shot) or *Eagle Eye* (range and critical hits). As in Bloons TD, both paths can't be at tier 2 or higher at the same time, so every tower build is a real choice.
- **Physical vs. magic damage:** each enemy has its own physical, magic, and slow resistances. Mixing tower types matters, because an armored enemy shrugs off arrows but not spells.
- **Tower abilities:** slow and freeze effects, splash damage, chain lightning, multi-shot, and critical hits.
- **9 enemy types across 20 waves,** including mini-bosses and bosses.
- **3 difficulty levels,** each changing enemy HP, rewards, and starting gold.
- **Game controls:** 1x/2x speed, pause, and selling towers for gold.

## How it works

- **Rendering:** Three.js with an orthographic top-down camera. Towers and enemies are drawn from sprites, with procedural 3D shapes as a fallback when a sprite is missing.
- **Placement:** raycasting converts mouse clicks into cells on a 20×15 grid. Towers can't be placed on the enemy path.
- **Game loop:** a `requestAnimationFrame` loop updates enemies, towers, and homing projectiles each frame. The speed setting scales the time step.
- **Data-driven design:** every tower, upgrade, enemy, and wave is defined in `js/constants.js`, so balancing the game means editing data, not logic.

```
js/
├── main.js         # Entry point
├── game.js         # Game loop, gold, lives, tower placement
├── renderer.js     # Three.js scene, camera, sprites
├── ui.js           # HUD, panels, overlays
├── waves.js        # Wave spawning
├── towers.js       # Towers and upgrade rules
├── enemies.js      # Enemy movement, HP, resistances
├── projectiles.js  # Homing projectiles
├── map.js          # Grid and path
└── constants.js    # All game data
```

## Running locally

The game uses ES modules loaded through an import map, so it needs to be served over HTTP rather than opened as a file:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the address it prints.

## Credits

Background music was generated with [Suno](https://suno.com).
