/* Adventure style: a bright, painted fantasy-strategy map seen from a high
 * three-quarter view. Buildings, trees, walls and towers are raised as 3D
 * blocks (via styles/raised.js) and drawn back to front. */
(() => {
'use strict';
const PAL = Raised.palette({}); // the shared kit's defaults are this style's colours
const OUT = PAL.outline;
const TITLE_FONT = '"Cinzel", Georgia, serif';

const WALL_COLORS = ['#efe0bd', '#e6d2a6', '#dccaa2', '#d2bf98', '#c9bda8'];
const ROOF_COLORS = ['#c0392b', '#a93226', '#2f5ea8', '#d0702f', '#b84a2a', '#3d6b8f', '#8f4a2c', '#c45a2a', '#6a4b8a'];

const { rgb, shade, fillPoly, smoothClosed } = Raised;
const block = (ctx, ...a) => Raised.block(ctx, PAL, ...a);
const tower = (ctx, ...a) => Raised.tower(ctx, PAL, ...a);

// ---------- ground ----------
function drawGround(ctx, m) {
  const r = mulberry(m.paperSeed ^ 0x9e3779b9);
  ctx.fillStyle = '#5b9131';
  ctx.fillRect(0, 0, WORLD, WORLD);
  const greens = ['#4b8226', '#66a038', '#558a2b', '#72a940', '#437a22', '#7cb049'];
  for (let i = 0; i < 260; i++) {
    const x = r() * WORLD, y = r() * WORLD, rad = 25 + r() * 110;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const [cr, cg, cb] = rgb(greens[Math.floor(r() * greens.length)]);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},.55)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // trodden earth where the town stands
  if (m.houses.length) {
    smoothClosed(ctx, m.outline);
    ctx.fillStyle = 'rgba(150,128,74,.45)'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < .5 ? 'rgba(110,90,50,.25)' : 'rgba(190,170,120,.25)';
      ctx.fillRect(r() * WORLD, r() * WORLD, 2, 2);
    }
    ctx.restore();
  }
  // grass tufts and wildflowers
  ctx.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = r() * WORLD, y = r() * WORLD;
    ctx.strokeStyle = r() < .5 ? 'rgba(40,80,20,.55)' : 'rgba(150,200,90,.45)';
    ctx.beginPath(); ctx.moveTo(x - 2, y - 3); ctx.lineTo(x, y); ctx.lineTo(x + 2, y - 3); ctx.stroke();
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = ['#f4e36a', '#ffffff', '#e98bb0', '#b9a3ec'][Math.floor(r() * 4)];
    ctx.fillRect(r() * WORLD, r() * WORLD, 2, 2);
  }
}

function drawRiver(ctx, m) {
  if (!m.river) return;
  const w = m.river.w;
  ctx.lineJoin = ctx.lineCap = 'round';
  const layers = [['#cdb877', w + 16], ['#8a7a4a', w + 6], ['#24476f', w + 3], ['#336aa3', w], ['#4f8cc6', w * 0.55]];
  for (const [col, lw] of layers) { poly(ctx, m.river.pts); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 23]);
  poly(ctx, m.river.pts); ctx.stroke();
  ctx.lineDashOffset = 13;
  ctx.strokeStyle = 'rgba(200,230,255,.5)';
  poly(ctx, m.river.pts.map(p => ({ x: p.x + 3, y: p.y + 4 }))); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

function drawRoads(ctx, m) {
  ctx.lineJoin = ctx.lineCap = 'round';
  const order = ['lane', 'ring', 'main'];
  const passes = [['#4a321b', 5], ['#a7804b', 1], ['#c49c62', -0.45]];
  for (const [col, extra] of passes) {
    for (const kind of order) for (const r of m.roads) {
      if (r.kind !== kind) continue;
      poly(ctx, r.pts, r.closed);
      ctx.strokeStyle = col;
      ctx.lineWidth = extra < 0 ? r.w * -extra : r.w + extra;
      ctx.stroke();
    }
  }
  // cobbles
  const rr = mulberry(m.paperSeed ^ 0x51ed);
  ctx.fillStyle = 'rgba(90,62,32,.4)';
  for (const r of m.roads) for (const p of r.pts) {
    for (let k = 0; k < 2; k++) ctx.fillRect(p.x + (rr() - .5) * r.w, p.y + (rr() - .5) * r.w, 1.6, 1.6);
  }
  // wooden bridges
  for (const b of m.bridges) {
    const dx = b.bx - b.ax, dy = b.by - b.ay, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = b.w / 2 + 3;
    const ax = b.ax - ux * 3, ay = b.ay - uy * 3, bx = b.bx + ux * 3, by = b.by + uy * 3;
    fillPoly(ctx, [{ x: ax + nx * hw, y: ay + ny * hw }, { x: bx + nx * hw, y: by + ny * hw }, { x: bx - nx * hw, y: by - ny * hw }, { x: ax - nx * hw, y: ay - ny * hw }], '#9a6a3a', OUT, 1);
    ctx.strokeStyle = 'rgba(50,30,15,.6)'; ctx.lineWidth = .8;
    ctx.beginPath();
    for (let t = 2; t < L + 4; t += 3) {
      const px = ax + ux * t, py = ay + uy * t;
      ctx.moveTo(px + nx * hw, py + ny * hw); ctx.lineTo(px - nx * hw, py - ny * hw);
    }
    ctx.stroke();
    ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 2;
    for (const sgn of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(ax + nx * hw * sgn, ay + ny * hw * sgn - 2); ctx.lineTo(bx + nx * hw * sgn, by + ny * hw * sgn - 2); ctx.stroke();
    }
  }
}

function drawFields(ctx, m) {
  for (const f of m.fields) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    const ripe = f.color.charCodeAt(2) % 3; // stable per field
    const base = ['#d9b44a', '#9fbf4a', '#c99a3e'][ripe];
    ctx.fillStyle = base;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.strokeStyle = shade(base, 0.75); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let y = -f.h / 2 + 3; y < f.h / 2; y += 3.5) { ctx.moveTo(-f.w / 2 + 1, y); ctx.lineTo(f.w / 2 - 1, y); }
    ctx.stroke();
    // wooden fence with posts
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 1.6;
    ctx.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.fillStyle = '#4a2c14';
    for (let x = -f.w / 2; x <= f.w / 2 + .1; x += f.w / Math.max(1, Math.round(f.w / 12))) {
      ctx.fillRect(x - 1, -f.h / 2 - 1.5, 2, 3); ctx.fillRect(x - 1, f.h / 2 - 1.5, 2, 3);
    }
    ctx.restore();
  }
}

function drawPlaza(ctx, m) {
  const r = mulberry(m.paperSeed + 11);
  const R = m.plazaR;
  ctx.fillStyle = '#b7a37a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let ring = R - 5; ring > 8; ring -= 6) {
    const n = Math.floor(ring * Math.PI * 2 / 6);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + ring;
      ctx.fillStyle = r() < .5 ? '#a8946b' : '#c6b28a';
      ctx.fillRect(CX + Math.cos(a) * ring - 2, CY + Math.sin(a) * ring - 1.5, 4, 3);
    }
  }
}

// ---------- sprites (sorted back to front) ----------
function houseDims(h) {
  return { H: 5 + Math.min(h.w, 26) * 0.16, roofH: h.h * 0.6 };
}

function collectSprites(m) {
  const sprites = [];

  for (const h of m.houses) {
    const { H, roofH } = houseDims(h);
    const k = hashStr(h.word);
    const wall = WALL_COLORS[k % WALL_COLORS.length];
    const roof = h.type === 'tavern' ? '#7a2e1c' : ROOF_COLORS[(k >>> 4) % ROOF_COLORS.length];
    sprites.push({ y: h.y, draw: ctx => {
      block(ctx, h.x, h.y, h.w, h.h, h.a, H, roofH, wall, roof, { chimney: (k & 3) === 0 });
      if (h.type === 'tavern') {
        ctx.fillStyle = '#e2b84a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(h.x + 6, h.y - H - roofH - 4, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } });
  }

  for (const t of m.trees) {
    const conifer = t.shade > 0.62;
    sprites.push({ y: t.y, draw: ctx => (conifer ? pine(ctx, t) : oak(ctx, t)) });
  }

  if (m.market) {
    const colors = ['#c0392b', '#e2b84a', '#2f5ea8', '#efe7d2', '#4f8a2b'];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + .2, d = m.plazaR * .64;
      const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
      sprites.push({ y, draw: ctx => block(ctx, x, y, 11, 7, a + Math.PI / 2, 4, 3, '#b48a5a', colors[i % colors.length], { door: false }) });
    }
  }
  // the well at the centre of the square
  sprites.push({ y: CY, draw: ctx => {
    tower(ctx, CX, CY, 6, 5, null);
    ctx.fillStyle = '#2b4f7a'; ctx.beginPath(); ctx.ellipse(CX, CY - 5, 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    block(ctx, CX, CY - 1, 14, 8, 0, 11, 5, '#6b4423', '#8f4a2c', { door: false, noShadow: true });
  } });

  for (const sp of m.specials) {
    if (sp.kind === 'castle') sprites.push({ y: sp.y + 40, draw: ctx => Raised.castle(ctx, PAL, sp) });
    else if (sp.kind === 'cathedral' || sp.kind === 'chapel') sprites.push({ y: sp.y + 10, draw: ctx => Raised.cathedral(ctx, PAL, sp) });
    else if (sp.kind === 'mill') sprites.push({ y: sp.y, draw: ctx => Raised.mill(ctx, PAL, sp) });
  }

  if (m.walls) {
    const pts = m.walls.pts, n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      sprites.push({ y: (a.y + b.y) / 2 - 0.5, draw: ctx => Raised.wallSegment(ctx, PAL, a, b) });
      if (i % 2 === 0) sprites.push({ y: a.y + 0.5, draw: ctx => tower(ctx, a.x, a.y, 8, 24, PAL.wallTowerRoof) });
    }
    for (const g of m.walls.gates) sprites.push({ y: g.y + 6, draw: ctx => Raised.gate(ctx, PAL, g) });
  }
  return sprites.sort((a, b) => a.y - b.y);
}

function oak(ctx, t) {
  const { x, y } = t, r = t.r;
  ctx.fillStyle = 'rgba(20,30,10,.3)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.9, y + 1, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x - 1.5, y - r * 0.9, 3, r * 0.9);
  const cy = y - r * 1.25;
  const g = Math.floor(t.shade * 40);
  const dark = `rgb(${38 + g},${92 + g},${30})`, mid = `rgb(${62 + g},${130 + g},${42})`, light = `rgb(${110 + g},${170 + g},${70})`;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(x - r * .45, cy + r * .15, r * .7, 0, Math.PI * 2);
  ctx.arc(x + r * .45, cy + r * .15, r * .7, 0, Math.PI * 2);
  ctx.arc(x, cy - r * .3, r * .75, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.arc(x - r * .4, cy + r * .05, r * .5, 0, Math.PI * 2);
  ctx.arc(x + r * .1, cy - r * .35, r * .55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(x - r * .25, cy - r * .45, r * .28, 0, Math.PI * 2); ctx.fill();
}

function pine(ctx, t) {
  const { x, y } = t, r = t.r * 0.95;
  ctx.fillStyle = 'rgba(20,30,10,.3)';
  ctx.beginPath(); ctx.ellipse(x + r * 1.1, y + 1, r * 1.2, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2c14'; ctx.fillRect(x - 1.2, y - 4, 2.4, 4);
  const g = Math.floor(t.shade * 30);
  for (let tier = 0; tier < 3; tier++) {
    const by = y - 3 - tier * r * 0.75, wdt = r * (1.05 - tier * 0.25), ht = r * 1.25;
    ctx.fillStyle = `rgb(${24 + g},${78 + g},${46})`; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - wdt, by); ctx.lineTo(x, by - ht); ctx.lineTo(x + wdt, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(150,210,120,.35)`;
    ctx.beginPath(); ctx.moveTo(x - wdt * .7, by - 1); ctx.lineTo(x, by - ht); ctx.lineTo(x - wdt * .1, by - 1); ctx.closePath(); ctx.fill();
  }
}

// ---------- labels & frame ----------
function drawLabel(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y - 8);
  if (l.angle) ctx.rotate(l.angle);
  const size = Math.round(l.size * 1.05);
  ctx.font = `700 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,14,8,.9)'; ctx.lineWidth = 4;
  ctx.strokeText(l.text, 0, 0);
  ctx.fillStyle = l.color ? '#cfe6ff' : '#fff3cf';
  ctx.fillText(l.text, 0, 0);
  ctx.restore();
}

function goldGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff1b0'); g.addColorStop(0.45, '#e2b84a'); g.addColorStop(0.55, '#b8862c'); g.addColorStop(1, '#f2d27a');
  return g;
}

function drawFrame(ctx, m) {
  // vignette
  const v = ctx.createRadialGradient(CX, CY, 380, CX, CY, 860);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,20,5,.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, WORLD, WORLD);

  // carved wooden frame with gold trim
  const wood = ctx.createLinearGradient(0, 0, WORLD, WORLD);
  wood.addColorStop(0, '#5a3a20'); wood.addColorStop(0.5, '#3b2414'); wood.addColorStop(1, '#5a3a20');
  ctx.strokeStyle = wood; ctx.lineWidth = 36;
  ctx.strokeRect(18, 18, WORLD - 36, WORLD - 36);
  ctx.strokeStyle = goldGradient(ctx, 0, WORLD); ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, WORLD - 72, WORLD - 72);
  ctx.strokeStyle = '#6b4a1a'; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 40, WORLD - 80, WORLD - 80);
  ctx.strokeStyle = 'rgba(255,230,160,.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, WORLD - 8, WORLD - 8);
  for (const [x, y] of [[36, 36], [WORLD - 36, 36], [WORLD - 36, WORLD - 36], [36, WORLD - 36]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldGradient(ctx, -14, 14); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.fillRect(-12, -12, 24, 24); ctx.strokeRect(-12, -12, 24, 24);
    ctx.fillStyle = '#8e2a1e'; ctx.fillRect(-5, -5, 10, 10); ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  }

  // title ribbon
  ctx.font = `700 40px ${TITLE_FONT}`;
  const tw = Math.max(ctx.measureText(m.name).width + 90, 300);
  const bx = CX - tw / 2, by = 18, bh = 64;
  const ribbon = [
    { x: bx - 26, y: by + 8 }, { x: bx + 10, y: by + 8 }, { x: bx + 10, y: by + bh + 8 }, { x: bx - 26, y: by + bh + 8 }, { x: bx - 12, y: by + bh / 2 + 8 },
  ];
  const ribbonR = ribbon.map(p => ({ x: 2 * CX - p.x, y: p.y }));
  for (const tail of [ribbon, ribbonR]) fillPoly(ctx, tail, '#6e1f16', OUT, 1.5);
  const red = ctx.createLinearGradient(0, by, 0, by + bh);
  red.addColorStop(0, '#b8392a'); red.addColorStop(1, '#7a2219');
  fillPoly(ctx, [{ x: bx, y: by }, { x: bx + tw, y: by }, { x: bx + tw, y: by + bh }, { x: bx, y: by + bh }], red, OUT, 2);
  ctx.strokeStyle = goldGradient(ctx, by, by + bh); ctx.lineWidth = 3;
  ctx.strokeRect(bx + 5, by + 5, tw - 10, bh - 10);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#2a0e08'; ctx.lineWidth = 5;
  ctx.strokeText(m.name, CX, by + bh / 2 + 2);
  ctx.fillStyle = goldGradient(ctx, by + 12, by + bh - 10);
  ctx.fillText(m.name, CX, by + bh / 2 + 2);

  // stats bar
  const stats = [
    ['house', m.houses.length, 'buildings'],
    ['folk', m.population, 'souls'],
    ['quill', m.parsed.words.length, 'words'],
  ];
  const sw = 460, sh = 46, sx = CX - sw / 2, sy = WORLD - 18 - sh;
  fillPoly(ctx, [{ x: sx, y: sy }, { x: sx + sw, y: sy }, { x: sx + sw, y: sy + sh }, { x: sx, y: sy + sh }], 'rgba(30,20,10,.92)', OUT, 2);
  ctx.strokeStyle = goldGradient(ctx, sy, sy + sh); ctx.lineWidth = 2.5;
  ctx.strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);
  stats.forEach(([icon, value, unit], i) => {
    const cx = sx + sw / 6 * (1 + i * 2), cy = sy + sh / 2;
    drawIcon(ctx, icon, cx - 52, cy);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 19px ${TITLE_FONT}`; ctx.fillStyle = '#f6e3a6';
    ctx.fillText(String(value), cx - 36, cy - 6);
    ctx.font = `700 11px ${TITLE_FONT}`; ctx.fillStyle = '#c9b27a';
    ctx.fillText(unit, cx - 36, cy + 11);
  });
}

function drawIcon(ctx, kind, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1;
  if (kind === 'house') {
    ctx.fillStyle = '#efe0bd'; ctx.fillRect(-8, -2, 16, 10); ctx.strokeRect(-8, -2, 16, 10);
    fillPoly(ctx, [{ x: -10, y: -2 }, { x: 0, y: -11 }, { x: 10, y: -2 }], '#c0392b', OUT, 1);
    ctx.fillStyle = '#3a2414'; ctx.fillRect(-2, 2, 4, 6);
  } else if (kind === 'folk') {
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2f5ea8';
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.quadraticCurveTo(0, -6, 8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.rotate(-0.6);
    ctx.fillStyle = '#f2ead6';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(7, -2, 1, 10); ctx.lineTo(-1, 10); ctx.quadraticCurveTo(-6, -2, 0, -12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 12); ctx.stroke();
  }
  ctx.restore();
}

function render(ctx, m) {
  drawGround(ctx, m);
  drawFields(ctx, m);
  drawRiver(ctx, m);
  drawRoads(ctx, m);
  drawPlaza(ctx, m);
  for (const s of collectSprites(m)) s.draw(ctx);
  for (const l of m.labels) drawLabel(ctx, l);
  drawFrame(ctx, m);
}

registerStyle({
  id: 'adventure',
  label: 'Adventure',
  fonts: [`700 40px "Cinzel"`],
  render,
  highlight: (ctx, m, h, isPrimary) => Raised.highlightHouse(ctx, PAL, h, houseDims(h), isPrimary),
  pick: (m, x, y) => Raised.pickRaised(m, x, y),
});
})();
