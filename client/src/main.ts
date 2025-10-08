import * as THREE from "three";
import { stats, renderer, camera, fpsHud, setOrtho, rotateCameraQuarter, stepCameraRotation, updateGrid, clampZoom, scene } from "./scene";
import { loadStaticModels, loadCharacters } from "./models";
import { CELL } from "./constants";
import type { BuildingKind, CursorMode } from "./types";
import {
  makeCursor, updateCursorOrient,
  makePreview, updatePreviewRotation, updatePreviewPosition,
  setCursorVisible, setCursorPosition, setPreviewVisible,
  placeGeneric, roads, houses, buildings, wells, turbines, sawmills,
  setMode, setPiece, getPiece, incAngle
} from "./placement";
import { updateWalkers } from "./npc";
import { showToast } from "./ui";

// input helpers
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function screenToGround(e: PointerEvent) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p.clone() : null;
}
function overUI(e: any) { return !!(e && e.target && (e.target as HTMLElement).closest(".ui")); }
function snapToCell(v: THREE.Vector3) {
  const x = Math.floor(v.x / CELL) * CELL + CELL * 0.5;
  const z = Math.floor(v.z / CELL) * CELL + CELL * 0.5;
  return new THREE.Vector3(x, 0, z);
}

// mode + UI
let currentMode: CursorMode = "pan";
function updateFabActive() {
  const fabList = document.getElementById("fab-tools");
  if (!fabList) return;
  [...fabList.children].forEach(el => {
    const li = el as HTMLElement;
    if (li.dataset.tool === currentMode) li.classList.add("active"); else li.classList.remove("active");
  });
}
function setActive(m: CursorMode) {
  const prev = currentMode;
  currentMode = m;
  setMode(m);
  updateFabActive();
  const isBuild = m === "road" || m === "house" || m === "building" || m === "well" || m === "turbine" || m === "sawmill" || m === "bulldozer";
  if (m === "bulldozer") document.body.style.cursor = "not-allowed";
  else if (isBuild) document.body.style.cursor = "crosshair";
  else document.body.style.cursor = "default";
  if (isBuild) {
    makePreview();
    if (lastPointerEvent) setPreviewVisible(!overUI(lastPointerEvent));
    if (lastPointerEvent) {
      const p = screenToGround(lastPointerEvent);
      if (p) updatePreviewPosition(snapToCell(p));
    }
  }
  if (prev !== m) painting = false;
}
const fab = document.getElementById("fab");
const fabList = document.getElementById("fab-tools");
if (fab && fabList) {
  fab.addEventListener("click", (e) => {
    fab.classList.toggle("active");
    e.stopPropagation();
  });
  document.addEventListener("click", (e) => {
    if (!fab.contains(e.target as Node)) fab.classList.remove("active");
  });
  fabList.addEventListener("click", (event) => {
    const li = (event.target as HTMLElement).closest<HTMLLIElement>("li[data-tool]");
    if (!li) return;
    const tool = li.dataset.tool as CursorMode;
    const wasBulldozer = currentMode === 'bulldozer';
    setActive(tool);
    // Messages toast cohérents
const labels: Record<CursorMode, string> = {
  pan: "Déplacement",
  road: "Route",
  house: "Maison",
  building: "Immeuble",
  well: "Puits",
  turbine: "Éolienne",
  sawmill: "Scierie",
  bulldozer: wasBulldozer ? "Bulldozer désactivé" : "Bulldozer activé"
};
    showToast(labels[tool] || tool);
    fab.classList.remove("active");
  });
}


// rotate piece
function cyclePiece() {
  const next = getPiece() === "I" ? "L" : getPiece() === "L" ? "X" : "I";
  setPiece(next);
  makePreview();
  if (lastPointerEvent) {
    const p = screenToGround(lastPointerEvent); if (p) { const s = snapToCell(p); updatePreviewPosition(s); }
  }
  showToast(`Route: ${next}`);
}
addEventListener("keydown", (e) => {
  if ((e.key === 'r' || e.key === 'R') && currentMode === 'road') { e.preventDefault(); cyclePiece(); }
  if (e.key === 'x' || e.key === 'X') {
    e.preventDefault();
    const wasBulldozer = currentMode === 'bulldozer';
    setActive(wasBulldozer ? 'pan' : 'bulldozer');
    showToast(wasBulldozer ? 'Bulldozer désactivé' : 'Bulldozer activé');
  }
  if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); rotateCameraQuarter(-1, 300); }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); rotateCameraQuarter(+1, 300); }
  const rotatable = currentMode === "road" || currentMode === "house" || currentMode === "building" || currentMode === "well" || currentMode === "turbine" || currentMode === "sawmill";
  if ((e.key === 'a' || e.key === 'A') && rotatable) { e.preventDefault(); incAngle(); updateCursorOrient(); updatePreviewRotation(); }
  if (e.key === '1') { setActive("well"); showToast("Puits"); }
  if (e.key === '2') { setActive("turbine"); showToast("Éolienne"); }
  if (e.key === '3') { setActive("sawmill"); showToast("Scierie"); }
});

// pointer
let painting = false;
let lastPointerEvent: PointerEvent | null = null;

addEventListener("pointermove", (e) => {
  lastPointerEvent = e;
  if (overUI(e)) { setCursorVisible(false); setPreviewVisible(false); return; }
  const p = screenToGround(e); if (!p) { setCursorVisible(false); setPreviewVisible(false); return; }
  const s = snapToCell(p);
  setCursorVisible(currentMode !== "pan" && currentMode !== "bulldozer");
  setCursorPosition(s.x, s.z);
  const isBuild = currentMode === "road" || currentMode === "house" || currentMode === "building" || currentMode === "well" || currentMode === "turbine" || currentMode === "sawmill" || currentMode === "bulldozer";
  // bulldozer uses only red plane (no yellow cursor overlay)
  setPreviewVisible(isBuild);
  if (isBuild) { updatePreviewPosition(s); updatePreviewRotation(); }
  if (!painting) return;
  tryPlace(currentMode, s.x, s.z);
});

function tryPlace(m: CursorMode, x: number, z: number) {
  const needRoad = m !== "road";
  const cost = m === "road" ? 200 : m === "house" ? 1200 : m === "building" ? 5000 : m === "well" ? 800 : m === "turbine" ? 1500 : 1000;
  const bag = m === "road" ? roads : m === "house" ? houses : m === "building" ? buildings : m === "well" ? wells : m === "turbine" ? turbines : sawmills;
  const res = placeGeneric(x, z, cost, bag, m as BuildingKind, { requireRoad: needRoad });
  if (!res.ok) {
    if ((m === "house" || m === "building") && res.err === "no_road") showToast("Besoin d’une route adjacente pour placer ici");
    return;
  }
}

addEventListener("pointerdown", (e) => {
  if (overUI(e)) return;
  if (e.button === 0) {
    const p = screenToGround(e); if (!p) return; const s = snapToCell(p);
    if (currentMode === "bulldozer") {
      // Cherche un objet à supprimer à cette position
      const id = `${s.x}:${s.z}`;
      let found = false;
      const bags = [houses, buildings, wells, turbines, sawmills, roads];
      for (const bag of bags) {
        const obj = bag.get(id);
        if (obj) {
          bag.delete(id);
          // @ts-ignore
          import("./placement").then(m => m.removeObject(obj));
          found = true;
          showToast("Bâtiment supprimé");
          break;
        }
      }
      if (!found) showToast("Aucun bâtiment à supprimer ici");
      return;
    }
    painting = true;
    tryPlace(currentMode, s.x, s.z);
  } else if (e.button === 2) {
    e.preventDefault();
    if (currentMode === "bulldozer") { setActive("pan"); showToast("Bulldozer annulé"); }
    else if (currentMode !== "pan") { setActive("pan"); showToast("Placement annulé"); }
  }
});
addEventListener("pointerup", () => painting = false);
addEventListener("contextmenu", e => e.preventDefault());

// load models
loadStaticModels((k) => { if (k === "I" || k === "L" || k === "X" || k === "HOUSE" || k === "BUILDING") makePreview(); });
loadCharacters();

// cursor
makeCursor();

// wheel + resize
addEventListener("wheel", () => clampZoom());
addEventListener("resize", () => { setOrtho(); renderer.setSize(innerWidth, innerHeight); });

// loop
let frames = 0, t0 = performance.now(), lastWalkerUpdate = performance.now();
function tick() {
  stats.begin();
  stepCameraRotation(performance.now());
  updateGrid();
  const nowTime = performance.now();
  const dt = (nowTime - lastWalkerUpdate) / 1000;
  updateWalkers(dt);
  lastWalkerUpdate = nowTime;
  renderer.render(scene, camera);
  stats.end();
  frames++;
  const now = performance.now();
  if (now - t0 >= 500) {
    const fps = Math.round(frames * 1000 / (now - t0));
    if (fpsHud) fpsHud.textContent = `${fps} FPS`;
    frames = 0; t0 = now;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
