/* Parchment style: a hand-inked, top-down map on aged paper. */
(() => {
'use strict';
const INK = '#3b2a1a';
const FONT = '"IM Fell English", Georgia, serif';

function drawPaper(ctx, m) {
  const g = ctx.createRadialGradient(CX, CY, 100, CX, CY, 900);
  g.addColorStop(0, '#f3e8cb');
  g.addColorStop(1, '#d4bf92');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD, WORLD);
  const r = mulberry(m.paperSeed);
  for (let i = 0; i < 3500; i++) {
    ctx.fillStyle = `rgba(110,80,40,${(r() * .08).toFixed(3)})`;
    const s = r() * 2.2;
    ctx.fillRect(r() * WORLD, r() * WORLD, s, s);
  }
  for (let i = 0; i < 18; i++) { // faint stains
    const x = r() * WORLD, y = r() * WORLD, rad = 40 + r() * 140;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    sg.addColorStop(0, 'rgba(150,110,60,.07)');
    sg.addColorStop(1, 'rgba(150,110,60,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function drawFields(ctx, m) {
  for (const f of m.fields) {
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.a);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = .85;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(80,70,30,.28)';
    ctx.lineWidth = .8;
    ctx.beginPath();
    if (f.furrow) for (let y = -f.h / 2 + 4; y < f.h / 2; y += 4) { ctx.moveTo(-f.w / 2 + 2, y); ctx.lineTo(f.w / 2 - 2, y); }
    else for (let x = -f.w / 2 + 4; x < f.w / 2; x += 4) { ctx.moveTo(x, -f.h / 2 + 2); ctx.lineTo(x, f.h / 2 - 2); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(85,100,50,.7)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.restore();
  }
}

function drawRiver(ctx, m) {
  if (!m.river) return;
  ctx.lineJoin = ctx.lineCap = 'round';
  poly(ctx, m.river.pts);
  ctx.strokeStyle = '#5c7f8a'; ctx.lineWidth = m.river.w + 5; ctx.stroke();
  ctx.strokeStyle = '#86adb9'; ctx.lineWidth = m.river.w; ctx.stroke();
  ctx.strokeStyle = 'rgba(220,235,238,.45)'; ctx.lineWidth = 1.2;
  ctx.setLineDash([10, 16]);
  poly(ctx, m.river.pts); ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrees(ctx, m) {
  for (const t of m.trees) {
    ctx.fillStyle = 'rgba(50,40,20,.22)';
    ctx.beginPath(); ctx.arc(t.x + 2.5, t.y + 2.5, t.r, 0, TAU); ctx.fill();
  }
  for (const t of m.trees) {
    const g = 95 + Math.floor(t.shade * 40);
    ctx.fillStyle = `rgb(${g - 30},${g + 10},${g - 45})`;
    ctx.strokeStyle = 'rgba(40,50,25,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,220,.18)';
    ctx.beginPath(); ctx.arc(t.x - t.r * .3, t.y - t.r * .3, t.r * .45, 0, TAU); ctx.fill();
  }
}

function drawRoads(ctx, m) {
  ctx.lineJoin = ctx.lineCap = 'round';
  const order = ['lane', 'ring', 'main'];
  for (const pass of [0, 1]) {
    for (const kind of order) for (const r of m.roads) {
      if (r.kind !== kind) continue;
      poly(ctx, r.pts, r.closed);
      ctx.strokeStyle = pass === 0 ? '#9a8058' : '#dccb9f';
      ctx.lineWidth = pass === 0 ? r.w + 3 : r.w;
      ctx.stroke();
    }
  }
  // bridges where streets cross the river
  ctx.lineCap = 'butt';
  for (const b of m.bridges) {
    const dx = b.bx - b.ax, dy = b.by - b.ay, L = Math.hypot(dx, dy) || 1;
    const ex = dx / L * 3, ey = dy / L * 3;
    ctx.beginPath(); ctx.moveTo(b.ax - ex, b.ay - ey); ctx.lineTo(b.bx + ex, b.by + ey);
    ctx.strokeStyle = '#5e554a'; ctx.lineWidth = b.w + 7; ctx.stroke();
    ctx.strokeStyle = '#c4b89f'; ctx.lineWidth = b.w + 1; ctx.stroke();
  }
  ctx.lineCap = 'round';
}

function drawPlaza(ctx, m) {
  const r = mulberry(m.paperSeed + 7);
  ctx.fillStyle = '#ddcea6';
  ctx.strokeStyle = '#9a8058';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(CX, CY, m.plazaR, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120,95,60,.25)';
  for (let i = 0; i < m.plazaR * 6; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * (m.plazaR - 3);
    ctx.fillRect(CX + Math.cos(a) * d, CY + Math.sin(a) * d, 1.5, 1.5);
  }
  if (m.market) {
    const colors = ['#a33b2b', '#d9b44a', '#3f6b8a', '#e8e0cc', '#5c7b3a'];
    const k = 10;
    for (let i = 0; i < k; i++) {
      const a = i / k * TAU + .2, d = m.plazaR * .62;
      ctx.save();
      ctx.translate(CX + Math.cos(a) * d, CY + Math.sin(a) * d); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(-6, -4, 3, 8); ctx.fillRect(0, -4, 3, 8);
      ctx.strokeStyle = INK; ctx.lineWidth = .8; ctx.strokeRect(-6, -4, 12, 8);
      ctx.restore();
    }
  }
  // well
  ctx.fillStyle = '#8a8378'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(CX, CY, 6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d5b66';
  ctx.beginPath(); ctx.arc(CX, CY, 3, 0, TAU); ctx.fill();
}

function hipRoof(ctx, w, h, color, outline = INK) {
  const hw = w / 2, hh = h / 2, ridge = Math.max(0, hw - hh);
  ctx.fillStyle = color;
  ctx.fillRect(-hw, -hh, w, h);
  // shaded faces
  ctx.fillStyle = 'rgba(30,15,5,.22)';
  ctx.beginPath(); ctx.moveTo(-hw, hh); ctx.lineTo(hw, hh); ctx.lineTo(ridge, 0); ctx.lineTo(-ridge, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(30,15,5,.12)';
  ctx.beginPath(); ctx.moveTo(hw, -hh); ctx.lineTo(hw, hh); ctx.lineTo(ridge, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,210,.12)';
  ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(ridge, 0); ctx.lineTo(-ridge, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(-ridge, 0); ctx.lineTo(ridge, 0);
  ctx.moveTo(-hw, -hh); ctx.lineTo(-ridge, 0); ctx.lineTo(-hw, hh);
  ctx.moveTo(hw, -hh); ctx.lineTo(ridge, 0); ctx.lineTo(hw, hh);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-hw, -hh, w, h);
}

function drawHouses(ctx, m) {
  for (const hs of m.houses) {
    ctx.save(); ctx.translate(hs.x + 2, hs.y + 2.5); ctx.rotate(hs.a);
    ctx.fillStyle = 'rgba(50,35,15,.28)';
    ctx.fillRect(-hs.w / 2, -hs.h / 2, hs.w, hs.h);
    ctx.restore();
  }
  for (const hs of m.houses) {
    ctx.save(); ctx.translate(hs.x, hs.y); ctx.rotate(hs.a);
    hipRoof(ctx, hs.w, hs.h, hs.type === 'tavern' ? '#7a3524' : hs.color);
    if (hs.type === 'tavern') { // hanging sign
      ctx.fillStyle = '#d9b44a'; ctx.strokeStyle = INK; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(0, hs.h / 2 + 3.5, 3, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSpecials(ctx, m) {
  for (const sp of m.specials) {
    ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(sp.a);
    if (sp.kind === 'cathedral' || sp.kind === 'chapel') {
      const k = sp.k;
      ctx.scale(k, k);
      ctx.fillStyle = 'rgba(50,35,15,.3)';
      ctx.fillRect(-46, -9, 96, 22); ctx.fillRect(4, -22, 22, 50);
      const stone = '#8f8a80';
      ctx.save(); ctx.translate(2, 0); hipRoof(ctx, 74, 22, stone); ctx.restore();          // nave
      ctx.save(); ctx.translate(14, 0); ctx.rotate(Math.PI / 2); hipRoof(ctx, 50, 20, stone); ctx.restore(); // transept
      ctx.fillStyle = stone; ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(39, 0, 11, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); // apse
      ctx.save(); ctx.translate(-41, 0); hipRoof(ctx, 18, 18, '#7b766d'); ctx.restore(); // tower
      ctx.strokeStyle = '#e9dfc6'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-41, -5); ctx.lineTo(-41, 5); ctx.moveTo(-45, -1); ctx.lineTo(-37, -1); ctx.stroke();
    } else if (sp.kind === 'castle') {
      ctx.fillStyle = 'rgba(50,35,15,.3)';
      ctx.fillRect(-46, -42, 96, 96);
      ctx.fillStyle = '#cbbd98';
      ctx.fillRect(-48, -48, 96, 96);
      ctx.strokeStyle = '#5f584e'; ctx.lineWidth = 8;
      ctx.strokeRect(-48, -48, 96, 96);
      ctx.strokeStyle = '#a39c90'; ctx.lineWidth = 4.5;
      ctx.strokeRect(-48, -48, 96, 96);
      ctx.save(); ctx.translate(12, -6); hipRoof(ctx, 40, 40, '#86807a'); ctx.restore(); // keep
      ctx.save(); ctx.translate(-22, 22); hipRoof(ctx, 30, 14, '#9a5a3c'); ctx.restore(); // hall
      for (const [tx, ty] of [[-48, -48], [48, -48], [48, 48], [-48, 48]]) {
        ctx.fillStyle = 'rgba(50,35,15,.3)';
        ctx.beginPath(); ctx.arc(tx + 2, ty + 3, 12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8b847a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(tx, ty, 6, 0, TAU); ctx.stroke();
      }
      // gatehouse facing town
      ctx.fillStyle = '#7b756c'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(-56, -10, 16, 20); ctx.strokeRect(-56, -10, 16, 20);
      // banner
      ctx.fillStyle = '#8e3b26';
      ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(26, -10); ctx.lineTo(12, -14); ctx.closePath(); ctx.fill();
    } else if (sp.kind === 'mill') {
      ctx.rotate(-sp.a);
      ctx.fillStyle = 'rgba(50,35,15,.3)';
      ctx.beginPath(); ctx.arc(2, 3, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a08a68'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.rotate(sp.sail);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#efe5cc';
        ctx.fillRect(2, -3, 20, 6); ctx.strokeRect(2, -3, 20, 6);
      }
    }
    ctx.restore();
  }
}

function drawWalls(ctx, m) {
  if (!m.walls) return;
  const { pts, gates } = m.walls;
  ctx.lineJoin = 'round';
  poly(ctx, pts, true);
  ctx.strokeStyle = '#4f483f'; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = '#a19887'; ctx.lineWidth = 4.5; ctx.stroke();
  for (let i = 0; i < pts.length; i += 2) {
    const q = pts[i];
    ctx.fillStyle = '#8b847a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, TAU); ctx.fill(); ctx.stroke();
  }
  for (const g of gates) {
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.a);
    ctx.fillStyle = '#dccb9f';
    ctx.fillRect(-8, -g.w / 2, 16, g.w);
    const s = g.w / 2 + 6;
    for (const y of [-s, s]) {
      ctx.fillStyle = '#7b756c'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(-7, y - 5, 14, 10); ctx.strokeRect(-7, y - 5, 14, 10);
    }
    ctx.restore();
  }
}

function drawLabel(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y);
  if (l.angle) ctx.rotate(l.angle);
  ctx.font = `${l.italic ? 'italic ' : ''}${l.size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = l.halo || 'rgba(243,232,203,.9)'; ctx.lineWidth = 4;
  ctx.strokeText(l.text, 0, 0);
  ctx.fillStyle = l.color || INK;
  ctx.fillText(l.text, 0, 0);
  ctx.restore();
}

function drawFrame(ctx, m) {
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, WORLD - 28, WORLD - 28);
  ctx.lineWidth = 1;
  ctx.strokeRect(21, 21, WORLD - 42, WORLD - 42);

  // cartouche
  ctx.font = `46px ${FONT}`;
  const tw = Math.max(ctx.measureText(m.name).width, 220);
  const bx = 40, by = 40, bw = tw + 60, bh = 96;
  ctx.fillStyle = 'rgba(243,232,203,.94)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.lineWidth = .8; ctx.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
  ctx.fillStyle = '#7a2f1d';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(m.name, bx + bw / 2, by + 54);
  ctx.font = `italic 16px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText(`${m.houses.length} buildings · ${m.population} souls`, bx + bw / 2, by + 80);

  // compass
  const cx = WORLD - 92, cy = WORLD - 100;
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 8; i++) {
    const len = i % 2 ? 22 : 42;
    ctx.save(); ctx.rotate(i * Math.PI / 4);
    ctx.fillStyle = i % 2 ? '#c8b287' : INK;
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(6, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = i % 2 ? '#e6d6b0' : '#8e3b26';
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-6, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
  ctx.font = `20px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center';
  ctx.fillText('N', 0, -48);
  ctx.restore();

  // scale bar
  const sx = 46, sy = WORLD - 52;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#f3e8cb' : INK;
    ctx.fillRect(sx + i * 30, sy, 30, 6);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 120, 6);
  ctx.font = `italic 13px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.fillText('one hundred paces', sx, sy - 6);
}

function renderTown(ctx, m) {
  drawPaper(ctx, m);
  drawFields(ctx, m);
  drawRiver(ctx, m);
  drawRoads(ctx, m);
  drawTrees(ctx, m);
  drawPlaza(ctx, m);
  drawHouses(ctx, m);
  drawSpecials(ctx, m);
  drawWalls(ctx, m);
  for (const l of m.labels) drawLabel(ctx, l);
  drawFrame(ctx, m);
}

registerStyle({
  id: 'parchment',
  label: 'Parchment',
  fonts: ['46px "IM Fell English"', 'italic 16px "IM Fell English"'],
  render: renderTown,
  highlight(ctx, m, h, isPrimary) {
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(h.a);
    ctx.strokeStyle = isPrimary ? '#fff6c8' : '#f0c75e';
    ctx.lineWidth = isPrimary ? 3 : 2;
    ctx.strokeRect(-h.w / 2 - 2, -h.h / 2 - 2, h.w + 4, h.h + 4);
    ctx.restore();
  },
});
})();

