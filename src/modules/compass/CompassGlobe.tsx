import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import gsap from 'gsap'
import { useAppStore } from '../../store'
import { usePrismData } from '../../api/PrismDataProvider'
import type { Region } from '../../types/domain'
import { EPISPLAT_VERT, EPISPLAT_FRAG } from './shaders'
import { PhyloFilaments } from './PhyloFilaments'

// ─── Constants ───────────────────────────────────────────────────────────────

const R          = 1
const ATMO_R     = 1.06
const STAR_COUNT = 12000
const TEXTURE_ROOT   = 'https://unpkg.com/three-globe/example/img'
const DRAG_THRESHOLD = 4
const ROT_SPEED      = 0.004
const MAX_ROT_X      = Math.PI / 2.5
const MIN_ZOOM       = 1.25
const MAX_ZOOM       = 5.5
const DEFAULT_ZOOM   = 2.9
const DBLCLICK_MS    = 280
const IDLE_TIMEOUT   = 6000
const RETICLE_SEGS   = 96

const TIER_HEX: Record<string, number> = {
  T3: 0xff6b4a, T2: 0xf0b429, T1: 0x4cc9f0, T0: 0x9ef277,
}
const SUBTYPE_RGB: Record<string, [number, number, number]> = {
  H3N2: [0.30, 0.55, 1.00],
  H5N1: [1.00, 0.42, 0.29],
  H7N9: [0.94, 0.70, 0.16],
  H1N1: [0.62, 0.95, 0.47],
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

function worldPointToLatLon(earth: THREE.Group, worldPt: THREE.Vector3): { lat: number; lon: number } {
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

const RETICLE_VERT = /* glsl */`
  uniform float uTime;
  uniform float uActive;
  attribute float aAngle;
  varying float vAngle;
  varying float vAlpha;
  void main() {
    vAngle = aAngle;
    float gap = step(0.5, fract(aAngle / 6.2831853 * 4.0 + uTime * 0.8));
    vAlpha = uActive * mix(0.0, 1.0, gap);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const RETICLE_FRAG = /* glsl */`
  varying float vAngle;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    vec3 col = mix(vec3(1.0, 0.42, 0.29), vec3(0.62, 0.95, 0.47), 0.5 + 0.5 * sin(vAngle * 2.0));
    gl_FragColor = vec4(col, vAlpha * 0.7);
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
  hoverScale: THREE.InstancedBufferAttribute
}

interface SceneRefs {
  renderer:  THREE.WebGLRenderer
  composer:  EffectComposer
  bloomPass: UnrealBloomPass
  scene:     THREE.Scene
  camera:    THREE.PerspectiveCamera
  earth:     THREE.Group
  earthMesh: THREE.Mesh
  cloudsMesh: THREE.Mesh
  atmoMesh:  THREE.Mesh
  starPoints: THREE.Points
  splatMesh: THREE.Mesh
  splatAttribs: SplatAttribs
  splatMaterial: THREE.ShaderMaterial
  splatWorldPositions: THREE.Vector3[]
  reticleMesh: THREE.LineLoop
  reticleMaterial: THREE.ShaderMaterial
  flyArcMeshes: THREE.Mesh[]
  gratMesh: THREE.LineSegments
  filaments: PhyloFilaments
  clock:     THREE.Clock
  raycaster: THREE.Raycaster
  rotY: number
  rotX: number
  introPlayed: boolean
}

function buildScene(canvas: HTMLDivElement, w: number, h: number, regions: Region[]): SceneRefs {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
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

  // Post-processing: bloom
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    0.65,  // strength
    0.4,   // radius
    0.85,  // threshold
  )
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())

  // Stars — start invisible for intro
  const starPos = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT * 3; i++) starPos[i] = (Math.random() - 0.5) * 120
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.08, transparent: true, opacity: 0,
  }))
  scene.add(starPoints)

  // Earth group — start invisible
  const earth = new THREE.Group()
  earth.scale.setScalar(0)
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
    transparent: true, opacity: 0, depthWrite: false,
  })
  const cloudsMesh = new THREE.Mesh(new THREE.SphereGeometry(R + 0.008, 72, 72), cloudMat)
  cloudsMesh.userData.isClouds = true
  earth.add(cloudsMesh)

  // Atmosphere — start invisible
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
    side: THREE.BackSide, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false,
    uniforms: { uOpacity: { value: 0 } },
  })
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(ATMO_R, 64, 64), atmoMat)
  scene.add(atmoMesh)

  // EpiSplat instanced billboard quads
  const regionById = Object.fromEntries(regions.map(r => [r.id, r]))
  const N = regions.length

  const baseGeo = new THREE.InstancedBufferGeometry()
  const quadVerts = new Float32Array([ -1,-1,0,  1,-1,0,  1,1,0,  -1,-1,0,  1,1,0,  -1,1,0 ])
  baseGeo.setAttribute('position', new THREE.BufferAttribute(quadVerts, 3))
  baseGeo.instanceCount = N

  const aWorldPos   = new Float32Array(N * 3)
  const aRadius     = new Float32Array(N)
  const aBrightness = new Float32Array(N)
  const aColor      = new Float32Array(N * 3)
  const aPulseRate  = new Float32Array(N)
  const aJitter     = new Float32Array(N)
  const aBloom      = new Float32Array(N)
  const aShimmer    = new Float32Array(N)
  const aGlow       = new Float32Array(N)
  const aHoverScale = new Float32Array(N).fill(1)

  const splatWorldPositions: THREE.Vector3[] = []

  regions.forEach((r, i) => {
    const pos = ll2xyz(r.lat, r.lon, R + 0.015)
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
    hoverScale: new THREE.InstancedBufferAttribute(aHoverScale, 1),
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
  baseGeo.setAttribute('aHoverScale', splatAttribs.hoverScale)

  const splatMaterial = new THREE.ShaderMaterial({
    vertexShader: EPISPLAT_VERT,
    fragmentShader: EPISPLAT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uIntroReveal: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const splatMesh = new THREE.Mesh(baseGeo, splatMaterial)
  earth.add(splatMesh)

  // Selection reticle — dashed ring that orbits selected splat
  const reticleGeo = new THREE.BufferGeometry()
  const reticlePositions = new Float32Array(RETICLE_SEGS * 3)
  const reticleAngles = new Float32Array(RETICLE_SEGS)
  for (let i = 0; i < RETICLE_SEGS; i++) {
    const a = (i / RETICLE_SEGS) * Math.PI * 2
    reticlePositions[i * 3]     = Math.cos(a) * 0.06
    reticlePositions[i * 3 + 1] = Math.sin(a) * 0.06
    reticlePositions[i * 3 + 2] = 0
    reticleAngles[i] = a
  }
  reticleGeo.setAttribute('position', new THREE.BufferAttribute(reticlePositions, 3))
  reticleGeo.setAttribute('aAngle', new THREE.BufferAttribute(reticleAngles, 1))

  const reticleMaterial = new THREE.ShaderMaterial({
    vertexShader: RETICLE_VERT,
    fragmentShader: RETICLE_FRAG,
    uniforms: { uTime: { value: 0 }, uActive: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const reticleMesh = new THREE.LineLoop(reticleGeo, reticleMaterial)
  reticleMesh.visible = false
  earth.add(reticleMesh)

  const clock = new THREE.Clock()

  // Flyway arcs — start with zero-opacity for intro draw-on
  const filamentConfigs: { arcPoints: THREE.Vector3[]; particleCount: number; speed: number; color: THREE.Color }[] = []
  const flyArcMeshes: THREE.Mesh[] = []
  FLYWAYS.forEach(([aid, bid]) => {
    const ra = regionById[aid], rb = regionById[bid]
    if (!ra || !rb) return
    const pts = arcPoints(ra.lat, ra.lon, rb.lat, rb.lon)
    const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0028, 5, false)
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0 })
    const arcMesh = new THREE.Mesh(tubeGeo, arcMat)
    earth.add(arcMesh)
    flyArcMeshes.push(arcMesh)
    filamentConfigs.push({ arcPoints: pts, particleCount: 4, speed: 0.15, color: new THREE.Color(0x9ef277) })
  })

  const filaments = new PhyloFilaments(filamentConfigs)
  earth.add(filaments.object)

  // Graticule — start invisible
  const gratGeo = new THREE.BufferGeometry()
  const gratVerts: number[] = []
  const GRAT_SEGS = 90
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let i = 0; i < GRAT_SEGS; i++) {
      const lon0 = (i / GRAT_SEGS) * 360 - 180
      const lon1 = ((i + 1) / GRAT_SEGS) * 360 - 180
      const p0 = ll2xyz(lat, lon0, R + 0.002)
      const p1 = ll2xyz(lat, lon1, R + 0.002)
      gratVerts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
    }
  }
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
  const gratMesh = new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({
    color: 0x4cc9f0, transparent: true, opacity: 0, depthWrite: false,
  }))
  earth.add(gratMesh)

  return {
    renderer, composer, bloomPass, scene, camera, earth, earthMesh, cloudsMesh, atmoMesh,
    starPoints, splatMesh, splatAttribs, splatMaterial, splatWorldPositions,
    reticleMesh, reticleMaterial, flyArcMeshes, gratMesh,
    filaments, clock, raycaster: new THREE.Raycaster(), rotY: 0, rotX: 0, introPlayed: false,
  }
}

// ─── Cinematic intro timeline ─────────────────────────────────────────────────

function playIntro(s: SceneRefs) {
  if (s.introPlayed) return
  s.introPlayed = true

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

  // Phase 1: Stars fade in
  tl.to((s.starPoints.material as THREE.PointsMaterial), {
    opacity: 0.55, duration: 1.2,
  }, 0)

  // Phase 2: Globe materializes — scale from 0 with elastic overshoot
  tl.to(s.earth.scale, {
    x: 1, y: 1, z: 1, duration: 2.0, ease: 'elastic.out(1, 0.6)',
  }, 0.4)

  // Phase 3: Atmosphere breathes in
  tl.to(s.atmoMesh.scale, {
    x: 1, y: 1, z: 1, duration: 1.5, ease: 'power2.out',
  }, 0.8)

  // Phase 4: Clouds fade in
  tl.to((s.cloudsMesh.material as THREE.MeshPhongMaterial), {
    opacity: 0.28, duration: 1.8,
  }, 1.0)

  // Phase 5: Graticule fades in
  tl.to((s.gratMesh.material as THREE.LineBasicMaterial), {
    opacity: 0.06, duration: 1.4,
  }, 1.4)

  // Phase 6: EpiSplats reveal — staggered pop-in via shader uniform
  tl.to(s.splatMaterial.uniforms.uIntroReveal, {
    value: 1, duration: 1.8, ease: 'power2.inOut',
  }, 1.6)

  // Phase 7: Flyway arcs draw on one by one
  s.flyArcMeshes.forEach((mesh, i) => {
    tl.to((mesh.material as THREE.MeshBasicMaterial), {
      opacity: 0.35, duration: 0.8, ease: 'power2.in',
    }, 2.0 + i * 0.15)
  })

  // Phase 8: Bloom intensity ramps up
  tl.fromTo(s.bloomPass, { strength: 0 }, {
    strength: 0.65, duration: 2.0, ease: 'power2.inOut',
  }, 1.2)

  // Camera fly-in runs in parallel
  s.camera.position.z = 6.5
  tl.to(s.camera.position, {
    z: DEFAULT_ZOOM, duration: 2.8, ease: 'power3.inOut',
  }, 0.2)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompassGlobe() {
  const PRISM_DATA = usePrismData()
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

  // Hover proximity state
  const hoverScalesTarget = useRef<Float32Array | null>(null)
  const lastMouseScreen   = useRef<THREE.Vector2>(new THREE.Vector2(-9999, -9999))

  // Idle drift state
  const lastInteractionRef = useRef(Date.now())
  const idleDriftPhase     = useRef(0)

  // Temporal interpolation state
  const splatLerpState = useRef<{ current: Float32Array[]; target: Float32Array[] } | null>(null)
  const LERP_ATTRS = ['radius', 'brightness', 'pulseRate', 'jitter', 'bloom', 'shimmer', 'glow'] as const

  const { selected, setSelected, tweaks, currentWeek } = useAppStore()
  const autoRotateRef = useRef(tweaks.rotation === 'auto')
  const currentWeekRef = useRef(currentWeek)
  const prevWeekRef = useRef(currentWeek)
  useEffect(() => { autoRotateRef.current = tweaks.rotation === 'auto' }, [tweaks.rotation])
  useEffect(() => { selectedRef.current = selected }, [selected])

  // Smooth temporal transitions via GSAP
  useEffect(() => {
    const s = sceneRef.current
    if (!s || currentWeek === prevWeekRef.current) {
      currentWeekRef.current = currentWeek
      return
    }
    prevWeekRef.current = currentWeek
    currentWeekRef.current = currentWeek
    const regions = PRISM_DATA.regions
    const N = regions.length
    const a = s.splatAttribs

    // Build target arrays from the new week's data
    const targets: Record<string, Float32Array> = {}
    LERP_ATTRS.forEach(attr => { targets[attr] = new Float32Array(N) })

    regions.forEach((r, i) => {
      const sp = r.splatTimeline[currentWeek] ?? r.splat
      targets.radius[i]     = sp.ps
      targets.brightness[i] = sp.rt
      targets.pulseRate[i]  = sp.hNorm
      targets.jitter[i]     = sp.tcc
      targets.bloom[i]      = sp.eti
      targets.shimmer[i]    = sp.rd
      targets.glow[i]       = sp.asMut
    })

    // GSAP tween a proxy object from 0→1, interpolate each frame
    const proxy = { t: 0 }
    const snapshots: Record<string, Float32Array> = {}
    LERP_ATTRS.forEach(attr => {
      snapshots[attr] = new Float32Array(a[attr].array as Float32Array)
    })

    gsap.to(proxy, {
      t: 1, duration: 0.6, ease: 'power2.inOut',
      onUpdate: () => {
        const t = proxy.t
        LERP_ATTRS.forEach(attr => {
          const arr = a[attr].array as Float32Array
          const snap = snapshots[attr]
          const tgt = targets[attr]
          for (let i = 0; i < N; i++) {
            arr[i] = snap[i] + (tgt[i] - snap[i]) * t
          }
          a[attr].needsUpdate = true
        })
      },
    })
  }, [currentWeek])

  // ── Zoom helpers ────────────────────────────────────────────────────────────
  const zoomTo = useCallback((z: number, duration = 0.55) => {
    const s = sceneRef.current
    if (!s) return
    zoomTargetRef.current = clampZoom(z)
    gsap.to(s.camera.position, { z: zoomTargetRef.current, duration, ease: 'power3.out', overwrite: true })
  }, [])

  const markActive = useCallback(() => { lastInteractionRef.current = Date.now() }, [])

  const setCursor = (c: string) => { if (mountRef.current) mountRef.current.style.cursor = c }

  // ── Raycaster pick ──────────────────────────────────────────────────────────
  const pickRegion = useCallback((clientX: number, clientY: number) => {
    const s = sceneRef.current
    if (!s || !mountRef.current) return
    const rect = mountRef.current.getBoundingClientRect()
    let bestDist = 30
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

  // ── Region pan + selection reticle ──────────────────────────────────────────
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !selected) {
      if (s) gsap.to(s.reticleMaterial.uniforms.uActive, { value: 0, duration: 0.3 })
      return
    }
    const targetY = -selected.lon * (Math.PI / 180)
    const targetX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, selected.lat * (Math.PI / 180)))
    gsap.killTweensOf(s.earth.rotation)
    gsap.to(s.earth.rotation, {
      y: targetY, x: targetX, duration: 1.4, ease: 'power2.inOut',
      onUpdate: () => { s.rotY = s.earth.rotation.y; s.rotX = s.earth.rotation.x },
    })

    // Position and activate reticle
    const idx = PRISM_DATA.regions.findIndex(r => r.id === selected.id)
    if (idx >= 0 && s.splatWorldPositions[idx]) {
      const wp = s.splatWorldPositions[idx]
      s.reticleMesh.position.copy(wp)
      s.reticleMesh.lookAt(wp.clone().multiplyScalar(2))
      s.reticleMesh.visible = true

      // Animate reticle scale pop + fade in
      s.reticleMesh.scale.setScalar(0)
      gsap.to(s.reticleMesh.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2.5)', delay: 0.3 })
      gsap.to(s.reticleMaterial.uniforms.uActive, { value: 1, duration: 0.4, delay: 0.3 })
    }
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
    markActive()
    let dy = e.deltaY
    if (e.deltaMode === 1) dy *= 20
    if (e.deltaMode === 2) dy *= 300
    const factor = 1 + dy * 0.0008
    zoomTo(zoomTargetRef.current * factor, 0.35)
  }, [zoomTo, markActive])

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

    const earthHits = s.raycaster.intersectObject(s.earthMesh)
    if (earthHits.length > 0) {
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
    markActive()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
      const [p1, p2] = [...activePointers.current.values()]
      lastPinchDist.current = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    }
    setCursor('grabbing')
  }, [markActive])

  // ── Pointer move ────────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: PointerEvent) => {
    markActive()
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Update mouse screen position for hover proximity
    if (mountRef.current) {
      const rect = mountRef.current.getBoundingClientRect()
      lastMouseScreen.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
    }

    // Pinch zoom
    if (activePointers.current.size === 2) {
      const [p1, p2] = [...activePointers.current.values()]
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      if (lastPinchDist.current > 0) {
        const factor = lastPinchDist.current / dist
        zoomTo(clampZoom(zoomTargetRef.current * factor), 0.08)
      }
      lastPinchDist.current = dist
      return
    }

    // Single-pointer drag
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
  }, [zoomTo, markActive])

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
        const now = Date.now()
        const isDbl = now - lastClickTime.current < DBLCLICK_MS
        lastClickTime.current = now

        if (isDbl) {
          onDblClick(e.clientX, e.clientY)
        } else {
          pickRegion(e.clientX, e.clientY)
        }
      } else {
        // Momentum coast with GSAP-like decay
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
    const refs = buildScene(el, el.clientWidth || 800, el.clientHeight || 600, PRISM_DATA.regions)
    sceneRef.current = refs
    hoverScalesTarget.current = new Float32Array(PRISM_DATA.regions.length).fill(1)

    const { scene, camera, earth, composer } = refs

    // Play cinematic intro
    playIntro(refs)

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const dt = refs.clock.getDelta()
      const elapsed = refs.clock.elapsedTime

      // Auto-rotation
      if (autoRotateRef.current && !isDraggingRef.current) {
        refs.rotY += 0.0018
        earth.rotation.y = refs.rotY
        const clouds = earth.children.find(c => c.userData.isClouds)
        if (clouds) clouds.rotation.y = refs.rotY * 0.08
      }

      // Idle ambient drift — subtle sinusoidal camera offset
      const idleMs = Date.now() - lastInteractionRef.current
      if (idleMs > IDLE_TIMEOUT && autoRotateRef.current) {
        idleDriftPhase.current += dt * 0.3
        const phase = idleDriftPhase.current
        const driftX = Math.sin(phase * 0.7) * 0.08
        const driftY = Math.cos(phase * 0.5) * 0.04
        camera.position.x += (driftX - camera.position.x) * 0.01
        camera.position.y += (driftY - camera.position.y) * 0.01
        camera.lookAt(0, 0, 0)
      } else {
        // Smoothly return camera to center when active
        camera.position.x *= 0.95
        camera.position.y *= 0.95
        if (Math.abs(camera.position.x) > 0.001 || Math.abs(camera.position.y) > 0.001) {
          camera.lookAt(0, 0, 0)
        }
        idleDriftPhase.current = 0
      }

      // EpiSplat time uniform
      refs.splatMaterial.uniforms.uTime.value = elapsed

      // Reticle time uniform
      refs.reticleMaterial.uniforms.uTime.value = elapsed

      // Hover proximity scaling — project splats to screen, scale by distance to cursor
      if (hoverScalesTarget.current && !isDraggingRef.current) {
        const mouse = lastMouseScreen.current
        const a = refs.splatAttribs
        const rect = el.getBoundingClientRect()
        PRISM_DATA.regions.forEach((_, i) => {
          const wp = refs.splatWorldPositions[i].clone().applyMatrix4(earth.matrixWorld)
          const screen = wp.project(camera)
          const dx = mouse.x - screen.x
          const dy = mouse.y - screen.y
          const screenDist = Math.sqrt(dx * dx + dy * dy)
          const targetScale = screenDist < 0.15 ? 1.0 + (1.0 - screenDist / 0.15) * 0.6 : 1.0
          const current = a.hoverScale.array[i] as number
          a.hoverScale.array[i] = current + (targetScale - current) * 0.12
        })
        a.hoverScale.needsUpdate = true
      }

      // Animate reticle — gentle scale pulse
      if (refs.reticleMesh.visible) {
        const pulse = 1.0 + Math.sin(elapsed * 3.0) * 0.08
        refs.reticleMesh.scale.setScalar(pulse)
      }

      // Advance phylo-filament particles
      refs.filaments.update(dt)

      // Render via composer (bloom pipeline)
      composer.render()
    }
    animate()

    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      refs.renderer.setSize(nw, nh)
      composer.setSize(nw, nh)
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
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points || obj instanceof THREE.LineLoop) {
          obj.geometry?.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material?.dispose()
        }
      })
      composer.dispose()
      refs.renderer.dispose()
      if (el.contains(refs.renderer.domElement)) el.removeChild(refs.renderer.domElement)
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
