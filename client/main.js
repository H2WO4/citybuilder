import * as THREE from './node_modules/three/build/three.module.js';
import { MapControls } from './node_modules/three/examples/jsm/controls/MapControls.js';

// ----- paramètres -----
const TILE_SIZE = 1;
const GRID_VIS_SIZE = 128;
const MIN_ZOOM = 0.4, MAX_ZOOM = 6;
let viewSize = 40; // hauteur visible en unités

// ----- scène -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

// ----- caméra ORTHO vue “en coin” -----
function setOrtho(cam){
  const a = innerWidth/innerHeight;
  cam.left = -a*viewSize/2; cam.right = a*viewSize/2;
  cam.top = viewSize/2; cam.bottom = -viewSize/2;
  cam.updateProjectionMatrix();
}
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,2000);
camera.position.set(30, 30, 30);
camera.lookAt(0, 0, 0);
camera.zoom = 1;
setOrtho(camera);

// ----- rendu -----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// ----- contrôles (pan/zoom uniquement) -----
const controls = new MapControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.mouseButtons.LEFT = null;                 // clic gauche libre pour poser
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.addEventListener('change', () => {
  camera.position.y = Math.max(camera.position.y, 1);
});

// ----- grille “infinie” -----
const grid = new THREE.GridHelper(GRID_VIS_SIZE, GRID_VIS_SIZE/TILE_SIZE, 0x000000, 0x000000);
grid.material.transparent = true;
grid.material.opacity = 0.35;
grid.material.depthWrite = false;
grid.renderOrder = 1;
scene.add(grid);

// ----- SOL VERT sous la grille -----
const groundGeo = new THREE.PlaneGeometry(GRID_VIS_SIZE, GRID_VIS_SIZE);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x55aa55 }); // vert constant
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = -0.002; // léger offset sous la grille
ground.renderOrder = 0;
scene.add(ground);

// repositionne grille + sol autour de la caméra
function updateGrid(){
  const gx = Math.round(camera.position.x / TILE_SIZE) * TILE_SIZE;
  const gz = Math.round(camera.position.z / TILE_SIZE) * TILE_SIZE;
  grid.position.set(gx, 0, gz);
  ground.position.set(gx, -0.002, gz);
}

// ----- plan Y=0 pour raycast -----
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function screenToGround(e){
  mouse.x = (e.clientX/innerWidth)*2 - 1;
  mouse.y = -(e.clientY/innerHeight)*2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p.clone() : null;
}
function snap(vec3){
  const x = Math.floor(vec3.x/TILE_SIZE)*TILE_SIZE + TILE_SIZE/2;
  const z = Math.floor(vec3.z/TILE_SIZE)*TILE_SIZE + TILE_SIZE/2;
  return new THREE.Vector3(x,0,z);
}

// ----- curseur -----
const tileGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE); tileGeo.rotateX(-Math.PI/2);
const cursor = new THREE.Mesh(
  tileGeo,
  new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.25 })
);
cursor.position.y = 0.001; cursor.visible = false; scene.add(cursor);

// ----- routes -----
const roadGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE); roadGeo.rotateX(-Math.PI/2);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const roads = new Map(); // "x:z" -> mesh
function k(wx,wz){ return `${wx}:${wz}`; }
function place(wx,wz){
  const id = k(wx,wz); if (roads.has(id)) return;
  const m = new THREE.Mesh(roadGeo, roadMat);
  m.position.set(wx,0.0005,wz);
  m.renderOrder = 2;
  scene.add(m); roads.set(id,m);
}
function erase(wx,wz){
  const id = k(wx,wz); const m = roads.get(id); if(!m) return;
  scene.remove(m); m.geometry.dispose(); m.material.dispose(); roads.delete(id);
}

// ----- interactions -----
let painting = false;
addEventListener('pointermove', e=>{
  const p = screenToGround(e); if(!p){ cursor.visible=false; return; }
  const s = snap(p); cursor.visible=true; cursor.position.set(s.x,0.001,s.z);
  if (painting) place(s.x, s.z);
});
addEventListener('pointerdown', e=>{
  const p = screenToGround(e); if(!p) return;
  const s = snap(p);
  if (e.button===0){ painting=true; place(s.x,s.z); }     // gauche = poser
  if (e.button===2){ e.preventDefault(); erase(s.x,s.z);} // droit = gommer
});
addEventListener('pointerup', ()=> painting=false);
addEventListener('contextmenu', e=> e.preventDefault());

// ----- zoom borné -----
addEventListener('wheel', ()=>{
  camera.zoom = THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  camera.updateProjectionMatrix();
});

// ----- resize -----
addEventListener('resize', ()=>{
  setOrtho(camera);
  renderer.setSize(innerWidth, innerHeight);
});

// ----- boucle -----
function tick(){
  updateGrid();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
