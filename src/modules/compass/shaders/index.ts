// EpiSplat shader exports — inline GLSL strings for Three.js ShaderMaterial

export const EPISPLAT_VERT = /* glsl */ `
uniform float uTime;

attribute vec3 aWorldPos;
attribute float aRadius;
attribute float aBrightness;
attribute vec3 aColor;
attribute float aPulseRate;
attribute float aJitter;
attribute float aBloom;
attribute float aShimmer;
attribute float aGlow;

varying vec2 vUv;
varying float vBrightness;
varying vec3 vColor;
varying float vPulseRate;
varying float vBloom;
varying float vShimmer;
varying float vGlow;
varying float vRadius;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = position.xy * 0.5 + 0.5;
  vBrightness = aBrightness;
  vColor = aColor;
  vPulseRate = aPulseRate;
  vBloom = aBloom;
  vShimmer = aShimmer;
  vGlow = aGlow;
  vRadius = aRadius;

  vec3 camRight = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 camUp    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  float jx = hash(aWorldPos.x * 100.0 + uTime * 3.7) * 2.0 - 1.0;
  float jy = hash(aWorldPos.y * 100.0 + uTime * 5.1) * 2.0 - 1.0;
  vec3 jitterOffset = (camRight * jx + camUp * jy) * aJitter * 0.012;

  float scale = mix(0.025, 0.09, aRadius) * (1.0 + aBloom * 0.5);
  vec3 vertexPos = aWorldPos + jitterOffset
    + camRight * position.x * scale
    + camUp * position.y * scale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPos, 1.0);
}
`

export const EPISPLAT_FRAG = /* glsl */ `
uniform float uTime;

varying vec2 vUv;
varying float vBrightness;
varying vec3 vColor;
varying float vPulseRate;
varying float vBloom;
varying float vShimmer;
varying float vGlow;
varying float vRadius;

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
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;

  float coreRadius = 1.0 / (1.0 + vBloom * 0.5);
  float coreDist = dist / coreRadius;
  float coreAlpha = smoothstep(1.0, 0.6, coreDist);

  float pulse = 1.0 - vPulseRate * 0.3 * (0.5 + 0.5 * sin(uTime * (2.0 + vPulseRate * 6.0)));
  float brightness = clamp(vBrightness * 0.5, 0.3, 1.0);

  float shimmerNoise = noise2(vUv * 8.0 + uTime * vec2(1.3, 0.9));
  float shimmer = 1.0 + vShimmer * 0.25 * (shimmerNoise - 0.5);

  vec3 coreColor = vColor * brightness * pulse * shimmer;
  float alpha = coreAlpha * (0.7 + 0.3 * brightness);

  float bloomDist = dist;
  float bloomAlpha = vBloom * 0.45 * exp(-bloomDist * bloomDist * 3.0);
  vec3 bloomColor = vColor * 0.8;

  float glowRing = smoothstep(0.3, 0.7, coreDist) * smoothstep(1.2, 0.8, coreDist);
  vec3 hotspotColor = mix(vec3(1.0, 0.42, 0.29), vec3(1.0, 0.7, 0.2), 0.5);
  float hotspotAlpha = vGlow * glowRing * 0.7 * (0.8 + 0.2 * sin(uTime * 1.8));

  vec3 finalColor = coreColor * alpha + bloomColor * bloomAlpha + hotspotColor * hotspotAlpha;
  float finalAlpha = max(max(alpha, bloomAlpha), hotspotAlpha);

  if (finalAlpha < 0.01) discard;

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`
