'use strict';
/* Shared drawing kit for "raised" styles: map styles that show buildings as 3D
 * blocks seen from a high three-quarter view (Adventure, Bruegel, ...).
 *
 * Nothing here has colours of its own: every function takes a palette `pal`
 * (see Raised.basePalette for the keys), so each style keeps its own look. */
const Raised = (() => {
const LIGHT = { x: -0.6, y: -0.8 }; // light comes from the upper left
const TAU = Math.PI * 2;

const basePalette = {
  outline: '#1d140b', lineWidth: 0.9,
  shadow: 'rgba(20,30,10,.28)', wallShadow: 'rgba(20,30,10,.25)',
  door: '#3a2414', window: '#2b2f3a', chimney: '#7d6b5a', ridgeLight: 1.35,
  stone: ['#d8cdb8', '#bdb09a', '#7f7462'],          // tower gradient: lit, mid, shaded
  towerCourses: 'rgba(40,30,20,.25)', towerTop: ['#cfc3ad', '#8c806b'], coneGloss: 'rgba(255,255,255,.18)',
  wallFace: '#b9ad96', wallCourses: 'rgba(60,45,30,.3)', wallWalk: '#d6cab2', merlons: '#8f846f', wallH: 15,
  wallTowerRoof: '#2f5ea8', gateTowerRoof: '#a93226', gateStone: '#b9ad96', gateDark: '#1d140b',
  castleYard: '#b9a57a', castleTowerRoof: '#c0392b', castleFlag: '#e2b84a', keep: '#c9bda5', keepFlag: '#c0392b',
  hallWall: '#ddd0b4', hallRoof: '#2f5ea8',
  churchStone: '#e2d9c6', churchTower: '#d6cbb4', churchRoof: '#45597a', cross: '#f0c75e',
  millRoof: '#8f4a2c', millSail: '#f2ead6', millHub: '#5a3a1c',
  highlight: ['#fff6c8', '#ffd24a', '#ffe27a'],       // primary, others, glow
};
const palette = overrides => ({ ...basePalette, ...overrides });

// ---------- colour & path helpers ----------
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function shade(hex, f) { // f < 1 darkens, f > 1 lightens toward white
  const c = rgb(hex).map(v => Math.round(f >= 1 ? v + (255 - v) * Math.min(f - 1, 1) : v * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function fillPoly(ctx, pts, fill, stroke, lw = 0.9) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function smoothClosed(ctx, pts) {
  ctx.beginPath();
  const n = pts.length, mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const s = mid(pts[n - 1], pts[0]);
  ctx.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
  ctx.closePath();
}
function convexHull(points) {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// ---------- the 3D block: an oriented box with an optional hip roof ----------
// (x, y) is the footprint centre on the ground; H is wall height; roofH the
// ridge height above the walls (0 = flat crenellated top).
function block(ctx, pal, x, y, w, h, a, H, roofH, wallCol, roofCol, opts = {}) {
  const OUT = pal.outline, LW = pal.lineWidth;
  if (h > w) { [w, h] = [h, w]; a += Math.PI / 2; }
  const c = Math.cos(a), s = Math.sin(a);
  const P = (u, v, z) => ({ x: x + u * c - v * s, y: y + u * s + v * c - z });
  const hw = w / 2, hh = h / 2;
  const base = [P(-hw, -hh, 0), P(hw, -hh, 0), P(hw, hh, 0), P(-hw, hh, 0)];

  // cast shadow toward the lower right
  if (!opts.noShadow) {
    const sx = H * 0.55 + 2, sy = H * 0.3 + 2;
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    base.forEach((p, i) => (i ? ctx.lineTo(p.x + sx, p.y + sy) : ctx.moveTo(p.x + sx, p.y + sy)));
    ctx.closePath(); ctx.fill();
  }

  // walls that face the viewer (outward normal pointing down the screen)
  let doorWall = null;
  for (let i = 0; i < 4; i++) {
    const p = base[i], q = base[(i + 1) % 4];
    const ex = q.x - p.x, ey = q.y - p.y, L = Math.hypot(ex, ey) || 1;
    const nx = ey / L, ny = -ex / L;
    if (ny <= 0.02) continue;
    const quad = [p, q, { x: q.x, y: q.y - H }, { x: p.x, y: p.y - H }];
    fillPoly(ctx, quad, shade(wallCol, 0.92 - 0.22 * nx), OUT, LW);
    if (opts.timber && H >= 6) { // half-timbering: posts and a rail
      ctx.strokeStyle = opts.timber; ctx.lineWidth = LW * 0.9;
      ctx.beginPath();
      const posts = Math.max(2, Math.round(L / 6));
      for (let k = 1; k < posts; k++) {
        const t = k / posts;
        ctx.moveTo(p.x + ex * t, p.y + ey * t); ctx.lineTo(p.x + ex * t, p.y + ey * t - H);
      }
      ctx.moveTo(p.x, p.y - H * 0.5); ctx.lineTo(q.x, q.y - H * 0.5);
      ctx.stroke();
    }
    if (!doorWall || ny > doorWall.ny) doorWall = { p, q, ny, L };
  }
  // a door and windows on the most viewer-facing wall
  if (doorWall && opts.door !== false && H >= 5) {
    const { p, q, L } = doorWall;
    const at = t => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const d = at(0.5);
    ctx.fillStyle = pal.door;
    ctx.fillRect(d.x - 1.6, d.y - Math.min(H * 0.7, 6), 3.2, Math.min(H * 0.7, 6));
    if (L > 16 && H > 6) {
      ctx.fillStyle = pal.window;
      for (const t of [0.2, 0.8]) { const wpt = at(t); ctx.fillRect(wpt.x - 1.2, wpt.y - H * 0.75, 2.4, 2.4); }
    }
  }

  const top = base.map(p => ({ x: p.x, y: p.y - H }));
  if (roofH <= 0) {
    // flat top with crenellations
    fillPoly(ctx, top, shade(wallCol, 1.06), OUT, 1);
    if (opts.crenel !== false) {
      ctx.fillStyle = shade(wallCol, 0.7);
      for (let i = 0; i < 4; i++) {
        const p = top[i], q = top[(i + 1) % 4], L = Math.hypot(q.x - p.x, q.y - p.y), n = Math.max(2, Math.floor(L / 5));
        for (let k = 0; k <= n; k += 2) {
          const t = k / n;
          ctx.fillRect(p.x + (q.x - p.x) * t - 1.5, p.y + (q.y - p.y) * t - 3, 3, 3);
        }
      }
    }
    return top;
  }

  // hip roof with a little overhang; faces drawn back to front
  const o = 1.6;
  const T = [P(-hw - o, -hh - o, H), P(hw + o, -hh - o, H), P(hw + o, hh + o, H), P(-hw - o, hh + o, H)];
  const rl = Math.max(0, hw - hh);
  const R1 = P(-rl, 0, H + roofH), R2 = P(rl, 0, H + roofH);
  const faces = [
    { pts: [T[0], T[1], R2, R1], n: [0, -1] },
    { pts: [T[1], T[2], R2], n: [1, 0] },
    { pts: [T[2], T[3], R1, R2], n: [0, 1] },
    { pts: [T[3], T[0], R1], n: [-1, 0] },
  ].map(f => {
    const nx = f.n[0] * c - f.n[1] * s, ny = f.n[0] * s + f.n[1] * c;
    return { ...f, nx, ny };
  }).sort((f, g) => f.ny - g.ny);
  for (const f of faces) {
    const lit = 0.82 + 0.3 * (-(f.nx * LIGHT.x + f.ny * LIGHT.y));
    fillPoly(ctx, f.pts, shade(roofCol, lit), OUT, LW);
  }
  if (opts.eaves) { // a dark line under the eaves (e.g. under snow)
    ctx.strokeStyle = opts.eaves; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(T[2].x, T[2].y); ctx.lineTo(T[3].x, T[3].y); ctx.stroke();
  }
  if (rl > 0) {
    ctx.strokeStyle = shade(roofCol, pal.ridgeLight); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(R1.x, R1.y); ctx.lineTo(R2.x, R2.y); ctx.stroke();
  }
  if (opts.chimney) {
    const ch = P(rl * 0.6, -hh * 0.35, H + roofH * 0.75);
    ctx.fillStyle = pal.chimney; ctx.strokeStyle = OUT; ctx.lineWidth = .8;
    ctx.fillRect(ch.x - 1.5, ch.y - 5, 3, 5); ctx.strokeRect(ch.x - 1.5, ch.y - 5, 3, 5);
    if (opts.smoke) {
      ctx.strokeStyle = opts.smoke; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ch.x, ch.y - 6);
      ctx.bezierCurveTo(ch.x - 3, ch.y - 10, ch.x + 3, ch.y - 13, ch.x - 1, ch.y - 18);
      ctx.stroke();
    }
  }
  return top;
}

// a round tower with a conical roof; (x, y) is the base centre
function tower(ctx, pal, x, y, r, H, roofCol, opts = {}) {
  const OUT = pal.outline;
  const ry = r * 0.45;
  ctx.fillStyle = pal.shadow;
  ctx.beginPath(); ctx.ellipse(x + H * 0.45, y + H * 0.22, r + 1, ry + 2, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, pal.stone[0]); g.addColorStop(0.45, pal.stone[1]); g.addColorStop(1, pal.stone[2]);
  ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r, y - H);
  ctx.lineTo(x - r, y);
  ctx.ellipse(x, y, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + r, y - H);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // stone courses
  ctx.strokeStyle = pal.towerCourses; ctx.lineWidth = .7;
  for (let z = 6; z < H - 2; z += 6) { ctx.beginPath(); ctx.ellipse(x, y - z, r, ry, 0, 0, Math.PI); ctx.stroke(); }
  // window slit
  ctx.fillStyle = pal.window; ctx.fillRect(x - 1, y - H * 0.6, 2, 4);
  if (roofCol) {
    const ro = r + 2.5, apex = H + r * (opts.steep || 1.9);
    ctx.fillStyle = shade(roofCol, 1); ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - ro, y - H);
    ctx.lineTo(x, y - apex);
    ctx.lineTo(x + ro, y - H);
    ctx.ellipse(x, y - H, ro, ry + 1, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.coneGloss;
    ctx.beginPath(); ctx.moveTo(x - ro * 0.6, y - H - 1); ctx.lineTo(x, y - apex); ctx.lineTo(x - ro * 0.1, y - H + ry * 0.8); ctx.closePath(); ctx.fill();
    if (opts.flag) flag(ctx, pal, x, y - apex, opts.flag);
  } else {
    ctx.fillStyle = pal.towerTop[0];
    ctx.beginPath(); ctx.ellipse(x, y - H, r, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.towerTop[1];
    ctx.beginPath(); ctx.ellipse(x, y - H, r * 0.6, ry * 0.6, 0, 0, TAU); ctx.fill();
  }
}

function flag(ctx, pal, x, y, color) {
  ctx.strokeStyle = pal.outline; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 6, y - 13, x + 11, y - 9); ctx.lineTo(x, y - 7); ctx.closePath();
  ctx.fill(); ctx.stroke();
}

// ---------- town structures ----------
function wallSegment(ctx, pal, a, b) {
  const WALL_H = pal.wallH, OUT = pal.outline;
  const ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1;
  const nx = ey / L;
  const quad = [a, b, { x: b.x, y: b.y - WALL_H }, { x: a.x, y: a.y - WALL_H }];
  ctx.fillStyle = pal.wallShadow;
  ctx.beginPath(); ctx.moveTo(a.x + 6, a.y + 4); ctx.lineTo(b.x + 6, b.y + 4); ctx.lineTo(b.x + 9, b.y + 9); ctx.lineTo(a.x + 9, a.y + 9); ctx.closePath(); ctx.fill();
  fillPoly(ctx, quad, shade(pal.wallFace, 0.95 - 0.15 * nx), OUT, 1);
  // masonry courses
  ctx.strokeStyle = pal.wallCourses; ctx.lineWidth = .7;
  for (const z of [5, 10]) { ctx.beginPath(); ctx.moveTo(a.x, a.y - z); ctx.lineTo(b.x, b.y - z); ctx.stroke(); }
  // wall-walk and merlons
  ctx.lineCap = 'butt';
  ctx.strokeStyle = OUT; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(a.x, a.y - WALL_H); ctx.lineTo(b.x, b.y - WALL_H); ctx.stroke();
  ctx.strokeStyle = pal.wallWalk; ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = pal.merlons; ctx.lineWidth = 3; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y - WALL_H - 2.5); ctx.lineTo(b.x, b.y - WALL_H - 2.5); ctx.stroke();
  ctx.setLineDash([]); ctx.lineCap = 'round';
}

function gate(ctx, pal, g) {
  const px = -Math.sin(g.a), py = Math.cos(g.a), s = g.w / 2 + 8;
  const towers = [{ x: g.x + px * s, y: g.y + py * s }, { x: g.x - px * s, y: g.y - py * s }].sort((a, b) => a.y - b.y);
  tower(ctx, pal, towers[0].x, towers[0].y, 7.5, 26, pal.gateTowerRoof);
  block(ctx, pal, g.x, g.y, 12, g.w + 10, g.a, 20, 0, pal.gateStone, null, { door: false });
  ctx.fillStyle = pal.gateDark;
  ctx.beginPath(); ctx.ellipse(g.x, g.y - 2, g.w * 0.35, 9, 0, Math.PI, 0); ctx.lineTo(g.x + g.w * .35, g.y + 1); ctx.lineTo(g.x - g.w * .35, g.y + 1); ctx.closePath(); ctx.fill();
  tower(ctx, pal, towers[1].x, towers[1].y, 7.5, 26, pal.gateTowerRoof);
}

function castle(ctx, pal, sp) {
  const c = Math.cos(sp.a), s = Math.sin(sp.a), half = 46;
  const P = (u, v) => ({ x: sp.x + u * c - v * s, y: sp.y + u * s + v * c });
  const corners = [P(-half, -half), P(half, -half), P(half, half), P(-half, half)];
  fillPoly(ctx, corners, pal.castleYard, pal.outline, 1); // courtyard
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    parts.push({ y: (a.y + b.y) / 2 - 1, draw: () => wallSegment(ctx, pal, a, b) });
    parts.push({ y: a.y + 1, draw: () => tower(ctx, pal, a.x, a.y, 12, 36, pal.castleTowerRoof, { flag: pal.castleFlag }) });
  }
  const keep = P(10, -6), hall = P(-20, 22), gateP = P(-half, 0);
  parts.push({ y: keep.y, draw: () => {
    block(ctx, pal, keep.x, keep.y, 38, 38, sp.a, 42, 0, pal.keep, null, { door: true });
    flag(ctx, pal, keep.x, keep.y - 46, pal.keepFlag);
  } });
  parts.push({ y: hall.y, draw: () => block(ctx, pal, hall.x, hall.y, 30, 14, sp.a, 14, 9, pal.hallWall, pal.hallRoof, {}) });
  parts.push({ y: gateP.y + 2, draw: () => block(ctx, pal, gateP.x, gateP.y, 14, 22, sp.a, 24, 0, pal.gateStone, null, {}) });
  parts.sort((a, b) => a.y - b.y).forEach(p => p.draw());
}

function cathedral(ctx, pal, sp) {
  const k = sp.k || 1, c = Math.cos(sp.a), s = Math.sin(sp.a);
  const P = (u, v) => ({ x: sp.x + (u * c - v * s) * k, y: sp.y + (u * s + v * c) * k });
  const stone = pal.churchStone, slate = pal.churchRoof;
  const parts = [
    { at: P(2, 0), draw: q => block(ctx, pal, q.x, q.y, 74 * k, 22 * k, sp.a, 22 * k, 13 * k, stone, slate, {}) },
    { at: P(14, 0), draw: q => block(ctx, pal, q.x, q.y, 50 * k, 20 * k, sp.a + Math.PI / 2, 22 * k, 12 * k, stone, slate, { door: false, noShadow: true }) },
    { at: P(42, 0), draw: q => block(ctx, pal, q.x, q.y, 14 * k, 18 * k, sp.a, 18 * k, 9 * k, stone, slate, { door: false }) },
    { at: P(-41, 0), draw: q => block(ctx, pal, q.x, q.y, 18 * k, 18 * k, sp.a, 52 * k, 26 * k, pal.churchTower, slate, {}) },
  ];
  parts.sort((a, b) => a.at.y - b.at.y).forEach(p => p.draw(p.at));
  // cross on the spire
  const t = P(-41, 0), top = t.y - (52 + 26) * k;
  ctx.strokeStyle = pal.cross; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(t.x, top); ctx.lineTo(t.x, top - 8); ctx.moveTo(t.x - 3, top - 5.5); ctx.lineTo(t.x + 3, top - 5.5); ctx.stroke();
}

function mill(ctx, pal, sp) {
  tower(ctx, pal, sp.x, sp.y, 9, 26, pal.millRoof);
  const hx = sp.x, hy = sp.y - 22;
  ctx.save(); ctx.translate(hx, hy + 4); ctx.rotate(sp.sail);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = pal.millSail; ctx.strokeStyle = pal.outline; ctx.lineWidth = .9;
    ctx.fillRect(2, -3, 22, 6); ctx.strokeRect(2, -3, 22, 6);
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(24, 0); ctx.stroke();
  }
  ctx.fillStyle = pal.millHub; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- hover support ----------
// outline the silhouette of a raised house (dims: { H, roofH })
function highlightHouse(ctx, pal, h, dims, isPrimary) {
  const { H, roofH } = dims;
  ctx.save();
  ctx.shadowColor = pal.highlight[2]; ctx.shadowBlur = isPrimary ? 10 : 6;
  ctx.strokeStyle = isPrimary ? pal.highlight[0] : pal.highlight[1];
  ctx.lineWidth = isPrimary ? 2.5 : 1.8;
  const c = Math.cos(h.a), s = Math.sin(h.a), hw = h.w / 2 + 2, hh = h.h / 2 + 2;
  const P = (u, v, z) => ({ x: h.x + u * c - v * s, y: h.y + u * s + v * c - z });
  const z = H + roofH * .5;
  const hull = convexHull([P(-hw, -hh, 0), P(hw, -hh, 0), P(hw, hh, 0), P(-hw, hh, 0), P(-hw, -hh, z), P(hw, -hh, z), P(hw, hh, z), P(-hw, hh, z)]);
  ctx.beginPath();
  hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// buildings are drawn raised, so hit-test the roof first, then the footprint
function pickRaised(m, x, y, lift = 9) {
  return houseAt(m, x, y + lift) || houseAt(m, x, y);
}

return {
  basePalette, palette, rgb, shade, fillPoly, smoothClosed, convexHull,
  block, tower, flag, wallSegment, gate, castle, cathedral, mill,
  highlightHouse, pickRaised,
};
})();
