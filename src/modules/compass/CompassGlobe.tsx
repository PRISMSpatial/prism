import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import type { Region } from '../../types/domain'

// ─── Constants ───────────────────────────────────────────────────────────────

const R          = 1
const ATMO_R     = 1.06
const STAR_COUNT = 10000
const TEXTURE_ROOT   = 'https://unpkg.com/three-globe/example/img'
const DRAG_THRESHOLD = 4       // px — below this is a click
const ROT_SPEED      = 0.004   // rad / px
const MAX_ROT_X      = Math.PI / 2.5
const MIN_ZOOM       = 1.25
const MAX_ZOOM       = 5.5
const DEFAULT_ZOOM   = 2.9
const DBLCLICK_MS    = 280     // max ms between clicks to register as double-click

const TIER_HEX: Record<string, number> = {
  T3: 0xff6b4a, T2: 0xf0b429, T1: 0x4cc9f0, T0: 0x9ef277,
}
const FLYWAYS: [string, string][] = [
  ['CSP', 'NSK'], ['VNM', 'CSP'], ['USA', 'GBR'], ['JPN', 'USA'], ['AUS', 'ZAF'],
]

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function ll2xyz(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

function arcPoints(aLat: number, aLon: number, bLat: number, bLon: number, segs = 80, rise = 0.18): THREE.Vector3[] {
  const a = ll2xyz(aLat, aLon).normalize()
  const b = ll2xyz(bLat, bLon).normalize()
  return Array.from({ length: segs + 1 }, (_, i) => {
    const t = i / segs
    return new THREE.Vector3().lerpVectors(a, b, t).normalize().multiplyScalar(R + Math.sin(Math.PI * t) * rise)
  })
}

/** World-space point on the unit sphere → { lat, lon } degrees */
function worldPointToLatLon(earth: THREE.Group, worldPt: THREE.Vector3): { lat: number; lon: number } {
  // Un-apply earth's current rotation to get the rest-pose surface normal
  const invQ = earth.quaternion.clone().invert()
  const rest = worldPt.clone().applyQuaternion(invQ)
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, rest.y / R))) * (180 / Math.PI)
  let lon = Math.atan2(rest.z, -rest.x) * (180 / Math.PI) - 180
  if (lon < -180) lon += 360
  return { lat, lon }
}

function clampZoom(z: number) { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) }

// ─── GLSL shaders ─────────────────────────────────────────────────────────────

const ATMO_VERT = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ATMO_FRAG = /* glsl */`
  varying vec3 vNormal;
  void main() {
    float i = pow(max(0.0, 0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.5);
    gl_FragColor = vec4(0.25, 0.55, 1.0, 1.0) * i;
  }
`

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SceneRefs {
  renderer:  THREE.WebGLRenderer
  scene:     THREE.Scene
  camera:    THREE.PerspectiveCamera
  earth:     THREE.Group
  earthMesh: THREE.Mesh         // main sphere, used for surface raycasting
  pinMeshes: Map<string, THREE.Mesh>
  raycaster: THREE.Raycaster
  rotY: number
  rotX: number
}

function buildScene(canvas: HTMLDivElement, w: number, h: number): SceneRefs {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  canvas.appendChild(renderer.domElement)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200)
  camera.position.z = DEFAULT_ZOOM

  scene.add(new THREE.AmbientLight(0x1a2233, 3.5))
  const sun = new THREE.DirectionalLight(0xfff5e0, 2.8)
  sun.position.set(5, 3, 5)
  scene.add(sun)
  const rim = new THREE.DirectionalLight(0x334488, 0.6)
  rim.position.set(-3, -1, -4)
  scene.add(rim)

  // Stars
  const starPos = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT * 3; i++) starPos[i] = (Math.random() - 0.5) * 120
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.55 })))

  // Earth group
  const earth = new THREE.Group()
  scene.add(earth)

  const loader   = new THREE.TextureLoader()
  const earthGeo = new THREE.SphereGeometry(R, 72, 72)
  const earthMat = new THREE.MeshPhongMaterial({
    map:         loader.load(`${TEXTURE_ROOT}/earth-blue-marble.jpg`),
    bumpMap:     loader.load(`${TEXTURE_ROOT}/earth-topology.png`),
    bumpScale:   0.045,
    specularMap: loader.load(`${TEXTURE_ROOT}/earth-water.png`),
    specular:    new THREE.Color(0x2244aa),
    shininess:   14,
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  earth.add(earthMesh)

  // Clouds
  const cloudMat = new THREE.MeshPhongMaterial({
    map: loader.load(`${TEXTURE_ROOT}/earth-clouds.png`),
    transparent: true, opacity: 0.28, depthWrite: false,
  })
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R + 0.008, 72, 72), cloudMat)
  clouds.userData.isClouds = true
  earth.add(clouds)

  // Atmosphere
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(ATMO_R, 64, 64),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  ))

  // Region pins
  const pinMeshes = new Map<string, THREE.Mesh>()
  const regionById = Object.fromEntries(PRISM_DATA.regions.map(r => [r.id, r]))

  PRISM_DATA.regions.forEach(r => {
    const surfacePos = ll2xyz(r.lat, r.lon, R)
    const normal = surfacePos.clone().normalize()
    const col = TIER_HEX[r.tier] ?? 0xffffff

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.015, 0.028, 24),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.25, depthWrite: false }),
    )
    ring.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.001)))
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    earth.add(ring)

    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(0.009, 0.05, 8),
      new THREE.MeshPhongMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 0.55, shininess: 60 }),
    )
    pin.userData.regionId = r.id
    pin.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.028)))
    pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
    earth.add(pin)
    pinMeshes.set(r.id, pin)
  })

  // Flyway arcs
  FLYWAYS.forEach(([aid, bid]) => {
    const ra = regionById[aid], rb = regionById[bid]
    if (!ra || !rb) return
    const pts = arcPoints(ra.lat, ra.lon, rb.lat, rb.lon)
    const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0028, 5, false)
    earth.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0.55 })))
  })

  return { renderer, scene, camera, earth, earthMesh, pinMeshes, raycaster: new THREE.Raycaster(), rotY: 0, rotX: 0 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompassGlobe() {
  const mountRef   = useRef<HTMLDivElement>(null)
  const sceneRef   = useRef<SceneRefs | null>(null)
  const selectedRef = useRef<Region | null>(null)
  const rafRef     = useRef<number>()

  // Gesture state
  const isDraggingRef    = useRef(false)
  const zoomTargetRef    = useRef(DEFAULT_ZOOM)
  const activePointers   = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinchDist    = useRef(0)
  const lastClickTime    = useRef(0)
  const pointerRef       = useRef({ down: false, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false, velX: 0, velY: 0 })

  const { selected, setSelected, tweaks } = useAppStore()
  const autoRotateRef = useRef(tweaks.rotation === 'auto')
  useEffect(() => { autoRotateRef.current = tweaks.rotation === 'auto' }, [tweaks.rotation])
  useEffect(() => { selectedRef.current = selected }, [selected])

  // ── Zoom helpers ────────────────────────────────────────────────────────────
  const zoomTo = useCallback((z: number, duration = 0.55) => {
    const s = sceneRef.current
    if (!s) return
    zoomTargetRef.current = clampZoom(z)
    gsap.to(s.camera.position, { z: zoomTargetRef.current, duration, ease: 'power3.out', overwrite: true })
  }, [])

  // ── Cursor helper ───────────────────────────────────────────────────────────
  const setCursor = (c: string) => { if (mountRef.current) mountRef.current.style.cursor = c }

  // ── Raycaster pick ──────────────────────────────────────────────────────────
  const pickRegion = useCallback((clientX: number, clientY: number) => {
    const s = sceneRef.current
    if (!s || !mountRef.current) return
    const rect = mountRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    s.raycaster.setFromCamera(mouse, s.camera)
    const hits = s.raycaster.intersectObjects([...s.pinMeshes.values()])
    if (hits.length > 0) {
      const id = hits[0].object.userData.regionId as string
      const region = PRISM_DATA.regions.find(r => r.id === id)
      if (region) setSelected(region)
    }
  }, [setSelected])

  // ── Region pan + GSAP ───────────────────────────────────────────────────────
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !selected) return
    const targetY = -selected.lon * (Math.PI / 180)
    const targetX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, selected.lat * (Math.PI / 180)))
    gsap.killTweensOf(s.earth.rotation)
    gsap.to(s.earth.rotation, {
      y: targetY, x: targetX, duration: 1.4, ease: 'power2.inOut',
      onUpdate: () => { s.rotY = s.earth.rotation.y; s.rotX = s.earth.rotation.x },
    })
  }, [selected])

  // ── Pan earth to lat/lon ────────────────────────────────────────────────────
  const panTo = useCallback((lat: number, lon: number) => {
    const s = sceneRef.current
    if (!s) return
    const targetY = -lon * (Math.PI / 180)
    const targetX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, lat * (Math.PI / 180)))
    gsap.killTweensOf(s.earth.rotation)
    gsap.to(s.earth.rotation, {
      y: targetY, x: targetX, duration: 0.9, ease: 'power2.out',
      onUpdate: () => { s.rotY = s.earth.rotation.y; s.rotX = s.earth.rotation.x },
    })
  }, [])

  // ── Scroll wheel zoom ───────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    // Normalize across mouse wheel / trackpad / page scroll modes
    let dy = e.deltaY
    if (e.deltaMode === 1) dy *= 20
    if (e.deltaMode === 2) dy *= 300
    const factor = 1 + dy * 0.0008
    zoomTo(zoomTargetRef.current * factor, 0.35)
  }, [zoomTo])

  // ── Double-click: zoom to surface point or pin ──────────────────────────────
  const onDblClick = useCallback((clientX: number, clientY: number) => {
    const s = sceneRef.current
    if (!s || !mountRef.current) return
    const rect = mountRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    s.raycaster.setFromCamera(mouse, s.camera)

    // Pin hit → select + zoom in
    const pinHits = s.raycaster.intersectObjects([...s.pinMeshes.values()])
    if (pinHits.length > 0) {
      const id = pinHits[0].object.userData.regionId as string
      const region = PRISM_DATA.regions.find(r => r.id === id)
      if (region) setSelected(region)
      zoomTo(1.65)
      return
    }

    // Earth surface hit → fly to that location
    const earthHits = s.raycaster.intersectObject(s.earthMesh)
    if (earthHits.length > 0) {
      // Toggle: zoom in if far, reset if already close
      if (zoomTargetRef.current > 2.1) {
        const { lat, lon } = worldPointToLatLon(s.earth, earthHits[0].point)
        panTo(lat, lon)
        zoomTo(1.75)
      } else {
        zoomTo(DEFAULT_ZOOM)
      }
    }
  }, [setSelected, zoomTo, panTo])

  // ── Pointer down ────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointers.current.size === 1) {
      pointerRef.current = {
        down: true, startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastY: e.clientY, moved: false, velX: 0, velY: 0,
      }
      isDraggingRef.current = false
      const s = sceneRef.current
      if (s) gsap.killTweensOf(s.earth.rotation)
    }
    if (activePointers.current.size === 2) {
      // Starting pinch — snapshot initial distance
      const [p1, p2] = [...activePointers.current.values()]
      lastPinchDist.current = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    }
    setCursor('grabbing')
  }, [])

  // ── Pointer move ────────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // ── Pinch zoom (2 fingers) ──────────────────────────────────────────────
    if (activePointers.current.size === 2) {
      const [p1, p2] = [...activePointers.current.values()]
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      if (lastPinchDist.current > 0) {
        const factor = lastPinchDist.current / dist
        zoomTo(clampZoom(zoomTargetRef.current * factor), 0.08)
      }
      lastPinchDist.current = dist
      return  // don't rotate while pinching
    }

    // ── Single-pointer drag ──────────────────────────────────────────────────
    const p = pointerRef.current
    if (!p.down) return
    const dx = e.clientX - p.lastX
    const dy = e.clientY - p.lastY

    if (!p.moved && (
      Math.abs(e.clientX - p.startX) > DRAG_THRESHOLD ||
      Math.abs(e.clientY - p.startY) > DRAG_THRESHOLD
    )) {
      p.moved = true
      isDraggingRef.current = true
    }

    if (p.moved) {
      const s = sceneRef.current
      if (s) {
        s.rotY += dx * ROT_SPEED
        s.rotX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, s.rotX + dy * ROT_SPEED))
        s.earth.rotation.y = s.rotY
        s.earth.rotation.x = s.rotX
      }
      p.velX = dx
      p.velY = dy
    }

    p.lastX = e.clientX
    p.lastY = e.clientY
  }, [zoomTo])

  // ── Pointer up ──────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((e: PointerEvent) => {
    const p = pointerRef.current
    activePointers.current.delete(e.pointerId)
    lastPinchDist.current = 0

    if (activePointers.current.size === 0) {
      p.down = false
      isDraggingRef.current = false
      setCursor('grab')

      if (!p.moved) {
        // Determine single vs double click
        const now = Date.now()
        const isDbl = now - lastClickTime.current < DBLCLICK_MS
        lastClickTime.current = now

        if (isDbl) {
          onDblClick(e.clientX, e.clientY)
        } else {
          pickRegion(e.clientX, e.clientY)
        }
      } else {
        // Momentum coast on release
        const s = sceneRef.current
        if (s) {
          const mom = { vx: p.velX * ROT_SPEED, vy: p.velY * ROT_SPEED }
          const coast = () => {
            if (isDraggingRef.current) return
            if (Math.abs(mom.vx) < 0.0001 && Math.abs(mom.vy) < 0.0001) return
            mom.vx *= 0.92
            mom.vy *= 0.92
            s.rotY += mom.vx
            s.rotX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, s.rotX + mom.vy))
            s.earth.rotation.y = s.rotY
            s.earth.rotation.x = s.rotX
            requestAnimationFrame(coast)
          }
          requestAnimationFrame(coast)
        }
      }
    }
  }, [onDblClick, pickRegion])

  // ── Build scene once ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const refs = buildScene(el, el.clientWidth || 800, el.clientHeight || 600)
    sceneRef.current = refs
    const { renderer, scene, camera, earth } = refs

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      if (autoRotateRef.current && !isDraggingRef.current) {
        refs.rotY += 0.0018
        earth.rotation.y = refs.rotY
        const clouds = earth.children.find(c => c.userData.isClouds)
        if (clouds) clouds.rotation.y = refs.rotY * 0.08
      }
      const sel = selectedRef.current
      refs.pinMeshes.forEach((pin, id) => {
        const target = sel?.id === id ? 2.0 : 1.0
        pin.scale.lerp(new THREE.Vector3(target, target, target), 0.12)
      })
      renderer.render(scene, camera)
    }
    animate()

    // Camera fly-in
    camera.position.z = 5.5
    zoomTargetRef.current = DEFAULT_ZOOM
    gsap.to(camera.position, { z: DEFAULT_ZOOM, duration: 2.2, ease: 'power3.out', delay: 0.3 })

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown',  onPointerDown as EventListener)
    el.addEventListener('pointermove',  onPointerMove as EventListener)
    el.addEventListener('pointerup',    onPointerUp   as EventListener)
    el.addEventListener('pointercancel', onPointerUp  as EventListener)

    return () => {
      window.removeEventListener('resize', onResize)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown',   onPointerDown  as EventListener)
      el.removeEventListener('pointermove',   onPointerMove  as EventListener)
      el.removeEventListener('pointerup',     onPointerUp    as EventListener)
      el.removeEventListener('pointercancel', onPointerUp    as EventListener)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [onWheel, onPointerDown, onPointerMove, onPointerUp])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
      role="img"
      aria-label="3D globe — drag to rotate, scroll to zoom, double-click to fly to location"
    />
  )
}
