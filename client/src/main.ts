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
import URL_WELL     from "../texture_models/Buildings/Well.glb?url";
import URL_TURBINE  from "../texture_models/Buildings/WindTurbine.glb?url";
import URL_SAWMILL  from "../texture_models/Buildings/FantasySawmill.glb?url";import URL_ANIMATED_WOMAN from "../texture_models/character/AnimatedWoman.glb?url";
import URL_ANIMATED_WOMAN_2 from "../texture_models/character/AnimatedWoman2.glb?url";
import URL_BUSINESSMAN from "../texture_models/character/BusinessMan.glb?url";
import URL_HOODIE_CHARACTER from "../texture_models/character/HoodieCharacter.glb?url";
// Import utilitaire pour cloner les modèles skinnés
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as UI from "./ui";

// Init
UI.init();

// ----- paramètres -----
const TILE_SIZE = 2;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const CELL = 3 * TILE_SIZE;

const ROAD_COST = 200;
const WELL_COST = 800;
const SAWMILL_COST = 1000;
const HOUSE_COST = 1200;
const TURBINE_COST = 1500;
const BUILDING_COST = 5000;


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

// ===== HUD Argent et Ressources =====
let money = 200000;
const hud = document.getElementById("money-hud") as HTMLElement;
const fmtEUR = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
function renderMoney(){ if(hud) hud.textContent = fmtEUR.format(money); }
renderMoney();

// ----- ressources -----
let resources = { power: 0, water: 0, food: 0, wood: 0 };
let production = { power: 0, water: 0, food: 0, wood: 0 };

const resHud = document.getElementById("res-hud") as HTMLElement;

function updateRes(){
  const p = document.getElementById("r-power");
  const w = document.getElementById("r-water");
  const f = document.getElementById("r-food");
  const wd = document.getElementById("r-wood");
  if(p) p.textContent = String(resources.power);
  if(w) w.textContent = String(resources.water);
  if(f) f.textContent = String(resources.food);
  if(wd) wd.textContent = String(resources.wood);
}
updateRes();

// ===== Outils =====
type Mode = "pan" | "road" | "house" | "building" | "bulldozer" | "well" | "turbine" | "sawmill";
let mode: Mode = "pan";
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
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
(controls.mouseButtons as any).LEFT = undefined;
(controls.mouseButtons as any).RIGHT = THREE.MOUSE.PAN;
controls.mouseButtons.LEFT=null; 
controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
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
  if(e.key==="1"){ setActive("well");     showToast("Puits"); }
  if(e.key==="2"){ setActive("turbine");  showToast("Éolienne"); }
  if(e.key==="3"){ setActive("sawmill");  showToast("Scierie"); }
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

type ModelKey = "I"|"L"|"X"|"HOUSE"|"BUILDING"|"WELL"|"TURBINE"|"SAWMILL";
interface ModelEntry {
  path:string;
  prefab:THREE.Object3D|null;
  scale:THREE.Vector3;
  target:[number,number];
  scaleMul:number;     // multiplicateur final
  baseLift:number;     // offset Y pour poser au sol après scale
}

const MODELS: Record<ModelKey, ModelEntry> = {
  I:{path:URL_STREET_I,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  L:{path:URL_STREET_L,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  X:{path:URL_STREET_X,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  HOUSE:{path:URL_HOUSE,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  BUILDING:{path:URL_BUILDING,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  WELL:{path:URL_WELL,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.40, baseLift:0},
  TURBINE:{path:URL_TURBINE,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.55, baseLift:0},
  SAWMILL:{path:URL_SAWMILL,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.85, baseLift:0},
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

// applique le multiplicateur global
entry.scale.set(sX * entry.scaleMul, sY * entry.scaleMul, sZ * entry.scaleMul);

// calcule le lift pour poser les pieds au sol après scale
entry.baseLift = (-box.min.y) * entry.scale.y;

// enregistre le prefab
entry.prefab = root;
    if ((key === piece) || (key === "HOUSE" && mode === "house") || (key === "BUILDING" && mode === "building")) makePreview();
  }, undefined, (e) => console.error("GLB load error:", key, entry.path, e));
}

type CharEntry = {
  path: string;
  prefab: THREE.Object3D | null;
  // clips d'animation extraits du GLB
  clips: THREE.AnimationClip[];
  // échelle d'origine du root du GLB (certains ≠ 1)
  baseScale: THREE.Vector3;
  // facteur de normalisation vers une taille humaine cible
  normScale: number;
  // offset Y pour poser les pieds au sol (après normalisation)
  footOffset: number;
};

const CHAR_MODELS: CharEntry[] = [
  { path: URL_ANIMATED_WOMAN, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_ANIMATED_WOMAN_2, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_BUSINESSMAN, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_HOODIE_CHARACTER, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
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
      C.clips = g.animations || [];
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

function pickWalkClip(entry: CharEntry): THREE.AnimationClip | null {
  if (!entry.clips.length) return null;
  // cherche clip contenant "walk" ou "Walk"
  const clip = entry.clips.find(c => /walk/i.test(c.name)) || entry.clips[0];
  return clip || null;
}

// ----- PREVIEW -----
function makePreview() {
  if (preview) { scene.remove(preview); preview = null; }

  let key: ModelKey;
  if (mode === "house") key = "HOUSE";
  else if (mode === "building") key = "BUILDING";
  else if (mode === "well") key = "WELL";
  else if (mode === "turbine") key = "TURBINE";
  else if (mode === "sawmill") key = "SAWMILL";
  else key = piece as ModelKey;

  const M = MODELS[key];
  if (!M || !M.prefab) return;

  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = Z_PREVIEW + M.baseLift;
  obj.userData.baseLift = M.baseLift;
  obj.traverse((n: any) => {
    if (n.isMesh && n.material) {
      const m = n.material.clone(); m.transparent = true; m.opacity = 0.5; m.depthWrite = false;
      n.material = m;
    }
  });
  obj.visible = (mode !== "pan");
  preview = obj;
  scene.add(preview);
}
function updatePreviewRotation(){ if(preview) preview.rotation.y = ANG[angleIndex]; }
function updatePreviewPosition(pos:any){
  if (!preview) return;
  const lift = preview.userData?.baseLift || 0;
  preview.position.set(pos.x, Z_PREVIEW + lift, pos.z);
}

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
  (plate.material as THREE.Material).dispose();
}

// ----- création d’un objet placé -----
function buildPlacedObject(kind: "road"|"house"|"building"|"well"|"turbine"|"sawmill") {
  let key: ModelKey =
    kind==="house"    ? "HOUSE" :
    kind==="building" ? "BUILDING" :
    kind==="well"     ? "WELL" :
    kind==="turbine"  ? "TURBINE" :
    kind==="sawmill"  ? "SAWMILL" :
    (piece as ModelKey);

  const M = MODELS[key];
  if (!M || !M.prefab) return null;

  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = Z_ROAD + M.baseLift;


  const cost =
    kind==="house"    ? HOUSE_COST :
    kind==="building" ? BUILDING_COST :
    kind==="well"     ? WELL_COST :
    kind==="turbine"  ? TURBINE_COST :
    kind==="sawmill"  ? SAWMILL_COST : ROAD_COST;

  obj.userData = { cost, kind, piece, angle: angleIndex, groundPlate: null };
  return obj;
}


// ----- placement/suppression -----
const roads    = new Map<string,THREE.Object3D>();
const houses   = new Map<string,THREE.Object3D>();
const buildings= new Map<string,THREE.Object3D>();
const wells    = new Map<string,THREE.Object3D>();
const turbines = new Map<string,THREE.Object3D>();
const sawmills = new Map<string,THREE.Object3D>();
// ====== Ajout des bâtiments manquants : Well, Turbine, Sawmill ======
function placeWell(wx:number, wz:number){
  if (money < WELL_COST) { lastPlaceError="money"; return false; }
  const id = keyFromCenter(wx, wz);
  if (roads.has(id)||houses.has(id)||buildings.has(id)||wells.has(id)||turbines.has(id)||sawmills.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx, wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("well"); if(!obj){ lastPlaceError="model"; return false; }
  obj.position.set(wx, obj.position.y, wz);
  scene.add(obj);
  wells.set(id, obj);
  money -= WELL_COST; renderMoney(); showSpend(WELL_COST);
  resources.water += 10; updateRes();
  lastPlaceError=""; return true;
}

function placeTurbine(wx:number, wz:number){
  if (money < TURBINE_COST) { lastPlaceError="money"; return false; }
  const id = keyFromCenter(wx, wz);
  if (roads.has(id)||houses.has(id)||buildings.has(id)||wells.has(id)||turbines.has(id)||sawmills.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx, wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("turbine"); if(!obj){ lastPlaceError="model"; return false; }
  obj.position.set(wx, Z_ROAD, wz);
  scene.add(obj);
  turbines.set(id, obj);
  money -= TURBINE_COST; renderMoney(); showSpend(TURBINE_COST);
  resources.power += 10; updateRes();
  lastPlaceError=""; return true;
}

function placeSawmill(wx:number, wz:number){
  if (money < SAWMILL_COST) { lastPlaceError="money"; return false; }
  const id = keyFromCenter(wx, wz);
  if (roads.has(id)||houses.has(id)||buildings.has(id)||wells.has(id)||turbines.has(id)||sawmills.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx, wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("sawmill"); if(!obj){ lastPlaceError="model"; return false; }
  obj.position.set(wx, Z_ROAD, wz);
  scene.add(obj);
  sawmills.set(id, obj);
  money -= SAWMILL_COST; renderMoney(); showSpend(SAWMILL_COST);
  resources.wood += 10; updateRes();
  lastPlaceError=""; return true;
}

function keyFromCenter(wx:any,wz:any){ return `${wx}:${wz}`; }

function hasAdjacentRoad(wx:any,wz:any){
  return (
    roads.has(keyFromCenter(wx + CELL, wz)) ||
    roads.has(keyFromCenter(wx - CELL, wz)) ||
    roads.has(keyFromCenter(wx, wz + CELL)) ||
    roads.has(keyFromCenter(wx, wz - CELL))
  );
}

// ====== PROMENEURS ANIMÉS ======
interface Walker {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  walkAction?: THREE.AnimationAction | null;
  dir: THREE.Vector3;          // direction linéaire (normalisée)
  speed: number;               // unités / sec
  life: number;                // temps restant (s)
  tileX: number;               // centre route courant (x)
  tileZ: number;               // centre route courant (z)
  axis: 'x'|'z';               // axe principal du déplacement
  lateralPhase: number;        // phase pour oscillation latérale
  lateralFreq: number;         // fréquence (rad/s)
  lateralAmp: number;          // amplitude max
  prevLat: number;             // précédent offset latéral appliqué
  perp: THREE.Vector3;         // vecteur perpendiculaire pour jitter
  state: 'walk' | 'turn' | 'idle';
  turnT: number;               // temps écoulé dans la rotation
  turnDur: number;             // durée de la rotation
  startQuat: THREE.Quaternion | null;
  endQuat: THREE.Quaternion | null;
  queuedDir: THREE.Vector3 | null; // nouvelle direction à appliquer quand turn fini
  baseSpeed: number;           // mémoire vitesse pour idle/turn
  idleT: number;               // temps écoulé idle
  idleDur: number;             // durée idle
}

const walkers: Walker[] = [];
const walkerPool: { obj: THREE.Object3D; mixer: THREE.AnimationMixer }[] = [];
const MAX_WALKERS = 40;
const MAX_POOL = 60;
let nextWalkerTime = performance.now() + 3000; // première apparition après 3s
const ROAD_EDGE_MARGIN = CELL*0.5 - 0.05;      // distance seuil avant changement de case
const BASE_WALK_ANIM_SPEED = 0.9;              // ratio vitesse => timeScale

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

function spawnWalker(){
  if (walkers.length >= MAX_WALKERS) return;
  // choisir un lot (maison ou immeuble) au hasard
  const sourceBag = Math.random()<0.6 ? houses : buildings; // bias vers maisons
  const entries = [...sourceBag.entries()];
  if (!entries.length) return;
  const [lotKey, lotObj] = entries[(Math.random()*entries.length)|0];
  const wxwz = lotKey.split(":").map(Number);
  const wx = wxwz[0]; const wz = wxwz[1];
  const angleIdx = lotObj.userData?.angle ?? 0;
  const front = chooseFrontRoad(wx, wz, angleIdx);
  if (!front) return; // pas de route adjacente

  const choice = pickChar();
  if (!choice || !choice.prefab) return;
  let baseObj: THREE.Object3D; let mixer: THREE.AnimationMixer;
  if (walkerPool.length){
    const reused = walkerPool.pop()!;
    baseObj = reused.obj;
    mixer = reused.mixer;
    // reset actions
    mixer.stopAllAction();
  } else {
    baseObj = SkeletonUtils.clone(choice.prefab);
    mixer = new THREE.AnimationMixer(baseObj);
  }
  const cloned = baseObj;
  // échelle normalisée
  cloned.scale.copy(choice.baseScale).multiplyScalar(choice.normScale);

  const frontOffset = (CELL/2) - 0.9; // sortir un peu plus loin
  // direction de marche = perpendiculaire à la route (droite/gauche)
  const side = Math.random()<0.5 ? new THREE.Vector3(front.dz,0,-front.dx) : new THREE.Vector3(-front.dz,0,front.dx);
  const px = wx + front.dx*frontOffset;
  const pz = wz + front.dz*frontOffset;
  const py = Z_ROAD + choice.footOffset;
  cloned.position.set(px, py, pz);
  // orientation: face dans la direction de déplacement (side)
  const lookTarget = cloned.position.clone().add(side);
  cloned.lookAt(lookTarget);
  scene.add(cloned);

  // animation
  const clip = pickWalkClip(choice);
  if (clip) {
    const action = mixer.clipAction(clip);
    action.reset();
    // vitesse choisie avant calibrage
  }

  const speed = 0.6 + Math.random()*0.6; // 0.6 à 1.2 u/s
  if (clip) {
    const action = mixer.clipAction(clip);
    action.timeScale = speed / BASE_WALK_ANIM_SPEED;
    action.play();
  }
  const life = 45 + Math.random()*55; // durée de vie 45-100s (plus longue car demi-tours)

  const axis: 'x'|'z' = Math.abs(side.x) > 0.1 ? 'x':'z';
  const tileX = wx + front.dx*CELL;
  const tileZ = wz + front.dz*CELL;
  const perp = new THREE.Vector3(-side.z,0,side.x); // perpendiculaire
  const lateralFreq = 1.5 + Math.random()*1.2;
  const lateralAmp = 0.18 + Math.random()*0.1;
  walkers.push({
    obj: cloned, mixer, walkAction: clip? mixer.clipAction(clip): null,
    dir: side.normalize(), speed, life, tileX, tileZ, axis,
    lateralPhase: Math.random()*Math.PI*2, lateralFreq, lateralAmp, prevLat:0, perp,
    state: 'walk', turnT:0, turnDur:0, startQuat:null, endQuat:null, queuedDir:null,
    baseSpeed: speed, idleT:0, idleDur:0
  });
}

function roadExistsAt(cx:number, cz:number){ return roads.has(keyFromCenter(cx, cz)); }

function recycleWalker(w:Walker){
  scene.remove(w.obj);
  if (walkerPool.length < MAX_POOL){
    walkerPool.push({ obj: w.obj, mixer: w.mixer });
  } else {
    // si pool plein: nettoyage lourd
    w.obj.traverse((n:any)=>{ if(n.isMesh){ n.geometry?.dispose?.(); const m:any = n.material; if(m?.map) m.map.dispose(); m?.dispose?.(); }});
  }
}

function updateWalkers(dt:number){
  // Si plus de maisons, supprimer tous les PNJ
  if (houses.size === 0 && walkers.length > 0) {
    for (let i = walkers.length - 1; i >= 0; i--) {
      recycleWalker(walkers[i]);
      walkers.splice(i, 1);
    }
    return;
  }
  if (dt <= 0) return;

  // helpers tournants / intersections
  function setupTurn(w:Walker, newDir:THREE.Vector3){
    w.state='turn';
    w.turnT=0; w.turnDur=0.38 + Math.random()*0.18; // 0.38-0.56s
    w.startQuat = w.obj.quaternion.clone();
    // orienter vers newDir pour endQuat
    const target = w.obj.position.clone().add(newDir);
    const tmp = new THREE.Object3D();
    tmp.position.copy(w.obj.position);
    tmp.lookAt(target);
    w.endQuat = tmp.quaternion.clone();
    w.queuedDir = newDir.clone().normalize();
    // ralentir l'animation pendant le virage
  if (w.walkAction) w.walkAction.timeScale = 0.6;
  }

  function maybeIdle(w:Walker){
    if (w.state==='walk' && Math.random()<0.05){
      w.state='idle';
      w.idleT=0; w.idleDur=1 + Math.random()*2.2; // 1-3.2s
  if (w.walkAction) w.walkAction.timeScale = 0.25;
      w.speed = 0; // pause déplacement
    }
  }

  for (let i=walkers.length-1; i>=0; i--){
    const w = walkers[i];
    w.mixer.update(dt);

    // gérer état turn
    if (w.state==='turn'){
      w.turnT += dt;
      const k = Math.min(1, w.turnT / w.turnDur);
      if (w.startQuat && w.endQuat){
        // slerp sur quaternion d'objet (interpolation manuelle)
        w.obj.quaternion.copy(w.startQuat).slerp(w.endQuat, k);
      }
      if (k>=1){
        if (w.queuedDir){
          w.dir.copy(w.queuedDir);
          w.axis = Math.abs(w.dir.x) > Math.abs(w.dir.z) ? 'x':'z';
          w.perp.set(-w.dir.z,0,w.dir.x);
        }
        w.state='walk';
        w.speed = w.baseSpeed;
  if (w.walkAction) w.walkAction.timeScale = w.baseSpeed / BASE_WALK_ANIM_SPEED;
      }
    }

    // idle
    else if (w.state==='idle'){
      w.idleT += dt;
      if (w.idleT >= w.idleDur){
        w.state='walk';
        w.speed = w.baseSpeed;
  if (w.walkAction) w.walkAction.timeScale = w.baseSpeed / BASE_WALK_ANIM_SPEED;
      }
    }

    // enlever oscillation précédente
    if (w.prevLat !== 0) w.obj.position.addScaledVector(w.perp, -w.prevLat);

    // déplacement linéaire seulement si walk
    if (w.state==='walk') w.obj.position.addScaledVector(w.dir, w.speed * dt);

    // progression & gestion de case
    if (w.state==='walk'){
      const localProgress = w.axis==='x' ? (w.obj.position.x - w.tileX) : (w.obj.position.z - w.tileZ);
      if (Math.abs(localProgress) > ROAD_EDGE_MARGIN){
        const step = (localProgress>0?1:-1) * CELL;
        const nx = w.axis==='x' ? w.tileX + step : w.tileX;
        const nz = w.axis==='z' ? w.tileZ + step : w.tileZ;
        if (roadExistsAt(nx, nz)) {
          // entrée nouvelle case : mise à jour + possibilité intersection
          w.tileX = nx; w.tileZ = nz;

          // test intersection: quelles routes dispo ?
            const dirs: THREE.Vector3[] = [];
            const forward = w.dir.clone();
            const left = new THREE.Vector3(-w.dir.z,0,w.dir.x);
            const right = new THREE.Vector3(w.dir.z,0,-w.dir.x);
            function tileCenterFromDir(d:THREE.Vector3){
              const cx = w.tileX + (Math.abs(d.x)>0.1 ? Math.sign(d.x)*CELL : 0);
              const cz = w.tileZ + (Math.abs(d.z)>0.1 ? Math.sign(d.z)*CELL : 0);
              return {cx,cz};
            }
            const fT = tileCenterFromDir(forward); if (roadExistsAt(fT.cx, fT.cz)) dirs.push(forward);
            const lT = tileCenterFromDir(left);    if (roadExistsAt(lT.cx, lT.cz)) dirs.push(left);
            const rT = tileCenterFromDir(right);   if (roadExistsAt(rT.cx, rT.cz)) dirs.push(right);

            // décider
            if (dirs.length>1){
              // pondération: forward favoris, 15% chance de chaque côté si existe
              let chosen = forward;
              const canLeft = dirs.some(d=>d===left);
              const canRight= dirs.some(d=>d===right);
              const roll = Math.random();
              if (canLeft && roll<0.15) chosen = left;
              else if (canRight && roll>=0.15 && roll<0.30) chosen = right;
              // si forward pas dans dirs (cul-de-sac latéral) on prend un autre
              if (!dirs.includes(forward)) chosen = dirs[(Math.random()*dirs.length)|0];
              if (chosen !== forward){
                setupTurn(w, chosen);
              } else {
                maybeIdle(w);
              }
            } else if (dirs.length===1){
              // si unique et pas forward => virage obligatoire
              if (dirs[0] !== forward) setupTurn(w, dirs[0]); else maybeIdle(w);
            } else {
              // cul-de-sac => demi-tour
              const back = w.dir.clone().multiplyScalar(-1);
              setupTurn(w, back);
            }
        } else {
          // pas de prochaine case => demi-tour à la frontière
          const back = w.dir.clone().multiplyScalar(-1);
          setupTurn(w, back);
          // clamp
          if (w.axis==='x') w.obj.position.x = w.tileX + Math.sign(localProgress)*ROAD_EDGE_MARGIN;
          else              w.obj.position.z = w.tileZ + Math.sign(localProgress)*ROAD_EDGE_MARGIN;
        }
      }
    }

    // oscillation latérale (même en idle/turn on peut réduire amplitude => ici on garde pour vie visuelle, mais amortir en turn)
    let amp = w.lateralAmp;
    if (w.state==='turn') amp *= 0.4; else if (w.state==='idle') amp *= 0.2;
    w.lateralPhase += dt * w.lateralFreq;
    const newLat = Math.sin(w.lateralPhase) * amp;
    w.obj.position.addScaledVector(w.perp, newLat);
    w.prevLat = newLat;

    w.life -= dt;
    if (w.life <= 0){
      recycleWalker(w);
      walkers.splice(i,1);
      continue;
    }
  }

  // évitement simple (séparation) – coût O(n^2) limité
  for (let i=0;i<walkers.length;i++){
    const a = walkers[i]; if (a.state==='turn') continue; // ignorer durant virage
    for (let j=i+1;j<walkers.length;j++){
      const b = walkers[j]; if (b.state==='turn') continue;
      const dx = b.obj.position.x - a.obj.position.x;
      const dz = b.obj.position.z - a.obj.position.z;
      const d2 = dx*dx + dz*dz;
      if (d2 < 0.36){
        const d = Math.sqrt(Math.max(1e-6,d2));
        const push = (0.6 - d) * 0.5;
        const nx = dx/d, nz = dz/d;
        a.obj.position.x -= nx*push*0.5; a.obj.position.z -= nz*push*0.5;
        b.obj.position.x += nx*push*0.5; b.obj.position.z += nz*push*0.5;
      }
    }
  }

  const now = performance.now();
  if (now >= nextWalkerTime){
    spawnWalker();
    nextWalkerTime = now + 1200 + Math.random()*3800;
  }
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

  // (Plus de citoyens statiques: les promeneurs apparaissent de façon globale)

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

  // (Plus de citoyens statiques: les promeneurs apparaissent de façon globale)

  money -= BUILDING_COST; renderMoney(); showSpend(BUILDING_COST);
  lastPlaceError = "";
  return true;
}

function eraseAtPointer(event:any){
  if (overUI(event)) return;

  mouse.x = (event.clientX/innerWidth)*2-1;
  mouse.y = -(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);

  // inclut routes + maisons + immeubles + puits + éoliennes + scieries
  const pool = [
    ...roads.values(), ...houses.values(), ...buildings.values(),
    ...wells.values(), ...turbines.values(), ...sawmills.values()
  ];
  const hits = raycaster.intersectObjects(pool, true);
  if (!hits.length) return;

  // remonte au root placé
  let node:any = hits[0].object, root:any = null;
  for(;;){
    if (pool.includes(node)) { root = node; break; }
    if (!node.parent || node.parent===scene) break;
    node = node.parent;
  }
  if (!root) return;

  // identifie la clé, le sac et le type
  let hitKey:string|undefined, bag:Map<string,THREE.Object3D>|undefined;
  let kind:'road'|'house'|'building'|'well'|'turbine'|'sawmill'|null = null;

  for (const [k,m] of roads.entries())      if (m===root){ hitKey=k; bag=roads;      kind='road'; break; }
  if (!hitKey) for (const [k,m] of houses.entries())     if (m===root){ hitKey=k; bag=houses;     kind='house'; break; }
  if (!hitKey) for (const [k,m] of buildings.entries())  if (m===root){ hitKey=k; bag=buildings;  kind='building'; break; }
  if (!hitKey) for (const [k,m] of wells.entries())      if (m===root){ hitKey=k; bag=wells;      kind='well'; break; }
  if (!hitKey) for (const [k,m] of turbines.entries())   if (m===root){ hitKey=k; bag=turbines;   kind='turbine'; break; }
  if (!hitKey) for (const [k,m] of sawmills.entries())   if (m===root){ hitKey=k; bag=sawmills;   kind='sawmill'; break; }
  if (!hitKey || !bag || !kind) return;

  // ajustements de ressources
  if (kind==='well')     { resources.water  = Math.max(0, resources.water  - 10); updateRes(); }
  if (kind==='turbine')  { resources.power  = Math.max(0, resources.power  - 10); updateRes(); }
  if (kind==='sawmill')  { resources.wood   = Math.max(0, resources.wood   - 10); updateRes(); }

  // suppression et nettoyage
  scene.remove(root);
  root.traverse((n:any)=>{
    if (n.isMesh){
      n.geometry?.dispose?.();
      const m:any = n.material;
      if (m?.map) m.map.dispose();
      m?.dispose?.();
    }
  });
  bag.delete(hitKey);

  // remboursement: route 100%, le reste 50%
  const full = root.userData?.cost ?? 0;
  const refund = (kind==='road') ? full : Math.round(full*0.5);
  money += refund; renderMoney();
  if (refund>0) showRefund(refund);
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
  if (mode === "well"     && painting) placeWell(s.x, s.z);
  if (mode === "turbine"  && painting) placeTurbine(s.x, s.z);
  if (mode === "sawmill"  && painting) placeSawmill(s.x, s.z);
});

addEventListener("pointerdown", e=>{
  if (overUI(e)) return;
  if (e.button===0){
    const p = screenToGround(e); if(!p) return; const s = snapToCell(p);
    painting = true;
    let ok = false;
    if (mode==="road")      ok = placeRoad(s.x,s.z);
    else if (mode==="house")     ok = placeHouse(s.x,s.z);
    else if (mode==="building")  ok = placeBuilding(s.x,s.z);
    else if (mode==="well")      ok = placeWell(s.x,s.z);
    else if (mode==="turbine")   ok = placeTurbine(s.x,s.z);
    else if (mode==="sawmill")   ok = placeSawmill(s.x,s.z);
    else if (mode==="bulldozer") { eraseAtPointer(e); ok = true; }

    if(!ok && (mode==="house"||mode==="building") && lastPlaceError==="no_road"){
      showToast("Besoin d’une route adjacente pour placer ici");
    }
  } else if (e.button===2){
    e.preventDefault();
    if (mode==="bulldozer") { setActive("pan"); showToast("Bulldozer annulé"); }
    else if (mode!=="pan")  { cancelPlacement(); }
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
  // update walkers (delta basé sur 60fps approx ou calcul précis)
  // on calcule delta réel pour mixer
  const nowTime = performance.now();
  const dt = (nowTime - lastWalkerUpdate) / 1000;
  updateWalkers(dt);
  lastWalkerUpdate = nowTime;
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
let lastWalkerUpdate = performance.now();
requestAnimationFrame(tick);
