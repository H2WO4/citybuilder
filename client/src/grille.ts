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


import { getMode } from "./placement";

export async function placeBuilding(kind: string, wx: number, wz: number, cost: number) {
  // Empêche le placement si le mode courant n'est pas un mode de construction
  const mode = getMode();
  if (mode === "pan" || mode === "bulldozer" || !["road","house","building","well","turbine","sawmill"].includes(mode)) {
    showToast("Sélectionne un type de bâtiment avant de placer !");
    return { ok: false, err: "bad_mode" };
  }
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
    // register placed object in the placement bags so bulldozer and NPCs can
    // find it. Use canonical keyFromCenter to match seeded objects.
    try {
      const id = keyFromCenter(worldX, worldZ)
      const t = (kind || "").toLowerCase()
      ;(obj as any).userData = { ...(obj as any).userData, cost, example: false }
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
      // non-fatal: registration failure shouldn't block placement
      console.warn('placeBuilding: failed to register placed object', e)
    }
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

export async function refreshCity(city?: string | null) {
  // clear current example objects then fetch & seed from server for the
  // provided city (or selected city if omitted).
  let target = city || getSelectedCity()
  if (!target) {
    try {
      const cities = await getAllCities()
      if (cities && cities.length > 0) target = (cities[0] as any)._id
    } catch (e) {
      console.warn('refreshCity: failed to fetch cities', e)
    }
  }
  // clear local placement objects and examples so the scene mirrors the
  // server state for this city. This removes any previously-placed objects
  // and avoids stale visuals requiring a manual reload.
  try {
    // remove and clear all placement maps
    for (const m of [houses, placedBuildings, roads, placedWells, placedTurbines, placedSawmills]) {
      for (const obj of m.values()) {
        try {
          removeObject(obj)
        } catch (e) {
          // ignore
        }
      }
      m.clear()
    }
  } catch (e) {
    console.warn('refreshCity: failed to clear placement maps', e)
  }
  // also clear seeded examples
  clearExampleBuildings()
  if (!target) return
  try {
    const all = await getAllBuildingsForCity(target as any)
    await seedExampleBuildings(all)
  } catch (e) {
    console.warn('refreshCity: failed to load buildings for', target, e)
  }
}

export default { GRID_DIV, GRID_SIZE, grid, updateGrid };
