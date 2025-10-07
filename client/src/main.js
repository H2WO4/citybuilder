// ===== imports =====
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

// URLs des modèles (résolution Vite/ESM, évite le retour d'index.html)
import URL_STREET_I   from "../texture_models/Street_Straight.glb?url";
import URL_STREET_L   from "../texture_models/Street_Turn.glb?url";
import URL_STREET_X   from "../texture_models/Cross_walk.glb?url";
import URL_HOUSE      from "../texture_models/House.glb?url";
import URL_BUILDING   from "../texture_models/Building.glb?url";

// ----- paramètres -----
const TILE_SIZE = 2;
const GRID_VIS_SIZE = 5000;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const ROAD_W = 3 * TILE_SIZE;
const ROAD_L = 3 * TILE_SIZE;
const CELL = 3 * TILE_SIZE;
const ROAD_COST = 200;
const HOUSE_COST = 1200;
const BUILDING_COST = 5000; 

// ----- scène -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x55aa55);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(50,100,50); scene.add(sun); scene.add(sun.target);

// ----- caméra -----
function setOrtho(cam){
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

// ===== petit toast =====
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
let toastT=null;
function showToast(msg){
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

// ===== Outils via le menu flottant =====
let mode = "pan";
let cursor = null;
let preview = null;

const fabList = document.getElementById("fab-tools");
function updateFabActive(){
  if(!fabList) return;
  [...fabList.children].forEach(li=>{
    if(li.dataset.tool === mode) li.classList.add("active"); else li.classList.remove("active");
  });
}
function setActive(m){
  mode = m;
  updateFabActive();
  document.body.style.cursor = (m==="road"||m==="house"||m==="building")?"crosshair":m==="bulldozer"?"not-allowed":"default";
  if (typeof grid !== "undefined") grid.visible = (m !== "pan");
  if (preview) preview.visible = ((m==="road"||m==="house"||m==="building") && !overUI(lastPointerEvent));
  if (m==="road"||m==="house"||m==="building") makePreview();
}
if(fabList){
  fabList.addEventListener("click", (e)=>{
    const li = e.target.closest("li[data-tool]");
    if(!li) return;
    setActive(li.dataset.tool);
  });
}

// Sélection de variante route : cycle I -> L -> X au clavier (R)
let piece = "I";
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
// Une case de grille = 1 cellule (3x3 tiles)
const grid = new THREE.GridHelper(GRID_VIS_SIZE, GRID_VIS_SIZE / CELL, 0x000000, 0x000000);
grid.material.transparent=true; grid.material.opacity=0.35; grid.material.depthWrite=false; grid.renderOrder=1; scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4096,4096), new THREE.MeshBasicMaterial({color:0x55aa55}));
ground.rotation.x=-Math.PI/2; ground.position.y=-0.002; scene.add(ground);
// centre la grille par pas de cellule
function updateGrid(){
  const gx = Math.round(camera.position.x / CELL) * CELL;
  const gz = Math.round(camera.position.z / CELL) * CELL;
  grid.position.set(gx,0,gz);
}

// ----- Raycast & snap -----
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
function screenToGround(e){ mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera); const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p)?p.clone():null; }
function overUI(e){ return !!(e && e.target && e.target.closest(".ui")); }

// --- Snap sur cellule entière ---
function snapToCell(v){
  const x = Math.round(v.x / CELL) * CELL;
  const z = Math.round(v.z / CELL) * CELL;
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
const GEO_PLACEMENT = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI/2); // taille d'une cellule
function makeCursor(){
  if (cursor) scene.remove(cursor);
  const geo = GEO_PLACEMENT.clone();
  cursor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xffff00, transparent:true, opacity:0.25 }));
  cursor.position.y = 0.001; cursor.visible=false; scene.add(cursor);
}
function updateCursor(resizeOnly=false){ if(!cursor||resizeOnly) makeCursor(); updateCursorOrient(); }
function updateCursorOrient(){ if(cursor) cursor.rotation.y = ANG[angleIndex]; }
makeCursor();

// ====== CHARGEMENT DES GLB ======
const gltfLoader = new GLTFLoader();

const MODELS = {
  I:        { path: URL_STREET_I, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  L:        { path: URL_STREET_L, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  X:        { path: URL_STREET_X, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  HOUSE:    { path: URL_HOUSE,    prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] },
  BUILDING: { path: URL_BUILDING, prefab: null, scale: new THREE.Vector3(), target: [CELL, CELL] }
};

for (const key of Object.keys(MODELS)){
  gltfLoader.load(MODELS[key].path,(gltf)=>{
    const root=gltf.scene;
    root.traverse(o=>{
      if(o.isMesh&&o.material){
        o.material.metalness=0; o.material.roughness=1;
        o.castShadow=o.receiveShadow=true;
      }
    });
    const box=new THREE.Box3().setFromObject(root);
    const sz=new THREE.Vector3(); box.getSize(sz);

    const [targetX, targetZ] = MODELS[key].target;
    const sX = (sz.x>1e-6)? targetX/sz.x : 1;
    const sZ = (sz.z>1e-6)? targetZ/sz.z : 1;
    const sY = 0.5*(sX+sZ);

    MODELS[key].scale.set(sX, sY, sZ);
    MODELS[key].prefab = root;

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
  obj.position.y = 0.0006;
  obj.traverse(n=>{
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
function updatePreviewPosition(pos){ if(preview){ preview.position.set(pos.x, 0.0006, pos.z); } }

// ====== plaques de sol grises ======
const plateGeo = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI/2);
const plateMatHouse = new THREE.MeshBasicMaterial({ color:0x777777 });
const plateMatBuild = new THREE.MeshBasicMaterial({ color:0x666666 });
function addGroundPlate(x, z, forKind){
  const mat = forKind==="house" ? plateMatHouse : plateMatBuild;
  const g = new THREE.Mesh(plateGeo.clone(), mat);
  g.position.set(x, -0.001, z);
  scene.add(g);
  return g;
}
function removeGroundPlate(plate){
  if (!plate) return;
  scene.remove(plate);
  plate.geometry.dispose();
}

// ----- création d’un objet placé -----
function buildPlacedObject(kind){
  const key = (kind==="house") ? "HOUSE" : (kind==="building" ? "BUILDING" : piece);
  const M = MODELS[key];
  if (!M || !M.prefab) return null;
  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = 0.0005;
  obj.userData = {
    cost: kind==="house" ? HOUSE_COST : kind==="building" ? BUILDING_COST : ROAD_COST,
    kind, piece, angle: angleIndex,
    groundPlate: null
  };
  return obj;
}

// ----- placement/suppression -----
const roads    = new Map();
const houses   = new Map();
const buildings= new Map();
function keyFromCenter(wx,wz){ return `${wx}:${wz}`; }

// voisinage 4
function hasAdjacentRoad(wx,wz){
  return (
    roads.has(keyFromCenter(wx + CELL, wz)) ||
    roads.has(keyFromCenter(wx - CELL, wz)) ||
    roads.has(keyFromCenter(wx, wz + CELL)) ||
    roads.has(keyFromCenter(wx, wz - CELL))
  );
}

let lastPlaceError = "";

function placeRoad(wx,wz){
  if (money < ROAD_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz); if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  const obj = buildPlacedObject("road"); if(!obj) { lastPlaceError="model"; return false; }
  obj.position.set(wx,0.0005,wz);
  scene.add(obj);
  roads.set(id, obj);
  money -= ROAD_COST; renderMoney();
  lastPlaceError="";
  return true;
}

function placeHouse(wx,wz){
  if (money < HOUSE_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz);
  if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx,wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("house"); if(!obj) { lastPlaceError="model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "house");

  obj.position.set(wx,0.0005,wz);
  scene.add(obj);
  houses.set(id, obj);
  money -= HOUSE_COST; renderMoney();
  lastPlaceError="";
  return true;
}

function placeBuilding(wx,wz){
  if (money < BUILDING_COST) { lastPlaceError="money"; return false; }
  const id=keyFromCenter(wx,wz);
  if(roads.has(id) || houses.has(id) || buildings.has(id)) { lastPlaceError="occupied"; return false; }
  if (!hasAdjacentRoad(wx,wz)) { lastPlaceError="no_road"; return false; }
  const obj = buildPlacedObject("building"); if(!obj) { lastPlaceError="model"; return false; }

  obj.userData.groundPlate = addGroundPlate(wx, wz, "building");

  obj.position.set(wx,0.0005,wz);
  scene.add(obj);
  buildings.set(id, obj);
  money -= BUILDING_COST; renderMoney();
  lastPlaceError="";
  return true;
}

function eraseAtPointer(event){
  if (overUI(event)) return;
  mouse.x=(event.clientX/innerWidth)*2-1; mouse.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const pool = [...roads.values(), ...houses.values(), ...buildings.values()];
  const hits=raycaster.intersectObjects(pool, true); if(!hits.length) return;
  let node = hits[0].object, root=null;
  for(;;){
    if (pool.includes(node)) { root=node; break; }
    if (!node.parent||node.parent===scene) break; node=node.parent;
  }
  if(!root) return;
  let hitKey=null, bag=null;
  for(const [k,m] of roads.entries())      if(m===root){ hitKey=k; bag=roads;      break; }
  if(!hitKey) for(const [k,m] of houses.entries())    if(m===root){ hitKey=k; bag=houses;    break; }
  if(!hitKey) for(const [k,m] of buildings.entries()) if(m===root){ hitKey=k; bag=buildings; break; }
  if(!hitKey) return;

  removeGroundPlate(root.userData?.groundPlate);

  scene.remove(root);
  root.traverse(n=>{ if(n.isMesh){ n.geometry?.dispose(); if(n.material?.map) n.material.map.dispose(); n.material?.dispose?.(); }});
  bag.delete(hitKey);
  money += root.userData?.cost ?? 0; renderMoney();
}

// ----- interactions -----
let painting=false;
let lastPointerEvent = null;

addEventListener("pointermove", e=>{
  lastPointerEvent = e;
  if (overUI(e)) { if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const p=screenToGround(e); if(!p){ if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const s=snapToCell(p);
  if(cursor){ cursor.visible=(mode!=="pan"); cursor.position.set(s.x,0.001,s.z); }
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
  } else if(e.button===2){ e.preventDefault(); }
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
