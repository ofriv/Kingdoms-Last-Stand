import { GRID_COLS, GRID_ROWS, PATH_WAYPOINTS, CELL_SIZE } from './constants.js';

function computePathCells() {
  const cells = new Set();
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [c0, r0] = PATH_WAYPOINTS[i];
    const [c1, r1] = PATH_WAYPOINTS[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    while (c !== c1 || r !== r1) {
      cells.add(`${c},${r}`);
      c += dc;
      r += dr;
    }
    cells.add(`${c1},${r1}`);
  }
  return cells;
}

export const PATH_CELLS = computePathCells();

export function isPathCell(col, row) {
  return PATH_CELLS.has(`${col},${row}`);
}

export function isValidCell(col, row) {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

// Cell center in world space (Y=0 ground level)
export function gridToWorld(col, row, y = 0) {
  return { x: col * CELL_SIZE, y, z: row * CELL_SIZE };
}

export function worldToGrid(x, z) {
  return {
    col: Math.round(x / CELL_SIZE),
    row: Math.round(z / CELL_SIZE),
  };
}

export function getPathWorldPositions() {
  return PATH_WAYPOINTS.map(([col, row]) => gridToWorld(col, row));
}
