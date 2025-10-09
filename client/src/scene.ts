import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Z_GROUND, Z_GRID, STEP, MIN_ZOOM, MAX_ZOOM, align } from "./constants";

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x55aa55);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(50, 100, 50); scene.add(sun); scene.add(sun.target);
// Shadows for sunlight
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
// Slight blur for softer pixels
(sun.shadow as any).radius = 3;
// normalBias reduces acne on detailed normals (r180+)
(sun.shadow as any).normalBias = 0.4;

let viewSize = 40;
export const CAM_TARGET = new THREE.Vector3(0, 0, 0);
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
camera.position.set(30, 30, 30);
camera.lookAt(CAM_TARGET);
camera.zoom = 1;

export function setOrtho(cam = camera) {
  const a = innerWidth / innerHeight;
  cam.left = -a * viewSize / 2; cam.right = a * viewSize / 2; cam.top = viewSize / 2; cam.bottom = -viewSize / 2;
  cam.updateProjectionMatrix();
}
setOrtho();

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x55aa55);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // smoother filtering to reduce pixelation
document.body.appendChild(renderer.domElement);

export const stats = new Stats();
stats.showPanel(0);
stats.dom.style.display = "none";
document.body.appendChild(stats.dom);

export const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
(controls.mouseButtons as any).LEFT = null;
(controls.mouseButtons as any).RIGHT = THREE.MOUSE.PAN;
controls.addEventListener("change", () => {
  camera.position.y = Math.max(camera.position.y, 1);
  updateSunShadowForView();
});
controls.target.copy(CAM_TARGET);

let camRotAnim: { t0: number; dur: number; a0: number; a1: number; R: number; y: number } | null = null;
export function rotateCameraQuarter(dir: 1 | -1, duration = 300) {
  if (camRotAnim) return;
  const t = controls.target;
  const v = camera.position.clone().sub(t);
  const a0 = Math.atan2(v.x, v.z);
  const a1 = a0 + dir * Math.PI / 2;
  const R = Math.hypot(v.x, v.z);
  camRotAnim = { t0: performance.now(), dur: duration, a0, a1, R, y: camera.position.y };
}
export function stepCameraRotation(now: number) {
  if (!camRotAnim) return;
  const { t0, dur, a0, a1, R, y } = camRotAnim;
  const k = Math.min(1, (now - t0) / dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const a = a0 + (a1 - a0) * e;
  const t = controls.target;
  const x = t.x + Math.sin(a) * R;
  const z = t.z + Math.cos(a) * R;
  camera.position.set(x, y, z);
  camera.up.set(0, 1, 0);
  camera.lookAt(t);
  controls.update();
  if (k >= 1) camRotAnim = null;
}

export const GRID_DIV = 800;
export const GRID_SIZE = GRID_DIV * STEP;
export const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIV, 0x000000, 0x000000);
(grid.material as any).transparent = true;
(grid.material as any).opacity = 0.35;
(grid.material as any).depthWrite = false;
(grid.material as any).depthTest = true;
grid.renderOrder = 1; scene.add(grid);

export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4096, 4096),
  new THREE.MeshPhongMaterial({ color: 0x55aa55 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = Z_GROUND;
ground.receiveShadow = true;
scene.add(ground);

export function updateGrid() {
  grid.position.set(align(camera.position.x), Z_GRID, align(camera.position.z));
  grid.rotation.x = 0;
}

export function clampZoom() {
  camera.zoom = THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
  updateSunShadowForView();
}

export const fpsHud = document.getElementById("fps-hud") as HTMLDivElement;

// Fit the sun shadow camera to current view to increase texel density (less pixelation)
export function updateSunShadowForView() {
  // Center light target on current map controls target
  sun.target.position.copy(controls.target);
  sun.position.set(controls.target.x + 50, controls.target.y + 100, controls.target.z + 50);

  const halfW = (camera.right - camera.left) * 0.5;
  const halfH = (camera.top - camera.bottom) * 0.5;
  const half = Math.max(halfW, halfH) * 1.25; // margin
  const cam = sun.shadow.camera as THREE.OrthographicCamera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.near = 1; cam.far = 2000;
  cam.updateProjectionMatrix();
}

// Initial shadow fit
updateSunShadowForView();
