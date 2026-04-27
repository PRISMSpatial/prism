// EpiSplat vertex shader — instanced billboard quads
// Each instance encodes one pathogen clone on the globe

uniform float uTime;

// Per-instance attributes
attribute vec3 aWorldPos;     // lat/lon → xyz on unit sphere
attribute float aRadius;      // PS → splat size
attribute float aBrightness;  // R(t) → luminance
attribute vec3 aColor;        // subtype → hue
attribute float aPulseRate;   // H_norm → pulsing speed
attribute float aJitter;      // TCC → position shake
attribute float aBloom;       // ETI → outer glow
attribute float aShimmer;     // RD → noise intensity
attribute float aGlow;        // antigenic mutations → hotspot ring

// Pass to fragment
varying vec2 vUv;
varying float vBrightness;
varying vec3 vColor;
varying float vPulseRate;
varying float vBloom;
varying float vShimmer;
varying float vGlow;
varying float vRadius;

// Simple hash for jitter noise
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = position.xy * 0.5 + 0.5;  // map [-1,1] quad → [0,1] UV
  vBrightness = aBrightness;
  vColor = aColor;
  vPulseRate = aPulseRate;
  vBloom = aBloom;
  vShimmer = aShimmer;
  vGlow = aGlow;
  vRadius = aRadius;

  // Billboard: extract camera right/up from modelView matrix
  vec3 camRight = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 camUp    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  // Jitter displacement (TCC-driven shake)
  float jx = hash(aWorldPos.x * 100.0 + uTime * 3.7) * 2.0 - 1.0;
  float jy = hash(aWorldPos.y * 100.0 + uTime * 5.1) * 2.0 - 1.0;
  vec3 jitterOffset = (camRight * jx + camUp * jy) * aJitter * 0.012;

  // Scale quad by radius (PS), with bloom extending the quad for outer glow
  float scale = mix(0.025, 0.09, aRadius) * (1.0 + aBloom * 0.5);
  vec3 vertexPos = aWorldPos + jitterOffset
    + camRight * position.x * scale
    + camUp * position.y * scale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPos, 1.0);
}
