// ===== imports =====
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";


// URLs des modèles (résolution Vite/ESM, évite le retour d'index.html)
import URL_STREET_L from "../texture_models/Roads/StreetCorner.glb?url";
import URL_STREET_I from "../texture_models/Roads/StreetStraight.glb?url";
import URL_STREET_X from "../texture_models/Roads/Crosswalk.glb?url";
import URL_HOUSE from "../texture_models/Buildings/House.glb?url";
import URL_BUILDING from "../texture_models/Buildings/Building.glb?url";
import * as UI from "./ui";

UI.init()

// ----- paramètres -----
const TILE_SIZE = 2;
const GRID_VIS_SIZE = 5000;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const CELL = 3 * TILE_SIZE;
const ROAD_COST = 200;
const HOUSE_COST = 1200;
const BUILDING_COST = 5000;

// ----- scène -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x55aa55);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(50, 100, 50); scene.add(sun); scene.add(sun.target);

// ----- caméra -----
function setOrtho(cam: any) {
  const a = innerWidth / innerHeight;
  cam.left = -a * viewSize / 2; cam.right = a * viewSize / 2; cam.top = viewSize / 2; cam.bottom = -viewSize / 2;
  cam.updateProjectionMatrix();
}
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
camera.position.set(30, 30, 30); camera.lookAt(0, 0, 0); camera.zoom = 1; setOrtho(camera);

// ----- rendu -----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x55aa55);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ----- stats + HUD FPS -----
const stats = new Stats();
stats.showPanel(0);
stats.dom.style.display = "none";
document.body.appendChild(stats.dom);

const fpsHud = document.createElement("div");
fpsHud.textContent = "— FPS";
fpsHud.className = "ui panel fps-hud";
document.body.appendChild(fpsHud);

// ===== petit toast =====
const toast = document.createElement("div");
Object.assign(toast.style, {
  position: "fixed", top: "64px", left: "50%", transform: "translateX(-50%)",
  padding: "6px 10px", border: "1px solid #222", borderRadius: "8px",
  background: "rgba(255,255,255,0.95)", fontFamily: "system-ui, sans-serif",
  fontSize: "14px", color: "#111", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  pointerEvents: "none", zIndex: "10000", opacity: "0", transition: "opacity .15s"
});
toast.className = "ui";
document.body.appendChild(toast);
let toastT: any = null;
function showToast(msg: any) {
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.style.opacity = "0", 1200);
}

// ----- POPUPS MONETAIRES (stack + agrégation remboursements) -----
interface MoneyPopupAggregate { amount:number; element:HTMLDivElement; timeout:any; lastTime:number; }
const moneyPopupContainer = document.createElement('div');
moneyPopupContainer.style.position = 'fixed';
moneyPopupContainer.style.top = '60px';
moneyPopupContainer.style.right = '14px';
moneyPopupContainer.style.display = 'flex';
moneyPopupContainer.style.flexDirection = 'column';
moneyPopupContainer.style.alignItems = 'flex-end';
moneyPopupContainer.style.gap = '4px';
moneyPopupContainer.style.zIndex = '10002';
document.body.appendChild(moneyPopupContainer);

const REFUND_AGG_WINDOW = 450; // ms pour grouper plusieurs remboursements rapides
let refundAggregate: MoneyPopupAggregate | null = null;
const SPEND_AGG_WINDOW = 450;  // ms pour grouper plusieurs dépenses rapides
let spendAggregate: MoneyPopupAggregate | null = null;

function createMoneyPopup(text:string, color:string, key:string, pulse:boolean=false){
  const div = document.createElement('div');
  div.className = 'ui money-float';
  Object.assign(div.style, {
    background:'rgba(255,255,255,0.95)',
    color,
    fontWeight:'600',
    padding:'4px 10px',
    fontFamily:'system-ui, sans-serif',
    fontSize:'14px',
    borderRadius:'8px',
    boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
    pointerEvents:'none',
    opacity:'0',
    transform:'translateY(-6px)',
    transition:'opacity .25s, transform .4s',
    position:'relative',
    minWidth:'80px',
    textAlign:'right'
  });
  div.dataset.kind = key;
  div.textContent = text;
  moneyPopupContainer.appendChild(div);
  requestAnimationFrame(()=>{
    div.style.opacity='1';
    div.style.transform='translateY(0)';
    if(pulse){
      div.animate([
        { transform:'translateY(0) scale(1.0)' },
        { transform:'translateY(0) scale(1.07)' },
        { transform:'translateY(0) scale(1.0)' }
      ], { duration:260, easing:'ease-out' });
    }
  });
  setTimeout(()=>{
    div.style.opacity='0';
    div.style.transform='translateY(-6px)';
    setTimeout(()=> div.remove(), 400);
  }, 1500);
  return div;
}

function showRefund(amount:number){
  const now = performance.now();
  if(refundAggregate && (now - refundAggregate.lastTime) < REFUND_AGG_WINDOW){
    refundAggregate.amount += amount;
    refundAggregate.lastTime = now;
    refundAggregate.element.textContent = '+'+fmtEUR.format(refundAggregate.amount);
    refundAggregate.element.style.color = '#0f7d1f';
    refundAggregate.element.animate([
      { transform:'translateY(0) scale(1.0)' },
      { transform:'translateY(0) scale(1.1)' },
      { transform:'translateY(0) scale(1.0)' }
    ], { duration:300, easing:'ease-out' });
    clearTimeout(refundAggregate.timeout);
    refundAggregate.timeout = setTimeout(()=>{
      const el = refundAggregate?.element; if(el){ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=> el.remove(),400); }
      refundAggregate = null;
    }, 1500);
    return;
  }
  // créer un nouveau popup agrégé
  const el = createMoneyPopup('+'+fmtEUR.format(amount), '#0f7d1f', 'refund', true);
  refundAggregate = {
    amount,
    element: el,
    lastTime: now,
    timeout: setTimeout(()=>{
      el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=> el.remove(),400); refundAggregate=null; }, 1500)
  };
}

function showSpend(amount:number){
  const now = performance.now();
  if(spendAggregate && (now - spendAggregate.lastTime) < SPEND_AGG_WINDOW){
    spendAggregate.amount += amount;
    spendAggregate.lastTime = now;
    spendAggregate.element.textContent = '-'+fmtEUR.format(spendAggregate.amount);
    spendAggregate.element.style.color = '#b51212';
    spendAggregate.element.animate([
      { transform:'translateY(0) scale(1.0)' },
      { transform:'translateY(0) scale(1.1)' },
      { transform:'translateY(0) scale(1.0)' }
    ], { duration:300, easing:'ease-out' });
    clearTimeout(spendAggregate.timeout);
    spendAggregate.timeout = setTimeout(()=>{
      const el = spendAggregate?.element; if(el){ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=> el.remove(),400); }
      spendAggregate = null;
    }, 1500);
    return;
  }
  const el = createMoneyPopup('-'+fmtEUR.format(amount), '#b51212', 'spend', true);
  spendAggregate = {
    amount,
    element: el,
    lastTime: now,
    timeout: setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=> el.remove(),400); spendAggregate=null; }, 1500)
  };
}

// ===== HUD Argent =====
let money = 200000;
const hud = document.createElement("div");
hud.className = "ui panel money-hud";
document.body.appendChild(hud);
const fmtEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
function renderMoney() { hud.textContent = fmtEUR.format(money); }
renderMoney();

// ===== Outils via le menu flottant =====
let mode = "pan";
let cursor: any = null;
let preview: any = null;
// let bulldozerHover: any = null;
// let bulldozerHelper: any = null;

const fabList = document.getElementById("fab-tools");
function updateFabActive() {
  if (!fabList) return;
  [...fabList.children].forEach(el => {
    const li = el as HTMLElement;
    if (li.dataset.tool === mode) li.classList.add("active"); else li.classList.remove("active");
  });
}
function setActive(m: any) {
  // Ignore if already in this mode (except road piece cycling handled elsewhere)
  const prevMode = mode;
  mode = m;
  updateFabActive();
  document.body.style.cursor = (m === "road" || m === "house" || m === "building") ? "crosshair" : m === "bulldozer" ? "not-allowed" : "default";
  if (typeof grid !== "undefined") grid.visible = (m !== "pan");

  // Adapter la couleur du curseur selon le mode
  if (cursor && (cursor.material as any)) {
    const mat = cursor.material as THREE.MeshBasicMaterial;
    if (m === "bulldozer") {
      mat.color.set(0xff0000); mat.opacity = 0.35;
    } else if (m === "road" || m === "house" || m === "building") {
      mat.color.set(0xffff00); mat.opacity = 0.25;
    } else {
      mat.color.set(0xffff00); mat.opacity = 0.20;
    }
    mat.transparent = true;
  }

  // For build modes always recreate preview to ensure correct model (fix house showing road)
  if (m === "road" || m === "house" || m === "building") {
    makePreview();
    if (preview) preview.visible = !overUI(lastPointerEvent);
  } else if (m === "bulldozer") {
    // créer une "preview" rouge simple pour feedback (carré rouge sur la cellule)
    if (preview) { scene.remove(preview); preview = null; }
    const geo = GEO_PLACEMENT.clone();
    const mat = new THREE.MeshBasicMaterial({ color:0xff0000, transparent:true, opacity:0.25 });
    const plate = new THREE.Mesh(geo, mat);
    plate.position.y = 0.0006;
    preview = plate;
    scene.add(preview);
  } else {
    if (preview) preview.visible = false;
  }

  // Reset rotation index if switching between categories? (Keep orientation consistent, so do nothing.)
  // If leaving a build mode clear painting state
  if (prevMode !== m && painting) painting = false;
}
if (fabList) {
  fabList.addEventListener("click", (e) => {
    const tgt = e.target as HTMLElement | null;
    const li = tgt ? tgt.closest<HTMLLIElement>("li[data-tool]") : null;
    if (!li) return;
    const tool = li.dataset.tool;
    if (tool) setActive(tool);
  });
}

// Sélection de variante route : cycle I -> L -> X au clavier (R)
let piece = "I";
function cyclePiece() {
  // Only applies to road mode
  piece = piece === "I" ? "L" : piece === "L" ? "X" : "I";
  updateCursor(true);
  if (mode === "road") {
    makePreview();
    // Reposition la nouvelle preview sous le curseur au lieu du centre
    if (lastPointerEvent) {
      const p = screenToGround(lastPointerEvent);
      if (p) {
        const s = snapToCell(p);
        updatePreviewPosition(s);
      }
    }
  }
  showToast(`Route: ${piece}`);
}
addEventListener("keydown", (e) => {
  if ((e.key === 'r' || e.key === 'R') && mode === 'road') { e.preventDefault(); cyclePiece(); }
});

// Raccourci clavier bulldozer (X) : toggle entre bulldozer et pan
addEventListener("keydown", (e) => {
  if (e.key === 'x' || e.key === 'X') {
    e.preventDefault();
    if (mode === 'bulldozer') {
      setActive('pan');
      showToast('Bulldozer désactivé');
    } else {
      setActive('bulldozer');
      showToast('Bulldozer actif');
    }
  }
});

// ----- contrôles -----
const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate = false; controls.screenSpacePanning = true; controls.enableDamping = true;
controls.mouseButtons.LEFT = null; controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.addEventListener("change", () => camera.position.y = Math.max(camera.position.y, 1));

// ----- grille + sol -----
// Une case de grille = 1 cellule (3x3 tiles)
const grid = new THREE.GridHelper(GRID_VIS_SIZE, GRID_VIS_SIZE / CELL, 0x000000, 0x000000);
grid.material.transparent = true; grid.material.opacity = 0.35; grid.material.depthWrite = false; grid.renderOrder = 1; scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4096, 4096), new THREE.MeshBasicMaterial({ color: 0x55aa55 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; scene.add(ground);
// centre la grille par pas de cellule
function updateGrid() {
  const gx = Math.round(camera.position.x / CELL) * CELL;
  const gz = Math.round(camera.position.z / CELL) * CELL;
  grid.position.set(gx, 0, gz);
}

// ----- Raycast & snap -----
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function screenToGround(e: any) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera); const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p.clone() : null;
}
function overUI(e: any) {
  return !!(e && e.target && e.target.closest(".ui"));
}

// --- Snap sur cellule entière ---
function snapToCell(v: any) {
  const x = Math.round(v.x / CELL) * CELL;
  const z = Math.round(v.z / CELL) * CELL;
  return new THREE.Vector3(x, 0, z);
}

// ----- orientation via A -----
let angleIndex = 0;
const ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
addEventListener("keydown", (e) => {
  if ((e.key === "a" || e.key === "A") && (mode === "road" || mode === "house" || mode === "building")) {
    e.preventDefault(); angleIndex = (angleIndex + 1) & 3; updateCursorOrient(); updatePreviewRotation();
  }
});

// ----- curseur -----
const GEO_PLACEMENT = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2); // taille d'une cellule
function makeCursor() {
  if (cursor) scene.remove(cursor);
  const geo = GEO_PLACEMENT.clone();
  cursor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.25 }));
  cursor.position.y = 0.001; cursor.visible = false; scene.add(cursor);
}
function updateCursor(resizeOnly = false) { if (!cursor || resizeOnly) makeCursor(); updateCursorOrient(); }
function updateCursorOrient() { if (cursor) cursor.rotation.y = ANG[angleIndex]; }
makeCursor();

// ====== CHARGEMENT DES GLB ======
const gltfLoader = new GLTFLoader();

type ModelKey = "I"|"L"|"X"|"HOUSE"|"BUILDING";
interface ModelEntry { path:string; prefab:THREE.Object3D|null; scale:THREE.Vector3; target:[number,number]; }
const MODELS: Record<ModelKey, ModelEntry> = {
  I: { path: URL_STREET_I, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  L: { path: URL_STREET_L, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  X: { path: URL_STREET_X, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  HOUSE: { path: URL_HOUSE, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  BUILDING: { path: URL_BUILDING, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] }
};

for (const key of Object.keys(MODELS) as ModelKey[]) {
  const entry = MODELS[key];
  gltfLoader.load(entry.path, (gltf: any) => {
    const root: THREE.Object3D = gltf.scene as THREE.Object3D;
    root.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh && mesh.material) {
        const mat = mesh.material as any;
        mat.metalness = 0; mat.roughness = 1;
        mesh.castShadow = mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const sz = new THREE.Vector3(); box.getSize(sz);
    const [targetX, targetZ] = entry.target;
    const sX = (sz.x > 1e-6) ? targetX / sz.x : 1;
    const sZ = (sz.z > 1e-6) ? targetZ / sz.z : 1;
    const sY = 0.5 * (sX + sZ);
    entry.scale.set(sX, sY, sZ);
    entry.prefab = root;
    if ((key === piece) || (key === "HOUSE" && mode === "house") || (key === "BUILDING" && mode === "building")) makePreview();
  }, undefined, (e) => console.error("GLB load error:", key, entry.path, e));
}

// ----- PREVIEW -----
function makePreview() {
  if (preview) { scene.remove(preview); preview = null; }
  let key: ModelKey;
  if (mode === "house") key = "HOUSE"; else if (mode === "building") key = "BUILDING"; else key = piece as ModelKey;
  const M = MODELS[key];
  if (!M || !M.prefab) return; // model pas encore chargé
  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = 0.0006;
  obj.traverse((n: THREE.Object3D) => {
    const mesh = n as THREE.Mesh;
    if ((mesh as any).isMesh && mesh.material) {
      const baseMat = mesh.material as THREE.Material;
      const mat = baseMat.clone() as any;
      mat.transparent = true; mat.opacity = 0.5; mat.depthWrite = false;
      mesh.material = mat;
    }
  });
  obj.userData.isPreview = true;
  obj.visible = (mode === "road" || mode === "house" || mode === "building");
  preview = obj;
  scene.add(preview);
}
function updatePreviewRotation() {
  if (preview) preview.rotation.y = ANG[angleIndex];
}
function updatePreviewPosition(pos: any) {
  if (preview) { preview.position.set(pos.x, 0.0006, pos.z); }
}

// ====== plaques de sol grises ======
const plateGeo = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
const plateMatHouse = new THREE.MeshBasicMaterial({ color: 0x777777 });
const plateMatBuild = new THREE.MeshBasicMaterial({ color: 0x666666 });
function addGroundPlate(x: number, z: number, forKind: any) {
  const mat = forKind === "house" ? plateMatHouse : plateMatBuild;
  const g = new THREE.Mesh(plateGeo.clone(), mat);
  g.position.set(x, -0.001, z);
  scene.add(g);
  return g;
}
function removeGroundPlate(plate: any) {
  if (!plate) return;
  scene.remove(plate);
  plate.geometry.dispose();
}

// ----- création d’un objet placé -----
function buildPlacedObject(kind: string) {
  let key: ModelKey;
  if (kind === "house") key = "HOUSE"; else if (kind === "building") key = "BUILDING"; else key = piece as ModelKey;
  const M = MODELS[key];
  if (!M || !M.prefab) return null;
  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = 0.0005;
  obj.userData = {
    cost: kind === "house" ? HOUSE_COST : kind === "building" ? BUILDING_COST : ROAD_COST,
    kind, piece, angle: angleIndex,
    groundPlate: null
  };
  return obj;
}

// ----- placement/suppression -----
const roads = new Map();
const houses = new Map();
const buildings = new Map();
function keyFromCenter(wx: any, wz: any) {
  return `${wx}:${wz}`;
}

// voisinage 4
function hasAdjacentRoad(wx: any, wz: any) {
  return (
    roads.has(keyFromCenter(wx + CELL, wz)) ||
    roads.has(keyFromCenter(wx - CELL, wz)) ||
    roads.has(keyFromCenter(wx, wz + CELL)) ||
    roads.has(keyFromCenter(wx, wz - CELL))
  );
}

let lastPlaceError = "";

function placeRoad(wx: any, wz: any) {
  if (money < ROAD_COST) { lastPlaceError = "money"; return false; }
  const id = keyFromCenter(wx, wz); if (roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError = "occupied"; return false; }
  const obj = buildPlacedObject("road"); if (!obj) { lastPlaceError = "model"; return false; }
  obj.position.set(wx, 0.0005, wz);
  scene.add(obj);
  roads.set(id, obj);
  money -= ROAD_COST; renderMoney(); showSpend(ROAD_COST);
  lastPlaceError = "";
  return true;
}

function placeHouse(wx: any, wz: any) {
  if (money < HOUSE_COST) { lastPlaceError = "money"; return false; }
  const id = keyFromCenter(wx, wz);
  if (roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError = "occupied"; return false; }
  if (!hasAdjacentRoad(wx, wz)) { lastPlaceError = "no_road"; return false; }
  const obj = buildPlacedObject("house"); if (!obj) { lastPlaceError = "model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "house");

  obj.position.set(wx, 0.0005, wz);
  scene.add(obj);
  houses.set(id, obj);
  money -= HOUSE_COST; renderMoney(); showSpend(HOUSE_COST);
  lastPlaceError = "";
  return true;
}

function placeBuilding(wx: any, wz: any) {
  if (money < BUILDING_COST) { lastPlaceError = "money"; return false; }
  const id = keyFromCenter(wx, wz);
  if (roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError = "occupied"; return false; }
  if (!hasAdjacentRoad(wx, wz)) { lastPlaceError = "no_road"; return false; }
  const obj = buildPlacedObject("building"); if (!obj) { lastPlaceError = "model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "building");

  obj.position.set(wx, 0.0005, wz);
  scene.add(obj);
  buildings.set(id, obj);
  money -= BUILDING_COST; renderMoney(); showSpend(BUILDING_COST);
  lastPlaceError = "";
  return true;
}

function eraseAtPointer(event: any) {
  if (overUI(event)) return;
  mouse.x = (event.clientX / innerWidth) * 2 - 1; mouse.y = -(event.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const pool = [...roads.values(), ...houses.values(), ...buildings.values()];
  const hits = raycaster.intersectObjects(pool, true); if (!hits.length) return;
  let node = hits[0].object, root = null;
  for (; ;) {
    if (pool.includes(node)) { root = node; break; }
    if (!node.parent || node.parent === scene) break; node = node.parent;
  }
  if (!root) return;
  let hitKey = null, bag = null;
  for (const [k, m] of roads.entries()) if (m === root) { hitKey = k; bag = roads; break; }
  if (!hitKey) for (const [k, m] of houses.entries()) if (m === root) { hitKey = k; bag = houses; break; }
  if (!hitKey) for (const [k, m] of buildings.entries()) if (m === root) { hitKey = k; bag = buildings; break; }
  if (!hitKey) return;

  removeGroundPlate(root.userData?.groundPlate);

  scene.remove(root);
  root.traverse((n: THREE.Object3D) => {
    const mesh = n as THREE.Mesh;
    if ((mesh as any).isMesh) {
      (mesh.geometry as any)?.dispose();
      const mat: any = mesh.material;
      if (mat?.map) mat.map.dispose();
      mat?.dispose?.();
    }
  });
  if (bag) bag.delete(hitKey as any);
  // Remboursement : route 100%, maison / building 50%
  const full = root.userData?.cost ?? 0;
  let refund = full;
  if (root.userData?.kind === 'house' || root.userData?.kind === 'building') {
    refund = Math.round(full * 0.5);
  }
  money += refund; renderMoney();
  if (refund > 0) showRefund(refund);
}

// ----- interactions -----
let painting = false;
let lastPointerEvent: any = null;

// Annulation du mode placement / prévisualisation
function cancelPlacement(showMsg = true) {
  if (preview) { scene.remove(preview); preview = null; }
  if (cursor) cursor.visible = false;
  painting = false;
  setActive("pan");
  if (showMsg) showToast("Placement annulé");
}

addEventListener("pointermove", e => {
  lastPointerEvent = e;
  if (overUI(e)) { if (cursor) cursor.visible = false; if (preview) preview.visible = false; return; }
  const p = screenToGround(e); if (!p) { if (cursor) cursor.visible = false; if (preview) preview.visible = false; return; }
  const s = snapToCell(p);
  if (cursor) { cursor.visible = (mode !== "pan"); cursor.position.set(s.x, 0.001, s.z); }
  if (preview) {
    if (mode === "road" || mode === "house" || mode === "building" || mode === 'bulldozer') {
      preview.visible = true;
      updatePreviewPosition(s);
      if (mode !== 'bulldozer') updatePreviewRotation();
    } else {
      preview.visible = false;
    }
  }
  if (mode === "road" && painting) placeRoad(s.x, s.z);
  if (mode === "house" && painting) placeHouse(s.x, s.z);
  if (mode === "building" && painting) placeBuilding(s.x, s.z);
  if (mode === "bulldozer" && painting) eraseAtPointer(e);
});

addEventListener("pointerdown", e => {
  if (overUI(e)) return;
  if (e.button === 0) {
    if (mode === "road" || mode === "house" || mode === "building") {
      const p = screenToGround(e); if (!p) return; const s = snapToCell(p);
      painting = true;
      let ok = false;
      if (mode === "road") ok = placeRoad(s.x, s.z);
      if (mode === "house") ok = placeHouse(s.x, s.z);
      if (mode === "building") ok = placeBuilding(s.x, s.z);
      if (!ok && (mode === "house" || mode === "building") && lastPlaceError === "no_road") {
        showToast("Besoin d’une route adjacente pour placer ici");
      }
    } else if (mode === "bulldozer") { painting = true; eraseAtPointer(e); }
  } else if (e.button === 2) {
    // Clic droit : annule si on est dans un mode de placement ou bulldozer
    if (mode === "road" || mode === "house" || mode === "building") {
      e.preventDefault();
      cancelPlacement();
    } else if (mode === "bulldozer") {
      e.preventDefault();
      setActive("pan");
      showToast("Bulldozer annulé");
    } else {
      e.preventDefault(); // on supprime menu contextuel tout de même
    }
  }
});
addEventListener("pointerup", () => painting = false);
addEventListener("contextmenu", e => e.preventDefault());

// ----- init -----
makePreview();
setActive("pan");

// ----- zoom + resize + loop -----
addEventListener("wheel", () => {
  camera.zoom = THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
});
addEventListener("resize", () => { setOrtho(camera); renderer.setSize(innerWidth, innerHeight); });

// ----- boucle anim + FPS -----
let frames = 0, t0 = performance.now();
function tick() {
  stats.begin();

  updateGrid();
  controls.update();
  renderer.render(scene, camera);

  stats.end();

  frames++;
  const now = performance.now();
  if (now - t0 >= 500) {
    const fps = Math.round(frames * 1000 / (now - t0));
    fpsHud.textContent = `${fps} FPS`;
    frames = 0; t0 = now;
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
