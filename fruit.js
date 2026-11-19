'use strict';
/* Random fruit: a peelable 3D fruit in an overlay.
 * Three.js is fetched from the CDN the first time the button is pressed, so it
 * costs nothing on page load. Each fruit is three nested surfaces (peel, pith,
 * flesh) built on the same grid. Peeling lowers per-vertex alpha on the peel and
 * pith, and alphaTest discards those fragments; the removed skin is drawn as a
 * ribbon that lifts away while you drag and falls off when it tears or you let go. */

(function () {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const TAU = Math.PI * 2;

  const layer = document.getElementById('fruit-layer');
  const titleEl = document.getElementById('fruit-title');
  const statusEl = document.getElementById('fruit-status');

  let THREE = null;
  let threePromise = null;
  let app = null;        // renderer, scene, camera (created once)
  let fruit = null;      // the current fruit
  let lastName = null;
  let running = false;

  // ---------- small maths helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = x => x - Math.floor(x);
  const hash3 = (x, y, z) => frac(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
  function makeNoise(seed) {
    const p = [1, 2, 3, 4, 5].map(i => frac(Math.sin(seed * 91.7 + i * 13.3) * 9137.1) * TAU);
    return (x, y, z, f) => 0.5 * (
      Math.sin(f * x * 1.7 + p[0]) * Math.sin(f * y * 2.3 + p[1]) * Math.sin(f * z * 1.9 + p[2]) +
      Math.sin(f * (x + y) * 1.3 + p[3]) * Math.sin(f * (y - z) * 1.1 + p[4]));
  }
  const sphere = (rx, ry) => t => { const phi = t * Math.PI; return { r: Math.sin(phi) * rx, y: -Math.cos(phi) * ry, phi }; };

  // ---------- fruit catalogue ----------
  function citrusFlesh(segments, membraneHex) {
    return (c, v, P) => {
      const seg = frac(v.theta / TAU * segments);
      const line = clamp(1 - Math.min(seg, 1 - seg) / 0.045, 0, 1);
      c.copy(P.flesh).multiplyScalar(0.82 + 0.3 * v.h + 0.06 * v.s);
      c.lerp(P.membrane || (P.membrane = new THREE.Color(membraneHex)), line * 0.85);
    };
  }
  const plainPith = (c, v, P) => c.copy(P.pith).multiplyScalar(0.95 + 0.07 * v.h);
  function citrusPeel(c, v, P) {
    c.copy(P.peel).multiplyScalar(0.86 + 0.16 * v.h + 0.05 * v.s);
    if (v.t > 0.985 || v.t < 0.01) c.lerp(P.navel, 0.6);
  }

  const FRUITS = [
    {
      name: 'orange', rough: 0.012, brush: 0.15,
      colors: { peel: '#ef8419', pith: '#f8efd8', flesh: '#f59a26', navel: '#8a6a22' },
      shape: sphere(1, 0.95), peel: citrusPeel, pith: plainPith, flesh: citrusFlesh(10, '#fbe3b4'),
      ribbon: ['#ec8218', '#f8efd8'], calyx: true,
    },
    {
      name: 'mandarin', rough: 0.01, brush: 0.15,
      colors: { peel: '#f27a12', pith: '#f6e6c4', flesh: '#f7911f', navel: '#6f6a26' },
      shape: sphere(1, 0.76), peel: citrusPeel, pith: plainPith, flesh: citrusFlesh(9, '#fad9a6'),
      ribbon: ['#ee7812', '#f6e6c4'], calyx: true,
    },
    {
      name: 'grapefruit', rough: 0.01, brush: 0.16,
      colors: { peel: '#f0b44a', pith: '#fbf1dc', flesh: '#e4554a', navel: '#8a7a30', blush: '#ea8a4a' },
      shape: sphere(1, 0.92),
      peel(c, v, P) { citrusPeel(c, v, P); c.lerp(P.blush, 0.35 * (0.5 + 0.5 * Math.cos(v.theta + v.s))); },
      pith: plainPith, flesh: citrusFlesh(12, '#f7c2b4'),
      ribbon: ['#eea94a', '#fbf1dc'], calyx: true,
    },
    {
      name: 'lemon', rough: 0.012, brush: 0.13,
      colors: { peel: '#f4d11c', pith: '#fbf4de', flesh: '#f5e07a', navel: '#b0a020' },
      shape(t) {
        const phi = t * Math.PI;
        let y = -Math.cos(phi) * 1.0;
        y += -0.17 * Math.exp(-((phi / 0.28) ** 2)) + 0.17 * Math.exp(-(((Math.PI - phi) / 0.28) ** 2));
        return { r: Math.sin(phi) * 0.78, y };
      },
      peel: citrusPeel, pith: plainPith, flesh: citrusFlesh(9, '#fbf2c4'),
      ribbon: ['#f2cf1c', '#fbf4de'],
    },
    {
      name: 'lime', rough: 0.01, brush: 0.13,
      colors: { peel: '#5fa52a', pith: '#eef3d2', flesh: '#b4d65c', navel: '#4a6a1a' },
      shape(t) {
        const phi = t * Math.PI;
        let y = -Math.cos(phi) * 0.92;
        y += -0.06 * Math.exp(-((phi / 0.3) ** 2)) + 0.06 * Math.exp(-(((Math.PI - phi) / 0.3) ** 2));
        return { r: Math.sin(phi) * 0.82, y };
      },
      peel: citrusPeel, pith: plainPith, flesh: citrusFlesh(10, '#e6f0b8'),
      ribbon: ['#5da328', '#eef3d2'],
    },
    {
      name: 'apple', rough: 0, brush: 0.12, roughness: 0.35,
      colors: { peel: '#b31d26', streak: '#e2a12c', flesh: '#f4ebc2', dot: '#f0d595' },
      shape(t) {
        const phi = t * Math.PI;
        let y = -Math.cos(phi) * 0.9;
        y -= 0.32 * Math.exp(-(((Math.PI - phi) / 0.45) ** 2));
        y += 0.16 * Math.exp(-((phi / 0.4) ** 2));
        return { r: Math.sin(phi) * (1 + 0.1 * (t - 0.5)), y };
      },
      peel(c, v, P) {
        const streak = Math.pow(0.5 + 0.5 * Math.sin(v.theta * 29 + v.s * 4 + v.t * 3), 3);
        c.copy(P.peel).lerp(P.streak, 0.12 + 0.4 * streak * (0.5 + 0.5 * Math.cos(v.theta)));
        c.multiplyScalar(0.92 + 0.1 * v.s);
        if (v.h > 0.985) c.lerp(P.dot, 0.6);
      },
      flesh: (c, v, P) => c.copy(P.flesh).multiplyScalar(0.94 + 0.08 * v.h),
      ribbon: ['#a81d26', '#f4ebc2'], stem: { y: 0.6, len: 0.38 }, leaf: true,
    },
    {
      name: 'green apple', rough: 0, brush: 0.12, roughness: 0.35,
      colors: { peel: '#86c23a', blush: '#d8d24a', flesh: '#f5efcc', dot: '#e8f0b0' },
      shape(t) {
        const phi = t * Math.PI;
        let y = -Math.cos(phi) * 0.92;
        y -= 0.3 * Math.exp(-(((Math.PI - phi) / 0.45) ** 2));
        y += 0.14 * Math.exp(-((phi / 0.4) ** 2));
        return { r: Math.sin(phi) * (1 + 0.08 * (t - 0.5)), y };
      },
      peel(c, v, P) {
        c.copy(P.peel).lerp(P.blush, 0.35 * (0.5 + 0.5 * Math.cos(v.theta + 0.5 * v.s)));
        c.multiplyScalar(0.93 + 0.1 * v.s);
        if (v.h > 0.985) c.lerp(P.dot, 0.7);
      },
      flesh: (c, v, P) => c.copy(P.flesh).multiplyScalar(0.94 + 0.08 * v.h),
      ribbon: ['#82be38', '#f5efcc'], stem: { y: 0.62, len: 0.36 },
    },
    {
      name: 'pear', rough: 0, brush: 0.11, roughness: 0.5,
      colors: { peel: '#b9c441', blush: '#c8822a', speck: '#6e5e24', russet: '#8a6a34', flesh: '#f3eccb' },
      shape(t) {
        const phi = t * Math.PI;
        const prof = 1 - 0.45 * smoothstep(0.38, 0.95, t);
        let y = -Math.cos(phi) * 1.12 + 0.28 * smoothstep(0.45, 1, t) - 0.12;
        y += 0.06 * Math.exp(-((phi / 0.35) ** 2));
        return { r: Math.sin(phi) * 0.86 * prof, y };
      },
      peel(c, v, P) {
        c.copy(P.peel).lerp(P.blush, 0.3 * (0.5 + 0.5 * Math.cos(v.theta)) * (1 - v.t));
        c.multiplyScalar(0.9 + 0.12 * v.s);
        if (v.h > 0.94) c.lerp(P.speck, 0.45);
        if (v.t > 0.9) c.lerp(P.russet, smoothstep(0.9, 1, v.t) * 0.8);
      },
      flesh: (c, v, P) => c.copy(P.flesh).multiplyScalar(0.94 + 0.08 * v.h),
      ribbon: ['#b5c03f', '#f3eccb'], stem: { y: 1.27, len: 0.32 },
    },
    {
      name: 'banana', rough: 0, brush: 0.09, segV: 220, bend: 1.0, roughness: 0.55,
      colors: { peel: '#f2cd36', green: '#9aa63a', tip: '#3e2c1a', spot: '#6a4620', pith: '#f2ead0', flesh: '#f2e1a8' },
      shape(t, theta, kind) {
        const phi = t * Math.PI;
        let r = Math.pow(Math.sin(phi), 0.55) * 0.32;
        if (kind !== 'flesh') r *= 1 + 0.06 * Math.abs(Math.cos(theta * 2.5));
        return { r, y: -Math.cos(phi) * 1.4 };
      },
      peel(c, v, P, noise) {
        const end = Math.abs(v.t - 0.5) * 2;
        c.copy(P.peel).lerp(P.green, smoothstep(0.72, 0.95, end) * 0.55);
        c.multiplyScalar(0.9 + 0.1 * v.s);
        const spot = clamp((noise(v.x, v.y, v.z, 9) - 0.55) * 4, 0, 1);
        c.lerp(P.spot, spot * 0.75);
        if (end > 0.95) c.lerp(P.tip, smoothstep(0.95, 0.99, end));
      },
      pith: plainPith,
      flesh: (c, v, P) => c.copy(P.flesh).multiplyScalar(0.92 + 0.1 * v.h),
      ribbon: ['#eec834', '#f2ead0'], orient: [0, 0, -Math.PI / 2],
    },
  ];

  // ---------- three.js setup ----------
  function loadThree() {
    if (!threePromise) threePromise = import(THREE_URL).then(m => { THREE = m; return m; });
    return threePromise;
  }

  function initApp() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    layer.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x4a3a2a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe2b0, 1.2);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    app = { renderer, scene, camera, raycaster: new THREE.Raycaster(), falling: [], clock: new THREE.Clock() };
    bindPointer();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!app) return;
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    app.renderer.setSize(w, h, false);
    app.camera.aspect = w / h;
    // keep the fruit roughly 340px across whatever the window size
    const fruitPx = Math.min(340, Math.min(w, h) * 0.6);
    const visibleH = (2.8 / fruitPx) * h;
    app.camera.position.set(0, 0, visibleH / (2 * Math.tan(THREE.MathUtils.degToRad(app.camera.fov / 2))));
    app.camera.lookAt(0, 0, 0);
    app.camera.updateProjectionMatrix();
  }

  // ---------- geometry ----------
  // One surface of the fruit. All three share the same grid so they nest cleanly.
  function buildLayer(spec, kind, scale, noise, palette) {
    const U = spec.segU || 160, V = spec.segV || 128;
    const count = (U + 1) * (V + 1);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 4);
    const c = new THREE.Color();
    const colorFn = spec[kind];
    const bendR = spec.bend ? (2 * 1.4) / spec.bend : 0;
    const bendFix = spec.bend ? bendR * (1 - Math.sin(spec.bend / 2) / (spec.bend / 2)) : 0;
    let k = 0;
    for (let j = 0; j <= V; j++) {
      const t = j / V;
      for (let i = 0; i <= U; i++) {
        const theta = (i % U) / U * TAU;
        const sh = spec.shape(t, theta, kind);
        let x = sh.r * Math.cos(theta), y = sh.y, z = sh.r * Math.sin(theta);
        const h = hash3(x, y, z);
        const s = noise(x, y, z, 3);
        if (kind === 'peel' && spec.rough) {
          const f = 1 + spec.rough * (h - 0.5);
          x *= f; y *= f; z *= f;
        }
        x *= scale; y *= scale; z *= scale;
        if (bendR) {
          const a = y / bendR;
          const rr = bendR + x;
          x = -bendR + rr * Math.cos(a) + bendFix;
          y = rr * Math.sin(a);
        }
        colorFn(c, { t, theta, x, y, z, h, s }, palette, noise);
        pos.set([x, y, z], k * 3);
        col.set([c.r, c.g, c.b, 1], k * 4);
        k++;
      }
    }
    const idx = [];
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < U; i++) {
        const a = j * (U + 1) + i, b = a + U + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    smoothSeams(g);
    g.computeBoundingSphere();
    return g;
  }

  // average normals of coincident vertices (the seam and the poles)
  function smoothSeams(g) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const groups = new Map();
    for (let i = 0; i < p.length / 3; i++) {
      const key = `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
      let arr = groups.get(key);
      if (!arr) groups.set(key, arr = []);
      arr.push(i);
    }
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      let x = 0, y = 0, z = 0;
      for (const i of arr) { x += n[i * 3]; y += n[i * 3 + 1]; z += n[i * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1;
      for (const i of arr) { n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; }
    }
  }

  function makeFruit(spec) {
    const noise = makeNoise(Math.random() * 1000);
    const palette = {};
    for (const k in spec.colors) palette[k] = new THREE.Color(spec.colors[k]);
    const group = new THREE.Group();
    const mat = (roughness) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, alphaTest: 0.5 });

    const peel = new THREE.Mesh(buildLayer(spec, 'peel', 1, noise, palette), mat(spec.roughness ?? 0.55));
    group.add(peel);
    let pith = null;
    if (spec.pith) {
      pith = new THREE.Mesh(buildLayer(spec, 'pith', 0.975, noise, palette), mat(0.9));
      group.add(pith);
    }
    const flesh = new THREE.Mesh(buildLayer(spec, 'flesh', spec.pith ? 0.94 : 0.975, noise, palette), mat(0.3));
    group.add(flesh);

    addExtras(spec, group);
    if (spec.orient) group.rotation.set(...spec.orient);
    group.rotation.y += Math.random() * TAU;

    // per-vertex jitter so torn edges look ragged rather than perfectly round
    const pp = peel.geometry.attributes.position.array;
    const jitter = new Float32Array(pp.length / 3);
    for (let i = 0; i < jitter.length; i++) jitter[i] = noise(pp[i * 3], pp[i * 3 + 1], pp[i * 3 + 2], 14);

    return { spec, group, peel, pith, flesh, jitter, peeled: 0, total: jitter.length, entered: 0 };
  }

  function addExtras(spec, group) {
    if (spec.stem) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.04, spec.stem.len, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a3c1e, roughness: 0.9 }));
      stem.position.set(0.02, spec.stem.y + spec.stem.len / 2 - 0.05, 0);
      stem.rotation.z = -0.18;
      group.add(stem);
      if (spec.leaf) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 8),
          new THREE.MeshStandardMaterial({ color: 0x4f8a2a, roughness: 0.6 }));
        leaf.scale.set(0.24, 0.015, 0.1);
        leaf.position.set(0.2, spec.stem.y + spec.stem.len * 0.75, 0.02);
        leaf.rotation.set(0.3, 0.4, 0.45);
        group.add(leaf);
      }
    }
    if (spec.calyx) {
      const top = spec.shape(1).y;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b7a2a, roughness: 0.8 }));
      cap.scale.set(0.07, 0.025, 0.07);
      cap.position.y = top + 0.005;
      group.add(cap);
    }
  }

  function disposeObject(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // ---------- peeling ----------
  // Remove skin within `radius` of local point p. Returns how many peel vertices came off.
  function eraseAt(p, radius) {
    let removed = 0;
    removed += eraseLayer(fruit.peel, p, radius, true);
    if (fruit.pith) eraseLayer(fruit.pith, p, radius * 0.8, false);
    fruit.peeled += removed;
    return removed;
  }

  function eraseLayer(mesh, p, radius, count) {
    const pos = mesh.geometry.attributes.position.array;
    const colAttr = mesh.geometry.attributes.color;
    const col = colAttr.array;
    const jit = fruit.jitter;
    const edge = radius * 0.18;
    const reach = radius * 1.3 + edge;
    const reach2 = reach * reach;
    let removed = 0, touched = false;
    for (let i = 0, n = pos.length / 3; i < n; i++) {
      const dx = pos[i * 3] - p.x, dy = pos[i * 3 + 1] - p.y, dz = pos[i * 3 + 2] - p.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > reach2) continue;
      const a0 = col[i * 4 + 3];
      if (a0 === 0) continue;
      const rr = radius * (1 + 0.22 * jit[i]);
      const a = clamp((Math.sqrt(d2) - rr) / edge + 0.5, 0, 1);
      if (a < a0) {
        col[i * 4 + 3] = a;
        touched = true;
        if (count && a0 >= 0.5 && a < 0.5) removed++;
      }
    }
    if (touched) colAttr.needsUpdate = true;
    return removed;
  }

  // The strip of skin currently lifting off under the cursor.
  const MAX_SAMPLES = 240;
  function newStrip() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SAMPLES * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const [outer, inner] = fruit.spec.ribbon;
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: outer, roughness: fruit.spec.roughness ?? 0.55, side: THREE.FrontSide })));
    obj.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: inner, roughness: 0.9, side: THREE.BackSide })));
    obj.visible = false;
    fruit.group.add(obj);
    return { obj, geom: g, samples: [], length: 0, tearAt: 0.8 + Math.random() * 0.9 };
  }

  function addSample(strip, p, n) {
    const last = strip.samples[strip.samples.length - 1];
    if (last) strip.length += last.p.distanceTo(p);
    strip.samples.push({ p: p.clone(), n: n.clone() });
    updateStrip(strip);
  }

  function updateStrip(strip) {
    const S = strip.samples, n = S.length;
    if (n < 2) return;
    const arr = strip.geom.attributes.position.array;
    const w = fruit.spec.brush * 0.95;
    const T = new THREE.Vector3(), side = new THREE.Vector3(), q = new THREE.Vector3();
    // arc length measured back from the newest sample (the bit still attached)
    const back = new Array(n).fill(0);
    for (let i = n - 2; i >= 0; i--) back[i] = back[i + 1] + S[i].p.distanceTo(S[i + 1].p);
    for (let i = 0; i < n; i++) {
      const a = S[Math.max(0, i - 1)].p, b = S[Math.min(n - 1, i + 1)].p;
      T.subVectors(b, a).normalize();
      side.crossVectors(S[i].n, T).normalize();
      const s = back[i];
      const lift = 0.012 + Math.min(0.55, 0.9 * s * s);
      const width = w * (0.55 + 0.45 * Math.min(1, i / 3));
      q.copy(S[i].p).addScaledVector(S[i].n, lift).addScaledVector(T, -0.25 * Math.min(s, 0.8) * s);
      arr.set([q.x + side.x * width, q.y + side.y * width, q.z + side.z * width], i * 6);
      arr.set([q.x - side.x * width, q.y - side.y * width, q.z - side.z * width], i * 6 + 3);
    }
    strip.geom.attributes.position.needsUpdate = true;
    strip.geom.setDrawRange(0, (n - 1) * 6);
    strip.geom.computeVertexNormals();
    strip.geom.computeBoundingSphere();
    strip.obj.visible = true;
  }

  // Let a strip go: it drops away from the fruit, tumbles and fades.
  function dropStrip(strip) {
    if (!strip) return;
    if (strip.samples.length < 2) {
      fruit.group.remove(strip.obj);
      disposeObject(strip.obj);
      return;
    }
    // centre on the strip itself (the buffer's unused tail sits at the origin)
    const centre = new THREE.Vector3();
    for (const s of strip.samples) centre.add(s.p);
    centre.divideScalar(strip.samples.length);
    strip.geom.translate(-centre.x, -centre.y, -centre.z);
    strip.obj.position.copy(centre);
    app.scene.attach(strip.obj);
    const out = strip.obj.position.clone().normalize();
    const vel = out.multiplyScalar(1.1).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.6, 0.4));
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    for (const m of strip.obj.children) { m.material.transparent = true; m.material.needsUpdate = true; }
    app.falling.push({ obj: strip.obj, vel, axis, spin: 2 + Math.random() * 4, age: 0 });
  }

  // ---------- pointer handling ----------
  const SPIN_SPEED = 0.45;  // radians per second, always
  let mode = null;          // 'peel' while the button is held, else null
  let strip = null;
  let lastHit = null;       // last local point on the skin
  let idleTravel = 0;       // distance dragged without removing any skin
  let lastPointer = null;
  const ndc = { x: 0, y: 0 };

  function hitFruit(e) {
    const rect = app.renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    app.raycaster.setFromCamera(ndc, app.camera);
    const hit = app.raycaster.intersectObject(fruit.peel, false)[0];
    if (!hit) return null;
    return { p: fruit.peel.worldToLocal(hit.point.clone()), n: hit.face.normal.clone() };
  }

  function peelTo(hit) {
    const brush = fruit.spec.brush;
    let removed = 0;
    if (lastHit) {
      const d = lastHit.distanceTo(hit.p);
      const steps = Math.max(1, Math.ceil(d / (brush * 0.3)));
      const q = new THREE.Vector3();
      for (let s = 1; s <= steps; s++) removed += eraseAt(q.lerpVectors(lastHit, hit.p, s / steps), brush);
      idleTravel = removed ? 0 : idleTravel + d;
    } else {
      removed = eraseAt(hit.p, brush);
    }
    if (removed) {
      if (!strip) strip = newStrip();
      const last = strip.samples[strip.samples.length - 1];
      if (!last || last.p.distanceTo(hit.p) > brush * 0.3) addSample(strip, hit.p, hit.n);
      if (strip.length > strip.tearAt || strip.samples.length >= MAX_SAMPLES) {
        dropStrip(strip);           // long strips tear off on their own
        strip = newStrip();
        addSample(strip, hit.p, hit.n);
      }
      updateStatus();
    } else if (strip && idleTravel > brush * 0.8) {
      dropStrip(strip);             // dragged onto bare fruit: the strip tears off
      strip = null;
    }
    lastHit = hit.p;
  }

  // The canvas ignores the mouse so the app underneath stays usable; we listen on
  // the window and only claim a press when it lands on the fruit.
  function bindPointer() {
    window.addEventListener('pointerdown', e => {
      if (!fruit || !running || e.button > 0) return;
      const hit = hitFruit(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      lastPointer = { x: e.clientX, y: e.clientY };
      document.body.classList.add('fruit-dragging');
      mode = 'peel';
      lastHit = null;
      idleTravel = 0;
      peelTo(hit);
      setCursor('grabbing');
    }, true);
    window.addEventListener('pointermove', e => {
      if (!fruit || !running) return;
      lastPointer = { x: e.clientX, y: e.clientY };
      const hit = hitFruit(e);
      if (mode === 'peel') {
        if (hit) peelTo(hit);
        else { dropStrip(strip); strip = null; lastHit = null; }
      } else {
        setCursor(hit ? 'grab' : '');
      }
    }, true);
    const end = () => {
      if (!mode) return;
      dropStrip(strip);
      strip = null;
      lastHit = null;
      mode = null;
      document.body.classList.remove('fruit-dragging');
      setCursor('');
    };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  }

  function setCursor(c) {
    if (c) document.documentElement.dataset.fruitCursor = c;
    else delete document.documentElement.dataset.fruitCursor;
  }

  // ---------- status text ----------
  function updateStatus() {
    if (!fruit) return;
    const pct = Math.min(100, Math.round(fruit.peeled / fruit.total * 100));
    if (pct >= 97) {
      statusEl.textContent = `Peeled! Enjoy your ${fruit.spec.name}.`;
    } else if (pct > 0) {
      statusEl.textContent = `${pct}% peeled. Keep going.`;
    } else {
      statusEl.textContent = 'Click and drag across the skin to peel it.';
    }
  }

  // ---------- loop ----------
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(app.clock.getDelta(), 0.05);
    if (fruit) {
      if (fruit.entered < 1) {
        fruit.entered = Math.min(1, fruit.entered + dt * 2.5);
        const e = fruit.entered, s = 1 + 0.12 * Math.sin(e * Math.PI) - (1 - e) * (1 - e);
        fruit.group.scale.setScalar(Math.max(0.001, s));
      }
      // The fruit always turns at the same pace. While the button is held, the
      // skin turning under a still cursor keeps peeling until the strip tears.
      fruit.group.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * SPIN_SPEED);
      if (mode === 'peel') {
        fruit.group.updateMatrixWorld();
        const hit = hitFruit({ clientX: lastPointer.x, clientY: lastPointer.y });
        if (hit) peelTo(hit);
      }
    }
    for (let i = app.falling.length - 1; i >= 0; i--) {
      const f = app.falling[i];
      f.age += dt;
      f.vel.y -= 7 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotateOnWorldAxis(f.axis, f.spin * dt);
      const fade = 1 - smoothstep(1.0, 1.8, f.age);
      for (const m of f.obj.children) m.material.opacity = fade;
      if (f.age > 1.8) {
        app.scene.remove(f.obj);
        disposeObject(f.obj);
        app.falling.splice(i, 1);
      }
    }
    app.renderer.render(app.scene, app.camera);
  }

  // ---------- open / close ----------
  function spawn() {
    if (fruit) {
      dropStrip(strip);
      strip = null;
      app.scene.remove(fruit.group);
      disposeObject(fruit.group);
    }
    const choices = FRUITS.filter(f => f.name !== lastName);
    const spec = choices[Math.floor(Math.random() * choices.length)];
    lastName = spec.name;
    fruit = makeFruit(spec);
    fruit.group.scale.setScalar(0.001);
    app.scene.add(fruit.group);
    titleEl.textContent = `A ${spec.name}`.replace(/^A ([aeiou])/i, 'An $1');
    mode = null;
    updateStatus();
  }

  async function open() {
    layer.hidden = false;
    if (!THREE) {
      titleEl.textContent = 'Fetching fruit…';
      statusEl.textContent = '';
      try { await loadThree(); } catch (err) {
        titleEl.textContent = 'The fruit cart is empty';
        statusEl.textContent = 'Could not load the 3D library. Check your internet connection and try again.';
        threePromise = null;
        return;
      }
    }
    if (!app) initApp();
    resize();
    spawn();
    if (!running) { running = true; app.clock.getDelta(); frame(); }
  }

  function close() {
    layer.hidden = true;
    running = false;
    setCursor('');
  }

  document.getElementById('random-fruit').addEventListener('click', open);
  document.getElementById('fruit-another').addEventListener('click', () => { if (app) spawn(); });
  document.getElementById('fruit-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !layer.hidden) close(); });
})();
