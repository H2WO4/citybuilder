import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CELL } from "./constants";
import { type ModelKey, type ModelEntry, type CharEntry } from "./types";

import URL_STREET_L from "../texture_models/Roads/StreetCorner.glb?url";
import URL_STREET_I from "../texture_models/Roads/StreetStraight.glb?url";
import URL_STREET_X from "../texture_models/Roads/Crosswalk.glb?url";
import URL_HOUSE    from "../texture_models/Buildings/House.glb?url";
import URL_BUILDING from "../texture_models/Buildings/Building.glb?url";
import URL_WELL     from "../texture_models/Buildings/Well.glb?url";
import URL_TURBINE  from "../texture_models/Buildings/WindTurbine.glb?url";
import URL_SAWMILL  from "../texture_models/Buildings/FantasySawmill.glb?url";
import URL_ANIMATED_WOMAN from "../texture_models/character/AnimatedWoman.glb?url";
import URL_ANIMATED_WOMAN_2 from "../texture_models/character/AnimatedWoman2.glb?url";
import URL_BUSINESSMAN from "../texture_models/character/BusinessMan.glb?url";
import URL_HOODIE_CHARACTER from "../texture_models/character/HoodieCharacter.glb?url";

export const gltfLoader = new GLTFLoader();

export const MODELS: Record<ModelKey, ModelEntry> = {
  I:{path:URL_STREET_I,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  L:{path:URL_STREET_L,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  X:{path:URL_STREET_X,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  HOUSE:{path:URL_HOUSE,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  BUILDING:{path:URL_BUILDING,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:1, baseLift:0},
  WELL:{path:URL_WELL,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.40, baseLift:0},
  TURBINE:{path:URL_TURBINE,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.55, baseLift:0},
  SAWMILL:{path:URL_SAWMILL,prefab:null,scale:new THREE.Vector3(),target:[CELL,CELL],scaleMul:0.85, baseLift:0},
};

export const CHAR_MODELS: CharEntry[] = [
  { path: URL_ANIMATED_WOMAN, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_ANIMATED_WOMAN_2, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_BUSINESSMAN, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
  { path: URL_HOODIE_CHARACTER, prefab: null, clips: [], baseScale: new THREE.Vector3(1,1,1), normScale: 1, footOffset: 0 },
];

export function loadStaticModels(onModelReady: (k:ModelKey)=>void){
  (Object.keys(MODELS) as ModelKey[]).forEach((key)=>{
    const entry = MODELS[key];
    gltfLoader.load(entry.path, (gltf:any)=>{
      const root = gltf.scene as THREE.Object3D;
      root.traverse((obj:any)=>{
        if (obj.isMesh && obj.material){
          obj.material.metalness = 0; obj.material.roughness = 1;
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const sz = new THREE.Vector3(); box.getSize(sz);
      const [targetX, targetZ] = entry.target;
      const sX = (sz.x>1e-6) ? targetX/sz.x : 1;
      const sZ = (sz.z>1e-6) ? targetZ/sz.z : 1;
      const sY = 0.5*(sX+sZ);
      entry.scale.set(sX*entry.scaleMul, sY*entry.scaleMul, sZ*entry.scaleMul);
      entry.baseLift = (-box.min.y) * entry.scale.y;
      entry.prefab = root;
      onModelReady(key);
    }, undefined, (e)=> console.error("GLB load error:", key, entry.path, e));
  });
}

export const TARGET_H = 0.70;
export const FOOT_EPS  = 0.002;

export function loadCharacters(done?:()=>void){
  let remain = CHAR_MODELS.length;
  CHAR_MODELS.forEach(C=>{
    gltfLoader.load(C.path,(g:any)=>{
      const root: THREE.Object3D = g.scene;
      root.updateWorldMatrix(true,true);
      C.baseScale = (root as any).scale?.clone?.() ?? new THREE.Vector3(1,1,1);
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(); box.getSize(size);
      const h = Math.max(1e-6, size.y);
      C.normScale = TARGET_H / h;
      C.footOffset = -box.min.y * C.normScale + FOOT_EPS;
      root.traverse((o:any)=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=true; }});
      C.prefab = root; C.clips = g.animations || [];
      if (--remain===0 && done) done();
    }, undefined, (e)=> console.error("GLB PNJ load error:", C.path, e));
  });
}
