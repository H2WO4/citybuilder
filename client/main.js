import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ----- paramètres -----
const TILE_SIZE = 2;
const GRID_VIS_SIZE = 128;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const ROAD_W = 3 * TILE_SIZE;
const ROAD_L = 3 * TILE_SIZE;           // 3x3
const ROAD_COST = 200;

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

// ===== HUD Argent =====
let money = 200000;
const hud = document.createElement("div");
Object.assign(hud.style,{position:"fixed",top:"12px",right:"12px",padding:"8px 12px",border:"2px solid #222",
  borderRadius:"10px",background:"rgba(255,255,255,0.9)",fontFamily:"system-ui, sans-serif",fontSize:"16px",
  color:"#111",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",pointerEvents:"auto"});
hud.className = "ui";
document.body.appendChild(hud);
const fmtEUR = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
function renderMoney(){ hud.textContent = fmtEUR.format(money); }
renderMoney();

// ===== Toolbar + sous-menu =====
const bar = document.createElement("div");
Object.assign(bar.style,{position:"fixed",top:"12px",left:"12px",display:"flex",gap:"8px",
  background:"rgba(255,255,255,0.9)",border:"2px solid #222",borderRadius:"10px",padding:"6px",
  fontFamily:"system-ui,sans-serif",userSelect:"none",pointerEvents:"auto"});
bar.className = "ui";
document.body.appendChild(bar);
function makeBtn(label,title){
  const b=document.createElement("button"); b.type="button"; b.textContent=label; b.title=title;
  Object.assign(b.style,{padding:"6px 10px",border:"1px solid #333",borderRadius:"8px",background:"#fff",
    cursor:"pointer",fontSize:"14px",minWidth:"44px",lineHeight:"1"});
  b.onmouseenter=()=>b.style.background="#f2f2f2";
  b.onmouseleave =()=>b.style.background=(b.dataset.active==="1")?"#dde8ff":"#fff";
  return b;
}
const btnPan=makeBtn("🖐️","Navigation");
const btnRoad=makeBtn("🛣️","Poser des routes");
const btnBulld=makeBtn("🪓","Bulldozer");
bar.append(btnPan, btnRoad, btnBulld);

let mode="pan";
let cursor = null;       // << déplacé avant setActive pour éviter la TDZ
let preview = null;      // << déplacé avant setActive pour éviter la TDZ

function setActive(m){
  mode=m;
  for (const b of [btnPan,btnRoad,btnBulld]){ b.dataset.active="0"; b.style.background="#fff"; }
  ({pan:btnPan,road:btnRoad,bulldozer:btnBulld}[m]).dataset.active="1";
  ({pan:btnPan,road:btnRoad,bulldozer:btnBulld}[m]).style.background="#dde8ff";
  document.body.style.cursor = m==="road"?"crosshair":m==="bulldozer"?"not-allowed":"default";
  if (typeof grid !== "undefined") grid.visible = (m !== "pan");
  if (preview) preview.visible = (m==="road" && !overUI(lastPointerEvent));
}
btnPan.onclick = ()=> setActive("pan");
btnRoad.onclick = ()=> setActive("road");
btnBulld.onclick = ()=> setActive("bulldozer");

// Sous-menu (3 pièces : I, L, X)
const sub = document.createElement("div");
Object.assign(sub.style,{position:"fixed",top:"54px",left:"12px",display:"none",gap:"6px",
  background:"rgba(255,255,255,0.98)",border:"2px solid #222",borderRadius:"10px",padding:"6px",
  boxShadow:"0 4px 12px rgba(0,0,0,.2)",pointerEvents:"auto"});
sub.className = "ui";
document.body.appendChild(sub);
function makeMini(label, title, onClick){
  const b=document.createElement("button"); b.textContent=label; b.title=title; b.type="button";
  Object.assign(b.style,{padding:"6px 8px",border:"1px solid #333",borderRadius:"8px",background:"#fff",
    cursor:"pointer",fontSize:"14px",minWidth:"36px"}); b.onclick=onClick; return b;
}
let piece = "I";
const miniI = makeMini("I","Ligne droite", ()=>{ piece="I"; updateCursor(true); makePreview(); setActive("road"); });
const miniL = makeMini("L","Virage",       ()=>{ piece="L"; updateCursor(true); makePreview(); setActive("road"); });
const miniX = makeMini("X","Passage piéton",()=>{ piece="X"; updateCursor(true); makePreview(); setActive("road"); });
sub.append(miniI, miniL, miniX);
btnRoad.addEventListener("mouseenter", ()=> sub.style.display="flex");
btnRoad.addEventListener("mouseleave", ()=> setTimeout(()=>{ if(!sub.matches(":hover")) sub.style.display="none"; }, 80));
sub.addEventListener("mouseleave", ()=> sub.style.display="none");

// ----- contrôles -----
const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate=false; controls.screenSpacePanning=true; controls.enableDamping=true;
controls.mouseButtons.LEFT=null; controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
controls.addEventListener("change",()=> camera.position.y=Math.max(camera.position.y,1));

// ----- grille + sol -----
const grid = new THREE.GridHelper(GRID_VIS_SIZE, GRID_VIS_SIZE / TILE_SIZE, 0x000000, 0x000000);
grid.material.transparent=true; grid.material.opacity=0.35; grid.material.depthWrite=false; grid.renderOrder=1; scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4096,4096), new THREE.MeshBasicMaterial({color:0x55aa55}));
ground.rotation.x=-Math.PI/2; ground.position.y=-0.002; scene.add(ground);
function updateGrid(){ const gx=Math.round(camera.position.x/TILE_SIZE)*TILE_SIZE; const gz=Math.round(camera.position.z/TILE_SIZE)*TILE_SIZE; grid.position.set(gx,0,gz); }

// ----- Raycast & snap -----
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
function screenToGround(e){ mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera); const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p)?p.clone():null; }
function overUI(e){ return !!(e && e.target && e.target.closest(".ui")); }

// --- Snap footprint 3x3 pour toutes les pièces ---
function footprintTiles(){ return [3,3]; }
function snapAxis(v, isEven){
  if (isEven) return Math.round(v / TILE_SIZE) * TILE_SIZE;
  return Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
}
function snapFootprint(worldVec3){
  let [tx, tz] = footprintTiles();
  if ((angleIndex & 1) === 1) [tx, tz] = [tz, tx];
  const x = snapAxis(worldVec3.x, (tx % 2) === 0);
  const z = snapAxis(worldVec3.z, (tz % 2) === 0);
  return new THREE.Vector3(x, 0, z);
}

// ----- orientation via A -----
let angleIndex = 0;
const ANG = [0, Math.PI/2, Math.PI, -Math.PI/2];
addEventListener("keydown",(e)=>{
  if((e.key==="a"||e.key==="A")&&mode==="road"){
    e.preventDefault(); angleIndex=(angleIndex+1)&3; updateCursorOrient(); updatePreviewRotation();
  }
});

// ----- curseur (toutes 3x3) -----
const GEO_I = new THREE.PlaneGeometry(3*TILE_SIZE, 3*TILE_SIZE).rotateX(-Math.PI/2);
const GEO_S = new THREE.PlaneGeometry(3*TILE_SIZE, 3*TILE_SIZE).rotateX(-Math.PI/2);
function makeCursor(){
  if (cursor) scene.remove(cursor);
  const geo = (piece==="I") ? GEO_I.clone() : GEO_S.clone();
  cursor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xffff00, transparent:true, opacity:0.25 }));
  cursor.position.y = 0.001; cursor.visible=false; scene.add(cursor);
}
function updateCursor(resizeOnly=false){ if(!cursor||resizeOnly) makeCursor(); updateCursorOrient(); }
function updateCursorOrient(){ if(cursor) cursor.rotation.y = ANG[angleIndex]; }
makeCursor(); // créé avant tout usage

// ====== CHARGEMENT DES 3 GLB ======
const gltfLoader = new GLTFLoader();
const MODELS = {
  I: { path:"./texture_models/Street_Straight.glb", prefab:null, scale:new THREE.Vector3(), target:[3*TILE_SIZE, 3*TILE_SIZE] },
  L: { path:"./texture_models/Street_Turn.glb",    prefab:null, scale:new THREE.Vector3(), target:[3*TILE_SIZE, 3*TILE_SIZE] },
  X: { path:"./texture_models/Cross_walk.glb",     prefab:null, scale:new THREE.Vector3(), target:[3*TILE_SIZE, 3*TILE_SIZE] },
};
for (const key of Object.keys(MODELS)){
  gltfLoader.load(MODELS[key].path,(gltf)=>{
    const root=gltf.scene;
    root.traverse(o=>{ if(o.isMesh&&o.material){ o.material.metalness=0; o.material.roughness=1; o.castShadow=o.receiveShadow=true; }});
    const box=new THREE.Box3().setFromObject(root); const sz=new THREE.Vector3(); box.getSize(sz);
    const targetX = MODELS[key].target[0], targetZ = MODELS[key].target[1];
    MODELS[key].scale.set(targetX/(sz.x||1), 1, targetZ/(sz.z||1));
    MODELS[key].prefab = root;
    if (key === piece) makePreview();
  },undefined,(e)=>console.error("GLB load error:",key,e));
}

// ----- PREVIEW (ghost) -----
function makePreview(){
  if (preview){ scene.remove(preview); preview = null; }
  const M = MODELS[piece]; if (!M.prefab) return;
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
  obj.visible = (mode==="road");
  preview = obj;
  scene.add(preview);
}
function updatePreviewRotation(){ if(preview) preview.rotation.y = ANG[angleIndex]; }
function updatePreviewPosition(pos){ if(preview){ preview.position.set(pos.x, 0.0006, pos.z); } }

// ----- création d’une tuile route (GLB réel) -----
function buildRoadObject(){
  const M = MODELS[piece];
  if (!M.prefab) return null;
  const obj = M.prefab.clone(true);
  obj.scale.copy(M.scale);
  obj.rotation.y = ANG[angleIndex];
  obj.position.y = 0.0005;
  obj.userData = { cost: ROAD_COST, piece, angle: angleIndex };
  return obj;
}

// ----- placement/suppression -----
const roads=new Map();
function keyFromCenter(wx,wz){ return `${wx}:${wz}`; }

function place(wx,wz){
  if (money < ROAD_COST) return;
  const id=keyFromCenter(wx,wz); if(roads.has(id)) return;
  const obj = buildRoadObject(); if(!obj) return;
  obj.position.set(wx,0.0005,wz);
  scene.add(obj);
  roads.set(id, obj);
  money -= ROAD_COST; renderMoney();
}
function eraseAtPointer(event){
  if (overUI(event)) return;
  mouse.x=(event.clientX/innerWidth)*2-1; mouse.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects([...roads.values()], true); if(!hits.length) return;
  let node = hits[0].object, root=null;
  for(;;){ if ([...roads.values()].includes(node)) { root=node; break; } if (!node.parent||node.parent===scene) break; node=node.parent; }
  if(!root) return;
  let hitKey=null; for(const [k,m] of roads.entries()) if(m===root){ hitKey=k; break; }
  if(!hitKey) return;
  scene.remove(root);
  root.traverse(n=>{ if(n.isMesh){ n.geometry?.dispose(); if(n.material?.map) n.material.map.dispose(); n.material?.dispose(); }});
  roads.delete(hitKey);
  money += root.userData?.cost ?? ROAD_COST; renderMoney();
}

// ----- interactions -----
let painting=false;
let lastPointerEvent = null;

addEventListener("pointermove", e=>{
  lastPointerEvent = e;
  if (overUI(e)) { if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const p=screenToGround(e); if(!p){ if(cursor) cursor.visible=false; if(preview) preview.visible=false; return; }
  const s=snapFootprint(p);
  if(cursor){ cursor.visible=(mode!=="pan"); cursor.position.set(s.x,0.001,s.z); }
  if(preview){ preview.visible = (mode==="road"); updatePreviewPosition(s); updatePreviewRotation(); }
  if(mode==="road" && painting) place(s.x,s.z);
  if(mode==="bulldozer" && painting) eraseAtPointer(e);
});

addEventListener("pointerdown", e=>{
  if (overUI(e)) return;
  if(e.button===0){
    if(mode==="road"){ const p=screenToGround(e); if(!p) return; const s=snapFootprint(p); painting=true; place(s.x,s.z); }
    else if(mode==="bulldozer"){ painting=true; eraseAtPointer(e); }
  } else if(e.button===2){ e.preventDefault(); }
});
addEventListener("pointerup", ()=> painting=false);
addEventListener("contextmenu", e=> e.preventDefault());

// ----- init états dépendants -----
makePreview();      // créé après MODELS init, mais no-op si non chargés
setActive("pan");   // appelé après déclarations de cursor/preview

// ----- zoom + resize + loop -----
addEventListener("wheel", ()=>{ camera.zoom=THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM); camera.updateProjectionMatrix(); });
addEventListener("resize", ()=>{ setOrtho(camera); renderer.setSize(innerWidth, innerHeight); });
function tick(){ updateGrid(); controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }
requestAnimationFrame(tick);
