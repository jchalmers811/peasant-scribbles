'use strict';
/* Page glue: textarea -> generateTown -> the chosen map style -> canvas.
 * Also the style switcher, hover tooltips and PNG export. Knows nothing about
 * how any style draws; see styles/registry.js for the style contract. */

const SAMPLES = {
  tale: `Once upon a time a young princess lived in a castle beside a cold river. Every night she climbed the tower and watched the boats drift toward the sea. The king feared a dragon in the dark forest, so his knights guarded the gate. One morning the miller's son brought bread and a song, and the whole town gathered in the market to dance.`,
  shanty: `Haul away, boys, the tide is turning! The ship is waiting by the shore. We'll drink our ale at the harbour tavern, then sail across the stormy sea once more. Oh the wind will blow and the waves will roar, and the fish will leap by the river's mouth. Sing, my friends, of the silver coins we'll trade in the market down south.`,
  war: `In the winter of the long siege, the enemy army camped beneath the walls. Soldiers stood guard at every gate with spear and shield. The lord prayed in the cathedral while arrows fell like rain. For forty days they fought and bled. When spring came, the battle ended, and the bells rang out over the ruined fields.`,
  list: `Eggs, milk, two loaves of bread, cheese, apples, flour for the cake, a bottle of wine, candles, soap, string, nails for the shed, seeds for the garden, and something nice for Grandmother.`,
};

const WORLD_SIZE = 1200;
const RENDER_SCALE = 2;
const STORE = { text: 'text-to-town:text', style: 'text-to-town:style' };
const DEFAULT_STYLE = 'conquest'; // for visitors who haven't picked a style yet

const textEl = document.getElementById('text');
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const chronicle = document.getElementById('chronicle');
const modeButtons = document.getElementById('modes');

const offscreen = document.createElement('canvas');
offscreen.width = offscreen.height = WORLD_SIZE * RENDER_SCALE;
const offCtx = offscreen.getContext('2d');

let model = null;
let hovered = null;
let style = getStyle(load(STORE.style) || DEFAULT_STYLE);
let paintToken = 0;

function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- building & painting ----------
function build() {
  model = generateTown(textEl.value);
  writeChronicle();
  save(STORE.text, textEl.value);
  paint();
}

// render the current model with the current style (after its fonts load)
async function paint() {
  const token = ++paintToken;
  if (document.fonts && style.fonts) {
    await Promise.all(style.fonts.map(f => document.fonts.load(f).catch(() => {})));
  }
  if (token !== paintToken || !model) return; // a newer paint superseded this one
  offCtx.setTransform(1, 0, 0, 1, 0, 0);
  offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
  offCtx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  style.render(offCtx, model);
  hovered = null;
  tooltip.hidden = true;
  sizeCanvas();
}

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const px = Math.round(rect.width * (window.devicePixelRatio || 1));
  if (px && canvas.width !== px) canvas.width = canvas.height = px;
  draw();
}

function draw() {
  if (!model) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  if (!hovered || !style.highlight) return;
  const s = canvas.width / WORLD_SIZE;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  for (const h of model.houses) {
    if (h.word === hovered.word) style.highlight(ctx, model, h, h === hovered);
  }
}

// ---------- style switcher ----------
function setStyle(id) {
  style = getStyle(id);
  save(STORE.style, style.id);
  document.body.dataset.mode = style.id;
  for (const b of modeButtons.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.style === style.id));
  paint();
}

for (const s of TownStyles) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.style = s.id;
  b.textContent = s.label;
  b.addEventListener('click', () => setStyle(s.id));
  modeButtons.appendChild(b);
}

// ---------- chronicle ----------
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

// ---------- interaction ----------
canvas.addEventListener('mousemove', e => {
  if (!model) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * WORLD_SIZE;
  const y = (e.clientY - rect.top) / rect.height * WORLD_SIZE;
  const h = (style.pick || houseAt)(model, x, y);
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
  a.download = `${model.name.toLowerCase()}-${style.id}.png`;
  a.href = offscreen.toDataURL('image/png');
  a.click();
});
window.addEventListener('resize', sizeCanvas);

textEl.value = load(STORE.text) || SAMPLES.tale;
setStyle(style.id);
build();
