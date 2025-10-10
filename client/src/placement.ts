import * as THREE from "three"
import { scene } from "./scene"
import { ANG, CELL, Z_CURSOR, Z_PREVIEW, Z_ROAD } from "./constants"
import { MODELS } from "./models"
import type { CursorMode, BuildingKind, ModelKey } from "./types"
// ...existing code...

export let mode: CursorMode = "pan"
export let piece: "I" | "L" | "X" = "I"
export let angleIndex = 0

// === setters/getters pour éviter les réassignations depuis main.ts ===
export function setMode(m: CursorMode) {
  mode = m
}
export function getMode() {
  return mode
}
export function setPiece(p: "I" | "L" | "X") {
  piece = p
}
export function getPiece() {
  return piece
}
export function incAngle() {
  angleIndex = (angleIndex + 1) & 3
}
export function getAngle() {
  return angleIndex
}

export const roads = new Map<string, THREE.Object3D>()
export const houses = new Map<string, THREE.Object3D>()
export const buildings = new Map<string, THREE.Object3D>()
export const wells = new Map<string, THREE.Object3D>()
export const turbines = new Map<string, THREE.Object3D>()
export const sawmills = new Map<string, THREE.Object3D>()

let cursor: THREE.Mesh | null = null
let preview: THREE.Object3D | null = null

const GEO_PLACEMENT = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2)

export function makeCursor() {
  if (cursor) {
    scene.remove(cursor)
  }
  cursor = new THREE.Mesh(
    GEO_PLACEMENT.clone(),
    new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.25 })
  )
  cursor.position.y = Z_CURSOR
  cursor.visible = false
  scene.add(cursor)
}
export function updateCursorOrient() {
  if (cursor) {
    cursor.rotation.y = ANG[angleIndex]
  }
}

export function makePreview() {
  if (preview) {
    scene.remove(preview)
    preview = null
  }
  // Bulldozer: simple red cell indicator, not a building/road model
  if (mode === "bulldozer") {
    const geo = new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9).rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.85 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = Z_PREVIEW + 0.0002
    mesh.renderOrder = 50
    mesh.userData.baseLift = 0
    preview = mesh
    preview.visible = true
    scene.add(preview)
    return
  }
  const key: ModelKey =
    mode === "house"
      ? "HOUSE"
      : mode === "building"
        ? "BUILDING"
        : mode === "well"
          ? "WELL"
          : mode === "turbine"
            ? "TURBINE"
            : mode === "sawmill"
              ? "SAWMILL"
              : (piece as ModelKey)

  const M = MODELS[key]
  if (!M || !M.prefab) {
    return
  }

  const obj = M.prefab.clone(true)
  obj.scale.copy(M.scale)
  obj.rotation.y = ANG[angleIndex]
  obj.position.y = Z_PREVIEW + M.baseLift
  ;(obj as any).userData.baseLift = M.baseLift
  obj.traverse((n: any) => {
    if (n.isMesh && n.material) {
      const m = n.material.clone()
      if (mode === "bulldozer") {
        if (m.color && typeof m.color.set === "function") {
          m.color.set(0xff3333)
        }
        m.opacity = 0.6
      } else {
        m.opacity = 0.5
      }
      m.transparent = true
      m.depthWrite = false
      n.material = m
    }
  })
  obj.visible = mode !== "pan"
  preview = obj
  scene.add(preview!)
}
export function updatePreviewRotation() {
  if (preview) {
    preview.rotation.y = ANG[angleIndex]
  }
}
export function updatePreviewPosition(pos: THREE.Vector3) {
  if (!preview) {
    return
  }
  const lift = (preview as any).userData?.baseLift || 0
  preview.position.set(pos.x, Z_PREVIEW + lift, pos.z)
}

export function buildPlacedObject(
  kind: "road" | "house" | "building" | "well" | "turbine" | "sawmill",
  cost: number
) {
  const key: ModelKey =
    kind === "house"
      ? "HOUSE"
      : kind === "building"
        ? "BUILDING"
        : kind === "well"
          ? "WELL"
          : kind === "turbine"
            ? "TURBINE"
            : kind === "sawmill"
              ? "SAWMILL"
              : (piece as ModelKey)

  const M = MODELS[key]
  if (!M || !M.prefab) {
    return null
  }

  const obj = M.prefab.clone(true)
  obj.scale.copy(M.scale)
  obj.rotation.y = ANG[angleIndex]
  obj.position.y = Z_ROAD + M.baseLift
  ;(obj as any).userData = { cost, kind, piece, angle: angleIndex, groundPlate: null }
  return obj
}

export function keyFromCenter(wx: number, wz: number) {
  // Use integer tile indices as the canonical key so seeded objects and
  // preview/cursor-generated keys match exactly (avoids float formatting
  // and rounding mismatches). CELL is equal to STEP in constants.
  const ix = Math.floor(wx / CELL)
  const iz = Math.floor(wz / CELL)
  return `${ix}:${iz}`
}
export function keyFromTile(ix: number, iz: number) {
  return `${ix}:${iz}`
}
export function hasAdjacentRoad(wx: number, wz: number) {
  return (
    roads.has(keyFromCenter(wx + CELL, wz)) ||
    roads.has(keyFromCenter(wx - CELL, wz)) ||
    roads.has(keyFromCenter(wx, wz + CELL)) ||
    roads.has(keyFromCenter(wx, wz - CELL))
  )
}

export function setCursorVisible(v: boolean) {
  if (cursor) {
    cursor.visible = v
  }
}
export function setCursorPosition(x: number, z: number) {
  if (cursor) {
    cursor.position.set(x, 0.001, z)
  }
}
export function setPreviewVisible(v: boolean) {
  if (preview) {
    preview.visible = v
  }
}

export function placeGeneric(
  wx: number,
  wz: number,
  cost: number,
  bag: Map<string, THREE.Object3D>,
  kind: BuildingKind
) {
  // NOTE: placement validations (money, occupancy, adjacency) intentionally
  // removed — placements created locally will always be placed. Money handling
  // and server-side validations should be handled by the caller when needed.
  const id = keyFromCenter(wx, wz)
  const obj = buildPlacedObject(kind, cost)
  if (!obj) {
    return { ok: false, err: "model" }
  }
  obj.position.set(wx, obj.position.y, wz)
  scene.add(obj)
  bag.set(id, obj)
  return { ok: true, err: "" }
}

export function removeObject(root: THREE.Object3D) {
  scene.remove(root)
  root.traverse((n: any) => {
    if (n.isMesh) {
      n.geometry?.dispose?.()
      const m: any = n.material
      if (m?.map) {
        m.map.dispose()
      }
      m?.dispose?.()
    }
  })
}

export { cursor, preview }
