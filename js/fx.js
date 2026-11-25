// Particles, shock rings, floating numbers, and screen shake.

import * as THREE from "three";

const PARTS = 260;
const POPS = 18;
const RINGS = 8;

export function createFx(scene) {
  const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, PARTS);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PARTS * 3), 3);
  mesh.frustumCulled = false;
  mesh.count = PARTS;
  scene.add(mesh);

  const parts = Array.from({ length: PARTS }, () => ({
    life: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rot: 0,
    spin: 0,
    size: 0.15,
    r: 1,
    g: 1,
    b: 1,
  }));

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.frustumCulled = false;
    scene.add(ring);
    rings.push({ mesh: ring, life: 0, max: 0.35, grow: 3 });
  }

  const pops = [];
  for (let i = 0; i < POPS; i++) {
    const spriteMat = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.visible = false;
    sprite.frustumCulled = false;
    sprite.renderOrder = 20;
    scene.add(sprite);
    pops.push({ mesh: sprite, life: 0, vy: 0, tex: null });
  }

  let trauma = 0;
  let ox = 0;
  let oy = 0;
  let ringCursor = 0;
  let popCursor = 0;

  function burst(x, y, z, hex, count, speed) {
    color.set(hex);
    let left = count;
    for (let i = 0; i < PARTS && left > 0; i++) {
      const p = parts[i];
      if (p.life > 0) continue;
      p.life = 0.32 + Math.random() * 0.38;
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * speed;
      const sp = speed * (0.35 + Math.random() * 0.85);
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = up;
      p.spin = Math.random() * 10 - 5;
      p.rot = Math.random() * 6;
      p.size = 0.1 + Math.random() * 0.16;
      p.r = color.r;
      p.g = color.g;
      p.b = color.b;
      left--;
    }
  }

  function ring(x, z, hex, grow) {
    const r = rings[ringCursor];
    ringCursor = (ringCursor + 1) % RINGS;
    r.life = 0.34;
    r.max = 0.34;
    r.grow = grow;
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.07, z);
    r.mesh.scale.setScalar(0.4);
    r.mesh.material.color.set(hex);
    r.mesh.material.opacity = 0.9;
  }

  function makeTexture(text, fill) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, 256, 128);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.font = "900 80px Impact, Arial Black, sans-serif";
    const width = g.measureText(text).width;
    const size = width > 236 ? Math.floor((80 * 236) / width) : 80;
    g.font = `900 ${size}px Impact, Arial Black, sans-serif`;
    g.lineWidth = 14;
    g.strokeStyle = "#1b1430";
    g.strokeText(text, 128, 68);
    g.fillStyle = fill;
    g.fillText(text, 128, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function popup(x, y, z, text, fill) {
    const p = pops[popCursor];
    popCursor = (popCursor + 1) % POPS;
    if (p.tex) p.tex.dispose();
    p.tex = makeTexture(text, fill);
    p.mesh.material.map = p.tex;
    p.mesh.material.opacity = 1;
    p.mesh.visible = true;
    p.life = 0.72;
    p.vy = 1.8;
    const jx = (Math.random() - 0.5) * 0.7;
    p.mesh.position.set(x + jx, y + 0.7, z);
    p.mesh.scale.set(2.3, 1.15, 1);
  }

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
    const s = trauma * trauma;
    ox = (Math.random() * 2 - 1) * s * 0.62;
    oy = (Math.random() * 2 - 1) * s * 0.62;
  }

  function update(dt) {
    if (dt > 0) trauma = Math.max(0, trauma - dt * 1.8);
    if (dt > 0 && trauma > 0) {
      const s = trauma * trauma;
      ox = (Math.random() * 2 - 1) * s * 0.62;
      oy = (Math.random() * 2 - 1) * s * 0.62;
    }
    if (trauma <= 0) {
      ox = 0;
      oy = 0;
    }

    for (let i = 0; i < PARTS; i++) {
      const p = parts[i];
      if (p.life <= 0) {
        dummy.position.set(0, -40, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.life -= dt;
      p.vy -= 16 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const s = p.size * Math.max(0, Math.min(1, p.life * 3));
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rot, p.rot * 0.6, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.35 + k * r.grow);
      r.mesh.material.opacity = Math.max(0, r.life / r.max) * 0.85;
      if (r.life <= 0) r.mesh.visible = false;
    }

    for (const p of pops) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.material.opacity = Math.max(0, Math.min(1, p.life / 0.25));
      const s = 2.3 * (p.life > 0.6 ? 1 + (0.72 - p.life) * 2 : 1);
      p.mesh.scale.set(s, s * 0.5, 1);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }

  function reset() {
    for (const p of parts) p.life = 0;
    for (const r of rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    for (const p of pops) {
      p.life = 0;
      p.mesh.visible = false;
    }
    trauma = 0;
    ox = 0;
    oy = 0;
    update(0);
  }

  return {
    burst,
    ring,
    popup,
    trauma: addTrauma,
    update,
    reset,
    shake() {
      return { x: ox, y: oy };
    },
  };
}
