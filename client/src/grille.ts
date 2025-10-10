import * as THREE from "three";
import { STEP, Z_GRID, align, ANG } from "./constants";
import { scene, camera } from "./scene";
import { getSelectedCity } from "./state";
import { post_one as postBuilding, get_all_from_city as getAllBuildingsForCity, type BuildingData } from "./server/buildings";
import { get_all as getAllCities } from "./server/cities";
import { addMoney, showSpend, showToast } from "./ui";
import { buildPlacedObject, removeObject, getAngle, houses, buildings as placedBuildings, roads, wells as placedWells, turbines as placedTurbines, sawmills as placedSawmills, keyFromCenter } from "./placement";
import STR from "./strings";
import type { Building } from "./types";



// map of example objects added by seedExampleBuildings; keys are object.uuid
export const exampleBuildings = new Map<string, THREE.Object3D>();



export const GRID_DIV = 800;
export const GRID_SIZE = GRID_DIV * STEP;

export const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIV, 0x000000, 0x000000);
(grid.material as any).transparent = true;
(grid.material as any).opacity = 0.35;
(grid.material as any).depthWrite = false;
(grid.material as any).depthTest = true;
grid.renderOrder = 1;
scene.add(grid);

export function updateGrid() {
  grid.position.set(align(camera.position.x), Z_GRID, align(camera.position.z));
  grid.rotation.x = 0;
}


export function worldToCellIndex(v: THREE.Vector3) {
  const ix = Math.floor(v.x / STEP);
  const iz = Math.floor(v.z / STEP);
  return { ix, iz };
}

export function snapToCell(v: THREE.Vector3) {
  const { ix, iz } = worldToCellIndex(v);
  const x = ix * STEP + STEP * 0.5;
  const z = iz * STEP + STEP * 0.5;
  return new THREE.Vector3(x, 0, z);
}


export async function seedExampleBuildings(data?: Building[]) {
  let source: Building[] | null = null;
  if (data && data.length) {
    source = data
  } else {
    // find a city (selected or first from DB)
    let city = getSelectedCity()
    if (!city) {
      try {
        const cities = await getAllCities()
        if (cities && cities.length > 0) city = (cities[0] as any)._id
      } catch (e) {
        console.warn("seedExampleBuildings: couldn't fetch cities", e)
      }
    }
    if (city) {
      try {
        source = await getAllBuildingsForCity(city as any)
      } catch (e) {
        console.warn("seedExampleBuildings: couldn't fetch buildings for city", e)
      }
    }
  }

  if (!source || source.length === 0) return

  for (const b of source) {
    try {
      const wx = b.position.x * STEP + STEP * 0.5
      const wz = b.position.y * STEP + STEP * 0.5
      const obj = buildPlacedObject(b.type as any, 0)
      if (!obj) continue
      // apply orientation from server if available
      try {
        const o = (b as any).orientation as string | undefined
        if (o && (o === "n" || o === "e" || o === "s" || o === "w")) {
          const map: Record<string, number> = { n: 0, e: 1, s: 2, w: 3 }
          obj.rotation.y = ANG[map[o]]
        }
      } catch (e) {
        // ignore
      }
      obj.position.set(wx, obj.position.y, wz)
      ;(obj as any).userData = { ...(obj as any).userData, example: true }
      scene.add(obj)
      exampleBuildings.set(obj.uuid, obj)
      try {
        // also register in the placement bags so bulldozer can find these seeded objects
        const id = keyFromCenter(wx, wz)
        const t = ((b as any).type as string || "").toLowerCase()
        if (t === "house") {
          houses.set(id, obj)
        } else if (t === "building") {
          placedBuildings.set(id, obj)
        } else if (t === "road") {
          roads.set(id, obj)
        } else if (t === "well") {
          placedWells.set(id, obj)
        } else if (t === "turbine") {
          placedTurbines.set(id, obj)
        } else if (t === "sawmill") {
          placedSawmills.set(id, obj)
        }
      } catch (e) {
        // ignore registration errors
      }
      if ((b as any)._id) {
        ;(obj as any).userData._id = (b as any)._id
      }
    } catch (e) {
      console.warn("seedExampleBuildings: skipped a test building", e)
    }
  }
}

export function clearExampleBuildings() {
  for (const obj of exampleBuildings.values()) {
    try {
      // remove from placement bags if present
      try {
        const id = keyFromCenter(obj.position.x, obj.position.z)
        houses.delete(id)
        placedBuildings.delete(id)
        roads.delete(id)
        placedWells.delete(id)
        placedTurbines.delete(id)
        placedSawmills.delete(id)
      } catch (e) {
        // ignore
      }
      removeObject(obj)
    } catch (e) {
      console.warn("clearExampleBuildings: failed to remove", e)
    }
  }
  exampleBuildings.clear()
}


export async function placeBuilding(kind: string, wx: number, wz: number, cost: number) {
  const city = getSelectedCity();
  if (city === null) {
    return { ok: false, err: "no_city" };
  }
  // compute tile indices from world coordinates
  const { ix, iz } = worldToCellIndex(new THREE.Vector3(wx, 0, wz));
  // check DB for existing building/road at this tile
  try {
    const existing = await getAllBuildingsForCity(city as any);
    if (existing && existing.some((b) => (b.position?.x === ix && b.position?.y === iz))) {
      showToast("Emplacement déjà occupé")
      return { ok: false, err: "occupied" }
    }
  } catch (e) {
    // if we cannot check, log and continue — we'll still try to post but warn
    console.warn("placeBuilding: could not verify existing buildings", e)
  }

  const payload: BuildingData = {
    city,
    type: kind,
    position: { x: ix, y: iz },
    // set orientation according to current placement angle
    orientation: ((): "n" | "e" | "s" | "w" => {
      const ai = getAngle() & 3
      return ai === 0 ? "n" : ai === 1 ? "e" : ai === 2 ? "s" : "w"
    })()
  };

  try {
    const res = await postBuilding(payload);
    const obj = buildPlacedObject(kind as any, cost);
    if (!obj) return { ok: false, err: "model" };
    const worldX = ix * STEP + STEP * 0.5;
    const worldZ = iz * STEP + STEP * 0.5;
    obj.position.set(worldX, obj.position.y, worldZ);
    scene.add(obj);
    addMoney(-cost);
    showSpend(cost);
    if (res && (res as any)._id) {
      (obj as any).userData._id = (res as any)._id;
    }
    return { ok: true, obj };
  } catch (e: any) {
    showToast(STR.TOAST.PLACEMENT_FAILED);
    return { ok: false, err: "server" };
  }
}

export default { GRID_DIV, GRID_SIZE, grid, updateGrid };
