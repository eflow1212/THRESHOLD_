// ─────────────────────────────────────────────────────────
//  sketch.js
//  Hosts the GLSL shader and passes uniforms each frame.
//  No sliders — values are fixed below.
// ─────────────────────────────────────────────────────────

let shdr;

// ── Fixed values ─────────────────────────────────────────
const TARGET_FPS  = 30;
const FLOW_SPEED  = 0.73;   // how fast the organic flow moves  (0=frozen, 1=fast)
const ENTROPY_VAL = 1.0;    // chaos / scan-line tearing  (0=clean, 1=full)

// ── Animation state ──────────────────────────────────────
let SEED    = 0;
let t       = 0;
let entropy = 0;

// ── Per-seed visual params ────────────────────────────────
let sp = {};


// ─────────────────────────────────────────────────────────
//  PRELOAD
// ─────────────────────────────────────────────────────────
function preload() {
  shdr = loadShader('vert.glsl', 'frag.glsl');
}


// ─────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  noStroke();
  frameRate(TARGET_FPS);

  SEED = random(1000);
  regenerate();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  regenerate();
}

function keyPressed() {
  if (key === ' ') {
    SEED    = random(1000);
    t       = 0;
    entropy = 0;
    regenerate();
    return false;
  }
}


// ─────────────────────────────────────────────────────────
//  REGENERATE
// ─────────────────────────────────────────────────────────
function regenerate() {
  randomSeed(floor(SEED * 1e6));

  let diag = sqrt(width * width + height * height);

  sp = {
    warpAmp1:     random(0.35, 0.7)  * diag,
    warpScale1:   random(0.2,  0.55),
    warpAmp2:     random(0.12, 0.3)  * diag,
    warpScale2:   random(0.5,  1.3),
    warpAmp3:     random(0.02, 0.08) * diag,
    warpScale3:   random(1.5,  3.5),
    flowAngle:    random(TWO_PI),
    flowStr:      random(0.15, 0.4)  * diag,
    flowFreq:     random(0.2,  0.6),
    strataStr:    random(0.1,  0.35),
    strataFreq:   random(3.0,  8.0),
    bandMin:      random(3,    7),
    bandMax:      random(80,   140),
    densScale1:   random(0.15, 0.45),
    densScale2:   random(0.6,  1.4),
    densMix:      random(0.2,  0.5),
    densityCurve: random(2.5,  4.0),
    vortices:     buildVortices(),
  };
}

function buildVortices() {
  let arr = [];
  let n   = floor(random(1, 5));
  for (let i = 0; i < n; i++) {
    arr.push({
      cx:        random(width  * 0.1, width  * 0.9),
      cy:        random(height * 0.1, height * 0.9),
      radius:    random(50, min(width, height) * 0.45),
      strength:  random(0.3, 1.0) * (random() < 0.5 ? 1 : -1),
      tightness: random(0.4, 1.8),
    });
  }
  return arr;
}


// ─────────────────────────────────────────────────────────
//  DRAW
// ─────────────────────────────────────────────────────────
function draw() {
  // Advance time using fixed flow speed
  t       += FLOW_SPEED * 0.01;
  // Entropy climbs toward ENTROPY_VAL and stays there
  entropy  = constrain(entropy + ENTROPY_VAL * 0.003, 0, ENTROPY_VAL);

  shader(shdr);

  // Core uniforms
  shdr.setUniform('uResolution',   [width, height]);
  shdr.setUniform('uTime',          t);
  shdr.setUniform('uEntropy',       entropy);
  shdr.setUniform('uSeed',          SEED);

  // Visual param uniforms
  shdr.setUniform('uWarpAmp1',      sp.warpAmp1);
  shdr.setUniform('uWarpScale1',    sp.warpScale1);
  shdr.setUniform('uWarpAmp2',      sp.warpAmp2);
  shdr.setUniform('uWarpScale2',    sp.warpScale2);
  shdr.setUniform('uWarpAmp3',      sp.warpAmp3);
  shdr.setUniform('uWarpScale3',    sp.warpScale3);
  shdr.setUniform('uFlowAngle',     sp.flowAngle);
  shdr.setUniform('uFlowStr',       sp.flowStr);
  shdr.setUniform('uFlowFreq',      sp.flowFreq);
  shdr.setUniform('uStrataStr',     sp.strataStr);
  shdr.setUniform('uStrataFreq',    sp.strataFreq);
  shdr.setUniform('uBandMin',       sp.bandMin);
  shdr.setUniform('uBandMax',       sp.bandMax);
  shdr.setUniform('uDensScale1',    sp.densScale1);
  shdr.setUniform('uDensScale2',    sp.densScale2);
  shdr.setUniform('uDensMix',       sp.densMix);
  shdr.setUniform('uDensityCurve',  sp.densityCurve);

  // Vortex uniforms (always 4 slots; zero radius = inactive)
  let vData  = [];
  let vTight = [];
  for (let i = 0; i < 4; i++) {
    if (i < sp.vortices.length) {
      let v = sp.vortices[i];
      vData.push(v.cx, v.cy, v.radius, v.strength);
      vTight.push(v.tightness);
    } else {
      vData.push(0, 0, 0, 0);
      vTight.push(0);
    }
  }
  shdr.setUniform('uVortex',      vData);
  shdr.setUniform('uVortexTight', vTight);

  // Fullscreen quad — p5 WEBGL origin is canvas centre
  rect(-width / 2, -height / 2, width, height);
}
