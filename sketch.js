// ─────────────────────────────────────────────────────────
//  sketch.js
//  Hosts the GLSL shader, manages uniforms and slider UI.
//  All rendering logic lives in frag.glsl — this file is
//  purely control/setup.
// ─────────────────────────────────────────────────────────

let shdr;

// ── Animation state ──────────────────────────────────────
let SEED    = 0;
let t       = 0;       // accumulated time (scaled by flow)
let entropy = 0;       // accumulated chaos (scaled by glitch)

// ── Slider values ─────────────────────────────────────────
let ctrl = {
  fps:    30,
  flow:   0.3,   // 0 = frozen,  1 = fast liquid
  glitch: 0.0,   // 0 = clean,   1 = full tearing chaos
};

// ── Per-seed visual params (sent as uniforms) ─────────────
let sp = {};


// ─────────────────────────────────────────────────────────
//  PRELOAD — shaders must load before setup()
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
  frameRate(ctrl.fps);

  SEED = random(1000);
  regenerate();
  buildUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  regenerate();   // recalculate diag-dependent params
}

function keyPressed() {
  if (key === ' ') {
    SEED    = random(1000);
    t       = 0;
    entropy = 0;
    regenerate();
    return false;   // prevent page scroll on space
  }
}


// ─────────────────────────────────────────────────────────
//  REGENERATE  — pick new random params for this seed
// ─────────────────────────────────────────────────────────
function regenerate() {
  // Seed p5's RNG so params are deterministic per SEED value
  randomSeed(floor(SEED * 1e6));

  let diag = sqrt(width * width + height * height);

  sp = {
    warpAmp1:   random(0.35, 0.7)  * diag,
    warpScale1: random(0.2,  0.55),
    warpAmp2:   random(0.12, 0.3)  * diag,
    warpScale2: random(0.5,  1.3),
    warpAmp3:   random(0.02, 0.08) * diag,
    warpScale3: random(1.5,  3.5),
    flowAngle:  random(TWO_PI),
    flowStr:    random(0.15, 0.4)  * diag,
    flowFreq:   random(0.2,  0.6),
    strataStr:  random(0.1,  0.35),
    strataFreq: random(3.0,  8.0),
    bandMin:    random(3,    7),
    bandMax:    random(80,   140),
    densScale1: random(0.15, 0.45),
    densScale2: random(0.6,  1.4),
    densMix:    random(0.2,  0.5),
    densityCurve: random(2.5, 4.0),
    vortices:   buildVortices(),
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
//  DRAW  — runs every frame, sets uniforms, draws quad
// ─────────────────────────────────────────────────────────
function draw() {
  frameRate(ctrl.fps);

  // Advance time and entropy based on sliders
  t       += ctrl.flow   * 0.01;
  entropy  = constrain(entropy + ctrl.glitch * 0.003, 0, 1);

  // Activate shader
  shader(shdr);

  // ── Core uniforms ──
  shdr.setUniform('uResolution',   [width, height]);
  shdr.setUniform('uTime',          t);
  shdr.setUniform('uEntropy',       entropy);
  shdr.setUniform('uSeed',          SEED);

  // ── Visual param uniforms ──
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

  // ── Vortex uniforms ──
  // Always send 4 slots; inactive slots have radius = 0 (frag shader ignores them)
  let vData   = [];
  let vTight  = [];
  for (let i = 0; i < 4; i++) {
    if (i < sp.vortices.length) {
      let v = sp.vortices[i];
      vData.push(v.cx, v.cy, v.radius, v.strength);
      vTight.push(v.tightness);
    } else {
      vData.push(0, 0, 0, 0);   // zero radius = inactive
      vTight.push(0);
    }
  }
  shdr.setUniform('uVortex',       vData);
  shdr.setUniform('uVortexTight',  vTight);

  // ── Draw fullscreen quad ──
  // In p5 WEBGL mode the origin is canvas centre,
  // so (-w/2, -h/2) is the top-left corner.
  rect(-width / 2, -height / 2, width, height);
}


// ─────────────────────────────────────────────────────────
//  UI  — floating slider panel
// ─────────────────────────────────────────────────────────
function buildUI() {
  let panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 36px;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 18px 32px 16px;
    font-family: 'Courier New', monospace;
    color: #fff;
    user-select: none;
    z-index: 9999;
    pointer-events: all;
  `;

  const sliders = [
    {
      key:   'fps',
      label: 'FPS',
      min: 1, max: 60, step: 1,
      fmt: v => String(Math.round(v)),
    },
    {
      key:   'flow',
      label: 'FLOW',
      min: 0, max: 1, step: 0.01,
      fmt: v => v.toFixed(2),
    },
    {
      key:   'glitch',
      label: 'ENTROPY',
      min: 0, max: 1, step: 0.01,
      fmt: v => v.toFixed(2),
    },
  ];

  sliders.forEach(s => {
    let col = document.createElement('div');
    col.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; gap: 7px; min-width: 96px;
    `;

    let lbl = document.createElement('div');
    lbl.style.cssText = 'font-size: 8px; letter-spacing: 2.5px; opacity: 0.45;';
    lbl.textContent = s.label;

    let val = document.createElement('div');
    val.style.cssText = `
      font-size: 15px; font-weight: bold;
      letter-spacing: 1px; min-width: 40px; text-align: center;
    `;
    val.textContent = s.fmt(ctrl[s.key]);

    let inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = s.min;
    inp.max   = s.max;
    inp.step  = s.step;
    inp.value = ctrl[s.key];
    inp.style.cssText = `
      width: 120px; height: 3px;
      background: rgba(255,255,255,0.18);
      border-radius: 2px;
    `;
    inp.addEventListener('input', () => {
      ctrl[s.key] = parseFloat(inp.value);
      val.textContent = s.fmt(ctrl[s.key]);
      if (s.key === 'fps') frameRate(ctrl.fps);
    });

    col.appendChild(lbl);
    col.appendChild(val);
    col.appendChild(inp);
    panel.appendChild(col);
  });

  // Reset entropy button
  let resetBtn = document.createElement('button');
  resetBtn.textContent = 'RESET';
  resetBtn.style.cssText = `
    font-family: 'Courier New', monospace;
    font-size: 9px; letter-spacing: 2px;
    background: none; border: 1px solid rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.5);
    padding: 5px 10px; border-radius: 6px;
    cursor: pointer; margin-bottom: 2px;
    transition: all 0.15s;
  `;
  resetBtn.addEventListener('mouseenter', () => {
    resetBtn.style.borderColor = 'rgba(255,255,255,0.7)';
    resetBtn.style.color = '#fff';
  });
  resetBtn.addEventListener('mouseleave', () => {
    resetBtn.style.borderColor = 'rgba(255,255,255,0.25)';
    resetBtn.style.color = 'rgba(255,255,255,0.5)';
  });
  resetBtn.addEventListener('click', () => {
    entropy = 0;
    // Reset the slider visually too
    let entSlider = panel.querySelector('input[data-key="glitch"]');
    if (entSlider) entSlider.value = 0;
    ctrl.glitch = 0;
  });
  // tag for reset
  resetBtn.setAttribute('data-role', 'reset-entropy');

  // Tag entropy slider for reset access
  panel.querySelectorAll && setTimeout(() => {
    let inputs = panel.querySelectorAll('input');
    if (inputs[2]) inputs[2].setAttribute('data-key', 'glitch');
  }, 0);

  let hint = document.createElement('div');
  hint.style.cssText = 'font-size: 8px; opacity: 0.22; letter-spacing: 1px; padding-bottom: 2px; align-self: center;';
  hint.textContent = 'SPACE = new seed';

  panel.appendChild(resetBtn);
  panel.appendChild(hint);
  document.body.appendChild(panel);
}
