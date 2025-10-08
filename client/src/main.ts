// ===== imports =====
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

import URL_STREET_L from "../texture_models/Roads/StreetCorner.glb?url";
import URL_STREET_I from "../texture_models/Roads/StreetStraight.glb?url";
import URL_STREET_X from "../texture_models/Roads/Crosswalk.glb?url";
import URL_HOUSE    from "../texture_models/Buildings/House.glb?url";
import URL_BUILDING from "../texture_models/Buildings/Building.glb?url";

import URL_CHAR_W1 from "../texture_models/character/AnimatedWoman.glb?url";
import URL_CHAR_W2 from "../texture_models/character/AnimatedWoman2.glb?url";
import URL_CHAR_BM from "../texture_models/character/BusinessMan.glb?url";
import URL_CHAR_HD from "../texture_models/character/HoodieCharacter.glb?url";

import * as UI from "./ui";

// Init
UI.init();

// ----- paramètres -----
const TILE_SIZE = 2;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const CELL = 3 * TILE_SIZE;

const ROAD_COST = 200;
const HOUSE_COST = 1200;
const BUILDING_COST = 5000;
// Pourcentage de remboursement universel
const REFUND_RATIO = 0.5; // 50%

// === trame unique ===
const STEP = CELL;
const align = (v:number)=> Math.floor(v / STEP) * STEP;

// === niveaux (du bas vers le haut) ===
const Z_GROUND  = -0.002;
const Z_GRID    =  0.0002;
const Z_ROAD    =  0.0005;
const Z_PREVIEW =  0.0008;
const Z_CURSOR  =  0.0012;

// ----- scène -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x55aa55);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(50,100,50); scene.add(sun); scene.add(sun.target);

// ----- caméra -----
function setOrtho(cam: any){
  const a = innerWidth/innerHeight;
  cam.left=-a*viewSize/2; cam.right=a*viewSize/2; cam.top=viewSize/2; cam.bottom=-viewSize/2;
  cam.updateProjectionMatrix();
}
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,2000);
const CAM_TARGET = new THREE.Vector3(0,0,0);   // cible de rotation
camera.position.set(30,30,30);
camera.lookAt(CAM_TARGET);
camera.zoom=1; setOrtho(camera);

// ----- rendu -----
const renderer = new THREE.WebGLRenderer({ antialias:true });
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

// ===== toast =====
const toast = document.createElement("div");
Object.assign(toast.style, {
  position:"fixed", top:"64px", left:"50%", transform:"translateX(-50%)",
  padding:"6px 10px", border:"1px solid #222", borderRadius:"8px",
  background:"rgba(255,255,255,0.95)", fontFamily:"system-ui, sans-serif",
  fontSize:"14px", color:"#111", boxShadow:"0 2px 8px rgba(0,0,0,0.15)",
  pointerEvents:"none", zIndex:"10000", opacity:"0", transition:"opacity .15s"
});
toast.className = "ui";
document.body.appendChild(toast);
let toastT:any=null;
function showToast(msg:any){
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
const fmtEUR = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
function renderMoney(){ hud.textContent = fmtEUR.format(money); }
renderMoney();

// ===== Outils =====
let mode = "pan";
let cursor:any = null;
let preview:any = null;

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
  document.body.style.cursor = (m==="road"||m==="house"||m==="building")?"crosshair":m==="bulldozer"?"not-allowed":"default";
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
    // Mode bulldozer: pas de preview séparée pour éviter double overlay, seul le curseur (rouge) sert de feedback
    if (preview) { scene.remove(preview); preview = null; }
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
addEventListener("keydown", (e)=>{
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
controls.enableRotate=false; controls.screenSpacePanning=true; controls.enableDamping=true;
controls.mouseButtons.LEFT=null; controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
controls.addEventListener("change",()=> camera.position.y=Math.max(camera.position.y,1));
controls.target.copy(CAM_TARGET);  // important

// rotation 90° autour de la cible
let camRotAnim: { t0:number; dur:number; a0:number; a1:number; R:number; y:number } | null = null;
let camYawIndex = 0;

function easeInOutCubic(x:number){ return x<0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2; }

function rotateCameraQuarter(dir: 1 | -1, duration=300){
  if (camRotAnim) return;                    // ignore si anim en cours
  camYawIndex = (camYawIndex + (dir===1?1:3)) & 3;

  const t = controls.target;
  const v = camera.position.clone().sub(t);
  const a0 = Math.atan2(v.x, v.z);           // angle actuel
  const a1 = a0 + dir * Math.PI/2;           // +90° / -90°
  const R  = Math.hypot(v.x, v.z);           // rayon
  camRotAnim = { t0: performance.now(), dur: duration, a0, a1, R, y: camera.position.y };
}

function stepCameraRotation(now:number){
  if(!camRotAnim) return;
  const { t0, dur, a0, a1, R, y } = camRotAnim;
  const k = Math.min(1, (now - t0) / dur);
  const e = easeInOutCubic(k);
  const a = a0 + (a1 - a0) * e;
  const t = controls.target;

  const x = t.x + Math.sin(a) * R;
  const z = t.z + Math.cos(a) * R;
  camera.position.set(x, y, z);
  camera.up.set(0,1,0);
  camera.lookAt(t);
  controls.update();

  if (k >= 1) camRotAnim = null;
}
addEventListener("keydown",(e)=>{
  if(e.key==='q'||e.key==='Q'){ e.preventDefault(); rotateCameraQuarter(-1, 300); }
  if(e.key==='e'||e.key==='E'){ e.preventDefault(); rotateCameraQuarter(+1, 300); }
});

// ----- grille + sol -----
const GRID_DIV = 800;                         // pair
const GRID_SIZE = GRID_DIV * STEP;
const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIV, 0x000000, 0x000000);
(grid.material as any).transparent=true;
(grid.material as any).opacity=0.35;
(grid.material as any).depthWrite=false;
(grid.material as any).depthTest=true;
grid.renderOrder=1; scene.add(grid);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(4096,4096), new THREE.MeshBasicMaterial({color:0x55aa55}));
ground.rotation.x=-Math.PI/2;
ground.position.y=Z_GROUND;
scene.add(ground);

// grille sur bords des cases, à Z_GRID
function updateGrid(){
  grid.position.set( align(camera.position.x), Z_GRID, align(camera.position.z) );
  grid.rotation.x = 0;
}

// ----- Raycast & snap -----
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
function screenToGround(e:any){
  mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera); const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p)?p.clone():null;
}
function overUI(e:any){ return !!(e && e.target && (e.target as HTMLElement).closest(".ui")); }

// objets centrés dans les carrés
function snapToCell(v:any){
  const x = align(v.x) + STEP*0.5;
  const z = align(v.z) + STEP*0.5;
  return new THREE.Vector3(x, 0, z);
}

// ----- orientation via A -----
let angleIndex = 0;
const ANG = [0, Math.PI/2, Math.PI, -Math.PI/2];
addEventListener("keydown",(e)=>{
  if((e.key==="a"||e.key==="A") && (mode==="road"||mode==="house"||mode==="building")){
    e.preventDefault(); angleIndex=(angleIndex+1)&3; updateCursorOrient(); updatePreviewRotation();
  }
});

// ----- curseur -----
const GEO_PLACEMENT = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI/2);
function makeCursor(){
  if (cursor) scene.remove(cursor);
  const geo = GEO_PLACEMENT.clone();
  cursor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xffff00, transparent:true, opacity:0.25 }));
  cursor.position.y = Z_CURSOR;
  cursor.visible=false; scene.add(cursor);
}
function updateCursor(resizeOnly=false){ if(!cursor||resizeOnly) makeCursor(); updateCursorOrient(); }
function updateCursorOrient(){ if(cursor) cursor.rotation.y = ANG[angleIndex]; }
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

type CharEntry = {
  path: string;
  prefab: THREE.Object3D | null;
  // échelle d'origine du root du GLB (certains ≠ 1)
  baseScale: THREE.Vector3;
  // facteur de normalisation vers une taille humaine cible
  normScale: number;
  // offset Y pour poser les pieds au sol (après normalisation)
  footOffset: number;
};

const CHAR_MODELS: CharEntry[] = [
  { path: URL_CHAR_W1, prefab: null, baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_CHAR_W2, prefab: null, baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_CHAR_BM, prefab: null, baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_CHAR_HD, prefab: null, baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
];

const TARGET_H = 0.70;     // taille humaine cible dans ta scène
const FOOT_EPS  = 0.002;   // anti z-fighting

for (const C of CHAR_MODELS) {
  gltfLoader.load(
    C.path,
    (g:any) => {
      const root: THREE.Object3D = g.scene;
      root.updateWorldMatrix(true, true);

      // mémorise l’échelle d’origine du root
      C.baseScale = (root as any).scale?.clone?.() ?? new THREE.Vector3(1,1,1);

      // mesure la hauteur actuelle (avec échelle d’origine)
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(); box.getSize(size);
      const h = Math.max(1e-6, size.y);

      // facteur pour normaliser à TARGET_H
      C.normScale = TARGET_H / h;

      // offset pour poser les pieds sur y=0 après normalisation
      C.footOffset = -box.min.y * C.normScale + FOOT_EPS;

      root.traverse((o:any)=>{ if(o.isMesh){ o.castShadow = o.receiveShadow = true; }});
      C.prefab = root;
    },
    undefined,
    (e)=> console.error("GLB PNJ load error:", C.path, e)
  );
}

function pickChar(): CharEntry | null {
  const ready = CHAR_MODELS.filter(c => !!c.prefab);
  if (!ready.length) return null;
  return ready[(Math.random() * ready.length) | 0];
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
  obj.visible = (mode==="road"||mode==="house"||mode==="building");
  preview = obj;
  scene.add(preview);
}
function updatePreviewRotation(){ if(preview) preview.rotation.y = ANG[angleIndex]; }
function updatePreviewPosition(pos:any){ if(preview){ preview.position.set(pos.x, Z_PREVIEW, pos.z); } }

// ====== plaques de sol ======
const PLATE_INSET = 0; // 0 = couvre toute la case. Mets >0 pour laisser un liseré vert
const plateGeo = new THREE.PlaneGeometry(CELL - 2*PLATE_INSET, CELL - 2*PLATE_INSET)
  .rotateX(-Math.PI/2);

// polygonOffset évite le z-fighting avec le sol
const plateMatHouse = new THREE.MeshBasicMaterial({
  color: 0x777777, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
});
const plateMatBuild = new THREE.MeshBasicMaterial({
  color: 0x666666, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
});

function addGroundPlate(x:number, z:number, forKind:any){
  const mat = forKind==="house" ? plateMatHouse : plateMatBuild;
  const g = new THREE.Mesh(plateGeo.clone(), mat);
  g.position.set(x, Z_GROUND + 0.0003, z); 
  g.renderOrder = 0;                        
  scene.add(g);
  return g;
}
function removeGroundPlate(plate:any){
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
  obj.position.y = Z_ROAD;
  obj.userData = {
    cost: kind==="house" ? HOUSE_COST : kind==="building" ? BUILDING_COST : ROAD_COST,
    kind, piece, angle: angleIndex,
    groundPlate: null
  };
  return obj;
}

// ----- placement/suppression -----
const roads    = new Map<string,THREE.Object3D>();
const houses   = new Map<string,THREE.Object3D>();
const buildings= new Map<string,THREE.Object3D>();
function keyFromCenter(wx:any,wz:any){ return `${wx}:${wz}`; }

function hasAdjacentRoad(wx:any,wz:any){
  return (
    roads.has(keyFromCenter(wx + CELL, wz)) ||
    roads.has(keyFromCenter(wx - CELL, wz)) ||
    roads.has(keyFromCenter(wx, wz + CELL)) ||
    roads.has(keyFromCenter(wx, wz - CELL))
  );
}

// ====== CITOYENS (AJOUT) ======
const citizensByLot = new Map<string, THREE.Object3D[]>();

function facingDirFromAngle(idx:number){
  return idx===0 ? {dx:0,dz:1} : idx===1 ? {dx:1,dz:0} : idx===2 ? {dx:0,dz:-1} : {dx:-1,dz:0};
}

function chooseFrontRoad(wx:number, wz:number, angleIdx:number){
  const f = facingDirFromAngle(angleIdx);
  const frontKey = `${wx + f.dx*CELL}:${wz + f.dz*CELL}`;
  if (roads.has(frontKey)) return {dx:f.dx, dz:f.dz};
  if (roads.has(`${wx + CELL}:${wz}`)) return {dx:1, dz:0};
  if (roads.has(`${wx - CELL}:${wz}`)) return {dx:-1, dz:0};
  if (roads.has(`${wx}:${wz + CELL}`)) return {dx:0, dz:1};
  if (roads.has(`${wx}:${wz - CELL}`)) return {dx:0, dz:-1};
  return null;
}

function spawnCitizensForLot(lotId:string, kind:"house"|"building", wx:number, wz:number, angleIdx:number){
  const dir = chooseFrontRoad(wx, wz, angleIdx);
  if (!dir) return;

  const count = kind==="house" ? (1 + Math.floor(Math.random()*3)) : (1 + Math.floor(Math.random()*6));
  const frontOffset = (CELL/2) - 0.55; // un peu plus côté bâtiment
const sideStep = 0.45;               // un peu plus d’écart latéral
  const side = { dx: dir.dz, dz: -dir.dx };
  const startIndex = -Math.floor((count-1)/2);

  const list: THREE.Object3D[] = [];
  for (let i=0;i<count;i++){
    const choice = pickChar();
if (!choice || !choice.prefab) continue;
const m = choice.prefab.clone(true);

// applique: échelle d’origine * normalisation
m.scale.copy(choice.baseScale).multiplyScalar(choice.normScale);

// position: bord du lot, pieds au sol
const px = wx + dir.dx*frontOffset + side.dx*(startIndex+i)*sideStep;
const pz = wz + dir.dz*frontOffset + side.dz*(startIndex+i)*sideStep;
const py = Z_ROAD + choice.footOffset;
m.position.set(px, py, pz);

// face à la route
m.lookAt(px + dir.dx, py, pz + dir.dz);
scene.add(m);
list.push(m);
  }
  citizensByLot.set(lotId, list);
}

function removeCitizensOfLot(lotId:string){
  const arr = citizensByLot.get(lotId);
  if (!arr) return;
  for(const c of arr){
    scene.remove(c);
    c.traverse((n:any)=>{
      if(n.isMesh){
        n.geometry?.dispose?.();
        const mat:any = n.material;
        if (mat?.map) mat.map.dispose();
        mat?.dispose?.();
      }
    });
  }
  citizensByLot.delete(lotId);
}
let lastPlaceError = "";

function placeRoad(wx:any,wz:any){
  if (money < ROAD_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz); if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  const obj = buildPlacedObject("road"); if(!obj) { lastPlaceError="model"; return false; }
  obj.position.set(wx,Z_ROAD,wz);
  scene.add(obj);
  roads.set(id, obj);
  money -= ROAD_COST; renderMoney(); showSpend(ROAD_COST);
  lastPlaceError = "";
  return true;
}

function placeHouse(wx:any,wz:any){
  if (money < HOUSE_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz);
  if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx,wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("house"); if(!obj) { lastPlaceError="model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "house");

  obj.position.set(wx,Z_ROAD,wz);
  scene.add(obj);
  houses.set(id, obj);

  // AJOUT citoyens gratuits
  spawnCitizensForLot(id, "house", wx, wz, obj.userData.angle ?? 0);

  money -= HOUSE_COST; renderMoney(); showSpend(HOUSE_COST);
  lastPlaceError = "";
  return true;
}

function placeBuilding(wx:any,wz:any){
  if (money < BUILDING_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz);
  if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx,wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("building"); if(!obj) { lastPlaceError="model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "building");

  obj.position.set(wx,Z_ROAD,wz);
  scene.add(obj);
  buildings.set(id, obj);

  // AJOUT citoyens gratuits
  spawnCitizensForLot(id, "building", wx, wz, obj.userData.angle ?? 0);

  money -= BUILDING_COST; renderMoney(); showSpend(BUILDING_COST);
  lastPlaceError = "";
  return true;
}

function eraseAtPointer(event:any){
  if (overUI(event)) return;
  mouse.x=(event.clientX/innerWidth)*2-1; mouse.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const pool = [...roads.values(), ...houses.values(), ...buildings.values()];
  const hits=raycaster.intersectObjects(pool, true); if(!hits.length) return;
  let node:any = hits[0].object, root:any = null;
  for(;;){
    if (pool.includes(node)) { root=node; break; }
    if (!node.parent||node.parent===scene) break; node=node.parent;
  }
  if(!root) return;
  let hitKey:any=null, bag:any=null, kind:'road'|'house'|'building'|null=null;
  for(const [k,m] of roads.entries())      if(m===root){ hitKey=k; bag=roads;      kind='road';      break; }
  if(!hitKey) for(const [k,m] of houses.entries())    if(m===root){ hitKey=k; bag=houses;    kind='house';     break; }
  if(!hitKey) for(const [k,m] of buildings.entries()) if(m===root){ hitKey=k; bag=buildings; kind='building';  break; }
  if(!hitKey) return;

  // AJOUT: supprimer citoyens liés si maison/immeuble
  if (kind==='house' || kind==='building') removeCitizensOfLot(hitKey);

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
  // Remboursement universel basé sur REFUND_RATIO
  const full = root.userData?.cost ?? 0;
  const refund = Math.round(full * REFUND_RATIO);
  if (refund > 0 && full > 0) {
    money += refund;
    renderMoney();
    showRefund(refund);
    // Debug (désactive si inutile)
    // console.debug(`[REFUND] kind=${root.userData?.kind} cost=${full} refund=${refund}`);
  }
}

// ----- interactions -----
let painting=false;
let lastPointerEvent:any = null;

function cancelPlacement(showMsg=true){
  if (preview) { scene.remove(preview); preview = null; }
  if (cursor) cursor.visible = false;
  painting = false;
  setActive("pan");
  if (showMsg) showToast("Placement annulé");
}

addEventListener("pointermove", e=>{
  lastPointerEvent = e;
  if (overUI(e)) { if (cursor) cursor.visible = false; if (preview) preview.visible = false; return; }
  const p = screenToGround(e); if (!p) { if (cursor) cursor.visible = false; if (preview) preview.visible = false; return; }
  const s = snapToCell(p);
  if (cursor) { cursor.visible = (mode !== "pan"); cursor.position.set(s.x, 0.001, s.z); }
  if (preview) {
    if (mode === "road" || mode === "house" || mode === "building") {
      preview.visible = true;
      updatePreviewPosition(s);
      updatePreviewRotation();
    } else {
      preview.visible = false;
    }
  }
  if (mode === "road" && painting) placeRoad(s.x, s.z);
  if (mode === "house" && painting) placeHouse(s.x, s.z);
  if (mode === "building" && painting) placeBuilding(s.x, s.z);
  if (mode === "bulldozer" && painting) eraseAtPointer(e);
});

addEventListener("pointerdown", e=>{
  if (overUI(e)) return;
  if(e.button===0){
    if(mode==="road"||mode==="house"||mode==="building"){
      const p=screenToGround(e); if(!p) return; const s=snapToCell(p);
      painting=true;
      let ok=false;
      if(mode==="road")      ok = placeRoad(s.x,s.z);
      if(mode==="house")     ok = placeHouse(s.x,s.z);
      if(mode==="building")  ok = placeBuilding(s.x,s.z);
      if(!ok && (mode==="house"||mode==="building") && lastPlaceError==="no_road"){
        showToast("Besoin d’une route adjacente pour placer ici");
      }
    } else if(mode==="bulldozer"){ painting=true; eraseAtPointer(e); }
  } else if(e.button===2){
    if (mode === "road" || mode === "house" || mode === "building") {
      e.preventDefault(); cancelPlacement();
    } else if (mode === "bulldozer") {
      e.preventDefault(); setActive("pan"); showToast("Bulldozer annulé");
    } else {
      e.preventDefault();
    }
  }
});
addEventListener("pointerup", ()=> painting=false);
addEventListener("contextmenu", e=> e.preventDefault());

// ----- init -----
makePreview();
setActive("pan");

// ----- zoom + resize + loop -----
addEventListener("wheel", ()=>{
  camera.zoom=THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
});
addEventListener("resize", ()=>{ setOrtho(camera); renderer.setSize(innerWidth, innerHeight); });

// ----- boucle anim + FPS -----
let frames = 0, t0 = performance.now();
function tick(){
  stats.begin();
  stepCameraRotation(performance.now()); // << ajoute ceci
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
