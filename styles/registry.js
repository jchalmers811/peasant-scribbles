'use strict';
/* Map styles ("modes"). Each style is a self-contained renderer for a town model:
 *
 *   registerStyle({
 *     id: 'parchment',               // stable key, saved in the viewer's browser
 *     label: 'Parchment',            // shown on the mode switcher
 *     fonts: ['46px "Some Font"'],   // canvas fonts to load before rendering (optional)
 *     render(ctx, model) {},         // draw the whole map in 1200x1200 world units
 *     highlight(ctx, model, house, isPrimary) {}, // hover outline (optional)
 *     pick(model, x, y) {},          // world point -> house under the cursor (optional)
 *   });
 *
 * Styles that draw buildings as 3D blocks share styles/raised.js.
 * Buttons appear in the order the style files are loaded in index.html.
 */
const TownStyles = [];

function registerStyle(style) {
  TownStyles.push(style);
}

function getStyle(id) {
  return TownStyles.find(s => s.id === id) || TownStyles[0];
}
