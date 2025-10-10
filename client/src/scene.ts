import * as THREE from "three"
import { MapControls } from "three/examples/jsm/controls/MapControls.js"
import Stats from "three/examples/jsm/libs/stats.module.js"
import { Z_GROUND, MIN_ZOOM, MAX_ZOOM } from "./constants"

export const scene = new THREE.Scene()
scene.background = new THREE.Color(0x55aa55)
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1))

export const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(50, 100, 50)
sun.castShadow = true
sun.shadow.mapSize.width = 2048
sun.shadow.mapSize.height = 2048
sun.shadow.camera.near = 10
sun.shadow.camera.far = 500
sun.shadow.camera.left = -100
sun.shadow.camera.right = 100
sun.shadow.camera.top = 100
sun.shadow.camera.bottom = -100
sun.shadow.bias = -0.001
scene.add(sun)
scene.add(sun.target)

const viewSize = 40
export const CAM_TARGET = new THREE.Vector3(0, 0, 0)
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000)
camera.position.set(30, 30, 30)
camera.lookAt(CAM_TARGET)
camera.zoom = 1

export function setOrtho(cam = camera) {
  const a = innerWidth / innerHeight
  cam.left = (-a * viewSize) / 2
  cam.right = (a * viewSize) / 2
  cam.top = viewSize / 2
  cam.bottom = -viewSize / 2
  cam.updateProjectionMatrix()
}
setOrtho()


export const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(devicePixelRatio)
renderer.setSize(innerWidth, innerHeight)
renderer.setClearColor(0x55aa55)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

export const stats = new Stats()
stats.showPanel(0)
stats.dom.style.display = "none"
document.body.appendChild(stats.dom)

export const controls = new MapControls(camera, renderer.domElement)
controls.enableRotate = false
controls.screenSpacePanning = true
controls.enableDamping = true
;(controls.mouseButtons as any).LEFT = null
;(controls.mouseButtons as any).RIGHT = THREE.MOUSE.PAN
controls.addEventListener("change", () => (camera.position.y = Math.max(camera.position.y, 1)))
controls.target.copy(CAM_TARGET)

let camRotAnim: { t0: number; dur: number; a0: number; a1: number; R: number; y: number } | null =
  null
export function rotateCameraQuarter(dir: 1 | -1, duration = 300) {
  if (camRotAnim) {
    return
  }
  const t = controls.target
  const v = camera.position.clone().sub(t)
  const a0 = Math.atan2(v.x, v.z)
  const a1 = a0 + (dir * Math.PI) / 2
  const R = Math.hypot(v.x, v.z)
  camRotAnim = { t0: performance.now(), dur: duration, a0, a1, R, y: camera.position.y }
}
export function stepCameraRotation(now: number) {
  if (!camRotAnim) {
    return
  }
  const { t0, dur, a0, a1, R, y } = camRotAnim
  const k = Math.min(1, (now - t0) / dur)
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
  const a = a0 + (a1 - a0) * e
  const t = controls.target
  const x = t.x + Math.sin(a) * R
  const z = t.z + Math.cos(a) * R
  camera.position.set(x, y, z)
  camera.up.set(0, 1, 0)
  camera.lookAt(t)
  controls.update()
  if (k >= 1) {
    camRotAnim = null
  }
}



export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4096, 4096),
  new THREE.MeshPhongMaterial({ color: 0x55aa55 })
)
ground.receiveShadow = true
ground.rotation.x = -Math.PI / 2
ground.position.y = Z_GROUND
scene.add(ground)

// Grid moved to `grille.ts`

export function clampZoom() {
  camera.zoom = THREE.MathUtils.clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM)
  camera.updateProjectionMatrix()
}

export const fpsHud = document.getElementById("fps-hud") as HTMLDivElement
