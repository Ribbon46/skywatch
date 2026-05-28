#!/usr/bin/env node
/* build-catalogs.js — regenerate js/catalogs.js from data/*.json.
 *   node scripts/build-catalogs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT  = path.join(ROOT, 'js', 'catalogs.js');

const sources = [
  ['MESSIER_DATA',        'messier.json'],
  ['NGC_DATA',            'ngc.json'],
  ['STARS_DATA',          'stars.json'],
  ['METEOR_SHOWERS_DATA', 'meteor-showers.json'],
  ['CAMERAS_DATA',        'cameras.json'],
  ['LENSES_DATA',         'lenses.json'],
  ['PLANNER_SPOTS_DATA',  'planner-spots.json']
];

const banner =
`/* catalogs.js — embedded data so the app works from file:// without a server.
 * Auto-generated from data/*.json by scripts/build-catalogs.js — do not hand-edit.
 */
`;

let out = banner + '\n';
let totalKB = 0;
for (const [varName, file] of sources) {
  const p = path.join(DATA, file);
  if (!fs.existsSync(p)) { console.warn('skip (missing):', file); continue; }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const json = JSON.stringify(data);
  out += `window.${varName} = ${json};\n\n`;
  totalKB += json.length / 1024;
  console.log(`  ${varName.padEnd(22)} ${String(data.length).padStart(4)} items   ${(json.length/1024).toFixed(1).padStart(6)} KB`);
}

fs.writeFileSync(OUT, out);
console.log(`\nwrote ${path.relative(ROOT, OUT)}   total ${totalKB.toFixed(1)} KB`);
