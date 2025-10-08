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
import * as UI from "./ui";

UI.init();

// ----- paramètres -----
const TILE_SIZE = 2;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const CELL = 3 * TILE_SIZE;

const ROAD_COST = 200;
const HOUSE_COST = 1200;
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
camera.position.set(30,30,30); camera.lookAt(0,0,0); camera.zoom=1; setOrtho(camera);

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
  toastT = setTimeout(()=> toast.style.opacity="0", 1200);
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
function updateFabActive(){
  if(!fabList) return;
  [...fabList.children].forEach(li=>{
    if(li instanceof HTMLElement){
      if(li.dataset.tool === mode) li.classList.add("active"); else li.classList.remove("active");
    }
  });
}
function setActive(m:any){
  mode = m;
  updateFabActive();
  document.body.style.cursor = (m==="road"||m==="house"||m==="building")?"crosshair":m==="bulldozer"?"not-allowed":"default";
  if (typeof grid !== "undefined") grid.visible = (m !== "pan");
  if (preview) preview.visible = ((m==="road"||m==="house"||m==="building") && !overUI(lastPointerEvent));
  if ((m==="road"||m==="house"||m==="building") && !preview) makePreview();
}
if(fabList){
  fabList.addEventListener("click", (e)=>{
    const li = (e.target as HTMLElement).closest("li[data-tool]") as HTMLElement | null;
    if(!li) return;
    setActive(li.dataset.tool);
  });
}

// Cycle des routes
let piece:"I"|"L"|"X" = "I";
function cyclePiece(){
  piece = piece === "I" ? "L" : piece === "L" ? "X" : "I";
  updateCursor(true); makePreview();
  showToast(`Route: ${piece}`);
}
addEventListener("keydown", (e)=>{
  if ((e.key === 'r' || e.key === 'R') && mode === 'road') { e.preventDefault(); cyclePiece(); }
});

// ----- contrôles -----
const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate=false; controls.screenSpacePanning=true; controls.enableDamping=true;
controls.mouseButtons.LEFT=null; controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
controls.addEventListener("change",()=> camera.position.y=Math.max(camera.position.y,1));

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

type ModelRec = { path:string; prefab:THREE.Object3D|null; scale:THREE.Vector3; target:[number,number] };
const MODELS:Record<string,ModelRec> = {
  I:        { path: URL_STREET_I, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  L:        { path: URL_STREET_L, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  X:        { path: URL_STREET_X, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  HOUSE:    { path: URL_HOUSE,    prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  BUILDING: { path: URL_BUILDING, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] }
};

// centre chaque GLB et scale 1 cellule
function preparePrefab(root:THREE.Object3D, targetX:number, targetZ:number){
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);

  const pivot = new THREE.Group();
  pivot.name = "PrefabPivot";
  pivot.add(root);
  root.position.sub(center);

  const sX = size.x > 1e-6 ? targetX / size.x : 1;
  const sZ = size.z > 1e-6 ? targetZ / size.z : 1;
  const sY = 0.5 * (sX + sZ);
  const scale = new THREE.Vector3(sX, sY, sZ);

  return { prefab: pivot, scale };
}

for (const key of Object.keys(MODELS)){
  gltfLoader.load(MODELS[key].path,(gltf)=>{
    const root = gltf.scene;
    root.traverse((o:any)=>{
      if(o.isMesh&&o.material){
        o.material.metalness=0; o.material.roughness=1;
        o.castShadow=o.receiveShadow=true;
      }
    });

    const [targetX, targetZ] = MODELS[key].target;
    const { prefab, scale } = preparePrefab(root, targetX, targetZ);

    MODELS[key].prefab = prefab;
    MODELS[key].scale.copy(scale);

    if ((key === piece) || (key === "HOUSE" && mode==="house") || (key==="BUILDING" && mode==="building")) makePreview();
  },undefined,(e)=>console.error("GLB load error:", key, MODELS[key].path, e));
}

// ----- PREVIEW -----
function makePreview(){
  if (preview){ scene.remove(preview); preview = null; }
  const key = (mode==="house") ? "HOUSE" : (mode==="building" ? "BUILDING" : piece);
  const M = MODELS[key]; if (!M || !M.prefab) return;
  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = Z_PREVIEW;
  obj.traverse((n:any)=>{
    if(n.isMesh){
      const mat = n.material.clone();
      mat.transparent = true; mat.opacity = 0.5; mat.depthWrite = false;
      n.material = mat;
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
function buildPlacedObject(kind:any){
  const key = (kind==="house") ? "HOUSE" : (kind==="building" ? "BUILDING" : piece);
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

let lastPlaceError = "";

function placeRoad(wx:any,wz:any){
  if (money < ROAD_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz); if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  const obj = buildPlacedObject("road"); if(!obj) { lastPlaceError="model"; return false; }
  obj.position.set(wx,Z_ROAD,wz);
  scene.add(obj);
  roads.set(id, obj);
  money -= ROAD_COST; renderMoney();
  lastPlaceError="";
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
  money -= HOUSE_COST; renderMoney();
  lastPlaceError="";
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
  money -= BUILDING_COST; renderMoney();
  lastPlaceError="";
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
  let hitKey:any=null, bag:any=null;
  for(const [k,m] of roads.entries())      if(m===root){ hitKey=k; bag=roads;      break; }
  if(!hitKey) for(const [k,m] of houses.entries())    if(m===root){ hitKey=k; bag=houses;    break; }
  if(!hitKey) for(const [k,m] of buildings.entries()) if(m===root){ hitKey=k; bag=buildings; break; }
  if(!hitKey) return;

  removeGroundPlate(root.userData?.groundPlate);

  scene.remove(root);
  root.traverse((n:any)=>{ if(n.isMesh){ n.geometry?.dispose(); if(n.material?.map) n.material.map.dispose(); n.material?.dispose?.(); }});
  bag.delete(hitKey);

  const full = root.userData?.cost ?? 0;
  let refund = full;
  if (root.userData?.kind === 'house' || root.userData?.kind === 'building') refund = Math.round(full * 0.5);
  money += refund; renderMoney();
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
  if (overUI(e)) { if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const p=screenToGround(e); if(!p){ if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const s=snapToCell(p);
  if(cursor){ cursor.visible=(mode!=="pan"); cursor.position.set(s.x, Z_CURSOR, s.z); }
  if(preview){ preview.visible = (mode==="road"||mode==="house"||mode==="building"); updatePreviewPosition(s); updatePreviewRotation(); }
  if(mode==="road" && painting)      placeRoad(s.x,s.z);
  if(mode==="house" && painting)     placeHouse(s.x,s.z);
  if(mode==="building" && painting)  placeBuilding(s.x,s.z);
  if(mode==="bulldozer" && painting) eraseAtPointer(e);
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
