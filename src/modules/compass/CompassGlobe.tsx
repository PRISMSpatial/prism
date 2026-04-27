import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import type { Region } from '../../types/domain'
import { EPISPLAT_VERT, EPISPLAT_FRAG } from './shaders'
import { PhyloFilaments } from './PhyloFilaments'

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
// Subtype → RGB for EpiSplat color channel
const SUBTYPE_RGB: Record<string, [number, number, number]> = {
  H3N2: [0.30, 0.55, 1.00],  // cool blue
  H5N1: [1.00, 0.42, 0.29],  // hot red-orange
  H7N9: [0.94, 0.70, 0.16],  // warm amber
  H1N1: [0.62, 0.95, 0.47],  // phos green
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

interface SplatAttribs {
  worldPos:   THREE.InstancedBufferAttribute
  radius:     THREE.InstancedBufferAttribute
  brightness: THREE.InstancedBufferAttribute
  color:      THREE.InstancedBufferAttribute
  pulseRate:  THREE.InstancedBufferAttribute
  jitter:     THREE.InstancedBufferAttribute
  bloom:      THREE.InstancedBufferAttribute
  shimmer:    THREE.InstancedBufferAttribute
  glow:       THREE.InstancedBufferAttribute
}

interface SceneRefs {
  renderer:  THREE.WebGLRenderer
  scene:     THREE.Scene
  camera:    THREE.PerspectiveCamera
  earth:     THREE.Group
  earthMesh: THREE.Mesh
  splatMesh: THREE.Mesh
  splatAttribs: SplatAttribs
  splatMaterial: THREE.ShaderMaterial
  splatWorldPositions: THREE.Vector3[]  // for raycasting
  filaments: PhyloFilaments
  clock:     THREE.Clock
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

  // EpiSplat instanced billboard quads
  const regionById = Object.fromEntries(PRISM_DATA.regions.map(r => [r.id, r]))
  const N = PRISM_DATA.regions.length

  // Base quad geometry: 2 triangles forming a [-1,1] square
  const baseGeo = new THREE.InstancedBufferGeometry()
  const quadVerts = new Float32Array([ -1,-1,0,  1,-1,0,  1,1,0,  -1,-1,0,  1,1,0,  -1,1,0 ])
  baseGeo.setAttribute('position', new THREE.BufferAttribute(quadVerts, 3))
  baseGeo.instanceCount = N

  // Per-instance attributes
  const aWorldPos   = new Float32Array(N * 3)
  const aRadius     = new Float32Array(N)
  const aBrightness = new Float32Array(N)
  const aColor      = new Float32Array(N * 3)
  const aPulseRate  = new Float32Array(N)
  const aJitter     = new Float32Array(N)
  const aBloom      = new Float32Array(N)
  const aShimmer    = new Float32Array(N)
  const aGlow       = new Float32Array(N)

  const splatWorldPositions: THREE.Vector3[] = []

  PRISM_DATA.regions.forEach((r, i) => {
    const pos = ll2xyz(r.lat, r.lon, R + 0.015) // slightly above surface
    splatWorldPositions.push(pos)
    aWorldPos[i*3]   = pos.x
    aWorldPos[i*3+1] = pos.y
    aWorldPos[i*3+2] = pos.z

    const s = r.splat
    aRadius[i]     = s.ps
    aBrightness[i] = s.rt
    const rgb = SUBTYPE_RGB[s.subtype] ?? [0.6, 0.6, 0.6]
    aColor[i*3]   = rgb[0]
    aColor[i*3+1] = rgb[1]
    aColor[i*3+2] = rgb[2]
    aPulseRate[i]  = s.hNorm
    aJitter[i]     = s.tcc
    aBloom[i]      = s.eti
    aShimmer[i]    = s.rd
    aGlow[i]       = s.asMut
  })

  const splatAttribs: SplatAttribs = {
    worldPos:   new THREE.InstancedBufferAttribute(aWorldPos, 3),
    radius:     new THREE.InstancedBufferAttribute(aRadius, 1),
    brightness: new THREE.InstancedBufferAttribute(aBrightness, 1),
    color:      new THREE.InstancedBufferAttribute(aColor, 3),
    pulseRate:  new THREE.InstancedBufferAttribute(aPulseRate, 1),
    jitter:     new THREE.InstancedBufferAttribute(aJitter, 1),
    bloom:      new THREE.InstancedBufferAttribute(aBloom, 1),
    shimmer:    new THREE.InstancedBufferAttribute(aShimmer, 1),
    glow:       new THREE.InstancedBufferAttribute(aGlow, 1),
  }

  baseGeo.setAttribute('aWorldPos',   splatAttribs.worldPos)
  baseGeo.setAttribute('aRadius',     splatAttribs.radius)
  baseGeo.setAttribute('aBrightness', splatAttribs.brightness)
  baseGeo.setAttribute('aColor',      splatAttribs.color)
  baseGeo.setAttribute('aPulseRate',  splatAttribs.pulseRate)
  baseGeo.setAttribute('aJitter',     splatAttribs.jitter)
  baseGeo.setAttribute('aBloom',      splatAttribs.bloom)
  baseGeo.setAttribute('aShimmer',    splatAttribs.shimmer)
  baseGeo.setAttribute('aGlow',       splatAttribs.glow)

  const splatMaterial = new THREE.ShaderMaterial({
    vertexShader: EPISPLAT_VERT,
    fragmentShader: EPISPLAT_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const splatMesh = new THREE.Mesh(baseGeo, splatMaterial)
  earth.add(splatMesh)

  const clock = new THREE.Clock()

  // Flyway arcs + phylo-filament particles
  const filamentConfigs: { arcPoints: THREE.Vector3[]; particleCount: number; speed: number; color: THREE.Color }[] = []
  FLYWAYS.forEach(([aid, bid]) => {
    const ra = regionById[aid], rb = regionById[bid]
    if (!ra || !rb) return
    const pts = arcPoints(ra.lat, ra.lon, rb.lat, rb.lon)
    const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0028, 5, false)
    earth.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0.35 })))
    filamentConfigs.push({ arcPoints: pts, particleCount: 4, speed: 0.15, color: new THREE.Color(0x9ef277) })
  })

  const filaments = new PhyloFilaments(filamentConfigs)
  earth.add(filaments.object)

  // Graticule — lat/lon grid lines at 30° intervals
  const gratGeo = new THREE.BufferGeometry()
  const gratVerts: number[] = []
  const GRAT_SEGS = 90
  // Latitude lines
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let i = 0; i < GRAT_SEGS; i++) {
      const lon0 = (i / GRAT_SEGS) * 360 - 180
      const lon1 = ((i + 1) / GRAT_SEGS) * 360 - 180
      const p0 = ll2xyz(lat, lon0, R + 0.002)
      const p1 = ll2xyz(lat, lon1, R + 0.002)
      gratVerts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
    }
  }
  // Longitude lines
  for (let lon = -180; lon < 180; lon += 30) {
    for (let i = 0; i < GRAT_SEGS; i++) {
      const lat0 = (i / GRAT_SEGS) * 180 - 90
      const lat1 = ((i + 1) / GRAT_SEGS) * 180 - 90
      const p0 = ll2xyz(lat0, lon, R + 0.002)
      const p1 = ll2xyz(lat1, lon, R + 0.002)
      gratVerts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
    }
  }
  gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratVerts, 3))
  earth.add(new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({
    color: 0x4cc9f0, transparent: true, opacity: 0.06, depthWrite: false,
  })))

  return { renderer, scene, camera, earth, earthMesh, splatMesh, splatAttribs, splatMaterial, splatWorldPositions, filaments, clock, raycaster: new THREE.Raycaster(), rotY: 0, rotX: 0 }
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

    // Project each splat world position to screen, find nearest to click
    let bestDist = 30 // max pixel distance to register a hit
    let bestRegion: Region | null = null
    s.splatWorldPositions.forEach((wp, i) => {
      const worldPos = wp.clone().applyMatrix4(s.earth.matrixWorld)
      const screen = worldPos.project(s.camera)
      const sx = (screen.x * 0.5 + 0.5) * rect.width
      const sy = (-screen.y * 0.5 + 0.5) * rect.height
      const dx = clientX - rect.left - sx
      const dy = clientY - rect.top - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        bestRegion = PRISM_DATA.regions[i]
      }
    })
    if (bestRegion) setSelected(bestRegion)
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

    // Splat hit → select + zoom in (screen-space proximity check)
    let bestDist = 40
    let bestRegion: Region | null = null
    s.splatWorldPositions.forEach((wp, i) => {
      const worldPos = wp.clone().applyMatrix4(s.earth.matrixWorld)
      const screen = worldPos.project(s.camera)
      const sx = (screen.x * 0.5 + 0.5) * rect.width
      const sy = (-screen.y * 0.5 + 0.5) * rect.height
      const dx = clientX - rect.left - sx
      const dy = clientY - rect.top - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) { bestDist = dist; bestRegion = PRISM_DATA.regions[i] }
    })
    if (bestRegion) {
      setSelected(bestRegion)
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
      // Advance EpiSplat time uniform for pulse/shimmer/jitter animation
      const dt = refs.clock.getDelta()
      refs.splatMaterial.uniforms.uTime.value = refs.clock.elapsedTime
      // Advance phylo-filament particles along flyway arcs
      refs.filaments.update(dt)
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
