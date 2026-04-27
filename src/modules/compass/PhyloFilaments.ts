// PhyloFilaments — animated particles traveling along flyway arcs on the globe
// Represents pathogen lineage transmission routes as moving light particles

import * as THREE from 'three'

interface FilamentConfig {
  arcPoints: THREE.Vector3[]  // pre-computed arc path
  particleCount: number       // particles per arc
  speed: number               // base speed (0-1 per frame)
  color: THREE.Color
}

const TRAIL_LENGTH = 3       // points per particle for trail effect
const TRAIL_DECAY  = 0.35    // alpha decay per trail point

export class PhyloFilaments {
  private particles: THREE.Points
  private configs: FilamentConfig[]
  private offsets: Float32Array // per-particle t offset (0-1)
  private totalParticles: number

  constructor(configs: FilamentConfig[]) {
    this.configs = configs
    this.totalParticles = configs.reduce((sum, c) => sum + c.particleCount * TRAIL_LENGTH, 0)

    const positions = new Float32Array(this.totalParticles * 3)
    const colors = new Float32Array(this.totalParticles * 3)
    const alphas = new Float32Array(this.totalParticles)

    // Initialize staggered offsets
    this.offsets = new Float32Array(configs.reduce((sum, c) => sum + c.particleCount, 0))
    let pi = 0
    configs.forEach(c => {
      for (let p = 0; p < c.particleCount; p++) {
        this.offsets[pi++] = p / c.particleCount // evenly stagger
      }
    })

    // Set base colors
    let idx = 0
    configs.forEach(c => {
      for (let p = 0; p < c.particleCount; p++) {
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          colors[idx * 3]     = c.color.r
          colors[idx * 3 + 1] = c.color.g
          colors[idx * 3 + 2] = c.color.b
          alphas[idx] = Math.max(0.05, 1.0 - t * TRAIL_DECAY)
          idx++
        }
      }
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

    const mat = new THREE.PointsMaterial({
      size: 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geo, mat)
  }

  get object(): THREE.Points {
    return this.particles
  }

  update(dt: number) {
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    const positions = posAttr.array as Float32Array
    const alphaAttr = this.particles.geometry.getAttribute('alpha') as THREE.BufferAttribute
    const alphas = alphaAttr.array as Float32Array

    let vertIdx = 0
    let offsetIdx = 0

    this.configs.forEach(config => {
      const arcLen = config.arcPoints.length - 1

      for (let p = 0; p < config.particleCount; p++) {
        // Advance offset
        this.offsets[offsetIdx] = (this.offsets[offsetIdx] + config.speed * dt) % 1.0
        const baseT = this.offsets[offsetIdx]

        for (let t = 0; t < TRAIL_LENGTH; t++) {
          const trailT = (baseT - t * 0.025 + 1.0) % 1.0 // trail follows behind
          const arcIdx = Math.floor(trailT * arcLen)
          const arcFrac = trailT * arcLen - arcIdx
          const idx0 = Math.min(arcIdx, arcLen)
          const idx1 = Math.min(arcIdx + 1, arcLen)

          const pt = new THREE.Vector3().lerpVectors(
            config.arcPoints[idx0],
            config.arcPoints[idx1],
            arcFrac,
          )

          positions[vertIdx * 3]     = pt.x
          positions[vertIdx * 3 + 1] = pt.y
          positions[vertIdx * 3 + 2] = pt.z

          alphas[vertIdx] = Math.max(0.05, (1.0 - t * TRAIL_DECAY) * 0.85)
          vertIdx++
        }
        offsetIdx++
      }
    })

    posAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  }
}
