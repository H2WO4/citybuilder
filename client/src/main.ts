import { login, signin, logout } from "./server/accounts"
// Gestion de la pop-up d'authentification
function showAuthModal(show = true) {
  const overlay = document.getElementById("auth-modal-overlay") as HTMLDivElement
  if (overlay) overlay.classList.toggle("hidden", !show)
  if (show) {
    ;(document.getElementById("auth-username") as HTMLInputElement)?.focus()
  }
}

function setAuthError(msg: string) {
  const err = document.getElementById("auth-error") as HTMLDivElement
  if (err) err.textContent = msg
}

function isAuthenticated() {
  // Simple: on vérifie un flag localStorage (à remplacer par un vrai check session si besoin)
  return localStorage.getItem("isAuthenticated") === "1"
}

function setAuthenticated(val: boolean) {
  localStorage.setItem("isAuthenticated", val ? "1" : "0")
}

function blockBackgroundInteractions(block = true) {
  // On bloque tout sauf la modale
  if (block) {
    document.body.style.overflow = "hidden"
  } else {
    document.body.style.overflow = ""
  }
}

function setupAuthModal() {
  const overlay = document.getElementById("auth-modal-overlay") as HTMLDivElement
  const form = document.getElementById("auth-form") as HTMLFormElement
  const loginBtn = document.getElementById("login-btn") as HTMLButtonElement
  const signupBtn = document.getElementById("signup-btn") as HTMLButtonElement
  if (!overlay || !form || !loginBtn || !signupBtn) return

  // Empêche la fermeture de la modale
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      // Optionnel: on ne ferme pas la modale si on clique dehors
      e.preventDefault()
    }
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    setAuthError("")
    const username = (document.getElementById("auth-username") as HTMLInputElement).value.trim()
    const password = (document.getElementById("auth-password") as HTMLInputElement).value
    if (!username || !password) {
      setAuthError("Veuillez remplir tous les champs.")
      return
    }
    loginBtn.disabled = true
    signupBtn.disabled = true
    try {
      await login({ name: username, pass: password })
      setAuthenticated(true)
      showAuthModal(false)
      blockBackgroundInteractions(false)
      updateLogoutBtn()
      showToast("Connexion réussie !")
    } catch (err: any) {
      console.error("Erreur de connexion:", err)
      setAuthError(err.message || "Identifiants incorrects.")
    } finally {
      loginBtn.disabled = false
      signupBtn.disabled = false
    }
  })

  signupBtn.addEventListener("click", async (e) => {
    e.preventDefault()
    setAuthError("")
    const username = (document.getElementById("auth-username") as HTMLInputElement).value.trim()
    const password = (document.getElementById("auth-password") as HTMLInputElement).value
    if (!username || !password) {
      setAuthError("Veuillez remplir tous les champs.")
      return
    }
    loginBtn.disabled = true
    signupBtn.disabled = true
    try {
      await signin({ name: username, pass: password })
      setAuthenticated(true)
      showAuthModal(false)
      blockBackgroundInteractions(false)
      updateLogoutBtn()
      showToast("Compte créé avec succès !")
    } catch (err: any) {
      console.error("Erreur de création de compte:", err)
      setAuthError(err.message || "Erreur lors de la création du compte.")
    } finally {
      loginBtn.disabled = false
      signupBtn.disabled = false
    }
  })
}

// Affiche ou masque le bouton déconnexion selon l'état de connexion
function updateLogoutBtn() {
  const fabItem = document.getElementById("logout-fab-item") as HTMLLIElement
  if (!fabItem) return
  if (isAuthenticated()) {
    fabItem.classList.remove("hidden")
  } else {
    fabItem.classList.add("hidden")
  }
}

// Gestion de la déconnexion
// async function handleLogout() {
//   try {
//     await logout()
//   } catch (err: any) {
//     // Si l'erreur est "please login first", c'est que l'utilisateur n'était déjà plus connecté côté serveur
//     // On continue quand même la déconnexion côté client
//     if (!err.message.includes("please login first")) {
//       console.error("Erreur de déconnexion:", err)
//       showToast("Erreur lors de la déconnexion.")
//       return
//     }
//   }

//   // Déconnexion côté client dans tous les cas
//   setAuthenticated(false)
//   showAuthModal(true)
//   blockBackgroundInteractions(true)
//   updateLogoutBtn()
//   showToast("Déconnexion réussie.")
// }

// Affiche la modale si non connecté
document.addEventListener("DOMContentLoaded", () => {
  setupAuthModal()
  updateLogoutBtn()
  if (!isAuthenticated()) {
    showAuthModal(true)
    blockBackgroundInteractions(true)
  }
  // Initialiser le dashboard financier (touche D)
  import("./dashboard").then((m) => m.initDashboard())
})
import * as THREE from "three"
import {
  stats,
  renderer,
  camera,
  fpsHud,
  setOrtho,
  rotateCameraQuarter,
  stepCameraRotation,
  clampZoom,
  scene
} from "./scene"
import { updateGrid, snapToCell, worldToCellIndex } from "./grille"
import { loadStaticModels, loadCharacters } from "./models"
import type { BuildingKind, CursorMode } from "./types"
import {
  makeCursor,
  updateCursorOrient,
  makePreview,
  updatePreviewRotation,
  updatePreviewPosition,
  setCursorVisible,
  setCursorPosition,
  setPreviewVisible,
  placeGeneric,
  roads,
  houses,
  buildings,
  wells,
  turbines,
  sawmills,
  setMode,
  setPiece,
  getPiece,
  incAngle,
  keyFromCenter
} from "./placement"
import { updateWalkers } from "./npc"
import { showToast } from "./ui"
import { placeBuilding, seedExampleBuildings, clearExampleBuildings } from "./grille"
import { get_all as getAllCities } from "./server/cities"
import { delete_one, get_all_from_city as getAllBuildingsForCity } from "./server/buildings"
import { setSelectedCity } from "./state"

// input helpers
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
function screenToGround(e: PointerEvent) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const p = new THREE.Vector3()
  return raycaster.ray.intersectPlane(groundPlane, p) ? p.clone() : null
}
function overUI(e: any) {
  return !!(e && e.target && (e.target as HTMLElement).closest(".ui"))
}

// mode + UI
let currentMode: CursorMode = "pan"

// city selector wiring
async function initCitySelector() {
  const citySelectEl = document.getElementById("city-select") as HTMLSelectElement | null
  if (!citySelectEl) return
  citySelectEl.innerHTML = '<option value="">Chargement...</option>'
  try {
    const cities = await getAllCities()
    citySelectEl.innerHTML = ""
    if (!cities || cities.length === 0) {
      citySelectEl.innerHTML = '<option value="">Aucune ville</option>'
      return
    }
    const saved = localStorage.getItem("selectedCity")
    for (const c of cities) {
      const opt = document.createElement("option")
      opt.value = (c as any)._id
      // show name + uuid so user can see the id
      opt.textContent = `${(c as any).name || (c as any)._id} — ${(c as any)._id}`
      citySelectEl.appendChild(opt)
    }
    if (saved) {
      citySelectEl.value = saved
      setSelectedCity(saved)
      // seed buildings for saved city
      try {
        const b = await getAllBuildingsForCity(saved)
        clearExampleBuildings()
        await seedExampleBuildings(b)
      } catch (e) {
        console.warn("failed to seed saved city", e)
      }
    } else {
      // no saved selection: try to auto-select Amiens if present
      const amiens = cities.find((c: any) => ((c.name || "") as string).toLowerCase() === "amiens")
      if (amiens) {
        const id = (amiens as any)._id
        citySelectEl.value = id
        setSelectedCity(id)
        localStorage.setItem("selectedCity", id)
        try {
          const b = await getAllBuildingsForCity(id)
          clearExampleBuildings()
          await seedExampleBuildings(b)
        } catch (e) {
          console.warn("failed to seed Amiens", e)
        }
      }
    }
    citySelectEl.addEventListener("change", async () => {
      const v = citySelectEl.value || null
      if (v) {
        setSelectedCity(v)
        localStorage.setItem("selectedCity", v)
        // clear existing examples and re-seed from the selected city
        clearExampleBuildings()
        try {
          const buildings = await getAllBuildingsForCity(v)
          await seedExampleBuildings(buildings)
        } catch (e) {
          console.warn("failed to load buildings for city", e)
        }
      } else {
        setSelectedCity(null)
        localStorage.removeItem("selectedCity")
      }
    })
  } catch (e) {
    console.warn("initCitySelector failed", e)
    citySelectEl.innerHTML = '<option value="">Erreur</option>'
  }
}

// ensure selector is initialized once DOM is ready (script may run before DOM)
document.addEventListener("DOMContentLoaded", () => initCitySelector())
function updateFabActive() {
  const fabList = document.getElementById("fab-tools")
  if (!fabList) {
    return
  }
  ;[...fabList.children].forEach((el) => {
    const li = el as HTMLElement
    if (li.dataset.tool === currentMode) {
      li.classList.add("active")
    } else {
      li.classList.remove("active")
    }
  })
}
function setActive(m: CursorMode) {
  const prev = currentMode
  currentMode = m
  setMode(m)
  updateFabActive()
  const isBuild =
    m === "road" ||
    m === "house" ||
    m === "building" ||
    m === "well" ||
    m === "turbine" ||
    m === "sawmill" ||
    m === "bulldozer"
  if (m === "bulldozer") {
    document.body.style.cursor = "not-allowed"
  } else if (isBuild) {
    document.body.style.cursor = "crosshair"
  } else {
    document.body.style.cursor = "default"
  }
  if (isBuild) {
    makePreview()
    if (lastPointerEvent) {
      setPreviewVisible(!overUI(lastPointerEvent))
    }
    if (lastPointerEvent) {
      const p = screenToGround(lastPointerEvent)
      if (p) {
        updatePreviewPosition(snapToCell(p))
      }
    }
  }
  if (prev !== m) {
    painting = false
  }
}
const fab = document.getElementById("fab")
const fabList = document.getElementById("fab-tools")
if (fab && fabList) {
  fab.addEventListener("click", (e) => {
    fab.classList.toggle("active")
    // Opening the tools should no longer clear example buildings.
    e.stopPropagation()
  })
  document.addEventListener("click", (e) => {
    if (!fab.contains(e.target as Node)) {
      fab.classList.remove("active")
    }
  })
  fabList.addEventListener("click", (event) => {
    const li = (event.target as HTMLElement).closest<HTMLLIElement>("li[data-tool]")
    if (!li) {
      return
    }
    const tool = li.dataset.tool as CursorMode
    const wasBulldozer = currentMode === "bulldozer"
    setActive(tool)
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
    }
    showToast(labels[tool] || tool)
    fab.classList.remove("active")
  })
}

// rotate piece
function cyclePiece() {
  const next = getPiece() === "I" ? "L" : getPiece() === "L" ? "X" : "I"
  setPiece(next)
  makePreview()
  if (lastPointerEvent) {
    const p = screenToGround(lastPointerEvent)
    if (p) {
      const s = snapToCell(p)
      updatePreviewPosition(s)
    }
  }
  showToast(`Route: ${next}`)
}
addEventListener("keydown", (e) => {
  // Bloquer les raccourcis si l'utilisateur n'est pas connecté ou si un champ de saisie est actif
  if (
    !isAuthenticated() ||
    (e.target as HTMLElement)?.tagName === "INPUT" ||
    (e.target as HTMLElement)?.tagName === "TEXTAREA"
  ) {
    return
  }

  if ((e.key === "r" || e.key === "R") && currentMode === "road") {
    e.preventDefault()
    cyclePiece()
  }
  if (e.key === "x" || e.key === "X") {
    e.preventDefault()
    const wasBulldozer = currentMode === "bulldozer"
    setActive(wasBulldozer ? "pan" : "bulldozer")
    showToast(wasBulldozer ? "Bulldozer désactivé" : "Bulldozer activé")
  }
  if (e.key === "q" || e.key === "Q") {
    e.preventDefault()
    rotateCameraQuarter(-1, 300)
  }
  if (e.key === "e" || e.key === "E") {
    e.preventDefault()
    rotateCameraQuarter(+1, 300)
  }
  const rotatable =
    currentMode === "road" ||
    currentMode === "house" ||
    currentMode === "building" ||
    currentMode === "well" ||
    currentMode === "turbine" ||
    currentMode === "sawmill"
  if ((e.key === "a" || e.key === "A") && rotatable) {
    e.preventDefault()
    incAngle()
    updateCursorOrient()
    updatePreviewRotation()
  }
  if (e.key === "1") {
    setActive("well")
    showToast("Puits")
  }
  if (e.key === "2") {
    setActive("turbine")
    showToast("Éolienne")
  }
  if (e.key === "3") {
    setActive("sawmill")
    showToast("Scierie")
  }
})

// pointer
let painting = false
let lastPointerEvent: PointerEvent | null = null

addEventListener("pointermove", (e) => {
  lastPointerEvent = e
  if (overUI(e)) {
    setCursorVisible(false)
    setPreviewVisible(false)
    return
  }
  const p = screenToGround(e)
  if (!p) {
    setCursorVisible(false)
    setPreviewVisible(false)
    return
  }
  const s = snapToCell(p)
  setCursorVisible(currentMode !== "pan" && currentMode !== "bulldozer")
  setCursorPosition(s.x, s.z)
  const isBuild =
    currentMode === "road" ||
    currentMode === "house" ||
    currentMode === "building" ||
    currentMode === "well" ||
    currentMode === "turbine" ||
    currentMode === "sawmill" ||
    currentMode === "bulldozer"
  // bulldozer uses only red plane (no yellow cursor overlay)
  setPreviewVisible(isBuild)
  if (isBuild) {
    updatePreviewPosition(s)
    updatePreviewRotation()
  }
  if (!painting) {
    return
  }
  tryPlace(currentMode, s.x, s.z)
})

async function tryPlace(m: CursorMode, x: number, z: number) {
  const cost =
    m === "road"
      ? 200
      : m === "house"
        ? 1200
        : m === "building"
          ? 5000
          : m === "well"
            ? 800
            : m === "turbine"
              ? 1500
              : 1000
  const bag =
    m === "road"
      ? roads
      : m === "house"
        ? houses
        : m === "building"
          ? buildings
          : m === "well"
            ? wells
            : m === "turbine"
              ? turbines
              : sawmills
  // Try to persist via backend (grille.placeBuilding). If there's no selected city
  // the function will return ok:false with err:'no_city' and we fallback to
  // local placement using placeGeneric.
  try {
    const pb = await placeBuilding(m, x, z, cost)
    if (pb.ok) {
      return
    }
    if (pb.err === "no_city") {
      const res = placeGeneric(x, z, cost, bag, m as BuildingKind)
      if (!res.ok) {
        if ((m === "house" || m === "building") && res.err === "no_road") {
          showToast("Besoin d’une route adjacente pour placer ici")
        }
      }
      return
    }
    // pb.err === 'server' => already handled by placeBuilding via toast
    return
  } catch (e) {
    console.log(e)
    // unexpected error — fallback to local placement
    const res = placeGeneric(x, z, cost, bag, m as BuildingKind)
    if (!res.ok) {
      if ((m === "house" || m === "building") && res.err === "no_road") {
        showToast("Besoin d’une route adjacente pour placer ici")
      }
    }
    return
  }
}

addEventListener("pointerdown", (e) => {
  if (overUI(e)) {
    return
  }
  if (e.button === 0) {
    const p = screenToGround(e)
    if (!p) {
      return
    }
    const s = snapToCell(p)
    if (currentMode === "bulldozer") {
      // Cherche un objet à supprimer à cette position using canonical tile keys
      // computed by keyFromCenter (which uses integer tile indices).
      const id = keyFromCenter(s.x, s.z)
      let found = false
      const bags = [houses, buildings, wells, turbines, sawmills, roads]
      for (const bag of bags) {
        const obj = bag.get(id)
        if (obj) {
          bag.delete(id)
          // @ts-ignore
          import("./placement").then((m) => m.removeObject(obj))
          // remboursement partiel
          const cost = (obj as any).userData?.cost ?? 0
          if (cost > 0) {
            import("./constants").then(({ REFUND_RATIO }) => {
              const refund = Math.floor(cost * (REFUND_RATIO ?? 0.5))
              import("./ui").then(({ addMoney, showRefund }) => {
                addMoney(refund)
                showRefund(refund)
              })
            })
          }
          // server-backed delete: prefer using city+position; fall back to _id if present
          ;(async () => {
            try {
              const city = (await import("./state")).getSelectedCity()
              if (city) {
                try {
                  // use the shared worldToCellIndex logic to compute tile indices
                  const { ix, iz } = worldToCellIndex(obj.position as any)
                  await delete_one({ city, position: { x: ix, y: iz } })
                } catch (e) {
                  // if delete by position fails, try delete by _id via server (not implemented server-side)
                  console.warn("server delete failed, continuing local removal", e)
                }
                // refresh examples from server so the scene matches backend
                try {
                  const { clearExampleBuildings, seedExampleBuildings } = await import("./grille")
                  const { get_all_from_city } = await import("./server/buildings")
                  clearExampleBuildings()
                  const all = await get_all_from_city(city)
                  await seedExampleBuildings(all)
                } catch (e) {
                  console.warn("failed to refresh buildings after delete", e)
                }
              }
            } catch (e) {
              console.warn("bulldozer: delete flow error", e)
            }
          })()
          found = true
          showToast("Bâtiment supprimé")
          break
        }
      }
      if (!found) {
        showToast("Aucun bâtiment à supprimer ici")
      }
      return
    }
    painting = true
    tryPlace(currentMode, s.x, s.z)
  } else if (e.button === 2) {
    e.preventDefault()
    if (currentMode === "bulldozer") {
      setActive("pan")
      showToast("Bulldozer annulé")
    } else if (currentMode !== "pan") {
      setActive("pan")
      showToast("Placement annulé")
    }
  }
})
addEventListener("pointerup", () => (painting = false))
addEventListener("contextmenu", (e) => e.preventDefault())

// load models
loadStaticModels((k) => {
  if (k === "I" || k === "L" || k === "X" || k === "HOUSE" || k === "BUILDING") {
    makePreview()
  }
  // Initialize city selector then seed example buildings so the
  // player arriving to the scene sees sample content immediately.
  initCitySelector().then(() => {
    seedExampleBuildings()
  })
})
loadCharacters()

// cursor
makeCursor()

// wheel + resize
addEventListener("wheel", () => clampZoom())
addEventListener("resize", () => {
  setOrtho()
  renderer.setSize(innerWidth, innerHeight)
})

// loop
let frames = 0,
  t0 = performance.now(),
  lastWalkerUpdate = performance.now()
function tick() {
  stats.begin()
  stepCameraRotation(performance.now())
  updateGrid()
  const nowTime = performance.now()
  const dt = (nowTime - lastWalkerUpdate) / 1000
  updateWalkers(dt)
  lastWalkerUpdate = nowTime
  renderer.render(scene, camera)
  stats.end()
  frames++
  const now = performance.now()
  if (now - t0 >= 500) {
    const fps = Math.round((frames * 1000) / (now - t0))
    if (fpsHud) {
      fpsHud.textContent = `${fps} FPS`
    }
    frames = 0
    t0 = now
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
