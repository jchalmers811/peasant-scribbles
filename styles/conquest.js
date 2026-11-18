/* Conquest style: the town as a real-time-strategy map. An isometric camera
 * that zooms to fit the town, natural terrain with dense forests and sandy
 * shores, villagers and soldiers in a blue team colour, sheep in the fields,
 * an RTS selection ring on hover, and a minimap in the corner.
 * Buildings come from styles/raised.js, drawn through this style's camera. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const FONT = '"Cinzel", Georgia, serif';
const TEAM = '#2f62c9', TEAM_DARK = '#1d3f86', TEAM_LIGHT = '#6f9bf0';
const { fillPoly, smoothClosed } = Raised;

const BASE = {
  outline: '#20180f', lineWidth: 0.7, shadow: 'rgba(15,25,5,.32)', wallShadow: 'rgba(15,25,5,.28)',
  door: '#3b2614', window: '#262a30', chimney: '#6d6255', ridgeLight: 1.25,
  stone: ['#d3cdbf', '#aaa293', '#6e685d'], towerCourses: 'rgba(40,35,25,.22)',
  towerTop: ['#c4bdae', '#857d70'], coneGloss: 'rgba(255,255,255,.14)',
  wallFace: '#b3ab9a', wallCourses: 'rgba(50,45,35,.28)', wallWalk: '#cfc8b8', merlons: '#8a8274', wallH: 16,
  wallTowerRoof: TEAM_DARK, gateTowerRoof: TEAM_DARK, gateStone: '#aca493', gateDark: '#17120c',
  castleYard: '#a99a76', castleTowerRoof: TEAM, castleFlag: TEAM_LIGHT, keep: '#c2baa8', keepFlag: TEAM,
  hallWall: '#d8cbb0', hallRoof: '#7a4b2c',
  churchStone: '#ddd6c6', churchTower: '#cfc7b5', churchRoof: '#56606e', cross: '#e8c55a',
  millRoof: '#7a5634', millSail: '#efe7d4', millHub: '#4a321c',
  highlight: ['#ffffff', '#d8f5c8', 'rgba(255,255,255,.9)'],
};
const WALLS = ['#d9c7a0', '#cfbb92', '#c4b08a', '#bdb3a0', '#d2c4a8', '#b8a684'];
const ROOFS = ['#7a5634', '#8c6239', '#6b4a2c', '#b08d52', '#a07a44', '#7d4a30', '#5f5a55', '#94502f'];

// ---------- camera: isometric, zoomed so the town fills the view ----------
const views = new WeakMap();
function viewFor(m) {
  if (views.has(m)) return views.get(m);
  const K = clamp(380 / (m.townR + 50), 0.72, 1.7);
  const OX = 600, OY = 610 - 600 * K; // world centre lands at (600, 610)
  const project = (x, y) => ({ x: (x - y) * K + OX, y: (x + y) * K * 0.5 + OY });
  const projectVec = (x, y) => ({ x: (x - y) * K, y: (x + y) * K * 0.5 });
  const unproject = (sx, sy) => { const a = (sx - OX) / K, b = (sy - OY) * 2 / K; return { x: (a + b) / 2, y: (b - a) / 2 }; };
  const v = { K, OX, OY, project, projectVec, unproject, pal: Raised.palette({ ...BASE, project, projectVec, zoom: K }) };
  views.set(m, v);
  return v;
}
const onScreen = (p, pad = 40) => p.x > -pad && p.y > -pad && p.x < WORLD + pad && p.y < WORLD + pad;

// ---------- ground (drawn in world coordinates through the iso transform) ----------
function drawGround(ctx, m, v) {
  const r = mulberry(m.paperSeed ^ 0x7a3c);
  ctx.save();
  ctx.transform(v.K, v.K / 2, -v.K, v.K / 2, v.OX, v.OY);
  ctx.fillStyle = '#5e8f39';
  ctx.fillRect(-1600, -1600, 4400, 4400);
  const tints = ['#4f8030', '#6b9b40', '#5a8a34', '#78a64a', '#486f2b', '#8a9a4a', '#7c8a44'];
  for (let i = 0; i < 520; i++) {
    const x = -700 + r() * 2600, y = -700 + r() * 2600, rad = 40 + r() * 150;
    const [cr, cg, cb] = Raised.rgb(tints[Math.floor(r() * tints.length)]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},.5)`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < .5 ? 'rgba(30,60,15,.22)' : 'rgba(170,210,110,.18)';
    ctx.fillRect(-500 + r() * 2200, -500 + r() * 2200, 2.2, 1.4);
  }
  if (m.houses.length) {
    ctx.save(); ctx.filter = 'blur(10px)';
    smoothClosed(ctx, m.outline); ctx.fillStyle = 'rgba(150,122,76,.55)'; ctx.fill();
    ctx.restore();
    ctx.save(); smoothClosed(ctx, m.outline); ctx.clip();
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = r() < .5 ? 'rgba(100,80,50,.3)' : 'rgba(200,180,140,.3)';
      ctx.fillRect(r() * WORLD, r() * WORLD, 2, 2);
    }
    ctx.restore();
  }
  drawFarms(ctx, m);
  drawWater(ctx, m);
  drawRoads(ctx, m);
  drawPlaza(ctx, m);
  ctx.restore();
}

function drawFarms(ctx, m) {
  for (const [i, f] of m.fields.entries()) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    const hw = f.w / 2, hh = f.h / 2;
    ctx.fillStyle = '#8b6a3e'; ctx.fillRect(-hw, -hh, f.w, f.h);
    const crop = ['#c9b24e', '#9fb04a', '#d4b85a', '#b3a446'][i % 4];
    ctx.strokeStyle = crop; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let y = -hh + 3; y < hh - 1; y += 4) { ctx.moveTo(-hw + 2, y); ctx.lineTo(hw - 2, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,20,.55)'; ctx.lineWidth = 1.4; ctx.strokeRect(-hw, -hh, f.w, f.h);
    ctx.restore();
  }
}

function drawWater(ctx, m) {
  if (!m.river) return;
  const w = m.river.w;
  // the camera can see past the map's edge, so carry the river on out of view
  const src = m.river.pts, n = src.length;
  const extend = (p, q) => { const dx = p.x - q.x, dy = p.y - q.y, L = Math.hypot(dx, dy) || 1; return { x: p.x + dx / L * 1500, y: p.y + dy / L * 1500 }; };
  const pts = [extend(src[0], src[3]), ...src, extend(src[n - 1], src[n - 4])];
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const [col, lw] of [['#d4c48e', w + 22], ['#b9a978', w + 12], ['#58a7bb', w + 7], ['#2f7898', w], ['#26637f', w * 0.45]]) {
    poly(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,248,255,.55)'; ctx.lineWidth = 1.2;
  for (const [dash, off, dx] of [[[6, 28], 0, -w * .25], [[4, 34], 17, w * .2]]) {
    ctx.setLineDash(dash); ctx.lineDashOffset = off;
    poly(ctx, pts.map(p => ({ x: p.x + dx, y: p.y - dx }))); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

function drawRoads(ctx, m) {
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const [col, extra, alpha] of [['#6e5636', 3, .55], ['#a88a5a', 0, 1], ['#bca06c', -0.4, .7]]) {
    ctx.globalAlpha = alpha;
    for (const kind of ['lane', 'ring', 'main']) for (const r of m.roads) {
      if (r.kind !== kind) continue;
      poly(ctx, r.pts, r.closed);
      ctx.strokeStyle = col; ctx.lineWidth = extra < 0 ? r.w * -extra : r.w + extra; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const b of m.bridges) {
    const dx = b.bx - b.ax, dy = b.by - b.ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = b.w / 2 + 3;
    const ax = b.ax - ux * 4, ay = b.ay - uy * 4, bx = b.bx + ux * 4, by = b.by + uy * 4;
    fillPoly(ctx, [{ x: ax + nx * hw, y: ay + ny * hw }, { x: bx + nx * hw, y: by + ny * hw }, { x: bx - nx * hw, y: by - ny * hw }, { x: ax - nx * hw, y: ay - ny * hw }], '#8d6338', '#3b2614', 1);
    ctx.strokeStyle = 'rgba(40,25,10,.55)'; ctx.lineWidth = .8;
    ctx.beginPath();
    for (let t = 2; t < L + 6; t += 3) { const px = ax + ux * t, py = ay + uy * t; ctx.moveTo(px + nx * hw, py + ny * hw); ctx.lineTo(px - nx * hw, py - ny * hw); }
    ctx.stroke();
  }
}

function drawPlaza(ctx, m) {
  const R = m.plazaR;
  ctx.fillStyle = '#b5aa94'; ctx.strokeStyle = '#6f6656'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(90,80,65,.35)'; ctx.lineWidth = .8;
  ctx.beginPath();
  for (let k = -R; k <= R; k += 7) { ctx.moveTo(CX + k, CY - R); ctx.lineTo(CX + k, CY + R); ctx.moveTo(CX - R, CY + k); ctx.lineTo(CX + R, CY + k); }
  ctx.stroke(); ctx.restore();
}

// ---------- sprites ----------
function houseDims(h) {
  return { H: 6 + Math.min(h.w, 26) * 0.18, roofH: h.h * 0.75 };
}

function broadleaf(ctx, p, s, shadeK) {
  ctx.fillStyle = 'rgba(15,25,5,.3)';
  ctx.beginPath(); ctx.ellipse(p.x + s * .7, p.y + s * .1, s * 1.1, s * .45, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a321c'; ctx.fillRect(p.x - s * .12, p.y - s * 1.1, s * .24, s * 1.1);
  const g = Math.floor(shadeK * 30), cy = p.y - s * 1.55;
  const puffs = [[-.45, .15, .62], [.45, .15, .62], [0, -.35, .7], [0, .2, .6]];
  ctx.fillStyle = `rgb(${34 + g},${74 + g},${24})`;
  ctx.beginPath(); for (const [dx, dy, rr] of puffs) { ctx.moveTo(p.x + dx * s + rr * s, cy + dy * s); ctx.arc(p.x + dx * s, cy + dy * s, rr * s, 0, TAU); } ctx.fill();
  ctx.fillStyle = `rgb(${60 + g},${110 + g},${36})`;
  ctx.beginPath(); for (const [dx, dy, rr] of puffs) { ctx.moveTo(p.x + dx * s - rr * .25 * s + rr * .6 * s, cy + dy * s - rr * .25 * s); ctx.arc(p.x + dx * s - rr * .25 * s, cy + dy * s - rr * .25 * s, rr * .6 * s, 0, TAU); } ctx.fill();
  ctx.fillStyle = 'rgba(200,235,140,.35)';
  ctx.beginPath(); ctx.arc(p.x - s * .3, cy - s * .55, s * .22, 0, TAU); ctx.fill();
}

function conifer(ctx, p, s, shadeK) {
  ctx.fillStyle = 'rgba(15,25,5,.3)';
  ctx.beginPath(); ctx.ellipse(p.x + s * .9, p.y + s * .1, s * 1.1, s * .35, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3f2a16'; ctx.fillRect(p.x - s * .1, p.y - s * .5, s * .2, s * .5);
  const g = Math.floor(shadeK * 25);
  for (let tier = 0; tier < 4; tier++) {
    const by = p.y - s * .4 - tier * s * .62, wdt = s * (.85 - tier * .17), ht = s * 1.05;
    ctx.fillStyle = `rgb(${22 + g},${62 + g},${36})`;
    ctx.beginPath(); ctx.moveTo(p.x - wdt, by); ctx.lineTo(p.x, by - ht); ctx.lineTo(p.x + wdt, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,100,.3)';
    ctx.beginPath(); ctx.moveTo(p.x - wdt * .75, by - 1); ctx.lineTo(p.x, by - ht); ctx.lineTo(p.x - wdt * .1, by - 1); ctx.closePath(); ctx.fill();
  }
}

function villager(ctx, p, k, kind, tint) {
  const s = k * 1.1;
  ctx.fillStyle = 'rgba(15,25,5,.3)';
  ctx.beginPath(); ctx.ellipse(p.x + 1.2 * s, p.y + .3 * s, 2.6 * s, 1 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a2018'; ctx.lineWidth = .9 * s;
  ctx.beginPath(); ctx.moveTo(p.x - .7 * s, p.y - 2.5 * s); ctx.lineTo(p.x - .9 * s, p.y); ctx.moveTo(p.x + .7 * s, p.y - 2.5 * s); ctx.lineTo(p.x + .9 * s, p.y); ctx.stroke();
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.moveTo(p.x - 2 * s, p.y - 2 * s); ctx.lineTo(p.x + 2 * s, p.y - 2 * s); ctx.lineTo(p.x + 1.3 * s, p.y - 6 * s); ctx.lineTo(p.x - 1.3 * s, p.y - 6 * s); ctx.closePath(); ctx.fill();
  ctx.lineWidth = .4 * s; ctx.stroke();
  ctx.fillStyle = '#d9a982';
  ctx.beginPath(); ctx.arc(p.x, p.y - 7.3 * s, 1.35 * s, 0, TAU); ctx.fill();
  if (kind === 'soldier') {
    ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(p.x, p.y - 7.7 * s, 1.5 * s, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = .7 * s;
    ctx.beginPath(); ctx.moveTo(p.x + 2.4 * s, p.y); ctx.lineTo(p.x + 2.4 * s, p.y - 12 * s); ctx.stroke();
    ctx.fillStyle = '#c9ced4'; ctx.beginPath(); ctx.moveTo(p.x + 2.4 * s, p.y - 14 * s); ctx.lineTo(p.x + 1.7 * s, p.y - 12 * s); ctx.lineTo(p.x + 3.1 * s, p.y - 12 * s); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#7a5a32'; ctx.fillRect(p.x - 1.7 * s, p.y - 8.8 * s, 3.4 * s, .9 * s);
    if (kind === 'carry') { ctx.fillStyle = '#c8a86a'; ctx.beginPath(); ctx.ellipse(p.x - 2.3 * s, p.y - 5 * s, 1.5 * s, 2 * s, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5a4022'; ctx.lineWidth = .4 * s; ctx.stroke(); }
    if (kind === 'wood') { ctx.fillStyle = '#7a5130'; ctx.fillRect(p.x - 3.4 * s, p.y - 7 * s, 6.8 * s, 1.4 * s); }
  }
}

function sheep(ctx, p, k, facing) {
  const s = k;
  ctx.fillStyle = 'rgba(15,25,5,.28)'; ctx.beginPath(); ctx.ellipse(p.x + 1 * s, p.y + .3 * s, 3 * s, 1 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a2420'; ctx.lineWidth = .7 * s;
  ctx.beginPath(); for (const dx of [-1.4, -.5, .6, 1.5]) { ctx.moveTo(p.x + dx * s, p.y - 1 * s); ctx.lineTo(p.x + dx * s, p.y); } ctx.stroke();
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 2.4 * s, 2.7 * s, 1.8 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,70,60,.6)'; ctx.lineWidth = .4 * s; ctx.stroke();
  ctx.fillStyle = '#2f2a26'; ctx.beginPath(); ctx.ellipse(p.x + facing * 2.6 * s, p.y - 2.8 * s, 1 * s, .8 * s, 0, 0, TAU); ctx.fill();
}

function collectSprites(m, v) {
  const { pal, K, project } = v, out = [];
  const r = mulberry(m.paperSeed ^ 0x3e11);
  const add = (world, draw, bias = 0) => { const p = project(world.x, world.y); out.push({ y: p.y + bias, p, draw }); };

  for (const h of m.houses) {
    const { H, roofH } = houseDims(h), k = hashStr(h.word);
    const wall = WALLS[k % WALLS.length];
    const roof = h.type === 'tavern' ? '#6e2f1c' : ROOFS[(k >>> 4) % ROOFS.length];
    add(h, ctx => {
      Raised.block(ctx, pal, h.x, h.y, h.w, h.h, h.a, H * K, roofH * K, wall, roof, { chimney: (k & 3) === 0, timber: (k & 8) ? '#5a3e24' : null });
      if (h.type === 'tavern') { const p = project(h.x, h.y); Raised.flag(ctx, pal, p.x + 4 * K, p.y - (H + roofH) * K, TEAM); }
    });
  }

  // trees from the town model, plus deep woods beyond the map's edge
  const trees = m.trees.map(t => ({ ...t }));
  const rr = mulberry(m.paperSeed ^ 0x9f0e);
  for (let i = 0; i < 2600; i++) {
    const x = -700 + rr() * 2600, y = -700 + rr() * 2600;
    if (x > 10 && y > 10 && x < WORLD - 10 && y < WORLD - 10) continue;
    if (!onScreen(project(x, y), 30)) continue;
    if ((Math.sin(x * .013) + Math.cos(y * .011) + Math.sin((x + y) * .007)) < -0.2) continue; // leave glades
    trees.push({ x, y, r: 6 + rr() * 5, shade: rr() });
  }
  for (const t of trees) {
    const conif = t.shade > 0.55, s = t.r * K * 0.95;
    add(t, ctx => { const p = project(t.x, t.y); (conif ? conifer : broadleaf)(ctx, p, s, t.shade); });
  }

  // market stalls with team-coloured awnings, and the well
  if (m.market) {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + .2, d = m.plazaR * .64, w = { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d };
      add(w, ctx => Raised.block(ctx, pal, w.x, w.y, 10, 7, a + Math.PI / 2, 4 * K, 3 * K, '#8d6338', i % 2 ? TEAM : '#e8e0cc', { door: false }));
    }
  }
  add({ x: CX, y: CY }, ctx => {
    Raised.tower(ctx, pal, CX, CY, 6 * K, 5 * K, null);
    const p = project(CX, CY);
    ctx.fillStyle = '#2f7898'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 5 * K, 3.6 * K, 1.6 * K, 0, 0, TAU); ctx.fill();
  });

  for (const sp of m.specials) {
    if (sp.kind === 'castle') add(sp, ctx => Raised.castle(ctx, pal, sp), 40 * K);
    else if (sp.kind === 'cathedral' || sp.kind === 'chapel') add(sp, ctx => Raised.cathedral(ctx, pal, sp), 10 * K);
    else if (sp.kind === 'mill') add(sp, ctx => Raised.mill(ctx, pal, sp));
  }
  if (m.walls) {
    const pts = m.walls.pts, n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      add({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ctx => Raised.wallSegment(ctx, pal, a, b), -0.5);
      if (i % 2 === 0) add(a, ctx => Raised.tower(ctx, pal, a.x, a.y, 8 * K, 26 * K, TEAM_DARK), 0.5);
    }
    for (const g of m.walls.gates) {
      add(g, ctx => Raised.gate(ctx, pal, g), 6 * K);
      for (const side of [-1, 1]) { // a guard either side of the gate
        const w = { x: g.x + Math.cos(g.a) * 14 - Math.sin(g.a) * side * (g.w / 2 + 2), y: g.y + Math.sin(g.a) * 14 + Math.cos(g.a) * side * (g.w / 2 + 2) };
        add(w, ctx => villager(ctx, project(w.x, w.y), K, 'soldier', TEAM));
      }
    }
  }

  // villagers going about their work along the streets
  const streets = m.roads.flatMap(rd => rd.pts.slice(0, -1).map((p, i) => ({ p, q: rd.pts[i + 1], w: rd.w })))
    .filter(s => s.p.d > m.plazaR + 4 && onScreen(project(s.p.x, s.p.y), -20));
  const n = clamp(m.parsed.content.length * 0.9, 12, 130);
  const jobs = ['walk', 'carry', 'carry', 'wood', 'walk'];
  for (let i = 0; i < n && streets.length; i++) {
    const s = streets[Math.floor(r() * streets.length)], t = r(), off = (r() - .5) * s.w * .5;
    const a = Math.atan2(s.q.y - s.p.y, s.q.x - s.p.x);
    const w = { x: s.p.x + (s.q.x - s.p.x) * t - Math.sin(a) * off, y: s.p.y + (s.q.y - s.p.y) * t + Math.cos(a) * off };
    const job = jobs[Math.floor(r() * jobs.length)], tint = r() < .75 ? TEAM : '#8a6a44';
    add(w, ctx => villager(ctx, project(w.x, w.y), K, job, tint));
  }
  for (let i = 0; i < 8; i++) { // folk in the square
    const a = r() * TAU, d = m.plazaR * (.3 + r() * .55), w = { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d };
    add(w, ctx => villager(ctx, project(w.x, w.y), K, 'walk', TEAM));
  }
  // flocks in some of the fields
  m.fields.forEach((f, i) => {
    if (i % 3 !== 1) return;
    const c = Math.cos(f.a), s = Math.sin(f.a);
    for (let j = 0; j < 3; j++) {
      const u = (r() - .5) * f.w * .6, vv = (r() - .5) * f.h * .5, facing = r() < .5 ? -1 : 1;
      const w = { x: f.x + u * c - vv * s, y: f.y + u * s + vv * c };
      if (onScreen(project(w.x, w.y))) add(w, ctx => sheep(ctx, project(w.x, w.y), K, facing));
    }
  });
  return out.filter(o => onScreen(o.p, 140)).sort((a, b) => a.y - b.y);
}

// ---------- labels, minimap and frame ----------
function drawLabel(ctx, l, v) {
  const p = v.project(l.x, l.y);
  ctx.save();
  ctx.translate(p.x, p.y - 10);
  if (l.angle) {
    const d = v.projectVec(Math.cos(l.angle), Math.sin(l.angle));
    let a = Math.atan2(d.y, d.x);
    if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
    ctx.rotate(a);
  }
  ctx.font = `700 ${Math.round(l.size * 1.05)}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,12,8,.85)'; ctx.lineWidth = 4; ctx.strokeText(l.text, 0, 0);
  ctx.fillStyle = l.color ? '#d2ecff' : '#ffffff'; ctx.fillText(l.text, 0, 0);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(22,26,30,.86)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8f98a3'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
}

function drawMinimap(ctx, m, v) {
  const W = 236, H = 150, x0 = WORLD - W - 18, y0 = WORLD - H - 18;
  panel(ctx, x0, y0, W, H);
  const s = 0.088, cx = x0 + W / 2, cy = y0 + 22;
  const mp = (x, y) => ({ x: cx + (x - y) * s, y: cy + (x + y) * s * .5 });
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + 5, y0 + 5, W - 10, H - 10); ctx.clip();
  fillPoly(ctx, [mp(0, 0), mp(WORLD, 0), mp(WORLD, WORLD), mp(0, WORLD)], '#4d7a30', null);
  ctx.save(); ctx.translate(cx, cy); ctx.transform(s, s / 2, -s, s / 2, 0, 0);
  for (const f of m.fields) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.fillStyle = '#c3a64e'; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore(); }
  ctx.fillStyle = '#2b5a1c'; for (const t of m.trees) ctx.fillRect(t.x - 5, t.y - 5, 10, 10);
  ctx.lineCap = ctx.lineJoin = 'round';
  if (m.river) { poly(ctx, m.river.pts); ctx.strokeStyle = '#3f8fb5'; ctx.lineWidth = m.river.w + 6; ctx.stroke(); }
  ctx.strokeStyle = '#c2a675'; ctx.lineWidth = 12;
  for (const r of m.roads) if (r.kind !== 'lane') { poly(ctx, r.pts, r.closed); ctx.stroke(); }
  if (m.walls) { poly(ctx, m.walls.pts, true); ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 12; ctx.stroke(); }
  ctx.fillStyle = TEAM_LIGHT; for (const h of m.houses) ctx.fillRect(h.x - 9, h.y - 9, 18, 18);
  ctx.fillStyle = '#ffffff'; for (const sp of m.specials) ctx.fillRect(sp.x - 20, sp.y - 20, 40, 40);
  ctx.restore();
  // what the main view currently shows
  const corners = [[0, 0], [WORLD, 0], [WORLD, WORLD], [0, WORLD]].map(([sx, sy]) => { const w = v.unproject(sx, sy); return mp(w.x, w.y); });
  fillPoly(ctx, corners, null, '#ffffff', 1.4);
  ctx.restore();
}

function drawHud(ctx, m) {
  ctx.font = `700 30px ${FONT}`;
  const w = Math.max(ctx.measureText(m.name).width + 48, 260);
  panel(ctx, 18, 18, w, 84);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff'; ctx.fillText(m.name, 42, 58);
  ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#b9c4d0';
  ctx.fillText(`${m.houses.length} BUILDINGS   ${m.population} VILLAGERS`, 42, 84);
  ctx.fillStyle = TEAM; ctx.fillRect(26, 30, 6, 64); // team colour stripe
}

function render(ctx, m) {
  const v = viewFor(m);
  drawGround(ctx, m, v);
  for (const s of collectSprites(m, v)) s.draw(ctx);
  for (const l of m.labels) drawLabel(ctx, l, v);
  const vg = ctx.createRadialGradient(CX, CY, 450, CX, CY, 900);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, WORLD, WORLD);
  drawHud(ctx, m);
  drawMinimap(ctx, m, v);
}

// hover: an RTS selection ring under the building, plus its outline
function highlight(ctx, m, h, isPrimary) {
  const v = viewFor(m), { H, roofH } = houseDims(h), p = v.project(h.x, h.y);
  const rx = Math.max(h.w, h.h) * v.K * 0.85;
  ctx.save();
  ctx.strokeStyle = isPrimary ? '#ffffff' : '#bdf5a8'; ctx.lineWidth = isPrimary ? 2 : 1.5;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, rx * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  if (isPrimary) Raised.highlightHouse(ctx, v.pal, h, { H: H * v.K, roofH: roofH * v.K }, true);
}

function pick(m, x, y) {
  const v = viewFor(m);
  for (const lift of [16, 11, 6, 0]) { // roofs sit above their footprints on screen
    const w = v.unproject(x, y + lift * v.K);
    const h = houseAt(m, w.x, w.y);
    if (h) return h;
  }
  return null;
}

registerStyle({
  id: 'conquest',
  label: 'Conquest',
  fonts: [`700 30px "Cinzel"`],
  render, highlight, pick,
});
})();
