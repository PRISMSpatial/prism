// EpiSplat fragment shader — renders biological signal encoding
// 8 visual parameters mapped to epidemiological metrics

uniform float uTime;

varying vec2 vUv;
varying float vBrightness;
varying vec3 vColor;
varying float vPulseRate;
varying float vBloom;
varying float vShimmer;
varying float vGlow;
varying float vRadius;

// Simplex-like 2D noise for shimmer
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // Distance from center in UV space
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;  // 0 at center, 1 at edge

  // Account for bloom extending the quad
  float coreRadius = 1.0 / (1.0 + vBloom * 0.5);

  // SDF circle — soft core
  float coreDist = dist / coreRadius;
  float coreAlpha = smoothstep(1.0, 0.6, coreDist);

  // Pulse modulation (H_norm → pulsing alpha)
  float pulse = 1.0 - vPulseRate * 0.3 * (0.5 + 0.5 * sin(uTime * (2.0 + vPulseRate * 6.0)));

  // Brightness from R(t) — maps 0.3-2.0 → 0.3-1.0 luminance
  float brightness = clamp(vBrightness * 0.5, 0.3, 1.0);

  // Shimmer (RD → animated noise pattern)
  float shimmerNoise = noise2(vUv * 8.0 + uTime * vec2(1.3, 0.9));
  float shimmer = 1.0 + vShimmer * 0.25 * (shimmerNoise - 0.5);

  // Core color with all modulations
  vec3 coreColor = vColor * brightness * pulse * shimmer;
  float alpha = coreAlpha * (0.7 + 0.3 * brightness);

  // Bloom ring (ETI → outer Gaussian glow)
  float bloomDist = dist;
  float bloomAlpha = vBloom * 0.45 * exp(-bloomDist * bloomDist * 3.0);
  vec3 bloomColor = vColor * 0.8;

  // Hotspot glow (antigenic mutations → red/orange halo)
  float glowRing = smoothstep(0.3, 0.7, coreDist) * smoothstep(1.2, 0.8, coreDist);
  vec3 hotspotColor = mix(vec3(1.0, 0.42, 0.29), vec3(1.0, 0.7, 0.2), 0.5);
  float hotspotAlpha = vGlow * glowRing * 0.7 * (0.8 + 0.2 * sin(uTime * 1.8));

  // Composite: core + bloom + hotspot
  vec3 finalColor = coreColor * alpha
    + bloomColor * bloomAlpha
    + hotspotColor * hotspotAlpha;
  float finalAlpha = max(max(alpha, bloomAlpha), hotspotAlpha);

  // Discard fully transparent fragments
  if (finalAlpha < 0.01) discard;

  gl_FragColor = vec4(finalColor, finalAlpha);
}
