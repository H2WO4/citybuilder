import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANG, CELL, Z_GROUND } from './constants';
import { roads } from './placement';

let pathfinder: Pathfinding | null = null;
let zoneId = 'roads';
let rebuildT: any = null;

// Parameters for walkway width and road width (in world units)
// Tuned to better match the visual width of the GLB road models (CELL ~= 6 units)
// Drive surface ~ 64% of cell (≈ 3.84u), sidewalks ~ 12% (≈ 0.72u) each side
const ROAD_DRIVE_WIDTH = CELL * 0.64; // total driving surface width
const SIDEWALK_WIDTH = CELL * 0.12;   // sidewalk width per side

export function getSidewalkCenterOffset() {
  return (ROAD_DRIVE_WIDTH * 0.5) + (SIDEWALK_WIDTH * 0.5);
}

function makeStrip(length: number, width: number, yaw: number, cx: number, cz: number, sideOffset = 0) {
  // Plane local: length along X, width along Z
  const g = new THREE.PlaneGeometry(length, width).rotateX(-Math.PI / 2);
  // Translate sideways in local Z, then rotate around Y and move to world center
  const side = new THREE.Vector3(0, 0, sideOffset).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  g.rotateY(yaw);
  g.translate(cx + side.x, Z_GROUND, cz + side.z);
  return g;
}

function addStraightSidewalks(geoms: THREE.BufferGeometry[], cx: number, cz: number, yaw: number) {
  const len = CELL;
  const off = (ROAD_DRIVE_WIDTH * 0.5) + (SIDEWALK_WIDTH * 0.5);
  geoms.push(makeStrip(len, SIDEWALK_WIDTH, yaw, cx, cz, +off));
  geoms.push(makeStrip(len, SIDEWALK_WIDTH, yaw, cx, cz, -off));
}

function addCornerSidewalks(geoms: THREE.BufferGeometry[], cx: number, cz: number, yaw: number) {
  // Two perpendicular sidewalks meeting at the corner
  addStraightSidewalks(geoms, cx, cz, yaw);
  addStraightSidewalks(geoms, cx, cz, yaw + Math.PI / 2);
  // Corner fill (small square to avoid gap)
  const fill = new THREE.PlaneGeometry(SIDEWALK_WIDTH, SIDEWALK_WIDTH).rotateX(-Math.PI / 2);
  fill.rotateY(yaw);
  fill.translate(cx, Z_GROUND, cz);
  geoms.push(fill);
}

function addCrossSidewalks(geoms: THREE.BufferGeometry[], cx: number, cz: number, yaw: number) {
  // Four arms
  addStraightSidewalks(geoms, cx, cz, yaw);
  addStraightSidewalks(geoms, cx, cz, yaw + Math.PI / 2);
  // Center plaza to connect arms
  const center = new THREE.PlaneGeometry(SIDEWALK_WIDTH * 1.4, SIDEWALK_WIDTH * 1.4).rotateX(-Math.PI / 2);
  center.rotateY(yaw);
  center.translate(cx, Z_GROUND, cz);
  geoms.push(center);
}

export function rebuildNavmesh() {
  const geoms: THREE.BufferGeometry[] = [];
  for (const [key, obj] of roads) {
    // keys are canonical tile indices "ix:iz" — convert to world center coords
    const [ix, iz] = key.split(':').map(Number);
    const cx = ix * CELL + CELL * 0.5;
    const cz = iz * CELL + CELL * 0.5;
    const piece: 'I' | 'L' | 'X' = (obj as any).userData?.piece ?? 'I';
    const angleIdx: number = (obj as any).userData?.angle ?? 0;
    const yaw = ANG[angleIdx] || 0;
    if (piece === 'I') addStraightSidewalks(geoms, cx, cz, yaw);
    else if (piece === 'L') addCornerSidewalks(geoms, cx, cz, yaw);
    else addCrossSidewalks(geoms, cx, cz, yaw);
  }
  if (!geoms.length) { pathfinder = null; return; }
  const merged = mergeGeometries(geoms, false);
  if (!merged) { pathfinder = null; return; }
  const zone = Pathfinding.createZone(merged);
  if (!pathfinder) pathfinder = new Pathfinding();
  pathfinder.setZoneData(zoneId, zone);
}

export function scheduleNavmeshRebuild(delay = 300) {
  clearTimeout(rebuildT);
  rebuildT = setTimeout(rebuildNavmesh, delay);
}

export function findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] | null {
  if (!pathfinder) return null;
  const group = pathfinder.getGroup(zoneId, start);
  if (group === -1 || group === undefined || group === null) return null;
  const path = pathfinder.findPath(start, end, zoneId, group);
  return path || null;
}
