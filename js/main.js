import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CONFIG } from "./config.js";
import { createAudio } from "./audio.js";
import { createInput } from "./input.js";
import { createFx } from "./fx.js";

const BEST_KEY = "skyslam.best.v1";
const CHAIN = ["", "SMASH", "DOUBLE", "TRIPLE", "QUAD", "MEGA", "UNREAL", "SKY SLAM!"];
const TIPS = [
  "Chain smashes before the combo bar empties",
  "SLAM when a crowd piles up",
  "Purple columns zap — step out while they pulse",
  "Dash is a free pass through mites",
  "Fever at x4 pulls gems toward you",
  "The rim is slippery. Don't get shoved off",
];
const REASONS = {
  fall: "You slipped off the island.",
  mite: "A rift mite bumped you out.",
  zap: "A zap ring caught you.",
};
const WELCOME = [
  [0, -2.7],
  [-1.7, -3.5],
  [1.7, -3.5],
  [0, -4.6],
  [-2.7, -4.5],
  [2.7, -4.5],
];

const $ = (id) => document.getElementById(id);

window.addEventListener("error", (event) => {
  if (window.__skyReady) return;
  const note = $("file-warn");
  if (!note) return;
  note.hidden = false;
  note.textContent = "Sky Slam hit an error: " + (event.message || "unknown problem");
});

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(value)));
  } catch {
    /* private mode */
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function dampAngle(a, b, speed, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-speed * dt));
}

function backOut(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function randomDisk(minR, maxR) {
  const a = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * (maxR - minR) + minR;
  return { x: Math.cos(a) * rad, z: Math.sin(a) * rad };
}

function makeGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const g = canvas.getContext("2d");
  ["#6d5d86", "#b3a6cc", "#f3eefe", "#ffffff"].forEach((hex, i) => {
    g.fillStyle = hex;
    g.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#1f6dff");
  grd.addColorStop(0.45, "#5eb6ff");
  grd.addColorStop(0.78, "#ffc9a2");
  grd.addColorStop(1, "#ff9d86");
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function paintIsland() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const g = canvas.getContext("2d");
  const cx = 512;
  const cy = 512;
  const R = 512;
  const palette = ["#ffe08a", "#7ee0c8", "#ff8fa3", "#cbb6ff", "#ffd0a1", "#8fd4ff"];
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  const rings = [
    { inner: 0, outer: 0.22, segs: 1 },
    { inner: 0.22, outer: 0.48, segs: 8 },
    { inner: 0.48, outer: 0.74, segs: 14 },
    { inner: 0.74, outer: 1, segs: 20 },
  ];
  let n = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.segs; i++) {
      const a0 = (i / ring.segs) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / ring.segs) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(cx, cy, ring.outer * R, a0, a1);
      g.arc(cx, cy, ring.inner * R, a1, a0, true);
      g.closePath();
      g.fillStyle = ring.segs === 1 ? "#fff6ea" : palette[n % palette.length];
      g.fill();
      g.lineWidth = ring.segs === 1 ? 18 : 10;
      g.strokeStyle = "#fffaf3";
      g.stroke();
      n++;
    }
  }
  g.beginPath();
  g.arc(cx, cy, R * 0.08, 0, Math.PI * 2);
  g.fillStyle = "#ffe566";
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = "#1b1430";
  g.stroke();
  g.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boot() {
  const canvas = $("c");
  const audio = createAudio();
  const input = createInput(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    const note = $("file-warn");
    note.hidden = false;
    note.textContent = "This browser couldn't start WebGL, so Sky Slam can't run here.";
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0xffb89e, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xffb089, 0.008);
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 480);

  const gradient = makeGradient();
  const ink = new THREE.MeshBasicMaterial({ color: 0x1b1430, side: THREE.BackSide });

  function toon(color, opts = {}) {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: gradient,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0,
    });
  }

  function hull(mesh, scale = 1.08) {
    const shell = new THREE.Mesh(mesh.geometry, ink);
    shell.scale.setScalar(scale);
    mesh.add(shell);
  }

  function edges(mesh) {
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 20),
        new THREE.LineBasicMaterial({ color: 0x1b1430 })
      )
    );
  }

  const hemi = new THREE.HemisphereLight(0xfff4d4, 0x684888, 0.95);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff7e6, 1.5);
  key.position.set(-10, 18, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9ecbff, 0.4);
  fill.position.set(12, 7, -8);
  scene.add(fill);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(240, 28, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeDiscTexture(),
      color: 0xfff1b8,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  sun.position.set(-36, 42, -18);
  sun.scale.set(18, 18, 1);
  scene.add(sun);

  const R = CONFIG.arena.radius;
  const island = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(R, 64),
    new THREE.MeshLambertMaterial({ map: paintIsland() })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.02;
  island.add(top);
  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.84, 2.35, 40, 1, true),
    toon("#54357a")
  );
  side.position.y = -1.16;
  island.add(side);
  const belly = new THREE.Mesh(new THREE.CircleGeometry(R * 0.84, 32), toon("#3a2158"));
  belly.rotation.x = Math.PI / 2;
  belly.position.y = -2.32;
  island.add(belly);
  scene.add(island);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 8, 64), toon("#1b1430"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.1;
  scene.add(rim);
  const rimGlowMat = new THREE.MeshBasicMaterial({
    color: 0x2ad2b2,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.08, 8, 64), rimGlowMat);
  rimGlow.rotation.x = Math.PI / 2;
  rimGlow.position.y = 0.14;
  scene.add(rimGlow);

  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff7ef, transparent: true, opacity: 0.92 });
  const cloudGroups = [];
  const cloudSpots = [
    [-24, 7, -12, 3.4],
    [18, 9, 16, 2.6],
    [-10, -5, 26, 3.8],
    [26, -3, -18, 2.9],
    [-34, 5, 8, 2.3],
    [6, 13, -30, 3.1],
  ];
  for (const [x, y, z, s] of cloudSpots) {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set((i - 2) * 0.75, Math.sin(i) * 0.18, (i % 2) * 0.28);
      puff.scale.set(1.35, 0.72, 1);
      group.add(puff);
    }
    group.position.set(x, y, z);
    group.scale.setScalar(s);
    group.userData.baseX = x;
    group.userData.speed = 0.6 + s * 0.15;
    scene.add(group);
    cloudGroups.push(group);
  }

  const isletSpots = [
    [30, -16, 2.3],
    [-34, 12, 1.9],
    [16, 36, 2.5],
    [-20, -38, 1.6],
    [42, 10, 1.5],
  ];
  const islets = [];
  for (const [x, z, s] of isletSpots) {
    const group = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.05, 1.4, 6), toon("#6a4e9a"));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.28, 6), toon("#7ddea8"));
    cap.position.y = 0.72;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 5), toon("#8a5a3a"));
    trunk.position.y = 1.2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.15, 6), toon("#2fce86"));
    leaf.position.y = 1.95;
    hull(leaf, 1.06);
    group.add(rock, cap, trunk, leaf);
    group.position.set(x, -1.2, z);
    group.scale.setScalar(s);
    scene.add(group);
    islets.push(group);
  }

  const fx = createFx(scene);

  const bodyMat = toon("#ff3d68");
  const visorMat = toon("#123044", { emissive: "#7af0ff", emissiveIntensity: 1.15 });
  const bulbMat = toon("#ffe566", { emissive: "#ffe566", emissiveIntensity: 0.7 });
  const playerRoot = new THREE.Group();
  const visual = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 18), bodyMat);
  body.scale.set(1.08, 0.92, 1);
  body.position.y = 0.86;
  hull(body, 1.06);
  const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), toon("#ffe7c2"));
  tummy.position.set(0, 0.7, 0.48);
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xfffaf3 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1b1430 });
  const eyeGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const pupilGeo = new THREE.SphereGeometry(0.08, 8, 8);
  for (const x of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(eyeGeo, eyeWhite);
    eye.position.set(x, 1.08, 0.92);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x * 1.05, 1.06, 1.06);
    visual.add(eye, pupil);
  }
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.18, 0.22), visorMat);
  visor.position.set(0, 1.28, 0.62);
  edges(visor);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 8), toon("#7af0ff", { emissive: "#7af0ff", emissiveIntensity: 0.55 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.78, 1.02);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.4, 0.28), toon("#ffc53d"));
  pack.position.set(0, 0.86, -0.5);
  edges(pack);
  const footGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const footMat = toon("#1b1430");
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(-0.28, 0.16, 0.12);
  footL.scale.set(1.15, 0.55, 1.35);
  const footR = new THREE.Mesh(footGeo, footMat);
  footR.position.set(0.28, 0.16, 0.12);
  footR.scale.set(1.15, 0.55, 1.35);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 6), toon("#ffe566"));
  antenna.position.set(0.24, 1.46, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbMat);
  bulb.position.set(0.24, 1.7, 0);
  visual.add(body, tummy, visor, beak, pack, footL, footR, antenna, bulb);
  playerRoot.add(visual);
  scene.add(playerRoot);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 24),
    new THREE.MeshBasicMaterial({
      map: makeDiscTexture(),
      color: 0x1b1430,
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  scene.add(shadow);

  const slamRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({
      color: 0x7af0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  slamRing.rotation.x = -Math.PI / 2;
  slamRing.position.y = 0.05;
  scene.add(slamRing);

  const ghosts = [];
  for (let i = 0; i < 4; i++) {
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0xff6d88,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), ghostMat);
    ghost.visible = false;
    scene.add(ghost);
    ghosts.push({ mesh: ghost, life: 0 });
  }

  function makeCrate() {
    const mesh = new THREE.Group();
    const mat = toon("#ffb000");
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.08, 1.08), mat);
    box.position.y = 0.56;
    edges(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 1.16), toon("#ff9f1c"));
    lid.position.y = 1.08;
    const starMat = toon("#fff6ea", { emissive: "#ffe566", emissiveIntensity: 0.35 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), starMat);
    star.position.y = 1.28;
    star.rotation.y = 0.4;
    mesh.add(box, lid, star);
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh,
      bodyMat: mat,
      alive: false,
      falling: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hp: 1,
      maxHp: 1,
      kind: "crate",
      age: 0,
      phase: 0,
      lastDash: -1,
      base: 1,
      radius: 0.62,
      flash: 0,
    };
  }

  function makeGem() {
    const mat = toon("#4cc9f0", { emissive: "#7af0ff", emissiveIntensity: 1.15 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
    hull(mesh, 1.12);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat, alive: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, age: 0, phase: 0 };
  }

  function makeMite() {
    const mat = toon("#ff3355", { emissive: "#ff2244", emissiveIntensity: 0.4 });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 0), mat);
    hull(mesh, 1.08);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat, alive: false, x: 0, z: 0, age: 0, phase: 0, radius: 0.64 };
  }

  function makeZap() {
    const group = new THREE.Group();
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xb388ff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 36), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.02;
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe4ccff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.04, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    const columnMat = new THREE.MeshBasicMaterial({
      color: 0xc9a6ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.2, 20, 1, true), columnMat);
    column.position.y = 2.1;
    group.add(fill, ring, column);
    group.visible = false;
    scene.add(group);
    return { group, fillMat, ringMat, columnMat, alive: false, fired: false, age: 0, x: 0, z: 0, radius: 3 };
  }

  const crates = Array.from({ length: 14 }, makeCrate);
  const gems = Array.from({ length: 10 }, makeGem);
  const mites = Array.from({ length: 8 }, makeMite);
  const zaps = Array.from({ length: 3 }, makeZap);
  const GEM_COLORS = ["#4cc9f0", "#f72585", "#80ed99", "#ffe566"];

  const player = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: Math.PI,
    dashing: false,
    dashT: 0,
    dashCd: 0,
    dashDirX: 0,
    dashDirZ: -1,
    dashId: 1,
    dashHits: 0,
    slamCd: 0,
    slamT: 0,
    landT: 0,
    dropIn: 0,
    falling: false,
    penalized: false,
    iframes: 0,
  };

  let mode = "title";
  let score = 0;
  let displayScore = 0;
  let best = loadBest();
  let bestAtStart = best;
  let celebrated = false;
  let combo = 0;
  let comboTime = 0;
  let multiplier = 1;
  let level = 1;
  let levelTime = 0;
  let lives = CONFIG.lives;
  let grace = CONFIG.difficulty.miteGrace;
  let spawnAcc = 0;
  let zapTimer = 2.2;
  let lonely = 0;
  let miteAcc = 0;
  let hitstop = 0;
  let islandPunch = 0;
  let realTime = 0;
  let arm = 0;
  let snapCam = true;
  let flashA = 0;
  let hurtFlash = 0;
  let bannerT = 0;
  let tipIndex = 0;
  let tipTime = 0;
  let ghostT = 0;
  let ghostCursor = 0;
  let moodKey = "";
  let fps = 60;
  let paintedLives = -1;
  let scorePop = 0;
  const did = { move: false, dash: false, slam: false };
  const juice = { smashes: 0, mites: 0, gems: 0, chips: 0, slam: false };
  const demo = {
    up: false,
    down: false,
    left: false,
    right: false,
    joyActive: false,
    joyX: 0,
    joyY: 0,
    pointerDown: false,
    pointerX: 0,
    pointerY: 0,
    dashHeld: false,
    slamHeld: false,
    dashClick: null,
    slamClick: false,
    pause: false,
    mute: false,
    start: false,
    restart: false,
    worldX: 0,
    worldZ: 0,
    worldAim: false,
  };

  const _mv = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _ndc = new THREE.Vector2();
  const _hit = new THREE.Vector3();
  const _ray = new THREE.Raycaster();
  const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const _desired = new THREE.Vector3();
  const _look = new THREE.Vector3();

  const scoreEl = $("score");
  const bestEl = $("best");
  const comboWrap = $("combo-wrap");
  const comboEl = $("combo");
  const comboFill = $("combo-fill");
  const levelEl = $("level");
  const hintsEl = $("hints");
  const livesEl = $("lives");
  const calloutEl = $("callout");
  const bannerEl = $("banner");
  const bannerTitle = $("banner-title");
  const bannerSub = $("banner-sub");
  const flashEl = $("flash");
  const titleBest = $("title-best");
  const overReason = $("over-reason");
  const overScore = $("over-score");
  const overBest = $("over-best");
  const overNew = $("over-new");

  function show(id) {
    $(id).hidden = false;
  }
  function hide(id) {
    $(id).hidden = true;
  }

  function camBasis() {
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    // forward × up = screen right when the camera looks toward -Z.
    _right.crossVectors(_fwd, _up).normalize();
    return { fwd: _fwd, right: _right };
  }

  function groundXZ(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _ray.setFromCamera(_ndc, camera);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
    return { x: _hit.x, z: _hit.z };
  }

  function moveVector(snap) {
    if (snap.worldAim) {
      _mv.set(snap.worldX, 0, snap.worldZ);
      const len = Math.hypot(_mv.x, _mv.z);
      if (len > 0.001) _mv.multiplyScalar(1 / len);
      else _mv.set(0, 0, 0);
      return _mv;
    }
    let sx = 0;
    let sy = 0;
    if (snap.joyActive) {
      sx = snap.joyX;
      sy = snap.joyY;
    } else {
      if (snap.right) sx += 1;
      if (snap.left) sx -= 1;
      if (snap.up) sy += 1;
      if (snap.down) sy -= 1;
    }
    const mag = Math.min(1, Math.hypot(sx, sy));
    if (mag > 0.01) {
      const basis = camBasis();
      _mv.set(basis.right.x * sx + basis.fwd.x * sy, 0, basis.right.z * sx + basis.fwd.z * sy);
      const len = Math.hypot(_mv.x, _mv.z) || 1;
      _mv.multiplyScalar(mag / len);
      return _mv;
    }
    if (snap.pointerDown) {
      const p = groundXZ(snap.pointerX, snap.pointerY);
      if (p) {
        _mv.set(p.x - player.x, 0, p.z - player.z);
        const len = Math.hypot(_mv.x, _mv.z);
        if (len > 0.9) {
          _mv.multiplyScalar(1 / len);
          return _mv;
        }
      }
    }
    _mv.set(0, 0, 0);
    return _mv;
  }

  function multFrom(hits) {
    if (hits <= 0) return 1;
    return Math.min(CONFIG.combo.maxMultiplier, 1 + Math.floor((hits - 1) / CONFIG.combo.step));
  }

  function dashCooldown() {
    const p = CONFIG.player;
    return Math.max(p.dashCooldownMin, p.dashCooldown - (level - 1) * p.dashCooldownPerLevel);
  }

  function slamReach() {
    const p = CONFIG.player;
    let radius = p.slamRadius + combo * p.slamRadiusPerCombo;
    if (multiplier >= CONFIG.combo.feverAt) radius += p.feverSlamBonus;
    return Math.min(p.slamRadiusMax, radius);
  }

  function miteCap() {
    const d = CONFIG.difficulty;
    return Math.min(CONFIG.spawn.maxMites, d.miteBase + Math.floor((level - 1) / d.mitesPerLevels));
  }

  function miteSpeed() {
    const d = CONFIG.difficulty;
    return Math.min(d.miteSpeedMax, d.miteSpeed + (level - 1) * d.miteSpeedPerLevel);
  }

  function spawnInterval() {
    const s = CONFIG.spawn;
    return Math.max(s.intervalMin, s.interval * s.intervalDecay ** (level - 1));
  }

  function callout(text) {
    if (mode !== "play") return;
    calloutEl.textContent = text;
    calloutEl.classList.remove("show");
    void calloutEl.offsetWidth;
    calloutEl.classList.add("show");
  }

  function banner(title, sub) {
    if (mode !== "play") return;
    bannerTitle.textContent = title;
    bannerSub.textContent = sub || "";
    bannerEl.hidden = false;
    bannerEl.classList.remove("show");
    void bannerEl.offsetWidth;
    bannerEl.classList.add("show");
    bannerT = 1.8;
  }

  function flash(color, amount) {
    flashEl.style.background = color;
    flashA = amount;
  }

  function paintLives() {
    if (paintedLives === lives) return;
    paintedLives = lives;
    livesEl.replaceChildren();
    for (let i = 0; i < CONFIG.lives; i++) {
      const heart = document.createElement("span");
      heart.className = "heart" + (i < lives ? "" : " lost");
      heart.textContent = "♥";
      livesEl.appendChild(heart);
    }
  }

  function paintMute() {
    const muted = audio.muted;
    for (const id of ["mute", "title-mute", "pause-mute"]) {
      const el = $(id);
      if (!el) continue;
      el.textContent = muted ? "MUTE" : "SND";
      el.classList.toggle("is-muted", muted);
      el.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    }
  }

  function syncMood() {
    const feverOn = multiplier >= CONFIG.combo.feverAt && combo > 0 && mode === "play";
    const key = `${mode}|${level}|${feverOn ? 1 : 0}`;
    if (key === moodKey) return;
    moodKey = key;
    audio.setMood({
      level,
      fever: feverOn,
      over: mode === "over",
      title: mode === "title",
    });
  }

  function persistBest() {
    if (mode === "title") return;
    if (score > best) {
      best = score;
      saveBest(score);
    }
  }

  function award(base, x, y, z, color) {
    combo += 1;
    comboTime = CONFIG.combo.timeout;
    const prev = multiplier;
    multiplier = multFrom(combo);
    const pts = base * multiplier;
    score += pts;
    scorePop = 1;
    persistBest();
    fx.popup(x, y, z, "+" + pts, multiplier >= CONFIG.combo.feverAt ? "#ffe566" : color);
    if (multiplier > prev) {
      audio.comboUp(multiplier);
      if (mode === "play" && multiplier === CONFIG.combo.feverAt) callout("FEVER");
      else if (mode === "play" && multiplier >= 6) callout("x" + multiplier);
    }
    if (mode === "play" && !celebrated && bestAtStart > 0 && score > bestAtStart) {
      celebrated = true;
      callout("NEW BEST");
      audio.best();
    }
    syncMood();
  }

  function hideCrate(c) {
    c.alive = false;
    c.mesh.visible = false;
  }
  function hideGem(g) {
    g.alive = false;
    g.mesh.visible = false;
  }
  function hideMite(m) {
    m.alive = false;
    m.mesh.visible = false;
  }
  function hideZap(z) {
    z.alive = false;
    z.group.visible = false;
  }

  function pickSpot() {
    const limit = R - 1.55;
    if (Math.random() < CONFIG.spawn.clusterChance) {
      const pals = crates.filter((c) => c.alive && !c.falling);
      if (pals.length) {
        const pal = pals[(Math.random() * pals.length) | 0];
        const a = Math.random() * Math.PI * 2;
        const dist = 1.55 + Math.random() * 1.45;
        const x = pal.x + Math.cos(a) * dist;
        const z = pal.z + Math.sin(a) * dist;
        if (Math.hypot(x, z) < limit && Math.hypot(x - player.x, z - player.z) > 2.3) return { x, z };
      }
    }
    for (let i = 0; i < 8; i++) {
      const spot = randomDisk(1.1, limit);
      if (Math.hypot(spot.x - player.x, spot.z - player.z) > 2.7) return spot;
    }
    return randomDisk(1.1, limit);
  }

  function spawnCrate(x, z, forceKind, grown) {
    const c = crates.find((item) => !item.alive);
    if (!c) return null;
    let px = x;
    let pz = z;
    if (px === undefined) {
      const spot = pickSpot();
      px = spot.x;
      pz = spot.z;
    }
    const pinata = forceKind
      ? forceKind === "pinata"
      : level >= CONFIG.difficulty.pinataStartLevel && Math.random() < CONFIG.difficulty.pinataChance;
    c.alive = true;
    c.falling = false;
    c.x = px;
    c.z = pz;
    c.y = 0;
    c.vx = 0;
    c.vy = 0;
    c.vz = 0;
    c.kind = pinata ? "pinata" : "crate";
    c.hp = pinata ? 2 : 1;
    c.maxHp = c.hp;
    c.age = grown ? 0.35 : 0;
    c.phase = Math.random() * Math.PI * 2;
    c.lastDash = -1;
    c.base = pinata ? 1.18 : 1;
    c.flash = 0;
    c.mesh.visible = true;
    c.bodyMat.color.set(pinata ? "#ff4fbf" : "#ffb000");
    c.bodyMat.emissive.set("#000000");
    return c;
  }

  function spawnGem(x, z, burst) {
    const g = gems.find((item) => !item.alive);
    if (!g) return;
    const spot = x === undefined ? randomDisk(1, R - 1.4) : { x, z };
    g.alive = true;
    g.x = spot.x;
    g.z = spot.z;
    g.vx = 0;
    g.vz = 0;
    g.age = burst ? 0.05 : 0;
    g.phase = Math.random() * Math.PI * 2;
    if (burst) {
      const a = Math.random() * Math.PI * 2;
      g.vx = Math.cos(a) * 4.5;
      g.vz = Math.sin(a) * 4.5;
    }
    const hex = GEM_COLORS[(Math.random() * GEM_COLORS.length) | 0];
    g.mat.color.set(hex);
    g.mat.emissive.set(hex);
    g.mesh.visible = true;
  }

  function spawnMite() {
    const m = mites.find((item) => !item.alive);
    if (!m) return;
    const a = Math.random() * Math.PI * 2;
    const rad = R - 0.85;
    m.alive = true;
    m.x = Math.cos(a) * rad;
    m.z = Math.sin(a) * rad;
    m.age = 0;
    m.phase = Math.random() * Math.PI * 2;
    m.mesh.visible = true;
  }

  function spawnZap() {
    const z = zaps.find((item) => !item.alive);
    if (!z) return;
    const limit = Math.max(1.2, R - CONFIG.difficulty.zapRadius - 0.25);
    const spot = randomDisk(0.4, limit);
    z.alive = true;
    z.fired = false;
    z.age = 0;
    z.x = spot.x;
    z.z = spot.z;
    z.radius = CONFIG.difficulty.zapRadius;
    z.group.visible = true;
    z.group.position.set(z.x, 0.06, z.z);
    z.group.scale.set(z.radius, 1, z.radius);
    z.fillMat.color.set("#b388ff");
    z.fillMat.opacity = 0.18;
    audio.warn();
  }

  function spawnWelcome() {
    for (const [x, z] of WELCOME) spawnCrate(x, z, "crate", true);
    spawnGem(-3.4, -3.2);
    spawnGem(3.4, -3.0);
    spawnGem(0, -5.4);
  }

  function destroyCrate(c) {
    const pinata = c.kind === "pinata";
    award(pinata ? CONFIG.score.pinata : CONFIG.score.crate, c.x, 1.15, c.z, pinata ? "#ff4fbf" : "#ffc53d");
    juice.smashes += 1;
    fx.burst(c.x, 0.8, c.z, pinata ? "#ff4fbf" : "#ffc53d", pinata ? 16 : 11, 7);
    fx.burst(c.x, 1, c.z, "#fff6ea", 5, 4);
    fx.ring(c.x, c.z, pinata ? "#ff4fbf" : "#ffe566", pinata ? 2.4 : 1.55);
    if (pinata) {
      for (let i = 0; i < 3; i++) spawnGem(c.x, c.z, true);
    }
    hideCrate(c);
  }

  function damageCrate(c, dmg) {
    if (!c.alive || c.falling) return;
    c.hp -= dmg;
    if (c.hp <= 0) {
      destroyCrate(c);
      if (player.dashing) {
        player.dashHits += 1;
        if (player.dashHits < CONFIG.player.dashMaxHits) {
          player.dashT = Math.max(player.dashT, CONFIG.player.dashExtendOnHit);
        }
      }
      return;
    }
    c.flash = 0.14;
    c.bodyMat.color.set("#ffd0ea");
    juice.chips += 1;
    fx.burst(c.x, 0.8, c.z, "#fff6ea", 5, 3);
  }

  function destroyMite(m) {
    award(CONFIG.score.mite, m.x, 0.9, m.z, "#ff4d6d");
    juice.mites += 1;
    fx.burst(m.x, 0.7, m.z, "#ff3355", 14, 6.5);
    fx.ring(m.x, m.z, "#ff4d6d", 1.8);
    hideMite(m);
  }

  function collectGem(g) {
    award(CONFIG.score.gem, g.x, 1, g.z, "#7af0ff");
    juice.gems += 1;
    fx.burst(g.x, 1, g.z, "#7af0ff", 7, 3.5);
    hideGem(g);
  }

  function respawn() {
    player.x = 0;
    player.z = 0;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.y = 3.2;
    player.falling = false;
    player.penalized = false;
    player.dashing = false;
    player.dropIn = 0.42;
    player.iframes = Math.max(player.iframes, CONFIG.player.iFrames);
    audio.pop();
    fx.burst(0, 2.2, 0, "#fff6ea", 12, 4);
  }

  function gameOver(reason) {
    if (mode !== "play") return;
    const fresh = score > bestAtStart && score > 0;
    persistBest();
    mode = "over";
    audio.gameover();
    syncMood();
    overReason.textContent = REASONS[reason] || "The island wins.";
    overScore.textContent = Math.round(score).toLocaleString("en-US");
    overBest.textContent = "BEST " + Math.round(Math.max(best, score)).toLocaleString("en-US");
    overNew.hidden = !fresh;
    hide("hud");
    hide("pause");
    show("over");
    $("again").focus();
  }

  function loseLife(reason, srcX = player.x + 1, srcZ = player.z) {
    if (mode !== "play") {
      respawn();
      return false;
    }
    if (reason !== "fall" && (player.iframes > 0 || player.dashing)) return false;
    if (player.falling || Math.hypot(player.x, player.z) > CONFIG.arena.radius - 0.2) reason = "fall";
    lives -= 1;
    paintedLives = -1;
    combo = 0;
    comboTime = 0;
    multiplier = 1;
    syncMood();
    audio.hurt();
    fx.trauma(CONFIG.juice.shakeHurt);
    hitstop = Math.max(hitstop, CONFIG.juice.hitstopHurt);
    flash("#ff3d68", 0.5);
    hurtFlash = 0.4;
    if (reason !== "fall") {
      const dx = player.x - srcX;
      const dz = player.z - srcZ;
      const len = Math.hypot(dx, dz) || 1;
      player.vx = (dx / len) * CONFIG.player.knockback;
      player.vz = (dz / len) * CONFIG.player.knockback;
      player.iframes = CONFIG.player.iFrames;
      player.dashing = false;
    }
    paintLives();
    if (lives <= 0) {
      gameOver(reason);
      return true;
    }
    return false;
  }

  function doSlam() {
    player.slamCd = CONFIG.player.slamCooldown;
    player.slamT = CONFIG.player.slamAnim;
    player.dashing = false;
    did.slam = true;
    juice.slam = true;
    const radius = slamReach();
    fx.ring(player.x, player.z, "#fff6ea", radius);
    fx.burst(player.x, 0.35, player.z, "#ffe566", 14, 6);
    islandPunch = 0.012;
    for (const c of crates) {
      if (!c.alive || c.falling || c.age < 0.18) continue;
      if (Math.hypot(c.x - player.x, c.z - player.z) <= radius + c.radius) damageCrate(c, 99);
    }
    for (const m of mites) {
      if (!m.alive || m.age < 0.5) continue;
      if (Math.hypot(m.x - player.x, m.z - player.z) <= radius + m.radius) destroyMite(m);
    }
    for (const g of gems) {
      if (!g.alive || g.age < 0.12) continue;
      if (Math.hypot(g.x - player.x, g.z - player.z) <= radius + 0.3) collectGem(g);
    }
  }

  function doDash(move, dashPoint) {
    let dx = 0;
    let dz = 0;
    if (dashPoint) {
      dx = dashPoint.x - player.x;
      dz = dashPoint.z - player.z;
    }
    if (dx * dx + dz * dz < 0.36) {
      if (move.x * move.x + move.z * move.z > 0.04) {
        dx = move.x;
        dz = move.z;
      } else {
        dx = Math.sin(player.facing);
        dz = Math.cos(player.facing);
      }
    }
    const len = Math.hypot(dx, dz) || 1;
    player.dashDirX = dx / len;
    player.dashDirZ = dz / len;
    player.facing = Math.atan2(player.dashDirX, player.dashDirZ);
    player.dashing = true;
    player.dashT = CONFIG.player.dashTime;
    player.dashCd = dashCooldown();
    player.dashId += 1;
    player.dashHits = 0;
    did.dash = true;
    did.move = true;
    ghostT = 0;
    audio.dash();
    fx.ring(player.x, player.z, "#7af0ff", 1.45);
  }

  function flushJuice() {
    const hits = juice.smashes + juice.mites;
    if (hits > 0) {
      const big = juice.slam || hits >= 3;
      audio.smash(hits, big);
      hitstop = Math.min(0.1, Math.max(hitstop, big ? CONFIG.juice.hitstopBig : CONFIG.juice.hitstopSmash));
      fx.trauma(big ? CONFIG.juice.shakeBig : CONFIG.juice.shakeSmash);
      if (juice.slam) audio.duck();
      if (hits >= 2) callout(CHAIN[Math.min(hits, CHAIN.length - 1)]);
      if (mode === "play" && navigator.vibrate) navigator.vibrate(big ? 16 : 8);
    } else if (juice.slam) {
      audio.slam();
      audio.duck();
      fx.trauma(0.22);
    } else if (juice.chips > 0) {
      audio.chip();
    }
    if (juice.gems > 0) audio.gem(juice.gems);
    juice.smashes = 0;
    juice.mites = 0;
    juice.gems = 0;
    juice.chips = 0;
    juice.slam = false;
  }

  function updatePlayer(dt, snap) {
    if (player.iframes > 0) player.iframes -= dt;
    if (player.dashCd > 0) player.dashCd -= dt;
    if (player.slamCd > 0) player.slamCd -= dt;
    if (player.landT > 0) player.landT -= dt;
    if (player.slamT > 0) player.slamT -= dt;

    const grounded = !player.falling && player.dropIn <= 0;
    const move = moveVector(snap);
    const dashPoint = snap.dashClick ? groundXZ(snap.dashClick.x, snap.dashClick.y) : null;
    const wantDash = snap.dashHeld || !!snap.dashClick;
    const wantSlam = snap.slamHeld || snap.slamClick;

    if (wantSlam && grounded && player.slamCd <= 0) doSlam();
    else if (wantDash && grounded && player.dashCd <= 0 && !player.dashing) doDash(move, dashPoint);

    if (player.dashing) {
      player.dashT -= dt;
      player.vx = player.dashDirX * CONFIG.player.dashSpeed;
      player.vz = player.dashDirZ * CONFIG.player.dashSpeed;
      if (player.dashT <= 0) player.dashing = false;
    } else if (grounded || player.dropIn > 0) {
      player.vx += move.x * CONFIG.player.accel * dt;
      player.vz += move.z * CONFIG.player.accel * dt;
      const drag = Math.exp(-CONFIG.player.drag * dt);
      player.vx *= drag;
      player.vz *= drag;
      const sp = Math.hypot(player.vx, player.vz);
      if (sp > CONFIG.player.maxSpeed) {
        player.vx = (player.vx / sp) * CONFIG.player.maxSpeed;
        player.vz = (player.vz / sp) * CONFIG.player.maxSpeed;
      }
      if (grounded) {
        const dist = Math.hypot(player.x, player.z);
        const edge0 = R - CONFIG.arena.edgeBand;
        if (dist > edge0 && dist > 0.001) {
          const push = (dist - edge0) / CONFIG.arena.edgeBand;
          const force = Math.min(
            CONFIG.arena.edgePushMax,
            CONFIG.arena.edgePush + (level - 1) * CONFIG.arena.edgePushPerLevel
          );
          player.vx += (player.x / dist) * push * force * dt;
          player.vz += (player.z / dist) * push * force * dt;
        }
      }
    } else {
      player.vx *= Math.exp(-1.4 * dt);
      player.vz *= Math.exp(-1.4 * dt);
    }

    const planar = Math.hypot(player.vx, player.vz);
    if (planar > 0.7) player.facing = dampAngle(player.facing, Math.atan2(player.vx, player.vz), 14, dt);
    if (planar > 1.2 && (snap.up || snap.down || snap.left || snap.right || snap.joyActive || snap.worldAim || snap.pointerDown)) {
      did.move = true;
    }

    player.x += player.vx * dt;
    player.z += player.vz * dt;

    if (player.dropIn > 0) {
      player.dropIn -= dt;
      const k = Math.max(0, player.dropIn / 0.42);
      player.y = k * k * 3.2;
      const maxR = R * 0.5;
      const d = Math.hypot(player.x, player.z);
      if (d > maxR) {
        player.x *= maxR / d;
        player.z *= maxR / d;
      }
      if (player.dropIn <= 0) {
        player.y = 0;
        player.landT = 0.16;
        fx.ring(player.x, player.z, "#fff6ea", 2.1);
        fx.burst(player.x, 0.3, player.z, "#ffe7c2", 8, 3);
      }
    } else if (!player.falling && Math.hypot(player.x, player.z) > R + 0.02) {
      player.falling = true;
      player.penalized = false;
      player.vy = 0;
      player.dashing = false;
    }

    if (player.falling) {
      player.vy -= 32 * dt;
      player.y += player.vy * dt;
      if (player.y < -7.2 && !player.penalized) {
        player.penalized = true;
        if (mode !== "play" || player.iframes > 0) respawn();
        else if (!loseLife("fall")) respawn();
      }
    } else if (player.dropIn <= 0) {
      player.y = 0;
    }
  }

  function updateCrates(dt) {
    for (const c of crates) {
      if (!c.alive) continue;
      c.age += dt;
      if (c.flash > 0) c.flash -= dt;
      if (c.falling) {
        c.vy -= 24 * dt;
        c.y += c.vy * dt;
        if (c.y < -8) hideCrate(c);
        continue;
      }
      c.vx *= Math.exp(-6.5 * dt);
      c.vz *= Math.exp(-6.5 * dt);
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      if (Math.hypot(c.x, c.z) > R + 0.25) {
        c.falling = true;
        c.vy = 0;
        continue;
      }
      if (c.age < 0.18 || player.falling || player.dropIn > 0) continue;
      const dx = c.x - player.x;
      const dz = c.z - player.z;
      const dist = Math.hypot(dx, dz);
      const min = CONFIG.player.radius + c.radius * (c.kind === "pinata" ? 1.05 : 1);
      if (dist >= min || dist < 0.0001) continue;
      if (player.dashing && c.lastDash !== player.dashId) {
        c.lastDash = player.dashId;
        damageCrate(c, 1);
      } else if (!player.dashing) {
        const push = min - dist;
        c.x += (dx / dist) * push;
        c.z += (dz / dist) * push;
        c.vx += (dx / dist) * 4;
        c.vz += (dz / dist) * 4;
      }
    }
  }

  function updateGems(dt) {
    const fever = multiplier >= CONFIG.combo.feverAt && combo > 0;
    for (const g of gems) {
      if (!g.alive) continue;
      g.age += dt;
      g.vx *= Math.exp(-2.6 * dt);
      g.vz *= Math.exp(-2.6 * dt);
      if (fever) {
        const dx = player.x - g.x;
        const dz = player.z - g.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 7.4 && dist > 0.15) {
          g.vx += (dx / dist) * 14 * dt;
          g.vz += (dz / dist) * 14 * dt;
        }
      }
      g.x += g.vx * dt;
      g.z += g.vz * dt;
      const limit = R - 0.55;
      const dist = Math.hypot(g.x, g.z);
      if (dist > limit) {
        g.x *= limit / dist;
        g.z *= limit / dist;
      }
      if (g.age > 0.16 && !player.falling && player.dropIn <= 0) {
        if (Math.hypot(g.x - player.x, g.z - player.z) < CONFIG.player.radius + 0.4) collectGem(g);
      }
    }
  }

  function updateMites(dt) {
    const speed = miteSpeed();
    for (const m of mites) {
      if (!m.alive) continue;
      m.age += dt;
      if (m.age >= 0.5) {
        const dx = player.x - m.x;
        const dz = player.z - m.z;
        const dist = Math.hypot(dx, dz) || 1;
        const strafe = Math.sin(realTime * 3 + m.phase) * speed * 0.35;
        m.x += ((dx / dist) * speed + (-dz / dist) * strafe) * dt;
        m.z += ((dz / dist) * speed + (dx / dist) * strafe) * dt;
        const limit = R - 0.55;
        const md = Math.hypot(m.x, m.z);
        if (md > limit) {
          m.x *= limit / md;
          m.z *= limit / md;
        }
      }
      if (m.age < 0.5 || player.falling || player.dropIn > 0) continue;
      const dist = Math.hypot(m.x - player.x, m.z - player.z);
      if (dist >= CONFIG.player.radius + m.radius) continue;
      if (player.dashing) destroyMite(m);
      else {
        const dx = m.x - player.x;
        const dz = m.z - player.z;
        const len = Math.hypot(dx, dz) || 1;
        m.x += (dx / len) * 1.1;
        m.z += (dz / len) * 1.1;
        loseLife("mite", m.x, m.z);
      }
    }
  }

  function updateZaps(dt) {
    const allow = level >= CONFIG.difficulty.zapStartLevel && (mode === "play" || mode === "title");
    if (allow) {
      zapTimer -= dt;
      if (zapTimer <= 0) {
        const cap = level >= CONFIG.difficulty.zapDoubleLevel ? 2 : 1;
        const alive = zaps.reduce((n, z) => n + (z.alive ? 1 : 0), 0);
        if (alive < cap) spawnZap();
        const every = Math.max(
          CONFIG.difficulty.zapEveryMin,
          CONFIG.difficulty.zapEvery * CONFIG.difficulty.zapEveryDecay ** Math.max(0, level - 2)
        );
        zapTimer = every;
      }
    }
    const warn = CONFIG.difficulty.zapWarn;
    for (const z of zaps) {
      if (!z.alive) continue;
      z.age += dt;
      const k = Math.min(1, z.age / warn);
      if (!z.fired) {
        z.fillMat.opacity = 0.12 + Math.abs(Math.sin(realTime * 16)) * 0.1;
        z.columnMat.opacity = 0.08 + k * 0.1;
      }
      if (!z.fired && z.age >= warn) {
        z.fired = true;
        z.fillMat.color.set("#fff6ea");
        z.fillMat.opacity = 0.62;
        z.columnMat.opacity = 0.32;
        audio.zap();
        fx.burst(z.x, 1.4, z.z, "#d6b3ff", 16, 7);
        const dist = Math.hypot(player.x - z.x, player.z - z.z);
        const safe = player.falling || player.dropIn > 0 || player.dashing || player.iframes > 0;
        if (!safe && dist < z.radius + CONFIG.player.radius * 0.35) loseLife("zap", z.x, z.z);
      }
      if (z.fired && z.age > warn + 0.3) hideZap(z);
    }
  }

  function updateSpawns(dt) {
    spawnAcc += dt;
    const interval = spawnInterval();
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      const roll = Math.random();
      const miteChance = Math.min(0.34, 0.08 + level * 0.035);
      const gemsAlive = gems.reduce((n, g) => n + (g.alive ? 1 : 0), 0);
      const mitesAlive = mites.reduce((n, m) => n + (m.alive ? 1 : 0), 0);
      const cratesAlive = crates.reduce((n, c) => n + (c.alive ? 1 : 0), 0);
      const mitesOk = (mode === "title" || grace <= 0) && mitesAlive < miteCap();
      if (roll < miteChance && mitesOk) spawnMite();
      else if (roll < miteChance + 0.24 && gemsAlive < CONFIG.spawn.maxGems) spawnGem();
      else if (cratesAlive < CONFIG.spawn.maxCrates) spawnCrate();
    }
    const cratesAlive = crates.reduce((n, c) => n + (c.alive && !c.falling ? 1 : 0), 0);
    if (cratesAlive < 2) {
      lonely += dt;
      if (lonely > 0.65) {
        lonely = 0;
        spawnCrate();
      }
    } else lonely = 0;

    if (mode === "play") grace -= dt;
    if ((mode === "title" || grace <= 0) && mites.reduce((n, m) => n + (m.alive ? 1 : 0), 0) < miteCap()) {
      miteAcc += dt;
      if (miteAcc > 1.35) {
        miteAcc = 0;
        spawnMite();
      }
    }
  }

  function levelUp() {
    level += 1;
    score += CONFIG.score.levelBonus;
    persistBest();
    audio.level();
    syncMood();
    const lines = {
      2: "Zap rings are live. Don't stand in the purple.",
      3: "Pinatas take two dashes, or one slam.",
      4: "Mites picked up the pace.",
      5: "The rim bites harder.",
      6: "Two zaps can land at once.",
    };
    banner("LEVEL " + level, lines[level] || "The island is heating up.");
    fx.ring(player.x, player.z, "#ffe566", 3.4);
  }

  function fillDemo() {
    demo.dashHeld = false;
    demo.slamHeld = false;
    demo.dashClick = null;
    demo.slamClick = false;
    demo.pointerDown = false;
    demo.worldAim = true;
    for (const z of zaps) {
      if (!z.alive || z.fired) continue;
      if (Math.hypot(z.x - player.x, z.z - player.z) < z.radius + 0.4) {
        demo.worldX = player.x - z.x;
        demo.worldZ = player.z - z.z;
        return demo;
      }
    }
    let bestDist = 1e9;
    let tx = -player.x;
    let tz = -player.z;
    let found = false;
    for (const c of crates) {
      if (!c.alive || c.falling) continue;
      const dist = Math.hypot(c.x - player.x, c.z - player.z);
      if (dist < bestDist) {
        bestDist = dist;
        tx = c.x - player.x;
        tz = c.z - player.z;
        found = true;
      }
    }
    demo.worldX = tx;
    demo.worldZ = tz || -0.01;
    if (found && bestDist < 2.3) demo.dashHeld = true;
    let near = 0;
    const radius = slamReach();
    for (const c of crates) {
      if (c.alive && !c.falling && Math.hypot(c.x - player.x, c.z - player.z) < radius) near += 1;
    }
    if (near >= 3) demo.slamHeld = true;
    return demo;
  }

  function update(dt, snap) {
    updateSpawns(dt);
    updatePlayer(dt, snap);
    updateCrates(dt);
    updateGems(dt);
    updateMites(dt);
    updateZaps(dt);
    if (combo > 0) {
      comboTime -= dt;
      if (comboTime <= 0) {
        if (multiplier >= CONFIG.combo.feverAt && mode === "play") audio.comboBreak();
        combo = 0;
        comboTime = 0;
        multiplier = 1;
        syncMood();
      }
    }
    if (mode === "play") {
      levelTime += dt;
      if (levelTime >= CONFIG.difficulty.secondsPerLevel) {
        levelTime = 0;
        levelUp();
      }
    }
    flushJuice();
    syncMeshes(dt);
  }

  function syncMeshes(dt) {
    const feverOn = multiplier >= CONFIG.combo.feverAt && combo > 0;
    visorMat.emissive.set(feverOn ? "#ffe566" : "#7af0ff");
    visorMat.emissiveIntensity = feverOn ? 1.7 : 1.15;
    bulbMat.emissiveIntensity = feverOn ? 1.5 : 0.65;

    let sx = 1;
    let sy = 1;
    let sz = 1;
    let hop = 0;
    if (player.dashing) {
      sx = 0.78;
      sy = 0.8;
      sz = 1.4;
    } else if (player.slamT > 0) {
      sx = 1.34;
      sy = 0.52;
      sz = 1.34;
    } else if (player.landT > 0) {
      const k = player.landT / 0.16;
      sx = 1 + 0.24 * k;
      sy = 1 - 0.34 * k;
      sz = sx;
    } else if (!player.falling) {
      const b = (Math.sin(realTime * 9) + 1) * 0.5;
      hop = b * 0.11;
      sy = 1 - b * 0.08;
      sx = 1 + b * 0.06;
      sz = sx;
    }
    visual.scale.set(sx, sy, sz);
    visual.position.y = hop;
    const blinking = player.iframes > 0 && mode === "play" && Math.sin(realTime * 28) > 0;
    visual.visible = true;
    bodyMat.emissive.set(blinking ? "#fff6ea" : "#000000");
    bodyMat.emissiveIntensity = blinking ? 0.7 : 0;
    playerRoot.position.set(player.x, player.y, player.z);
    playerRoot.rotation.y = player.facing;

    if (player.dashing) {
      ghostT -= dt;
      if (ghostT <= 0) {
        ghostT = 0.045;
        const ghost = ghosts[ghostCursor];
        ghostCursor = (ghostCursor + 1) % ghosts.length;
        ghost.life = 0.18;
        ghost.mesh.visible = true;
        ghost.mesh.position.set(player.x, 0.75 + player.y, player.z);
        ghost.mesh.scale.set(sx, sy, sz);
      }
    }
    for (const ghost of ghosts) {
      if (ghost.life <= 0) continue;
      ghost.life -= dt;
      ghost.mesh.material.opacity = Math.max(0, ghost.life / 0.18) * 0.4;
      if (ghost.life <= 0) ghost.mesh.visible = false;
    }

    const air = Math.max(0, player.y);
    shadow.position.set(player.x, 0.04, player.z);
    shadow.material.opacity = player.falling ? 0.06 : 0.36 * (1 - Math.min(1, air / 3.2));
    shadow.scale.setScalar(1 - Math.min(0.45, air * 0.08));

    const ready = player.slamCd <= 0 && !player.falling;
    const reach = slamReach();
    slamRing.position.set(player.x, 0.055, player.z);
    slamRing.visible = mode !== "over";
    if (ready) {
      const pulse = 1 + Math.sin(realTime * 8) * 0.05;
      slamRing.scale.set(reach * pulse, reach * pulse, 1);
      slamRing.material.opacity = 0.5;
      slamRing.material.color.set(feverOn ? "#ffe566" : "#7af0ff");
    } else {
      const left = 1 - player.slamCd / CONFIG.player.slamCooldown;
      const cooled = Math.max(0.35, reach * left);
      slamRing.scale.set(cooled, cooled, 1);
      slamRing.material.opacity = 0.18;
      slamRing.material.color.set("#fff6ea");
    }

    for (const c of crates) {
      if (!c.alive) continue;
      const pop = c.age < 0.26 ? backOut(Math.min(1, c.age / 0.26)) : 1;
      c.mesh.scale.setScalar(Math.max(0.001, c.base * pop));
      const bob = c.falling ? 0 : Math.sin(realTime * 2.3 + c.phase) * 0.06;
      c.mesh.position.set(c.x, c.y + bob, c.z);
      c.mesh.rotation.y = realTime * 0.4 + c.phase;
      c.bodyMat.emissive.set(c.flash > 0 ? "#ffffff" : "#000000");
      c.bodyMat.emissiveIntensity = c.flash > 0 ? 0.85 : 0;
    }

    for (const g of gems) {
      if (!g.alive) continue;
      g.mesh.position.set(g.x, 0.9 + Math.sin(realTime * 3.1 + g.phase) * 0.16, g.z);
      g.mesh.rotation.y += dt * 2.4;
      g.mesh.rotation.z = Math.sin(realTime * 2 + g.phase) * 0.4;
    }

    for (const m of mites) {
      if (!m.alive) continue;
      const telegraph = m.age < 0.5;
      const pulse = telegraph ? 0.72 + Math.sin(realTime * 18) * 0.1 : 1;
      m.mesh.scale.setScalar(pulse);
      m.mesh.position.set(m.x, (telegraph ? 1.05 : 0.66) + Math.sin(realTime * 5 + m.phase) * 0.07, m.z);
      m.mesh.rotation.y += dt * 1.6;
      m.mat.emissiveIntensity = telegraph ? 0.95 : 0.4;
    }

    islandPunch *= Math.exp(-7 * dt);
    island.scale.set(1 + islandPunch, 1, 1 + islandPunch);

    const dist = Math.hypot(player.x, player.z);
    const danger = clamp((dist - (R - CONFIG.arena.edgeBand)) / CONFIG.arena.edgeBand, 0, 1);
    rimGlowMat.color.set(danger > 0.5 ? "#ff4d6d" : "#2ad2b2");
    rimGlowMat.opacity = 0.28 + danger * 0.55 + Math.sin(realTime * 5) * 0.04;
    document.body.classList.toggle("rim", danger > 0.62 && mode === "play" && !player.falling);
    document.body.classList.toggle("fever", feverOn && mode === "play");
    document.body.classList.toggle("low", mode === "play" && lives === 1);
  }

  function driftScenery() {
    for (const group of cloudGroups) {
      const span = 120;
      const travel = (realTime * group.userData.speed) % span;
      group.position.x = group.userData.baseX + travel;
      if (group.position.x > 60) group.position.x -= span;
    }
    for (let i = 0; i < islets.length; i++) {
      islets[i].position.y = -1.2 + Math.sin(realTime * 0.6 + i) * 0.25;
    }
  }

  function placeCamera(dt, snap) {
    const aspect = Math.max(0.6, (canvas.clientWidth || window.innerWidth) / Math.max(1, canvas.clientHeight || window.innerHeight));
    const fov = (CONFIG.camera.fov * Math.PI) / 180;
    const span = R * CONFIG.camera.span * (aspect < 0.95 ? 1.16 : 1);
    const dist = span / (2 * Math.tan(fov / 2) * Math.max(aspect, 0.78));
    const sway = mode === "title" ? Math.sin(realTime * 0.38) * 0.2 : 0;
    const yaw = CONFIG.camera.side + sway;
    const back = dist * CONFIG.camera.back;
    _desired.set(
      player.x + Math.sin(yaw) * back,
      dist * CONFIG.camera.height + Math.min(0, player.y) * 0.45,
      player.z + Math.cos(yaw) * back
    );
    const t = snap ? 1 : 1 - Math.exp(-CONFIG.camera.follow * dt);
    camera.position.lerp(_desired, t);
    const shake = fx.shake();
    camera.position.x += shake.x;
    camera.position.y += shake.y;
    _look.set(player.x, 0.45 + clamp(player.y * 0.25, -1.6, 0.8), player.z);
    camera.lookAt(_look);
    const basis = camBasis();
    const lateral = player.vx * basis.right.x + player.vz * basis.right.z;
    camera.rotateZ(clamp(-lateral * 0.006, -0.03, 0.03));
    const targetFov = CONFIG.camera.fov + (player.dashing ? 4 : 0);
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-8 * dt));
    camera.updateProjectionMatrix();
  }

  function paintUi(dt) {
    if (Math.abs(displayScore - score) < 0.6) displayScore = score;
    else displayScore += (score - displayScore) * Math.min(1, dt * 12);
    scoreEl.textContent = Math.round(displayScore).toLocaleString("en-US");
    if (scorePop > 0) {
      scoreEl.classList.remove("bump");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("bump");
      scorePop = 0;
    }
    if (mode === "play" && score > bestAtStart && bestAtStart > 0) bestEl.textContent = "NEW BEST";
    else bestEl.textContent = best > 0 ? "BEST " + Math.round(best).toLocaleString("en-US") : "BEST —";
    levelEl.textContent = "LV " + level;

    const showCombo = combo > 0 && (mode === "play" || mode === "pause");
    comboWrap.hidden = !showCombo;
    if (showCombo) {
      comboEl.textContent = "x" + multiplier;
      comboEl.classList.toggle("fever", multiplier >= CONFIG.combo.feverAt);
      comboFill.style.transform = `scaleX(${clamp(comboTime / CONFIG.combo.timeout, 0, 1)})`;
    }

    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) bannerEl.hidden = true;
    }

    flashA *= Math.exp(-6 * dt);
    flashEl.style.opacity = String(flashA);
    if (hurtFlash > 0) hurtFlash -= dt;

    $("btn-dash").classList.toggle("ready", player.dashCd <= 0);
    $("btn-slam").classList.toggle("ready", player.slamCd <= 0);

    if (mode === "play") {
      let hint;
      if (!did.move) hint = "WASD or arrows to move";
      else if (!did.dash) hint = "SPACE, K, or click to dash";
      else if (!did.slam) hint = "F, J, Shift, or right-click to slam";
      else {
        tipTime += dt;
        if (tipTime > 4.2) {
          tipTime = 0;
          tipIndex = (tipIndex + 1) % TIPS.length;
        }
        hint = TIPS[tipIndex];
      }
      hintsEl.textContent = hint;
    }
  }

  function resetWorld() {
    fx.reset();
    score = 0;
    displayScore = 0;
    combo = 0;
    comboTime = 0;
    multiplier = 1;
    level = 1;
    levelTime = 0;
    lives = CONFIG.lives;
    paintedLives = -1;
    grace = CONFIG.difficulty.miteGrace;
    spawnAcc = 0.15;
    zapTimer = 3;
    lonely = 0;
    miteAcc = 0;
    hitstop = 0;
    islandPunch = 0;
    celebrated = false;
    did.move = false;
    did.dash = false;
    did.slam = false;
    tipIndex = 0;
    tipTime = 0;
    for (const c of crates) hideCrate(c);
    for (const g of gems) hideGem(g);
    for (const m of mites) hideMite(m);
    for (const z of zaps) hideZap(z);
    player.x = 0;
    player.z = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.facing = Math.PI;
    player.dashing = false;
    player.dashT = 0;
    player.dashCd = 0;
    player.slamCd = 0;
    player.slamT = 0;
    player.landT = 0;
    player.dropIn = 0;
    player.falling = false;
    player.penalized = false;
    player.iframes = 0.7;
    player.dashHits = 0;
    spawnWelcome();
    paintLives();
    scoreEl.textContent = "0";
    bannerEl.hidden = true;
    document.body.classList.remove("fever", "low", "rim");
  }

  function titleBestText() {
    titleBest.textContent = best > 0 ? "BEST " + Math.round(best).toLocaleString("en-US") : "NO RECORD YET";
  }

  function begin(kind) {
    resetWorld();
    snapCam = true;
    moodKey = "";
    if (kind === "title") {
      mode = "title";
      level = 3;
      grace = 0;
      spawnMite();
      spawnMite();
      hide("hud");
      hide("pause");
      hide("over");
      show("title");
      titleBestText();
    } else {
      mode = "play";
      bestAtStart = loadBest();
      best = bestAtStart;
      hide("title");
      hide("pause");
      hide("over");
      show("hud");
      callout("GO!");
    }
    syncMood();
    syncMeshes(0.016);
  }

  function startRun() {
    if (arm > 0) return;
    arm = 0.3;
    audio.unlock();
    begin("play");
    audio.go();
  }

  function beginTitle() {
    audio.unlock();
    begin("title");
    audio.setMood({ title: true, level: 1, fever: false, over: false });
    moodKey = "title|3|0";
  }

  function setPause(paused) {
    if (paused && mode === "play") {
      mode = "pause";
      show("pause");
      $("resume").focus();
    } else if (!paused && mode === "pause") {
      mode = "play";
      hide("pause");
    }
    syncMood();
  }

  function toggleMute() {
    audio.unlock();
    audio.toggle();
    paintMute();
    audio.ui();
  }

  function handleMeta(snap) {
    if (snap.mute) toggleMute();
    if (mode === "title" && (snap.start || snap.restart)) startRun();
    else if (mode === "over" && (snap.start || snap.restart)) startRun();
    else if (mode === "over" && snap.pause) beginTitle();
    else if (mode === "play" && snap.pause) setPause(true);
    else if (mode === "pause" && (snap.pause || snap.start)) setPause(false);
    else if (mode === "pause" && snap.restart) startRun();
  }

  $("title").addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-noclick]")) return;
    startRun();
  });
  $("title-mute").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMute();
  });
  $("mute").addEventListener("click", toggleMute);
  $("pause-mute").addEventListener("click", toggleMute);
  $("btn-pause").addEventListener("click", () => {
    if (mode === "play") setPause(true);
    else if (mode === "pause") setPause(false);
  });
  $("resume").addEventListener("click", () => setPause(false));
  $("pause-restart").addEventListener("click", startRun);
  $("pause-menu").addEventListener("click", beginTitle);
  $("again").addEventListener("click", startRun);
  $("over-menu").addEventListener("click", beginTitle);

  window.addEventListener("pointerdown", () => audio.unlock(), { passive: true });
  window.addEventListener("keydown", () => audio.unlock());

  let lastTime = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") setPause(true);
    lastTime = performance.now();
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.35, 0.94);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = true;

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight || window.innerHeight));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  }
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  function draw() {
    if (!useBloom) {
      renderer.render(scene, camera);
      return;
    }
    try {
      composer.render();
    } catch {
      useBloom = false;
      renderer.render(scene, camera);
    }
  }

  function frame(now) {
    if (!lastTime) {
      lastTime = now;
      return;
    }
    const realDt = Math.min(Math.max(0, (now - lastTime) / 1000), 0.05);
    lastTime = now;
    realTime += realDt;
    if (arm > 0) arm -= realDt;
    const instant = 1 / Math.max(realDt, 1 / 240);
    fps += (instant - fps) * 0.05;

    const snap = input.snapshot();
    handleMeta(snap);

    if (mode === "pause" || mode === "over") {
      fx.update(0);
    } else if (hitstop > 0) {
      hitstop = Math.max(0, hitstop - realDt);
      fx.update(0);
    } else {
      const sim = Math.min(realDt, 0.05);
      update(sim, mode === "title" ? fillDemo() : snap);
      fx.update(sim);
    }

    driftScenery();
    placeCamera(realDt, snapCam);
    snapCam = false;
    paintUi(realDt);
    draw();
  }

  begin("title");
  placeCamera(1 / 60, true);
  snapCam = false;
  paintMute();
  titleBestText();
  renderer.setAnimationLoop(frame);
  window.__skyReady = true;

  window.sky = {
    get mode() {
      return mode;
    },
    get score() {
      return score;
    },
    get lives() {
      return lives;
    },
    get level() {
      return level;
    },
    get combo() {
      return combo;
    },
    get fps() {
      return fps;
    },
    player() {
      return {
        x: player.x,
        y: player.y,
        z: player.z,
        falling: player.falling,
        speed: Math.hypot(player.vx, player.vz),
      };
    },
  };

  if (new URLSearchParams(location.search).has("debug")) {
    window.sky.debug = {
      over(reason) {
        if (mode !== "play") startRun();
        gameOver(reason || "mite");
      },
      score(n) {
        score = n;
        persistBest();
      },
      level(n) {
        level = n;
      },
      hurt() {
        loseLife("mite", player.x + 1, player.z);
      },
    };
  }
}

if (location.protocol === "file:") {
  const note = $("file-warn");
  note.hidden = false;
  note.textContent =
    "Sky Slam needs a tiny local server. On Windows, double-click start.bat. On Mac or Linux, run ./start.sh. Opening index.html directly will not start the game.";
} else {
  boot();
}
