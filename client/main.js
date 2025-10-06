import * as THREE from "./node_modules/three/build/three.module.js";
import { MapControls } from "./node_modules/three/examples/jsm/controls/MapControls.js";
import { GLTFLoader } from "./node_modules/three/examples/jsm/loaders/GLTFLoader.js";

// ----- paramètres -----
const TILE_SIZE = 2;
const GRID_VIS_SIZE = 128;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40;
const ROAD_W = 3 * TILE_SIZE;
const ROAD_L = 10 * TILE_SIZE;
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
  cam.left = -a*viewSize/2; cam.right = a*viewSize/2;
  cam.top = viewSize/2; cam.bottom = -viewSize/2;
  cam.updateProjectionMatrix();
}
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,2000);
camera.position.set(30,30,30);
camera.lookAt(0,0,0);
camera.zoom = 1;
setOrtho(camera);

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
  color:"#111",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",pointerEvents:"none"});
document.body.appendChild(hud);
const fmtEUR = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
function renderMoney(){ hud.textContent = fmtEUR.format(money); }
renderMoney();

// ===== Toolbar =====
const bar = document.createElement("div");
Object.assign(bar.style,{position:"fixed",top:"12px",left:"12px",display:"flex",gap:"8px",
  background:"rgba(255,255,255,0.9)",border:"2px solid #222",borderRadius:"10px",padding:"6px",
  fontFamily:"system-ui,sans-serif",userSelect:"none"});
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
const btnOrient=makeBtn("↕︎","Orientation route (↕︎/↔︎)");
const btnBulld=makeBtn("🪓","Bulldozer");
bar.append(btnPan, btnRoad, btnOrient, btnBulld);

let mode="pan";
function setActive(m){
  mode=m; for (const b of [btnPan,btnRoad,btnBulld]){ b.dataset.active="0"; b.style.background="#fff"; }
  ({pan:btnPan,road:btnRoad,bulldozer:btnBulld}[m]).dataset.active="1";
  ({pan:btnPan,road:btnRoad,bulldozer:btnBulld}[m]).style.background="#dde8ff";
  document.body.style.cursor = m==="road"?"crosshair":m==="bulldozer"?"not-allowed":"default";
}
btnPan.onclick = ()=> setActive("pan");
btnRoad.onclick = ()=> setActive("road");
btnBulld.onclick = ()=> setActive("bulldozer");
setActive("pan");

// ----- orientation route -----
let orient = "vertical"; // "vertical": longueur sur Z, "horizontal": sur X
function toggleOrient(){
  orient = (orient === "vertical") ? "horizontal" : "vertical";
  btnOrient.textContent = (orient === "vertical") ? "↕︎" : "↔︎";
  updateCursorOrient();
}
btnOrient.onclick = toggleOrient;

// ----- contrôles -----
const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate=false;
controls.screenSpacePanning=true;
controls.enableDamping=true;
controls.mouseButtons.LEFT=null;
controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
controls.addEventListener("change",()=> camera.position.y=Math.max(camera.position.y,1));

// ----- grille + sol -----
const grid = new THREE.GridHelper(GRID_VIS_SIZE, GRID_VIS_SIZE / TILE_SIZE, 0x000000, 0x000000);
grid.material.transparent=true;
grid.material.opacity=0.35;
grid.material.depthWrite=false;
grid.renderOrder=1;
scene.add(grid);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4096,4096),
  new THREE.MeshBasicMaterial({color:0x55aa55})
);
ground.rotation.x=-Math.PI/2;
ground.position.y=-0.002;
scene.add(ground);

function updateGrid(){
  const gx=Math.round(camera.position.x/TILE_SIZE)*TILE_SIZE;
  const gz=Math.round(camera.position.z/TILE_SIZE)*TILE_SIZE;
  grid.position.set(gx,0,gz);
}

// ----- Raycast & snap -----
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
function screenToGround(e){
  mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const p=new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane,p)?p.clone():null;
}
function snap(v){
  const x=Math.floor(v.x/TILE_SIZE)*TILE_SIZE+TILE_SIZE/2;
  const z=Math.floor(v.z/TILE_SIZE)*TILE_SIZE+TILE_SIZE/2;
  return new THREE.Vector3(x,0,z);
}

// ----- curseur 3x10 -----
const cursorGeo=new THREE.PlaneGeometry(ROAD_W, ROAD_L); cursorGeo.rotateX(-Math.PI/2);
const cursor=new THREE.Mesh(
  cursorGeo,
  new THREE.MeshBasicMaterial({color:0xffff00, transparent:true, opacity:0.25})
);
cursor.position.y=0.001; cursor.visible=false; scene.add(cursor);
function updateCursorOrient(){ cursor.rotation.y = (orient === "horizontal") ? Math.PI/2 : 0; }
updateCursorOrient();

// ====== ROUTES via GLB cloné ======
const gltfLoader = new GLTFLoader();
let roadPrefab = null;
let roadScale = new THREE.Vector3(1,1,1);

gltfLoader.load("./texture_models/road.glb", (gltf)=>{
  roadPrefab = gltf.scene;
  roadPrefab.traverse(o=>{
    if (o.isMesh && o.material){
      o.castShadow=o.receiveShadow=true;
      o.material.metalness=0; o.material.roughness=1;
    }
  });
  const box = new THREE.Box3().setFromObject(roadPrefab);
  const size = new THREE.Vector3(); box.getSize(size);
  roadScale.set(ROAD_W/(size.x||1), 1, ROAD_L/(size.z||1));
}, undefined, (e)=> console.error("GLB error:", e));

const roads=new Map();
function keyFromCenter(wx,wz){ return `${wx}:${wz}`; }

function place(wx,wz){
  if (!roadPrefab || money < ROAD_COST) return;
  const id=keyFromCenter(wx,wz); if(roads.has(id)) return;
  const obj = roadPrefab.clone(true);
  obj.position.set(wx,0.0005,wz);
  obj.scale.copy(roadScale);
  obj.rotation.y = (orient === "horizontal") ? Math.PI/2 : 0;
  obj.userData.cost = ROAD_COST;
  scene.add(obj); roads.set(id,obj);
  money -= ROAD_COST; renderMoney();
}

function eraseAtPointer(event){
  mouse.x=(event.clientX/innerWidth)*2-1; mouse.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects([...roads.values()], true); if(!hits.length) return;
  let node = hits[0].object, root=null;
  for(;;){
    if ([...roads.values()].includes(node)) { root=node; break; }
    if (!node.parent || node.parent===scene) break;
    node=node.parent;
  }
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
addEventListener("pointermove", e=>{
  const p=screenToGround(e); if(!p){ cursor.visible=false; return; }
  const s=snap(p); cursor.visible=(mode!=="pan"); cursor.position.set(s.x,0.001,s.z);
  if(mode==="road" && painting) place(s.x,s.z);
  if(mode==="bulldozer" && painting) eraseAtPointer(e);
});
addEventListener("pointerdown", e=>{
  if(e.button===0){
    if(mode==="road"){ const p=screenToGround(e); if(!p) return; const s=snap(p); painting=true; place(s.x,s.z); }
    else if(mode==="bulldozer"){ painting=true; eraseAtPointer(e); }
  } else if(e.button===2){ e.preventDefault(); }
});
addEventListener("pointerup", ()=> painting=false);
addEventListener("contextmenu", e=> e.preventDefault());

// ----- zoom + resize + loop -----
addEventListener("wheel", ()=>{
  camera.zoom=THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
});
addEventListener("resize", ()=>{
  setOrtho(camera);
  renderer.setSize(innerWidth, innerHeight);
});

function tick(){
  updateGrid();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
