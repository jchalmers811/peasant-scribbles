'use strict';
/* Peasant Scribbles: deterministic medieval town generator.
 * generateTown(text) -> model; renderTown(ctx, model) draws it in a 1200x1200 world. */

const TAU = Math.PI * 2;
const WORLD = 1200, CX = 600, CY = 600;

// ---------- seeded randomness ----------
function hashStr(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) ^ (h1 >>> 0)) >>> 0;
}
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- language ----------
const STOP = new Set(('the and for are but not you all any can had her was one our out has him his how its may new now old see two way who did get let put say she too use that with have this will your from they know want been good much some time very when come here just like long make many more only over such take than them well were what into also then there their these those would could should about after again being which while where because before under above other each most into upon unto said went shall thee thou thy yet nor off own why ever even onto onto every through without within among until itself himself herself myself yours ours theirs whom whose does doing done just than then once both same some few here there').split(' '));

const FEATURES = {
  river:  { label: 'a river winds through it',     roots: ['river','stream','water','sea','lake','brook','flow','fish','boat','ship','rain','tide','wave','ocean','creek','bridge','sail','swim','shore','wet'] },
  castle: { label: 'a castle looms over it',        roots: ['castle','king','queen','lord','lady','knight','prince','princess','throne','crown','duke','fortress','royal','power','rule','tower','dragon'] },
  church: { label: 'a cathedral rises at its heart', roots: ['church','god','pray','prayer','faith','holy','soul','bell','priest','heaven','angel','saint','sacred','abbey','monk','bless','sin','hope','grace','spirit'] },
  market: { label: 'a market square bustles',        roots: ['market','trade','gold','coin','money','sell','buy','bought','merchant','price','shop','wine','fair','goods','silver','rich','cheese','eggs','milk','bread','apple'] },
  walls:  { label: 'stone walls ring it',           roots: ['wall','war','siege','guard','enemy','battle','sword','fight','army','defend','safe','fear','gate','soldier','attack','protect','shield','blood','spear','arrow'] },
  farm:   { label: 'farmland spreads around it',     roots: ['farm','field','wheat','harvest','grain','cow','sheep','corn','plough','plow','barley','soil','seed','grow','pasture','hay','summer','sun','earth'] },
  forest: { label: 'a great forest presses close',   roots: ['forest','wood','tree','oak','pine','wild','wolf','deer','leaf','leaves','green','hunt','root','moss','dark','owl','fox','bear'] },
  mill:   { label: 'a windmill turns in the fields', roots: ['mill','miller','flour','wind','windmill','bread','grind','storm','breeze'] },
  tavern: { label: 'a tavern keeps the lamps lit',   roots: ['tavern','inn','ale','beer','drink','song','sing','merry','feast','laugh','friend','mead','dance','music','night'] },
};

function matchesRoot(w, roots) {
  for (const r of roots) {
    if (w === r || w === r + 's' || w === r + 'es') return true;
    if (r.length >= 4 && w.startsWith(r)) return true;
  }
  return false;
}

function parseText(text) {
  const words = (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []);
  const content = words
    .map(w => w.replace(/'s$/, '').replace(/'/g, ''))
    .filter(w => w.length > 2 && !STOP.has(w));
  const sentences = text.split(/[.!?;\n]+/).filter(s => /[a-z]/i.test(s));
  const feats = {};
  for (const k in FEATURES) feats[k] = [];
  const freq = new Map();
  for (const w of content) {
    freq.set(w, (freq.get(w) || 0) + 1);
    for (const k in FEATURES) {
      if (matchesRoot(w, FEATURES[k].roots) && !feats[k].includes(w)) feats[k].push(w);
    }
  }
  let top = null, topN = 0;
  for (const [w, n] of freq) if (n > topN || (n === topN && w.length > top.length)) { top = w; topN = n; }
  return { words, content, sentences, feats, top };
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- geometry helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI;
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return Math.sqrt(x * x + y * y);
}
// sample points of an oriented rectangle: corners, center, edge midpoints
function rectSamples(x, y, w, h, a) {
  const c = Math.cos(a), s = Math.sin(a), out = [];
  for (const [u, v] of [[0,0],[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[0,-.5],[0,.5],[-.5,0],[.5,0],[-.25,-.5],[.25,-.5],[-.25,.5],[.25,.5]]) {
    const lx = u * w, ly = v * h;
    out.push([x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  return out;
}

class Grid {
  constructor(cs) { this.cs = cs; this.m = new Map(); }
  add(item, x0, y0, x1, y1) {
    const cs = this.cs;
    for (let i = Math.floor(x0 / cs); i <= Math.floor(x1 / cs); i++)
      for (let j = Math.floor(y0 / cs); j <= Math.floor(y1 / cs); j++) {
        const k = i * 10007 + j;
        let a = this.m.get(k);
        if (!a) this.m.set(k, a = []);
        a.push(item);
      }
  }
  any(x, y, r, fn) {
    const cs = this.cs;
    for (let i = Math.floor((x - r) / cs); i <= Math.floor((x + r) / cs); i++)
      for (let j = Math.floor((y - r) / cs); j <= Math.floor((y + r) / cs); j++) {
        const a = this.m.get(i * 10007 + j);
        if (a) for (const it of a) if (fn(it)) return true;
      }
    return false;
  }
}

// ---------- generator ----------
function generateTown(text) {
  const p = parseText(text);
  const rnd = mulberry(hashStr(text.trim() || 'an empty page'));
  const rand = (a, b) => a + (b - a) * rnd();
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const has = k => p.feats[k].length > 0;

  const houseWords = p.content.slice(0, 1500);
  const n = houseWords.length;
  const townR = clamp(95 + Math.sqrt(n) * 17, 130, 460);
  const plazaR = has('market') ? 50 : 34;

  // collision structures
  const obstacles = new Grid(40);
  const segGrid = new Grid(50);
  const riverGrid = new Grid(50);
  const addCircle = (x, y, r) => obstacles.add({ x, y, r }, x - r, y - r, x + r, y + r);
  const isFree = (x, y, r) => !obstacles.any(x, y, r, o => Math.hypot(o.x - x, o.y - y) < o.r + r);
  addCircle(CX, CY, plazaR + 4);

  const roads = [];
  const addRoad = road => {
    road.id = roads.length;
    roads.push(road);
    const pts = road.pts;
    for (const q of pts) q.d = Math.hypot(q.x - CX, q.y - CY);
    const segs = road.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], hw = road.w / 2;
      const s = { ax: a.x, ay: a.y, bx: b.x, by: b.y, w: road.w, road: road.id };
      segGrid.add(s, Math.min(a.x, b.x) - hw, Math.min(a.y, b.y) - hw, Math.max(a.x, b.x) + hw, Math.max(a.y, b.y) + hw);
    }
  };
  const onRoad = (x, y, clear, except = -1) =>
    segGrid.any(x, y, clear + 8, s => s.road !== except && distSeg(x, y, s.ax, s.ay, s.bx, s.by) < s.w / 2 + clear);
  let river = null;
  const onRiver = (x, y, clear) => river !== null &&
    riverGrid.any(x, y, clear + river.w, s => distSeg(x, y, s.ax, s.ay, s.bx, s.by) < river.w / 2 + clear);
  const rectClear = (x, y, w, h, a, roadClear, riverClear) => {
    for (const [sx, sy] of rectSamples(x, y, w, h, a)) {
      if (onRoad(sx, sy, roadClear) || onRiver(sx, sy, riverClear)) return false;
    }
    return true;
  };

  // --- main roads: one per sentence (3..8) ---
  const nRoads = clamp(p.sentences.length + 2, 3, 8);
  const base = rnd() * TAU;
  const mainAngles = [];
  for (let i = 0; i < nRoads; i++) {
    const a = base + i * TAU / nRoads + rand(-.25, .25) * TAU / nRoads;
    mainAngles.push(a);
    let x = CX + Math.cos(a) * plazaR * 0.85, y = CY + Math.sin(a) * plazaR * 0.85;
    const pts = [{ x, y }];
    let dir = a;
    const wob = rand(.05, .14);
    while (x > -40 && x < WORLD + 40 && y > -40 && y < WORLD + 40 && pts.length < 200) {
      dir += rand(-wob, wob);
      dir += angDiff(a, dir) * 0.08;
      x += Math.cos(dir) * 16; y += Math.sin(dir) * 16;
      pts.push({ x, y });
    }
    addRoad({ pts, w: i < 2 ? 13 : 10, kind: 'main' });
  }

  // --- ring roads ---
  const ringRs = [];
  if (townR > 220) ringRs.push(townR * rand(.5, .6));
  if (townR > 380) ringRs.push(townR * rand(.8, .86));
  for (const rr of ringRs) {
    const ph1 = rand(0, TAU), ph2 = rand(0, TAU), pts = [];
    for (let k = 0; k < 90; k++) {
      const t = k / 90 * TAU;
      const r = rr * (1 + 0.07 * Math.sin(3 * t + ph1) + 0.04 * Math.sin(5 * t + ph2));
      pts.push({ x: CX + Math.cos(t) * r, y: CY + Math.sin(t) * r });
    }
    addRoad({ pts, w: 9, kind: 'ring', closed: true });
  }

  // --- river ---
  if (has('river')) {
    const th = rand(0, TAU), ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    const w = rand(22, 32), A1 = rand(20, 45), f1 = rand(.004, .008), A2 = rand(5, 14), f2 = rand(.015, .03);
    const ph1 = rand(0, TAU), ph2 = rand(0, TAU);
    const minOff = plazaR + w / 2 + A1 + A2 + 14;
    const off = (rnd() < .5 ? -1 : 1) * Math.max(minOff, rand(.1, .45) * townR);
    const ox = CX + nx * off, oy = CY + ny * off, pts = [];
    for (let s = -950; s <= 950; s += 10) {
      const wv = A1 * Math.sin(s * f1 + ph1) + A2 * Math.sin(s * f2 + ph2) - A1 * Math.sin(ph1) - A2 * Math.sin(ph2);
      pts.push({ x: ox + ux * s + nx * wv, y: oy + uy * s + ny * wv });
    }
    river = { pts, w };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], hw = w / 2;
      riverGrid.add({ ax: a.x, ay: a.y, bx: b.x, by: b.y }, Math.min(a.x, b.x) - hw, Math.min(a.y, b.y) - hw, Math.max(a.x, b.x) + hw, Math.max(a.y, b.y) + hw);
    }
  }

  // gaps between main roads, largest first (for big buildings)
  const sorted = mainAngles.map(a => ((a % TAU) + TAU) % TAU).sort((a, b) => a - b);
  const gaps = sorted.map((a, i) => {
    const b = i === sorted.length - 1 ? sorted[0] + TAU : sorted[i + 1];
    return { mid: (a + b) / 2, size: b - a };
  }).sort((a, b) => b.size - a.size);

  const specials = [];
  const labels = [];

  const placeBig = (angle, d0, w, h, circles, kind) => {
    for (let tries = 0; tries < 40; tries++) {
      const d = d0 + tries * 8;
      const a = angle + (tries % 2 ? 1 : -1) * Math.floor(tries / 2) * 0.03;
      const x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
      if (!rectClear(x, y, w, h, a, 3, 4)) continue;
      const c = Math.cos(a), s = Math.sin(a);
      const world = circles.map(([u, v, r]) => [x + u * c - v * s, y + u * s + v * c, r]);
      if (!world.every(([cx, cy, r]) => isFree(cx, cy, r))) continue;
      world.forEach(([cx, cy, r]) => addCircle(cx, cy, r));
      const sp = { kind, x, y, a, w, h, d: d + Math.hypot(w, h) / 2 };
      specials.push(sp);
      return sp;
    }
    return null;
  };

  // --- cathedral / chapel ---
  const bigChurch = has('church');
  if (bigChurch || n > 40) {
    const k = bigChurch ? 1 : 0.65;
    const sp = placeBig(gaps[0].mid, plazaR + 52 * k, 96 * k, 50 * k,
      [[-30 * k, 0, 18 * k], [0, 0, 27 * k], [32 * k, 0, 18 * k]], bigChurch ? 'cathedral' : 'chapel');
    if (sp) { sp.k = k; labels.push({ text: bigChurch ? 'Cathedral' : 'Chapel', x: sp.x, y: sp.y + 34 * k + 12, size: 15 }); }
  }
  // --- castle ---
  if (has('castle')) {
    const g = gaps[1] || gaps[0];
    const sp = placeBig(g.mid, Math.max(townR * .72, plazaR + 150), 120, 120,
      [[0, 0, 70]], 'castle');
    if (sp) labels.push({ text: 'Castle', x: sp.x, y: sp.y + 78, size: 17 });
  }

  // --- lanes branching off main roads ---
  for (const road of roads.filter(r => r.kind === 'main')) {
    const pts = road.pts;
    let next = rand(20, 60);
    let travelled = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      travelled += 16;
      const pd = pts[i].d;
      if (pd < plazaR + 40 || pd > townR * .92) continue;
      if (travelled < next) continue;
      travelled = 0; next = rand(45, 95);
      if (rnd() < .35) continue;
      const rd = Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);
      let dir = rd + (rnd() < .5 ? 1 : -1) * (Math.PI / 2 + rand(-.45, .45));
      let x = pts[i].x, y = pts[i].y;
      const lane = [{ x, y }];
      const len = rand(50, 130), id = roads.length;
      for (let s = 0; s < len; s += 12) {
        dir += rand(-.15, .15);
        const nx = x + Math.cos(dir) * 12, ny = y + Math.sin(dir) * 12;
        const nd = Math.hypot(nx - CX, ny - CY);
        if (nd > townR * .98 || nd < plazaR + 8 || !isFree(nx, ny, 6) || onRiver(nx, ny, 4)) break;
        x = nx; y = ny;
        lane.push({ x, y });
        if (lane.length > 2 && onRoad(x, y, 2, id)) break; // joined another street
      }
      if (lane.length >= 3) addRoad({ pts: lane, w: 6, kind: 'lane' });
    }
  }

  // --- houses: one per word, growing outward from the square ---
  const PALETTE = ['#b0603a', '#9a4f33', '#c27a4a', '#7d7468', '#a8875a', '#8f5a3c', '#6e6a64', '#b8935e', '#94523a'];
  const frontage = [];
  for (const road of roads) for (let i = 0; i < road.pts.length - 1; i++) frontage.push({ road, i, d: road.pts[i].d });
  frontage.sort((a, b) => a.d - b.d);
  const lowerBound = d => { let lo = 0, hi = frontage.length; while (lo < hi) { const m = (lo + hi) >> 1; if (frontage[m].d < d) lo = m + 1; else hi = m; } return lo; };

  const houses = [];
  let skipped = 0;
  houseWords.forEach((word, idx) => {
    const len = word.length;
    let w = 9 + Math.min(len, 13) * 1.6;
    let h = rand(8, 12) + (len > 8 ? 3 : 0);
    if (h > w) [w, h] = [h, w];
    let g = plazaR + 18 + (townR - plazaR) * Math.sqrt((idx + 1) / n);
    for (let round = 0; round < 4; round++, g += 30) {
      const lo = lowerBound(g - 90), hi = lowerBound(g);
      if (hi <= lo) continue;
      for (let attempt = 0; attempt < 25; attempt++) {
        const f = frontage[lo + Math.floor(rnd() * (hi - lo))];
        const a0 = f.road.pts[f.i], a1 = f.road.pts[(f.i + 1) % f.road.pts.length];
        const t = rnd();
        const bx = a0.x + (a1.x - a0.x) * t, by = a0.y + (a1.y - a0.y) * t;
        const dir = Math.atan2(a1.y - a0.y, a1.x - a0.x);
        const side = rnd() < .5 ? 1 : -1;
        const row = rnd() < .55 ? 0 : rnd() < .6 ? 1 : 2;
        const off = f.road.w / 2 + 2.5 + h / 2 + row * (h + rand(4, 8));
        const x = bx - Math.sin(dir) * off * side, y = by + Math.cos(dir) * off * side;
        const a = dir + rand(-.07, .07);
        if (x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
        if (Math.hypot(x - CX, y - CY) < plazaR + w / 2 + 2) continue;
        const c = Math.cos(a), s = Math.sin(a);
        const k = Math.max(1, Math.round(w / h));
        const circles = [];
        for (let j = 0; j < k + 1; j++) {
          const u = k === 0 ? 0 : (-w / 2 + h / 2) + (w - h) * (j / k);
          circles.push([x + u * c, y + u * s, h / 2 + 1.5]);
        }
        if (!circles.every(([cx, cy, r]) => isFree(cx, cy, r))) continue;
        if (!rectClear(x, y, w, h, a, 1.2, 3)) continue;
        circles.forEach(([cx, cy, r]) => addCircle(cx, cy, r));
        houses.push({
          x, y, w, h, a, word, idx,
          d: Math.hypot(x - CX, y - CY) + w / 2,
          color: PALETTE[hashStr(word) % PALETTE.length],
          type: len <= 3 ? 'hovel' : len === 4 ? 'hut' : len <= 6 ? 'cottage' : len <= 8 ? 'house' : len <= 10 ? 'hall' : 'manor',
        });
        return;
      }
    }
    skipped++;
  });

  // --- tavern: the house nearest the square ---
  let tavern = null;
  if (houses.length >= 12) {
    tavern = houses.reduce((best, hh) => (hh.d < best.d ? hh : best), houses[0]);
    const a = has('tavern') ? pick(p.feats.tavern) : pick(houseWords);
    let b = pick(houseWords);
    for (let i = 0; i < 5 && b === a; i++) b = pick(houseWords);
    tavern.type = 'tavern';
    tavern.tavernName = `The ${cap(a)} & ${cap(b)}`;
    labels.push({ text: tavern.tavernName, x: tavern.x, y: tavern.y - 16, size: 12, italic: true });
  }

  // --- town extent per angular sector (used by walls, fields, trees) ---
  const K = 36;
  let sector = new Array(K).fill(Math.max(plazaR + 30, townR * .35));
  const sectorOf = (x, y) => Math.floor((((Math.atan2(y - CY, x - CX)) % TAU + TAU) % TAU) / TAU * K) % K;
  for (const hh of houses) { const k = sectorOf(hh.x, hh.y); sector[k] = Math.max(sector[k], hh.d); }
  for (const sp of specials) {
    const k = sectorOf(sp.x, sp.y);
    for (let j = -2; j <= 2; j++) { const kk = (k + j + K) % K; sector[kk] = Math.max(sector[kk], sp.d); }
  }
  for (let it = 0; it < 3; it++) {
    sector = sector.map((r, k) => Math.max(r, (sector[(k + K - 1) % K] + sector[(k + 1) % K]) / 2 - 4, sector[(k + K - 1) % K] * .82, sector[(k + 1) % K] * .82));
  }
  const extentAt = theta => {
    // sector k's value sits at the centre of the sector, (k + 0.5)
    const f = ((theta % TAU + TAU) % TAU) / TAU * K - .5;
    const g0 = Math.floor(f), t = f - g0;
    const a = sector[(g0 % K + K) % K], b = sector[((g0 + 1) % K + K) % K];
    return a + (b - a) * t;
  };

  // --- walls ---
  let walls = null;
  const wantWalls = has('walls') || p.content.length > 160;
  if (wantWalls && houses.length > 8) {
    const pts = [];
    for (let k = 0; k < K; k++) {
      const th = (k + .5) / K * TAU, r = sector[k] + 16;
      pts.push({ x: CX + Math.cos(th) * r, y: CY + Math.sin(th) * r });
    }
    const gates = [];
    for (const road of roads.filter(r => r.kind === 'main')) {
      for (let i = 1; i < road.pts.length; i++) {
        const q = road.pts[i];
        if (q.d > extentAt(Math.atan2(q.y - CY, q.x - CX)) + 16) {
          const pr = road.pts[i - 1];
          gates.push({ x: q.x, y: q.y, a: Math.atan2(q.y - pr.y, q.x - pr.x), w: road.w });
          break;
        }
      }
    }
    walls = { pts, gates };
  }
  const outerAt = theta => extentAt(theta) + (walls ? 32 : 22);
  const outside = (x, y, margin = 0) => Math.hypot(x - CX, y - CY) > outerAt(Math.atan2(y - CY, x - CX)) + margin;

  // --- fields & windmill ---
  const fields = [];
  const mains = roads.filter(r => r.kind === 'main');
  const FIELD_COLORS = ['#cdc68a', '#b9b877', '#d8c47c', '#a9b26f', '#cfb46b', '#bfc183', '#c4a96a'];
  const placeOutside = (w, h, rows) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const road = pick(mains);
      const cands = [];
      for (let i = 0; i < road.pts.length - 1; i++) {
        const q = road.pts[i];
        if (q.x > 30 && q.y > 30 && q.x < WORLD - 30 && q.y < WORLD - 30 && outside(q.x, q.y, 10)) cands.push(i);
      }
      if (!cands.length) continue;
      const i = pick(cands), a0 = road.pts[i], a1 = road.pts[i + 1];
      const dir = Math.atan2(a1.y - a0.y, a1.x - a0.x), side = rnd() < .5 ? 1 : -1;
      const row = Math.floor(rnd() * rows);
      const off = road.w / 2 + 4 + h / 2 + row * (h + 5);
      const x = a0.x - Math.sin(dir) * off * side, y = a0.y + Math.cos(dir) * off * side;
      const a = dir + rand(-.1, .1);
      const samples = rectSamples(x, y, w, h, a);
      if (!samples.every(([sx, sy]) => sx > 26 && sy > 26 && sx < WORLD - 26 && sy < WORLD - 26 && outside(sx, sy))) continue;
      if (!rectClear(x, y, w, h, a, 2, 4)) continue;
      const c = Math.cos(a), s = Math.sin(a), k = Math.max(1, Math.round(w / h));
      const circles = [];
      for (let j = 0; j <= k; j++) { const u = -w / 2 + h / 2 + (w - h) * (j / k); circles.push([x + u * c, y + u * s, h / 2 + 2]); }
      if (!circles.every(([cx, cy, r]) => isFree(cx, cy, r))) continue;
      circles.forEach(([cx, cy, r]) => addCircle(cx, cy, r));
      return { x, y, w, h, a };
    }
    return null;
  };
  if (has('mill')) {
    const m = placeOutside(26, 26, 2);
    if (m) { specials.push({ kind: 'mill', ...m, sail: rand(0, TAU) }); labels.push({ text: 'Mill', x: m.x, y: m.y + 26, size: 12, italic: true }); }
  }
  const nFields = has('farm') ? 90 : 22;
  for (let i = 0; i < nFields; i++) {
    const w = rand(45, 85), h = rand(26, 46);
    const f = placeOutside(Math.max(w, h), Math.min(w, h), 4);
    if (f) fields.push({ ...f, color: pick(FIELD_COLORS), furrow: rnd() < .5 });
  }

  // --- trees ---
  const trees = [];
  const tryTree = (x, y) => {
    const r = rand(5.5, 10.5);
    if (x < 26 + r || y < 26 + r || x > WORLD - 26 - r || y > WORLD - 26 - r) return;
    if (!outside(x, y, -4) || !isFree(x, y, r * .75) || onRoad(x, y, r * .6) || onRiver(x, y, r * .5)) return;
    addCircle(x, y, r * .75);
    trees.push({ x, y, r, shade: rnd() });
  };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  if (has('forest')) {
    const fa = (gaps[2] || gaps[0]).mid + Math.PI * .6;
    const fd = outerAt(fa) + 170;
    const fx = clamp(CX + Math.cos(fa) * fd, 150, WORLD - 150), fy = clamp(CY + Math.sin(fa) * fd, 150, WORLD - 150);
    for (let i = 0; i < 900; i++) tryTree(fx + gauss() * 240, fy + gauss() * 240);
  }
  for (let i = 0; i < 260; i++) tryTree(rand(0, WORLD), rand(0, WORLD));
  if (river) {
    for (let i = 0; i < 160; i++) {
      const j = Math.floor(rand(0, river.pts.length - 1)), a = river.pts[j], b = river.pts[j + 1];
      const dir = Math.atan2(b.y - a.y, b.x - a.x), side = rnd() < .5 ? 1 : -1, off = river.w / 2 + rand(8, 40);
      tryTree(a.x - Math.sin(dir) * off * side, a.y + Math.cos(dir) * off * side);
    }
  }

  // --- river label ---
  if (river) {
    const name = cap(pick(p.feats.river.concat(p.content)) || 'Mere');
    let best = null;
    for (let i = 1; i < river.pts.length - 1; i++) {
      const q = river.pts[i];
      if (q.x < 120 || q.y < 120 || q.x > WORLD - 120 || q.y > WORLD - 120) continue;
      const dd = Math.abs(Math.hypot(q.x - CX, q.y - CY) - (outerAt(Math.atan2(q.y - CY, q.x - CX)) + 90));
      if (!best || dd < best.dd) best = { i, dd };
    }
    if (best) {
      const a = river.pts[best.i - 1], b = river.pts[best.i + 1], q = river.pts[best.i];
      let ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      labels.push({ text: `River ${name}`, x: q.x, y: q.y, size: 15, italic: true, angle: ang, color: '#2f5363', halo: 'rgba(127,167,181,0)' });
    }
  }
  if (has('market')) labels.push({ text: 'Market', x: CX, y: CY - plazaR - 10, size: 13, italic: true });

  // --- name ---
  const nameWord = p.top || 'nowhere';
  let stem = nameWord.replace(/(ings?|ed|ly|ness|es|s|e|y)$/, '');
  if (stem.length < 3) stem = nameWord;
  stem = stem.slice(0, 6);
  // avoid clunky endings like "Grandm-": drop trailing consonants after a cluster
  while (stem.length > 3 && /[^aeiouy]{2}$/.test(stem) && !/(nd|rd|ld|st|ck|ng|rn|rk|th|sh|ll|ss|rt|nt|lt|ht|gh)$/.test(stem)) stem = stem.slice(0, -1);
  const suffixes = has('river') ? ['ford', 'mouth', 'bridge', 'wick', 'mere']
    : has('castle') ? ['castle', 'burgh', 'keep', 'borough']
    : has('church') ? ['minster', 'chester', 'kirk', 'abbey']
    : ['bury', 'ham', 'ton', 'stead', 'by', 'thorpe', 'wick', 'field', 'ley'];
  const name = cap(stem) + pick(suffixes);

  const population = houses.reduce((sum, hh) => sum + 2 + (hashStr(hh.word) % 5) + (hh.type === 'manor' ? 6 : 0), 0);

  return {
    name, parsed: p, roads, river, houses, specials, walls, fields, trees, labels, tavern,
    plazaR, market: has('market'), townR, skipped, population, seed: rnd,
    paperSeed: hashStr(text + '#paper'),
  };
}

// ---------- rendering ----------
const INK = '#3b2a1a';
const FONT = '"IM Fell English", Georgia, serif';

function poly(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
}

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
  if (!m.river) return;
  for (const r of m.roads) {
    const segs = r.closed ? r.pts.length : r.pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let wet = false;
      for (let j = 0; j < m.river.pts.length - 1 && !wet; j++) {
        const p0 = m.river.pts[j], p1 = m.river.pts[j + 1];
        if (distSeg(mx, my, p0.x, p0.y, p1.x, p1.y) < m.river.w / 2 + 5) wet = true;
      }
      if (!wet) continue;
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const ex = dx / L * 3, ey = dy / L * 3;
      ctx.beginPath(); ctx.moveTo(a.x - ex, a.y - ey); ctx.lineTo(b.x + ex, b.y + ey);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#5e554a'; ctx.lineWidth = r.w + 7; ctx.stroke();
      ctx.strokeStyle = '#c4b89f'; ctx.lineWidth = r.w + 1; ctx.stroke();
      ctx.lineCap = 'round';
    }
  }
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

// hit-test a world point against houses
function houseAt(m, x, y) {
  for (let i = m.houses.length - 1; i >= 0; i--) {
    const h = m.houses[i];
    const c = Math.cos(-h.a), s = Math.sin(-h.a);
    const dx = x - h.x, dy = y - h.y;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    if (Math.abs(lx) <= h.w / 2 + 1 && Math.abs(ly) <= h.h / 2 + 1) return h;
  }
  return null;
}
