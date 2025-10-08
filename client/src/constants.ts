export const TILE_SIZE = 2;
export const CELL = 3 * TILE_SIZE;
export const STEP = CELL;

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 6;

export const ROAD_COST = 200;
export const WELL_COST = 800;
export const SAWMILL_COST = 1000;
export const HOUSE_COST = 1200;
export const TURBINE_COST = 1500;
export const BUILDING_COST = 5000;

export const Z_GROUND = -0.002;
export const Z_GRID = 0.0002;
export const Z_ROAD = 0.0005;
export const Z_PREVIEW = 0.0008;
export const Z_CURSOR = 0.0012;

export const ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export const align = (v: number) => Math.floor(v / STEP) * STEP;
