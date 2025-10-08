import * as THREE from "three"
import type { UUIDTypes as UUID } from "uuid";

export type CursorMode = "pan" | "road" | "house" | "building" | "bulldozer" | "well" | "turbine" | "sawmill"
export type BuildingKind = "road" | "house" | "building" | "well" | "turbine" | "sawmill"
export type ModelKey = "I" | "L" | "X" | "HOUSE" | "BUILDING" | "WELL" | "TURBINE" | "SAWMILL"

export interface ModelEntry {
  path: string
  prefab: THREE.Object3D | null
  scale: THREE.Vector3
  target: [number, number]
  scaleMul: number // multiplicateur final
  baseLift: number // offset Y pour poser au sol après scale
}

export type CharEntry = {
  path: string
  prefab: THREE.Object3D | null
  clips: THREE.AnimationClip[]
  baseScale: THREE.Vector3
  normScale: number
  footOffset: number
}

export interface Walker {
  obj: THREE.Object3D
  mixer: THREE.AnimationMixer
  walkAction?: THREE.AnimationAction | null
  dir: THREE.Vector3         
  speed: number            
  life: number              
  tileX: number              
  tileZ: number              
  axis: 'x'|'z'               
  lateralPhase: number    
  lateralFreq: number  
  lateralAmp: number   
  prevLat: number         
  perp: THREE.Vector3  
  state: 'walk' | 'turn' | 'idle'
  turnT: number           
  turnDur: number     
  startQuat: THREE.Quaternion | null
  endQuat: THREE.Quaternion | null
  queuedDir: THREE.Vector3 | null
  baseSpeed: number
  idleT: number           
  idleDur: number       
}

export interface City {
  _id: UUID,
  name: string,
}

export interface Building {
  _id: UUID,
  city: UUID,

  type: string,

  position: {
    x: number,
    y: number,
  },
  orientation: "n" | "s" | "e" | "w"
}

export enum BuildingClass {
  Residential,
  Commercial,
  Industry,
  Entertainment,
  Services,
}

export interface BuildingType {
  id: string,
  name: string,
  class: BuildingClass,

  stats: {
    population?: {
      houses?: number,
      employs?: number,
    }
    electricity?: number,
    water?: number,
    food?: number,
  }
}

