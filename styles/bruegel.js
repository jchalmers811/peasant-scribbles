/* Bruegel style: the town as a 16th-century Flemish peasant painting, seen
 * from the high viewpoint of Bruegel the Elder's village scenes. Earth
 * ochres, olive greens, grey-blue distance, and crowds of small figures in
 * red, white and black. Texts that mention winter become a snow scene; all
 * others become a late-summer harvest. Buildings come from styles/raised.js. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const FONT = '"IM Fell English", Georgia, serif';
const FONT_SC = '"IM Fell English SC", Georgia, serif';
const { shade, fillPoly, smoothClosed } = Raised;

const WINTER_WORDS = ['snow', 'winter', 'cold', 'ice', 'icy', 'frost', 'frozen', 'freez', 'skate', 'sled', 'december', 'january', 'february', 'christmas', 'chill', 'bitter', 'blizzard'];

const COMMON = {
  outline: '#2a1e14', lineWidth: 0.6, shadow: 'rgba(40,28,14,.22)', wallShadow: 'rgba(40,28,14,.2)',
  door: '#2a1e14', window: '#2a2420', chimney: '#6e5e4c', ridgeLight: 1.15,
  stone: ['#c9bea6', '#a89d86', '#6f6656'], towerCourses: 'rgba(40,30,20,.18)',
  towerTop: ['#b9ae98', '#7d7364'], coneGloss: 'rgba(255,255,255,.08)',
  wallFace: '#a89c84', wallCourses: 'rgba(50,40,28,.25)', wallWalk: '#c4b89c', merlons: '#7f7562',
  wallTowerRoof: '#4e5452', gateTowerRoof: '#5a3f2c', gateStone: '#a89c84', gateDark: '#1e1610',
  castleYard: '#9c8a62', castleTowerRoof: '#4e5452', castleFlag: '#9a2e22', keep: '#b7ab92', keepFlag: '#9a2e22',
  hallWall: '#d2c4a4', hallRoof: '#8f3d25',
  churchStone: '#cfc3a8', churchTower: '#bfb398', churchRoof: '#4f5755', cross: '#b08d3e',
  millRoof: '#6b4a2e', millSail: '#e3d9c2', millHub: '#3a2a1c',
  highlight: ['#fff2c0', '#f0cf6a', '#ffe7a0'],
};
const SNOW = '#e8e6df';

const SEASONS = {
  summer: {
    pal: Raised.palette(COMMON),
    ground: '#7c7c46',
    patches: ['#5f6e36', '#6f7a3e', '#8a8a4c', '#a8914f', '#4f5f30', '#b39a58', '#728046'],
    strokes: ['#8f8a50', '#6f7442', '#5e6a38', '#a8925a', '#55623a', '#7f7a46', '#bba062', '#4c5a34'],
    town: 'rgba(120,92,56,.38)',
    road: ['#5a4128', '#8a6a42', '#a0815a'],
    river: [['#8b7c52', 12], ['#3f5248', 4], ['#56706a', 0], ['#6f8a80', -0.5]],
    walls: ['#d6c7a4', '#cbb995', '#bfae8a', '#ddd0b2', '#b9a888'],
    roofs: ['#8f6d3c', '#a07c45', '#7e5f34', '#93402a', '#7d3a26', '#5b5f5c', '#9a7848', '#86603a'],
    tavernRoof: '#6a2a1a',
    haze: [150, 170, 168], hazeAlpha: .5, varnish: '#f5e8c8',
    people: ['#9a2e22', '#e9e1cf', '#2b2622', '#4f5d6b', '#b8893e', '#6b4a2e', '#9a2e22', '#e9e1cf'],
  },
  winter: {
    pal: Raised.palette({
      ...COMMON, castleYard: '#e2e0d8', wallWalk: '#eceae3',
      wallTowerRoof: SNOW, gateTowerRoof: SNOW, castleTowerRoof: SNOW, churchRoof: SNOW, millRoof: SNOW, hallRoof: SNOW,
      towerTop: ['#eceae3', '#bdb8ac'], ridgeLight: 1.0,
    }),
    ground: '#e8e8e2',
    patches: ['#f4f4f0', '#dfe1dc', '#d4d8d2', '#eeeee8', '#c9cbc2'],
    strokes: ['#f3f3ef', '#dcdfd9', '#cfd4ce', '#fbfbf8', '#c4c4ba', '#e6e6e0'],
    town: 'rgba(165,155,140,.30)',
    road: ['#8f877a', '#c9c2b5', '#a39a8b'],
    river: [['#cfccc2', 12], ['#7d8c86', 4], ['#9fb0aa', 0], ['#b9c8c3', -0.6]],
    walls: ['#cdbf9f', '#c2b292', '#b5a487', '#d4c7aa', '#ad9d80'],
    roofs: [SNOW, '#e3e1d9', '#efeee8'],
    tavernRoof: '#e0ddd4',
    haze: [140, 165, 155], hazeAlpha: .55, varnish: '#f8f5ec',
    people: ['#2b2622', '#3d3631', '#9a2e22', '#5a4a3a', '#e9e1cf', '#2b2622', '#4f5d6b'],
  },
};

function seasonOf(m) {
  return m.parsed.content.some(w => matchesRoot(w, WINTER_WORDS)) ? 'winter' : 'summer';
}
const seeded = (x, y) => mulberry((Math.floor(x * 31) * 73856093) ^ (Math.floor(y * 17) * 19349663));

// ---------- painted ground ----------
function brushStrokes(ctx, r, n, colors, minL, maxL, alpha) {
  for (let i = 0; i < n; i++) {
    const x = r() * WORLD, y = r() * WORLD, len = minL + r() * (maxL - minL);
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.beginPath(); ctx.ellipse(x, y, len, len * (0.18 + r() * 0.15), (r() - 0.5) * 0.9, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGround(ctx, m, S) {
  const r = mulberry(m.paperSeed ^ 0x1569);
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, WORLD, WORLD);
  // broad patches of meadow and earth, then layers of brushwork on top
  for (let i = 0; i < 140; i++) {
    const x = r() * WORLD, y = r() * WORLD, rad = 50 + r() * 160;
    const [cr, cg, cb] = Raised.rgb(S.patches[Math.floor(r() * S.patches.length)]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},.6)`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  brushStrokes(ctx, r, 1400, S.strokes, 18, 60, 0.3);
  brushStrokes(ctx, r, 5000, S.strokes, 4, 14, 0.4);
  if (m.houses.length) { // trodden ground under the town, with soft edges
    ctx.save();
    ctx.filter = 'blur(14px)';
    smoothClosed(ctx, m.outline);
    ctx.fillStyle = S.town; ctx.fill();
    ctx.restore();
  }
}

function drawFields(ctx, m, S, winter) {
  for (const [i, f] of m.fields.entries()) {
    const r = seeded(f.x, f.y);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    const hw = f.w / 2, hh = f.h / 2;
    if (winter) {
      // snow over the furrows, with stubble poking through here and there
      ctx.fillStyle = 'rgba(250,250,247,.7)'; ctx.fillRect(-hw, -hh, f.w, f.h);
      ctx.fillStyle = 'rgba(95,85,70,.35)';
      for (let y = -hh + 3; y < hh; y += 4) {
        for (let x = -hw + 2; x < hw - 2; x += 3 + r() * 6) if (r() < .45) ctx.fillRect(x, y + (r() - .5), 1.5 + r() * 2, .8);
      }
      ctx.strokeStyle = 'rgba(70,62,50,.35)'; ctx.lineWidth = .8; ctx.strokeRect(-hw, -hh, f.w, f.h);
    } else {
      const wheat = ['#c9a04a', '#bf9541', '#d2ad55', '#b9a060'][i % 4];
      ctx.fillStyle = wheat; ctx.fillRect(-hw, -hh, f.w, f.h);
      ctx.strokeStyle = shade(wheat, 0.82); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -hw + 2; x < hw; x += 2.5) { ctx.moveTo(x, -hh + 1); ctx.lineTo(x + (r() - .5), hh - 1); }
      ctx.stroke();
      if (i % 3 === 0) { // half reaped: pale stubble with sheaves standing in rows
        const cut = -hw + f.w * (0.35 + r() * 0.3);
        ctx.fillStyle = '#d8c48a'; ctx.fillRect(cut, -hh, hw - cut, f.h);
        for (let x = cut + 5; x < hw - 3; x += 7) for (let y = -hh + 5; y < hh - 3; y += 8) {
          ctx.fillStyle = '#c99a3e'; ctx.strokeStyle = '#6e5228'; ctx.lineWidth = .5;
          ctx.beginPath(); ctx.ellipse(x, y, 1.6, 2.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(80,64,30,.35)'; ctx.lineWidth = 1; ctx.strokeRect(-hw, -hh, f.w, f.h);
    }
    ctx.restore();
  }
}

function drawRiver(ctx, m, S) {
  if (!m.river) return;
  const w = m.river.w;
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const [col, extra] of S.river) {
    poly(ctx, m.river.pts); ctx.strokeStyle = col;
    ctx.lineWidth = extra < 0 ? w * -extra : w + extra; ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(235,238,228,.35)'; ctx.lineWidth = 1;
  ctx.setLineDash([14, 26]);
  poly(ctx, m.river.pts.map(p => ({ x: p.x - 3, y: p.y - 2 }))); ctx.stroke();
  ctx.setLineDash([]);
}

function drawRoads(ctx, m, S, winter) {
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const [i, col] of S.road.entries()) {
    for (const kind of ['lane', 'ring', 'main']) for (const r of m.roads) {
      if (r.kind !== kind) continue;
      poly(ctx, r.pts, r.closed);
      ctx.strokeStyle = col;
      ctx.lineWidth = i === 0 ? r.w + 3 : i === 1 ? r.w : r.w * 0.35;
      ctx.globalAlpha = i === 2 ? 0.6 : 1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // cart ruts
  ctx.strokeStyle = winter ? 'rgba(120,110,95,.5)' : 'rgba(70,50,30,.35)'; ctx.lineWidth = .7;
  for (const r of m.roads) {
    if (r.kind === 'lane') continue;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      r.pts.forEach((p, i) => {
        const q = r.pts[Math.min(i + 1, r.pts.length - 1)], o = r.pts[Math.max(i - 1, 0)];
        const a = Math.atan2(q.y - o.y, q.x - o.x), d = side * r.w * 0.22;
        const x = p.x - Math.sin(a) * d, y = p.y + Math.cos(a) * d;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }
  // stone bridges
  for (const b of m.bridges) {
    const dx = b.bx - b.ax, dy = b.by - b.ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = b.w / 2 + 2.5;
    const ax = b.ax - ux * 3, ay = b.ay - uy * 3, bx = b.bx + ux * 3, by = b.by + uy * 3;
    fillPoly(ctx, [{ x: ax + nx * hw, y: ay + ny * hw }, { x: bx + nx * hw, y: by + ny * hw }, { x: bx - nx * hw, y: by - ny * hw }, { x: ax - nx * hw, y: ay - ny * hw }], winter ? '#d9d5cb' : '#a89c84', '#2a1e14', .7);
    ctx.strokeStyle = '#6f6656'; ctx.lineWidth = 1.6;
    for (const sgn of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(ax + nx * hw * sgn, ay + ny * hw * sgn - 1.5); ctx.lineTo(bx + nx * hw * sgn, by + ny * hw * sgn - 1.5); ctx.stroke();
    }
  }
}

function drawPlaza(ctx, m, winter) {
  const r = mulberry(m.paperSeed + 23);
  ctx.fillStyle = winter ? '#d6d1c6' : '#9c8460';
  ctx.beginPath(); ctx.arc(CX, CY, m.plazaR, 0, TAU); ctx.fill();
  for (let i = 0; i < m.plazaR * 8; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * (m.plazaR - 2);
    ctx.fillStyle = r() < .5 ? 'rgba(70,50,30,.25)' : 'rgba(220,205,170,.25)';
    ctx.fillRect(CX + Math.cos(a) * d, CY + Math.sin(a) * d, 2, 1.5);
  }
}

// ---------- trees ----------
function leafyTree(ctx, t) {
  const { x, y } = t, s = t.r * 1.35, r = seeded(x, y);
  ctx.fillStyle = 'rgba(40,28,14,.2)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.9, y + 1, s * 0.9, s * 0.35, 0, 0, TAU); ctx.fill();
  const top = y - s * 2.3;
  ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 2, top + s * .6); ctx.stroke();
  for (const [col, n, size] of [['#2b3521', 7, .5], ['#434e2d', 6, .42], ['#68703f', 3, .26]]) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const dx = (r() - .5) * s * 1.3 - (col === '#68703f' ? s * .25 : 0);
      const dy = (r() - .5) * s * 1.2 - (col === '#68703f' ? s * .3 : 0);
      ctx.beginPath(); ctx.ellipse(x + dx, top + dy, s * size, s * size * .8, r() * TAU, 0, TAU); ctx.fill();
    }
  }
}

function bareTree(ctx, t) {
  const { x, y } = t, s = t.r * 1.2, r = seeded(x, y);
  ctx.fillStyle = 'rgba(60,60,55,.18)';
  ctx.beginPath(); ctx.ellipse(x + s * 1.1, y + 1, s * 1.1, s * 0.3, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1f1a16'; ctx.lineCap = 'round';
  const branch = (bx, by, ang, len, depth, w) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, ang - 0.35 - r() * 0.3, len * 0.68, depth - 1, w * 0.62);
      branch(ex, ey, ang + 0.35 + r() * 0.3, len * 0.68, depth - 1, w * 0.62);
    }
  };
  const H = s * 2.6, up = -Math.PI / 2;
  ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - H); ctx.stroke();
  branch(x, y - H, up + (r() - .5) * .3, s * .7, 3, 1.2);
  branch(x, y - H * .65, up - 0.7, s * .55, 2, 0.9);
  branch(x, y - H * .55, up + 0.7, s * .55, 2, 0.9);
  if (r() < .12) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x + s * .4, y - H - 1, 1.6, 1.1, 0, 0, TAU); ctx.fill(); } // a crow
}

// ---------- people ----------
function figure(ctx, f) {
  const { x, y, c, cap, pose } = f;
  ctx.fillStyle = 'rgba(40,28,14,.25)';
  ctx.beginPath(); ctx.ellipse(x + 1.5, y + .4, 2.2, .8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = .8;
  ctx.beginPath();
  const spread = pose === 'skate' ? 1.8 : 0.7;
  ctx.moveTo(x - .6, y - 2); ctx.lineTo(x - spread, y);
  ctx.moveTo(x + .6, y - 2); ctx.lineTo(x + spread, y);
  ctx.stroke();
  const lean = pose === 'skate' ? 1 : pose === 'reap' ? 1.6 : 0;
  ctx.fillStyle = c; ctx.lineWidth = .4;
  ctx.beginPath();
  ctx.moveTo(x - 1.9, y - 1.6); ctx.lineTo(x + 1.9, y - 1.6); ctx.lineTo(x + 1.1 + lean, y - 5.3); ctx.lineTo(x - 1.1 + lean, y - 5.3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (pose === 'dance' || pose === 'skate') {
    ctx.beginPath(); ctx.moveTo(x - 1 + lean, y - 4.6); ctx.lineTo(x - 3.4 + lean, y - 3.4); ctx.moveTo(x + 1 + lean, y - 4.6); ctx.lineTo(x + 3.4 + lean, y - 3.4); ctx.lineWidth = .7; ctx.stroke();
  }
  if (pose === 'hunt') { ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x + 2, y - 1); ctx.lineTo(x + 3.5, y - 10); ctx.stroke(); }
  if (pose === 'reap') { ctx.lineWidth = .6; ctx.beginPath(); ctx.arc(x + 4, y - 3, 2.5, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke(); }
  const hx = x + lean, hy = y - 6.4;
  ctx.fillStyle = '#d0a283';
  ctx.beginPath(); ctx.arc(hx, hy, 1.2, 0, TAU); ctx.fill();
  if (cap === 'white') { ctx.fillStyle = '#efe8d8'; ctx.beginPath(); ctx.arc(hx, hy - .3, 1.35, Math.PI, 0); ctx.fill(); }
  else if (cap === 'dark') { ctx.fillStyle = '#2a2420'; ctx.fillRect(hx - 1.8, hy - 1.4, 3.6, .8); ctx.fillRect(hx - 1, hy - 2.4, 2, 1.2); }
}

function dog(ctx, x, y) {
  ctx.fillStyle = 'rgba(60,60,55,.2)'; ctx.beginPath(); ctx.ellipse(x + 1, y + .3, 2.6, .7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1f1a16'; ctx.fillStyle = '#2b2622'; ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(x - 1.6, y); ctx.lineTo(x - 1.4, y - 1.6); ctx.moveTo(x + 1.4, y); ctx.lineTo(x + 1.6, y - 1.6); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y - 2.2, 2.3, 1, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.4, y - 3, .9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 2.2, y - 2.4); ctx.lineTo(x - 3.4, y - 3.6); ctx.stroke();
}

function bonfire(ctx, x, y) {
  ctx.fillStyle = '#2a1e14'; ctx.fillRect(x - 3, y - 1, 6, 1.5);
  ctx.fillStyle = '#c4501f'; ctx.beginPath(); ctx.moveTo(x - 3, y - 1); ctx.quadraticCurveTo(x, y - 9, x + 3, y - 1); ctx.fill();
  ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.moveTo(x - 1.5, y - 1); ctx.quadraticCurveTo(x, y - 6, x + 1.5, y - 1); ctx.fill();
  ctx.strokeStyle = 'rgba(120,115,105,.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.bezierCurveTo(x - 6, y - 18, x + 8, y - 26, x + 2, y - 40); ctx.stroke();
}

function collectPeople(m, S, winter) {
  const out = [];
  const r = mulberry(m.paperSeed ^ 0xb7e6);
  const P = () => S.people[Math.floor(r() * S.people.length)];
  const capFor = c => (c === '#e9e1cf' ? 'dark' : r() < 0.4 ? 'white' : r() < 0.5 ? 'dark' : null);
  const person = (x, y, pose) => { const c = P(); out.push({ y, draw: ctx => figure(ctx, { x, y, c, cap: capFor(c), pose }) }); };

  // folk along the streets
  const streets = m.roads.flatMap(rd => rd.pts.slice(0, -1).map((p, i) => ({ p, q: rd.pts[i + 1], w: rd.w })))
    .filter(s => s.p.x > 50 && s.p.y > 50 && s.p.x < WORLD - 50 && s.p.y < WORLD - 50 && s.p.d > m.plazaR + 6);
  const n = clamp(m.parsed.content.length * 1.2, 14, 170);
  for (let i = 0; i < n && streets.length; i++) {
    const s = streets[Math.floor(r() * streets.length)], t = r();
    const a = Math.atan2(s.q.y - s.p.y, s.q.x - s.p.x), off = (r() - .5) * s.w * 0.6;
    const x = s.p.x + (s.q.x - s.p.x) * t - Math.sin(a) * off, y = s.p.y + (s.q.y - s.p.y) * t + Math.cos(a) * off;
    person(x, y, null);
    if (r() < 0.25) person(x + 3, y + .5, null); // pairs stopping to talk
  }

  // the square: a ring dance in summer, a fire and onlookers in winter
  if (winter) {
    const fx = CX + m.plazaR * 0.45, fy = CY + m.plazaR * 0.3;
    out.push({ y: fy, draw: ctx => bonfire(ctx, fx, fy) });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; person(fx + Math.cos(a) * 6, fy + Math.sin(a) * 4, null); }
    for (let i = 0; i < 8; i++) { const a = r() * TAU, d = m.plazaR * (0.3 + r() * 0.6); person(CX + Math.cos(a) * d, CY + Math.sin(a) * d, null); }
  } else {
    const k = 12, rr = m.plazaR * (m.market ? 0.36 : 0.5);
    for (let i = 0; i < k; i++) { const a = i / k * TAU; person(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr * 0.8, 'dance'); }
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = m.plazaR * (0.75 + r() * 0.2); person(CX + Math.cos(a) * d, CY + Math.sin(a) * d, null); }
  }

  if (winter) {
    // skaters on the frozen river
    if (m.river) {
      const pts = m.river.pts.filter(p => p.x > 60 && p.y > 60 && p.x < WORLD - 60 && p.y < WORLD - 60);
      for (let i = 0; i < 34 && pts.length; i++) {
        const p = pts[Math.floor(r() * pts.length)];
        person(p.x + (r() - .5) * m.river.w * .6, p.y + (r() - .5) * m.river.w * .5, 'skate');
      }
    }
    // hunters and their dogs trudging home along a high road
    const road = m.roads.find(rd => rd.kind === 'main');
    const at = road && road.pts.find(p => p.d > m.townR + 70);
    if (at) {
      for (let i = 0; i < 3; i++) person(at.x + i * 5, at.y + i * 2.5, 'hunt');
      for (let i = 0; i < 5; i++) { const x = at.x - 4 + r() * 18, y = at.y + 4 + r() * 6; out.push({ y, draw: ctx => dog(ctx, x, y) }); }
    }
  } else {
    // reapers in the fields
    m.fields.forEach((f, i) => {
      if (i % 3 !== 0) return;
      const c = Math.cos(f.a), s = Math.sin(f.a);
      for (let j = 0; j < 2; j++) {
        const u = (r() - .5) * f.w * .6, v = (r() - .5) * f.h * .6;
        const x = f.x + u * c - v * s, y = f.y + u * s + v * c;
        const col = r() < .6 ? '#e9e1cf' : '#9a2e22';
        out.push({ y, draw: ctx => figure(ctx, { x, y, c: col, cap: r() < .5 ? 'white' : null, pose: 'reap' }) });
      }
    });
  }
  return out;
}

// ---------- sprites ----------
function houseDims(h) {
  return { H: 5 + Math.min(h.w, 26) * 0.17, roofH: h.h * 0.95 };
}

function collectSprites(m, S, winter) {
  const pal = S.pal, sprites = [];
  for (const h of m.houses) {
    const { H, roofH } = houseDims(h);
    const k = hashStr(h.word);
    const wall = S.walls[k % S.walls.length];
    const roof = h.type === 'tavern' ? S.tavernRoof : S.roofs[(k >>> 4) % S.roofs.length];
    const opts = {
      chimney: (k & 3) === 0 || (winter && (k & 3) === 1),
      smoke: winter ? 'rgba(205,205,198,.65)' : 'rgba(190,185,170,.35)',
      timber: (k & 8) ? '#4a3524' : null,
      eaves: winter ? '#3a3028' : null,
    };
    sprites.push({ y: h.y, draw: ctx => {
      Raised.block(ctx, pal, h.x, h.y, h.w, h.h, h.a, H, roofH, wall, roof, opts);
      if (h.type === 'tavern') { // a pole with a hanging sign, as on Bruegel's inns
        ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(h.x + 5, h.y); ctx.lineTo(h.x + 5, h.y - H - 8); ctx.lineTo(h.x + 10, h.y - H - 8); ctx.stroke();
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(h.x + 8, h.y - H - 7, 4, 4); ctx.strokeRect(h.x + 8, h.y - H - 7, 4, 4);
      }
    } });
  }
  for (const t of m.trees) sprites.push({ y: t.y, draw: ctx => (winter ? bareTree(ctx, t) : leafyTree(ctx, t)) });

  if (m.market) {
    const colors = winter ? [SNOW] : ['#9a2e22', '#d9cfb8', '#4f5d6b', '#b8893e'];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + .2, d = m.plazaR * .66;
      const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
      sprites.push({ y, draw: ctx => Raised.block(ctx, pal, x, y, 10, 6, a + Math.PI / 2, 4, 3, '#8a6a42', colors[i % colors.length], { door: false }) });
    }
  }
  sprites.push({ y: CY, draw: ctx => {
    Raised.tower(ctx, pal, CX, CY, 5.5, 5, null);
    ctx.fillStyle = winter ? '#b9c8c3' : '#3f5248';
    ctx.beginPath(); ctx.ellipse(CX, CY - 5, 3.2, 1.4, 0, 0, TAU); ctx.fill();
  } });

  for (const sp of m.specials) {
    if (sp.kind === 'castle') sprites.push({ y: sp.y + 40, draw: ctx => Raised.castle(ctx, pal, sp) });
    else if (sp.kind === 'cathedral' || sp.kind === 'chapel') sprites.push({ y: sp.y + 10, draw: ctx => Raised.cathedral(ctx, pal, sp) });
    else if (sp.kind === 'mill') sprites.push({ y: sp.y, draw: ctx => Raised.mill(ctx, pal, sp) });
  }
  if (m.walls) {
    const pts = m.walls.pts, n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      sprites.push({ y: (a.y + b.y) / 2 - 0.5, draw: ctx => Raised.wallSegment(ctx, pal, a, b) });
      if (i % 3 === 0) sprites.push({ y: a.y + 0.5, draw: ctx => Raised.tower(ctx, pal, a.x, a.y, 7, 22, pal.wallTowerRoof, { steep: 1.5 }) });
    }
    for (const g of m.walls.gates) sprites.push({ y: g.y + 6, draw: ctx => Raised.gate(ctx, pal, g) });
  }
  return sprites.concat(collectPeople(m, S, winter)).sort((a, b) => a.y - b.y);
}

// ---------- birds, finish & inscription ----------
function drawBirds(ctx, m, winter) {
  const r = mulberry(m.paperSeed ^ 0xb12d);
  ctx.strokeStyle = '#1f1a16'; ctx.lineWidth = 1.1;
  const n = winter ? 22 : 12;
  for (let i = 0; i < n; i++) {
    const x = 80 + r() * (WORLD - 160), y = 60 + r() * 420, s = 3 + r() * 3;
    ctx.beginPath(); ctx.moveTo(x - s, y - s * .4); ctx.quadraticCurveTo(x - s * .4, y - s * .6, x, y); ctx.quadraticCurveTo(x + s * .4, y - s * .6, x + s, y - s * .4); ctx.stroke();
  }
}

function finish(ctx, m, S) {
  const r = mulberry(m.paperSeed ^ 0xc4ac);
  // aerial perspective: the far (upper) part of the land fades to blue-grey
  const [hr, hg, hb] = S.haze;
  const haze = ctx.createLinearGradient(0, 0, 0, 560);
  haze.addColorStop(0, `rgba(${hr},${hg},${hb},${S.hazeAlpha})`);
  haze.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  ctx.fillStyle = haze; ctx.fillRect(0, 0, WORLD, 560);
  // warm varnish
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = S.varnish; ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.globalCompositeOperation = 'source-over';
  // darkened edges
  const v = ctx.createRadialGradient(CX, CY, 420, CX, CY, 880);
  v.addColorStop(0, 'rgba(50,32,15,0)'); v.addColorStop(1, 'rgba(50,32,15,.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, WORLD, WORLD);
  // craquelure: fine cracks in old paint
  ctx.strokeStyle = 'rgba(40,25,10,.14)'; ctx.lineWidth = .5;
  for (let i = 0; i < 650; i++) {
    let x = r() * WORLD, y = r() * WORLD, a = r() * TAU;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { a += (r() - .5) * 1.4; x += Math.cos(a) * (5 + r() * 9); y += Math.sin(a) * (5 + r() * 9); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

function roman(n) {
  n = Math.max(1, Math.floor(n));
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, sym] of map) while (n >= v) { s += sym; n -= v; }
  return s;
}

function drawLabel(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y - 6);
  if (l.angle) ctx.rotate(l.angle);
  ctx.font = `italic ${l.size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(235,225,200,.55)'; ctx.lineWidth = 3;
  ctx.strokeText(l.text, 0, 0);
  ctx.fillStyle = '#2f2216';
  ctx.fillText(l.text, 0, 0);
  ctx.restore();
}

function drawFrame(ctx, m) {
  // painted inscription, lower left, in the manner of a signed panel
  const year = 1550 + (m.paperSeed % 19);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const lines = [
    [`28px ${FONT_SC}`, m.name.toUpperCase().split('').join(' ')], // hair-spaced capitals
    [`italic 16px ${FONT}`, `M.D.${roman(year - 1500)}`],
    [`italic 14px ${FONT}`, `${roman(m.houses.length || 1)} domus · ${roman(m.population || 1)} animae`],
  ];
  let y = WORLD - 116;
  for (const [font, text] of lines) {
    ctx.font = font;
    ctx.strokeStyle = 'rgba(225,212,182,.55)'; ctx.lineWidth = 3; ctx.strokeText(text, 62, y);
    ctx.fillStyle = 'rgba(40,26,14,.88)'; ctx.fillText(text, 62, y);
    y += 24;
  }
  // heavy dark panel frame with a thin gilt slip
  const wood = ctx.createLinearGradient(0, 0, WORLD, WORLD);
  wood.addColorStop(0, '#3a2818'); wood.addColorStop(0.5, '#22160d'); wood.addColorStop(1, '#3a2818');
  ctx.strokeStyle = wood; ctx.lineWidth = 40;
  ctx.strokeRect(20, 20, WORLD - 40, WORLD - 40);
  ctx.strokeStyle = '#a8873e'; ctx.lineWidth = 2.5;
  ctx.strokeRect(41, 41, WORLD - 82, WORLD - 82);
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(44, 44, WORLD - 88, WORLD - 88);
  ctx.strokeStyle = 'rgba(160,130,80,.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, WORLD - 10, WORLD - 10);
}

function render(ctx, m) {
  const season = seasonOf(m), S = SEASONS[season], winter = season === 'winter';
  drawGround(ctx, m, S);
  drawFields(ctx, m, S, winter);
  drawRiver(ctx, m, S);
  drawRoads(ctx, m, S, winter);
  drawPlaza(ctx, m, winter);
  for (const s of collectSprites(m, S, winter)) s.draw(ctx);
  drawBirds(ctx, m, winter);
  for (const l of m.labels) drawLabel(ctx, l);
  finish(ctx, m, S);
  drawFrame(ctx, m);
}

registerStyle({
  id: 'bruegel',
  label: 'Bruegel',
  fonts: [`28px "IM Fell English SC"`, `italic 16px "IM Fell English"`],
  render,
  highlight: (ctx, m, h, isPrimary) => Raised.highlightHouse(ctx, SEASONS.summer.pal, h, houseDims(h), isPrimary),
  pick: (m, x, y) => Raised.pickRaised(m, x, y, 11),
});
})();
