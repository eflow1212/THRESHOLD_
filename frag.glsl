precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uEntropy;
uniform float uSeed;

uniform float uWarpAmp1;   uniform float uWarpScale1;
uniform float uWarpAmp2;   uniform float uWarpScale2;
uniform float uWarpAmp3;   uniform float uWarpScale3;
uniform float uFlowAngle;  uniform float uFlowStr;  uniform float uFlowFreq;
uniform float uStrataStr;  uniform float uStrataFreq;
uniform float uBandMin;    uniform float uBandMax;
uniform float uDensScale1; uniform float uDensScale2;
uniform float uDensMix;    uniform float uDensityCurve;

uniform vec4  uVortex[4];
uniform float uVortexTight[4];


float hash(vec2 p) {
  p  = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  return vnoise(p) * 0.6667 + vnoise(p * 2.0) * 0.3333;
}

float O(float idx) {
  return fract(sin(idx * 127.1 + uSeed * 0.001137) * 43758.5453) * 890.0 + 10.0;
}

float scurve(float t, float k) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5
    ? 0.5 * pow(2.0 * t, k)
    : 1.0 - 0.5 * pow(2.0 * (1.0 - t), k);
}


void main() {

  vec2 uv = vec2(gl_FragCoord.x,
                 uResolution.y - gl_FragCoord.y) / uResolution;
  vec2 px = uv * uResolution;
  float W = uResolution.x;
  float H = uResolution.y;

  float tW1 = uTime * 0.28;
  float tW2 = uTime * 0.55;
  float tW3 = uTime * 1.10;
  float tB  = uTime * 0.18;


  // ── Scan stretch ──
  float stretchAmt = 0.0;
  float yN = px.y / H;

  float baseTear = fbm(vec2(O(50.0) * 0.008, yN * 5.0 + O(51.0) * 0.008));
  stretchAmt = max(0.0, baseTear - 0.56) * 38.0;

  float eb1 = fbm(vec2(O(52.0)*0.008, yN *  2.2 + O(53.0)*0.008));
  float eb2 = fbm(vec2(O(54.0)*0.008, yN *  7.0 + O(55.0)*0.008));
  float eb3 = fbm(vec2(O(56.0)*0.008, yN * 18.0 + O(57.0)*0.008));

  float thresh1 = 1.0 - uEntropy * 0.82;
  float thresh2 = 1.0 - uEntropy * 0.65;
  float thresh3 = 1.0 - uEntropy * 0.45;

  stretchAmt += max(0.0, eb1 - thresh1) / max(0.001, 1.0 - thresh1) * 60.0  * uEntropy;
  stretchAmt += max(0.0, eb2 - thresh2) / max(0.001, 1.0 - thresh2) * 35.0  * uEntropy;
  stretchAmt += max(0.0, eb3 - thresh3) / max(0.001, 1.0 - thresh3) * 25.0  * uEntropy * uEntropy;

  vec2 spx = px;
  if (stretchAmt > 1.0) {
    float s = floor(stretchAmt);
    spx.x = floor(spx.x / s) * s;
    if (uEntropy > 0.5 && s > 8.0) {
      float vs = max(1.0, floor(s * 0.3));
      spx.y = floor(spx.y / vs) * vs;
    }
  }


  // ── Shift glitch ──
  float row   = floor(px.y / 3.0);
  float gStep = floor(uTime * 9.0);
  float rA = hash(vec2(row * 0.0137, gStep * 0.071 + uSeed * 0.001));
  float rB = hash(vec2(row * 0.0312, gStep * 0.113 + uSeed * 0.002));
  if (rA < 0.04 + uEntropy * 0.28) {
    spx.x += (rB * 2.0 - 1.0) * (18.0 + uEntropy * 80.0);
  }


  const float PAD = 0.18;
  float su = (spx.x / W - 0.5) * (1.0 + PAD * 2.0) + 0.5;
  float sv = (spx.y / H - 0.5) * (1.0 + PAD * 2.0) + 0.5;


  // ── Domain warp ──
  float w1x = fbm(vec2(su*uWarpScale1 + O(0.0) + tW1,
                       sv*uWarpScale1 + O(1.0) + tW1));
  float w1y = fbm(vec2(su*uWarpScale1 + O(2.0) + tW1,
                       sv*uWarpScale1 + O(3.0) + tW1));
  vec2 d1 = (vec2(w1x, w1y) - 0.5) * uWarpAmp1;

  vec2 p2   = (spx + d1) / uResolution;
  float w2x = fbm(vec2(p2.x*uWarpScale2 + O(4.0) + tW2,
                       p2.y*uWarpScale2 + O(5.0) + tW2));
  float w2y = fbm(vec2(p2.x*uWarpScale2 + O(6.0) + tW2,
                       p2.y*uWarpScale2 + O(7.0) + tW2));
  vec2 d2 = (vec2(w2x, w2y) - 0.5) * uWarpAmp2;

  vec2 p3   = (spx + d1 + d2) / uResolution;
  float w3x = fbm(vec2(p3.x*uWarpScale3 + O(40.0) + tW3,
                       p3.y*uWarpScale3 + O(41.0) + tW3));
  float w3y = fbm(vec2(p3.x*uWarpScale3 + O(42.0) + tW3,
                       p3.y*uWarpScale3 + O(43.0) + tW3));
  vec2 d3 = (vec2(w3x, w3y) - 0.5) * uWarpAmp3;

  float fn = fbm(vec2(su*uFlowFreq + O(8.0), sv*uFlowFreq + O(9.0)));
  vec2 df  = vec2(cos(uFlowAngle), sin(uFlowAngle) * 0.6) * fn * uFlowStr;

  vec2 wpx = spx + d1 + d2 + d3 + df;


  // ── Vortices ──
  {
    vec4 v = uVortex[0];
    if (v.z > 1.0) {
      vec2  vd    = wpx - v.xy;
      float vdist = length(vd);
      if (vdist < v.z && vdist > 1.0) {
        float f2   = 1.0 - vdist / v.z;  f2 *= f2;
        float ang  = atan(vd.y, vd.x) + 1.5707963 * v.w;
        float pull = f2 * uVortexTight[0] * v.z * 0.3;
        wpx += vec2(cos(ang), sin(ang)) * pull * f2;
      }
    }
  }
  {
    vec4 v = uVortex[1];
    if (v.z > 1.0) {
      vec2  vd    = wpx - v.xy;
      float vdist = length(vd);
      if (vdist < v.z && vdist > 1.0) {
        float f2   = 1.0 - vdist / v.z;  f2 *= f2;
        float ang  = atan(vd.y, vd.x) + 1.5707963 * v.w;
        float pull = f2 * uVortexTight[1] * v.z * 0.3;
        wpx += vec2(cos(ang), sin(ang)) * pull * f2;
      }
    }
  }
  {
    vec4 v = uVortex[2];
    if (v.z > 1.0) {
      vec2  vd    = wpx - v.xy;
      float vdist = length(vd);
      if (vdist < v.z && vdist > 1.0) {
        float f2   = 1.0 - vdist / v.z;  f2 *= f2;
        float ang  = atan(vd.y, vd.x) + 1.5707963 * v.w;
        float pull = f2 * uVortexTight[2] * v.z * 0.3;
        wpx += vec2(cos(ang), sin(ang)) * pull * f2;
      }
    }
  }
  {
    vec4 v = uVortex[3];
    if (v.z > 1.0) {
      vec2  vd    = wpx - v.xy;
      float vdist = length(vd);
      if (vdist < v.z && vdist > 1.0) {
        float f2   = 1.0 - vdist / v.z;  f2 *= f2;
        float ang  = atan(vd.y, vd.x) + 1.5707963 * v.w;
        float pull = f2 * uVortexTight[3] * v.z * 0.3;
        wpx += vec2(cos(ang), sin(ang)) * pull * f2;
      }
    }
  }

  vec2 wu = wpx / uResolution;


  // ── Base field ──
  float base   = fbm(vec2(wu.x + O(10.0) + tB, wu.y + O(11.0) + tB));
  float strata = fbm(vec2(wu.x * 0.35, wu.y * uStrataFreq));
  base = mix(base, strata, uStrataStr);
  float su4 = wu.x * 0.94 + wu.y * 0.34;
  base = mix(base, fbm(vec2(su4*3.5 + O(44.0), su4*0.5 + O(45.0))), 0.06);
  base = clamp(base, 0.0, 1.0);


  // ── Density map ──
  float d1d = fbm(vec2(uv.x*uDensScale1 + O(16.0), uv.y*uDensScale1 + O(17.0)));
  float d2d = fbm(vec2(uv.x*uDensScale2 + O(18.0), uv.y*uDensScale2 + O(19.0)));
  float density = scurve(mix(d1d, d2d, uDensMix), uDensityCurve);


  // ── Banding ──
  float bands   = mix(uBandMin, uBandMax, density);
  float phase   = base * bands;
  float bandIdx = floor(phase);
  float frac    = phase - bandIdx;
  float isWhite = step(mod(bandIdx, 2.0), 0.5);

  float eW = 0.07;
  float shade;
  if (frac < eW) {
    float tt = frac / eW;
    shade = isWhite > 0.5 ? mix(50.0, 255.0, tt*tt) : mix(205.0, 0.0, tt*tt);
  } else if (frac > (1.0 - eW)) {
    float tt = (1.0 - frac) / eW;
    shade = isWhite > 0.5 ? mix(50.0, 255.0, tt*tt) : mix(205.0, 0.0, tt*tt);
  } else {
    shade = isWhite > 0.5 ? 255.0 : 0.0;
  }

  if (density > 0.55 && isWhite > 0.5) {
    float thinning = (density - 0.55) / 0.45 * 0.4;
    float dfc      = abs(frac - 0.5);
    float thresh   = 0.5 - thinning;
    if (dfc > thresh && thinning > 0.001) {
      float da = clamp((dfc - thresh) / thinning, 0.0, 1.0);
      shade = mix(shade, 20.0, da * 0.75);
    }
  }

  if (density < 0.25 && isWhite < 0.5) {
    float widening = (0.25 - density) / 0.25 * 0.15;
    float dfc      = abs(frac - 0.5);
    float thresh   = 0.5 - widening;
    if (dfc > thresh && widening > 0.001) {
      float la = clamp((dfc - thresh) / widening, 0.0, 1.0);
      shade = mix(shade, 235.0, la * 0.5);
    }
  }

  float c = shade / 255.0;
  gl_FragColor = vec4(c, c, c, 1.0);
}
