// MoleculeViewer — WebGL-based HA trimer visualization using Three.js
// Replaces the SVG molecule with a 3D interactive protein structure

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { PRISM_DATA } from '../../data/mock'

interface MoleculeViewerProps {
  selectedSite: number | null
  onSelectSite: (site: number) => void
}

// Chain colors matching the design system
const CHAIN_COLORS = [
  new THREE.Color(0x4cc9f0), // cool
  new THREE.Color(0xb08bff), // violet
  new THREE.Color(0x9ef277), // phos
]

// Antigenic sites from mutations data
const SITES = PRISM_DATA.mutations.map(m => m.site)

// Impact → glow color
const IMPACT_COLORS: Record<string, THREE.Color> = {
  high: new THREE.Color(0xff6b4a),
  mid:  new THREE.Color(0xf0b429),
  low:  new THREE.Color(0x4cc9f0),
}

function buildTrimer(scene: THREE.Scene): {
  chains: THREE.Mesh[]
  siteSpheres: Map<number, THREE.Mesh>
  glowSpheres: Map<number, THREE.Mesh>
} {
  const chains: THREE.Mesh[] = []
  const siteSpheres = new Map<number, THREE.Mesh>()
  const glowSpheres = new Map<number, THREE.Mesh>()

  // Build 3 ribbon-like chains at 120° intervals
  for (let c = 0; c < 3; c++) {
    const angle = (c / 3) * Math.PI * 2
    const points: THREE.Vector3[] = []

    for (let i = 0; i <= 60; i++) {
      const t = i / 60
      const baseR = 1.2
      const x = Math.cos(angle + t * 1.5) * baseR + Math.sin(t * Math.PI * 3.5) * 0.15
      const y = (t - 0.5) * 4.0
      const z = Math.sin(angle + t * 1.5) * baseR + Math.cos(t * Math.PI * 3.5) * 0.15
      points.push(new THREE.Vector3(x, y, z))
    }

    const curve = new THREE.CatmullRomCurve3(points)
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.08, 8, false)
    const mat = new THREE.MeshPhongMaterial({
      color: CHAIN_COLORS[c],
      emissive: CHAIN_COLORS[c],
      emissiveIntensity: 0.15,
      shininess: 40,
      transparent: true,
      opacity: 0.85,
    })
    const mesh = new THREE.Mesh(tubeGeo, mat)
    scene.add(mesh)
    chains.push(mesh)
  }

  // Place mutation site markers on chain 0
  PRISM_DATA.mutations.forEach((m, i) => {
    const t = (i + 1) / (PRISM_DATA.mutations.length + 1)
    const angle = 0 // chain 0
    const baseR = 1.2
    const x = Math.cos(angle + t * 1.5) * baseR + Math.sin(t * Math.PI * 3.5) * 0.15
    const y = (t - 0.5) * 4.0
    const z = Math.sin(angle + t * 1.5) * baseR + Math.cos(t * Math.PI * 3.5) * 0.15

    const impactColor = IMPACT_COLORS[m.impact] ?? IMPACT_COLORS.low

    // Core sphere
    const sGeo = new THREE.SphereGeometry(0.12, 16, 16)
    const sMat = new THREE.MeshPhongMaterial({
      color: impactColor,
      emissive: impactColor,
      emissiveIntensity: 0.4,
      shininess: 60,
    })
    const sphere = new THREE.Mesh(sGeo, sMat)
    sphere.position.set(x, y, z)
    sphere.userData.site = m.site
    scene.add(sphere)
    siteSpheres.set(m.site, sphere)

    // Hotspot glow sphere (visible for ESM-2 escape > threshold)
    const glowGeo = new THREE.SphereGeometry(0.22, 16, 16)
    const glowMat = new THREE.MeshBasicMaterial({
      color: impactColor,
      transparent: true,
      opacity: m.esm < -0.7 ? 0.35 : 0.0, // show glow for high escape score
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const glowMesh = new THREE.Mesh(glowGeo, glowMat)
    glowMesh.position.set(x, y, z)
    scene.add(glowMesh)
    glowSpheres.set(m.site, glowMesh)
  })

  return { chains, siteSpheres, glowSpheres }
}

export function MoleculeViewer({ selectedSite, onSelectSite }: MoleculeViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const w = el.clientWidth || 400
    const h = el.clientHeight || 400

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(2.5, 1.5, 3.5)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0x1a2233, 3.0))
    const key = new THREE.DirectionalLight(0xfff5e0, 2.0)
    key.position.set(4, 3, 5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x334488, 0.8)
    fill.position.set(-3, -1, -3)
    scene.add(fill)

    const { chains, siteSpheres, glowSpheres } = buildTrimer(scene)

    // Auto-rotation
    const group = new THREE.Group()
    scene.children.forEach(c => { if (c !== key && c !== fill && c.type !== 'AmbientLight') group.add(c) })
    scene.add(group)

    // Raycaster for site selection
    const raycaster = new THREE.Raycaster()

    const onPointerDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects([...siteSpheres.values()])
      if (hits.length > 0) {
        onSelectSite(hits[0].object.userData.site)
      }
    }
    el.addEventListener('pointerdown', onPointerDown)

    const clock = new THREE.Clock()
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      group.rotation.y = t * 0.3

      // Pulse glow spheres
      glowSpheres.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshBasicMaterial
        if (mat.opacity > 0) {
          mat.opacity = 0.2 + 0.15 * Math.sin(t * 2.0)
        }
      })

      // Highlight selected site
      siteSpheres.forEach((mesh, site) => {
        const target = site === selectedSite ? 1.8 : 1.0
        mesh.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
      })

      renderer.render(scene, camera)
    }

    // Camera fly-in
    camera.position.z = 6
    gsap.to(camera.position, { z: 3.5, duration: 1.5, ease: 'power2.out' })

    animate()

    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      el.removeEventListener('pointerdown', onPointerDown)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [selectedSite, onSelectSite])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', minHeight: 300, position: 'relative', cursor: 'grab' }}
    />
  )
}
