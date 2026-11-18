'use strict';
/* UI glue: textarea -> generateTown -> canvas, plus hover tooltips and PNG export. */

const SAMPLES = {
  tale: `Once upon a time a young princess lived in a castle beside a cold river. Every night she climbed the tower and watched the boats drift toward the sea. The king feared a dragon in the dark forest, so his knights guarded the gate. One morning the miller's son brought bread and a song, and the whole town gathered in the market to dance.`,
  shanty: `Haul away, boys, the tide is turning! The ship is waiting by the shore. We'll drink our ale at the harbour tavern, then sail across the stormy sea once more. Oh the wind will blow and the waves will roar, and the fish will leap by the river's mouth. Sing, my friends, of the silver coins we'll trade in the market down south.`,
  war: `In the winter of the long siege, the enemy army camped beneath the walls. Soldiers stood guard at every gate with spear and shield. The lord prayed in the cathedral while arrows fell like rain. For forty days they fought and bled. When spring came, the battle ended, and the bells rang out over the ruined fields.`,
  list: `Eggs, milk, two loaves of bread, cheese, apples, flour for the cake, a bottle of wine, candles, soap, string, nails for the shed, seeds for the garden, and something nice for Grandmother.`,
};

const WORLD_SIZE = 1200;
const RENDER_SCALE = 2;

const textEl = document.getElementById('text');
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const chronicle = document.getElementById('chronicle');

const offscreen = document.createElement('canvas');
offscreen.width = offscreen.height = WORLD_SIZE * RENDER_SCALE;
const offCtx = offscreen.getContext('2d');

let model = null;
let hovered = null;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function build() {
  model = generateTown(textEl.value);
  offCtx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  renderTown(offCtx, model);
  hovered = null;
  tooltip.hidden = true;
  sizeCanvas();
  writeChronicle();
  try { localStorage.setItem('text-to-town:text', textEl.value); } catch (e) { /* storage unavailable */ }
}

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(rect.width * dpr);
  if (canvas.width !== px) canvas.width = canvas.height = px;
  draw();
}

function draw() {
  if (!model) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  if (!hovered) return;
  const s = canvas.width / WORLD_SIZE;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  for (const h of model.houses) {
    if (h.word !== hovered.word) continue;
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(h.a);
    ctx.strokeStyle = h === hovered ? '#fff6c8' : '#f0c75e';
    ctx.lineWidth = h === hovered ? 3 : 2;
    ctx.strokeRect(-h.w / 2 - 2, -h.h / 2 - 2, h.w + 4, h.h + 4);
    ctx.restore();
  }
}

function writeChronicle() {
  const m = model, p = m.parsed;
  if (!p.content.length) {
    chronicle.innerHTML = `<h2>${escapeHtml(m.name)}</h2><p class="stats">An empty page raises an empty hamlet. Write a few sentences to found a town.</p>`;
    return;
  }
  const items = [];
  for (const k in FEATURES) {
    const trig = p.feats[k];
    if (!trig.length) continue;
    const shown = trig.slice(0, 4).map(w => `<em>${escapeHtml(w)}</em>`).join(', ');
    items.push(`<li>${FEATURES[k].label}, because you wrote ${shown}${trig.length > 4 ? '…' : ''}.</li>`);
  }
  if (m.walls && !p.feats.walls.length) items.push(`<li>stone walls ring it, because a town this large needs them.</li>`);
  if (m.tavern) items.push(`<li>its tavern is called <em>${escapeHtml(m.tavern.tavernName)}</em>.</li>`);
  const n = p.sentences.length;
  chronicle.innerHTML = `
    <h2>${escapeHtml(m.name)}</h2>
    <p class="stats">${m.houses.length} buildings · ${m.population} souls · ${Math.min(Math.max(n + 2, 3), 8)} high roads from ${n} sentence${n === 1 ? '' : 's'}${m.skipped ? ` · ${m.skipped} words found no room` : ''}</p>
    <p>Named for its most-used word, <em>${escapeHtml(p.top)}</em>.</p>
    ${items.length ? `<ul>${items.join('')}</ul>` : '<p>A plain market town with no particular distinctions. Mention rivers, kings, prayers or wars to change that.</p>'}
    <p class="hint">Hover any building to see the word that built it.</p>`;
}

canvas.addEventListener('mousemove', e => {
  if (!model) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * WORLD_SIZE;
  const y = (e.clientY - rect.top) / rect.height * WORLD_SIZE;
  const h = houseAt(model, x, y);
  if (h !== hovered) { hovered = h; draw(); }
  if (h) {
    const wrap = canvas.parentElement.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.style.left = `${e.clientX - wrap.left}px`;
    tooltip.style.top = `${e.clientY - wrap.top}px`;
    const label = h.type === 'tavern' ? h.tavernName : `a ${h.type}`;
    const count = model.houses.filter(o => o.word === h.word).length;
    tooltip.innerHTML = `“${escapeHtml(h.word)}” <small>${escapeHtml(label)}${count > 1 ? ` · ${count} like it` : ''}</small>`;
  } else {
    tooltip.hidden = true;
  }
});
canvas.addEventListener('mouseleave', () => { hovered = null; tooltip.hidden = true; draw(); });

let debounce = null;
textEl.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(build, 450);
});
document.querySelectorAll('[data-sample]').forEach(btn => btn.addEventListener('click', () => {
  textEl.value = SAMPLES[btn.dataset.sample];
  build();
}));
document.getElementById('download').addEventListener('click', () => {
  if (!model) return;
  const a = document.createElement('a');
  a.download = `${model.name.toLowerCase()}.png`;
  a.href = offscreen.toDataURL('image/png');
  a.click();
});
window.addEventListener('resize', sizeCanvas);

let saved = null;
try { saved = localStorage.getItem('text-to-town:text'); } catch (e) { /* storage unavailable */ }
textEl.value = saved || SAMPLES.tale;

// wait for the map font so the first render uses it
(document.fonts ? document.fonts.load('46px "IM Fell English"').catch(() => {}) : Promise.resolve()).then(build);
