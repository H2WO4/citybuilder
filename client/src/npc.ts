import * as THREE from "three"
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js"
import { CHAR_MODELS } from "./models"
import type { Walker } from "./types"
import { CELL } from "./constants"
import { scene } from "./scene"
import { houses, buildings, roads, keyFromCenter } from "./placement"

const walkers: Walker[] = []
const walkerPool: { obj: THREE.Object3D; mixer: THREE.AnimationMixer }[] = []
const MAX_WALKERS = 40
// const MAX_POOL = 60;
let nextWalkerTime = performance.now() + 3000
const ROAD_EDGE_MARGIN = CELL * 0.5 - 0.05
const BASE_WALK_ANIM_SPEED = 0.9

function pickChar() {
  const ready = CHAR_MODELS.filter((c) => !!c.prefab)
  if (!ready.length) {
    return null
  }
  return ready[(Math.random() * ready.length) | 0]
}
function pickWalkClip(entry: any) {
  if (!entry.clips.length) {
    return null
  }
  return entry.clips.find((c: any) => /walk/i.test(c.name)) || entry.clips[0]
}
function roadExistsAt(cx: number, cz: number) {
  return roads.has(keyFromCenter(cx, cz))
}
function facingDirFromAngle(idx: number) {
  return idx === 0
    ? { dx: 0, dz: 1 }
    : idx === 1
      ? { dx: 1, dz: 0 }
      : idx === 2
        ? { dx: 0, dz: -1 }
        : { dx: -1, dz: 0 }
}
function chooseFrontRoad(wx: number, wz: number, angleIdx: number) {
  const f = facingDirFromAngle(angleIdx)
  if (roads.has(keyFromCenter(wx + f.dx * CELL, wz + f.dz * CELL))) {
    return { dx: f.dx, dz: f.dz }
  }
  if (roads.has(keyFromCenter(wx + CELL, wz))) {
    return { dx: 1, dz: 0 }
  }
  if (roads.has(keyFromCenter(wx - CELL, wz))) {
    return { dx: -1, dz: 0 }
  }
  if (roads.has(keyFromCenter(wx, wz + CELL))) {
    return { dx: 0, dz: 1 }
  }
  if (roads.has(keyFromCenter(wx, wz - CELL))) {
    return { dx: 0, dz: -1 }
  }
  return null
}

export function spawnWalker() {
  if (walkers.length >= MAX_WALKERS) {
    return
  }
  const sourceBag = Math.random() < 0.6 ? houses : buildings
  const entries = [...sourceBag.entries()]
  if (!entries.length) {
    return
  }
  const [lotKey, lotObj] = entries[(Math.random() * entries.length) | 0]
  const [wx, wz] = lotKey.split(":").map(Number)
  const angleIdx = (lotObj as any).userData?.angle ?? 0
  const front = chooseFrontRoad(wx, wz, angleIdx)
  if (!front) {
    return
  }

  const choice = pickChar()
  if (!choice || !choice.prefab) {
    return
  }
  let baseObj: THREE.Object3D
  let mixer: THREE.AnimationMixer
  if (walkerPool.length) {
    const reused = walkerPool.pop()!
    baseObj = reused.obj
    mixer = reused.mixer
    mixer.stopAllAction()
  } else {
    baseObj = SkeletonUtils.clone(choice.prefab)
    mixer = new THREE.AnimationMixer(baseObj)
  }

  baseObj.scale.copy(choice.baseScale).multiplyScalar(choice.normScale)

  const frontOffset = CELL / 2 - 0.9
  const side =
    Math.random() < 0.5
      ? new THREE.Vector3(front.dz, 0, -front.dx)
      : new THREE.Vector3(-front.dz, 0, front.dx)
  const px = wx + front.dx * frontOffset
  const pz = wz + front.dz * frontOffset
  const py = choice.footOffset + 0.0005
  baseObj.position.set(px, py, pz)
  const lookTarget = baseObj.position.clone().add(side)
  ;(baseObj as any).lookAt(lookTarget)
  scene.add(baseObj)

  const clip = pickWalkClip(choice)
  if (clip) {
    const action = mixer.clipAction(clip)
    action.reset()
  }
  const speed = 0.6 + Math.random() * 0.6
  if (clip) {
    const action = mixer.clipAction(clip)
    action.timeScale = speed / BASE_WALK_ANIM_SPEED
    action.play()
  }
  const life = 45 + Math.random() * 55

  const axis: "x" | "z" = Math.abs(side.x) > 0.1 ? "x" : "z"
  const tileX = wx + front.dx * CELL
  const tileZ = wz + front.dz * CELL
  const perp = new THREE.Vector3(-side.z, 0, side.x)
  const lateralFreq = 1.5 + Math.random() * 1.2
  const lateralAmp = 0.18 + Math.random() * 0.1

  walkers.push({
    obj: baseObj,
    mixer,
    walkAction: clip ? mixer.clipAction(clip) : null,
    dir: side.normalize(),
    speed,
    life,
    tileX,
    tileZ,
    axis,
    lateralPhase: Math.random() * Math.PI * 2,
    lateralFreq,
    lateralAmp,
    prevLat: 0,
    perp,
    state: "walk",
    turnT: 0,
    turnDur: 0,
    startQuat: null,
    endQuat: null,
    queuedDir: null,
    baseSpeed: speed,
    idleT: 0,
    idleDur: 0
  })
}

export function updateWalkers(dt: number) {
  if (houses.size === 0 && walkers.length > 0) {
    for (let i = walkers.length - 1; i >= 0; i--) {
      scene.remove(walkers[i].obj)
      walkers.splice(i, 1)
    }
    return
  }
  if (dt <= 0) {
    return
  }

  function setupTurn(w: Walker, newDir: THREE.Vector3) {
    w.state = "turn"
    w.turnT = 0
    w.turnDur = 0.38 + Math.random() * 0.18
    w.startQuat = w.obj.quaternion.clone()
    const target = w.obj.position.clone().add(newDir)
    const tmp = new THREE.Object3D()
    tmp.position.copy(w.obj.position)
    tmp.lookAt(target)
    w.endQuat = tmp.quaternion.clone()
    w.queuedDir = newDir.clone().normalize()
    if (w.walkAction) {
      w.walkAction.timeScale = 0.6
    }
  }
  function maybeIdle(w: Walker) {
    if (w.state === "walk" && Math.random() < 0.05) {
      w.state = "idle"
      w.idleT = 0
      w.idleDur = 1 + Math.random() * 2.2
      if (w.walkAction) {
        w.walkAction.timeScale = 0.25
      }
      w.speed = 0
    }
  }

  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i]
    w.mixer.update(dt)

    if (w.state === "turn") {
      w.turnT += dt
      const k = Math.min(1, w.turnT / w.turnDur)
      if (w.startQuat && w.endQuat) {
        w.obj.quaternion.copy(w.startQuat).slerp(w.endQuat, k)
      }
      if (k >= 1) {
        if (w.queuedDir) {
          w.dir.copy(w.queuedDir)
          w.axis = Math.abs(w.dir.x) > Math.abs(w.dir.z) ? "x" : "z"
          w.perp.set(-w.dir.z, 0, w.dir.x)
        }
        w.state = "walk"
        w.speed = w.baseSpeed
        if (w.walkAction) {
          w.walkAction.timeScale = w.baseSpeed / BASE_WALK_ANIM_SPEED
        }
      }
    } else if (w.state === "idle") {
      w.idleT += dt
      if (w.idleT >= w.idleDur) {
        w.state = "walk"
        w.speed = w.baseSpeed
        if (w.walkAction) {
          w.walkAction.timeScale = w.baseSpeed / BASE_WALK_ANIM_SPEED
        }
      }
    }

    if (w.prevLat !== 0) {
      w.obj.position.addScaledVector(w.perp, -w.prevLat)
    }
    if (w.state === "walk") {
      w.obj.position.addScaledVector(w.dir, w.speed * dt)
    }

    if (w.state === "walk") {
      const localProgress = w.axis === "x" ? w.obj.position.x - w.tileX : w.obj.position.z - w.tileZ
      if (Math.abs(localProgress) > ROAD_EDGE_MARGIN) {
        const step = (localProgress > 0 ? 1 : -1) * CELL
        const nx = w.axis === "x" ? w.tileX + step : w.tileX
        const nz = w.axis === "z" ? w.tileZ + step : w.tileZ
        if (roadExistsAt(nx, nz)) {
          w.tileX = nx
          w.tileZ = nz
          const dirs: THREE.Vector3[] = []
          const f = w.dir.clone()
          const l = new THREE.Vector3(-w.dir.z, 0, w.dir.x)
          const r = new THREE.Vector3(w.dir.z, 0, -w.dir.x)
          const tc = (d: THREE.Vector3) => ({
            cx: w.tileX + (Math.abs(d.x) > 0.1 ? Math.sign(d.x) * CELL : 0),
            cz: w.tileZ + (Math.abs(d.z) > 0.1 ? Math.sign(d.z) * CELL : 0)
          })
          if (roadExistsAt(tc(f).cx, tc(f).cz)) {
            dirs.push(f)
          }
          if (roadExistsAt(tc(l).cx, tc(l).cz)) {
            dirs.push(l)
          }
          if (roadExistsAt(tc(r).cx, tc(r).cz)) {
            dirs.push(r)
          }

          if (dirs.length > 1) {
            let chosen = f
            const canLeft = dirs.some((d) => d === l),
              canRight = dirs.some((d) => d === r)
            const roll = Math.random()
            if (canLeft && roll < 0.15) {
              chosen = l
            } else if (canRight && roll >= 0.15 && roll < 0.3) {
              chosen = r
            }
            if (!dirs.includes(f)) {
              chosen = dirs[(Math.random() * dirs.length) | 0]
            }
            if (chosen !== f) {
              setupTurn(w, chosen)
            } else {
              maybeIdle(w)
            }
          } else if (dirs.length === 1) {
            if (dirs[0] !== f) {
              setupTurn(w, dirs[0])
            } else {
              maybeIdle(w)
            }
          } else {
            const back = w.dir.clone().multiplyScalar(-1)
            setupTurn(w, back)
          }
        } else {
          const back = w.dir.clone().multiplyScalar(-1)
          setupTurn(w, back)
          if (w.axis === "x") {
            w.obj.position.x = w.tileX + Math.sign(localProgress) * ROAD_EDGE_MARGIN
          } else {
            w.obj.position.z = w.tileZ + Math.sign(localProgress) * ROAD_EDGE_MARGIN
          }
        }
      }
    }

    let amp = w.lateralAmp
    if (w.state === "turn") {
      amp *= 0.4
    } else if (w.state === "idle") {
      amp *= 0.2
    }
    w.lateralPhase += dt * w.lateralFreq
    const newLat = Math.sin(w.lateralPhase) * amp
    w.obj.position.addScaledVector(w.perp, newLat)
    w.prevLat = newLat

    w.life -= dt
    if (w.life <= 0) {
      scene.remove(w.obj)
      walkers.splice(i, 1)
      continue
    }
  }

  const now = performance.now()
  if (now >= nextWalkerTime) {
    spawnWalker()
    nextWalkerTime = now + 1200 + Math.random() * 3800
  }
}
