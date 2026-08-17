// Behavioral verification of the show-all toggles using a real DOM (jsdom).
// Asserts both the class toggling AND that the CSS contains the rule that
// actually hides collapsed rows (.toggle-hidden with !important).
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

let failures = 0;

// CSS rule must exist and win over display utilities
const cssDir = 'dist/_astro';
let cssOk = false;
for (const file of readdirSync(cssDir)) {
  if (!file.endsWith('.css')) continue;
  if (/\.toggle-hidden\{display:none!important\}/.test(readFileSync(`${cssDir}/${file}`, 'utf8'))) cssOk = true;
}
console.log(`CSS .toggle-hidden{display:none!important}: ${cssOk ? '✓ present' : '✗ MISSING'}`);
if (!cssOk) failures++;

const pages = [
  ['movie', 'dist/movies/toxic/index.html'],
  ['person', 'dist/people/vijay-varma/index.html'],
];

for (const [kind, file] of pages) {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const { document } = dom.window;

  const scripts = [...document.querySelectorAll('script[type="module"]')];
  for (const s of scripts) dom.window.eval(s.textContent ?? '');

  const buttons = [...document.querySelectorAll('.toggle-btn')];
  if (buttons.length === 0) {
    console.log(`${kind}: no toggle buttons`);
    continue;
  }
  for (const btn of buttons) {
    const target = btn.dataset.target;
    const rows = [...document.querySelectorAll('.' + target)];
    const hiddenBefore = rows.filter((r) => r.classList.contains('toggle-hidden')).length;
    btn.click();
    const hiddenAfter = rows.filter((r) => r.classList.contains('toggle-hidden')).length;
    const label = btn.textContent?.trim();
    btn.click();
    const hiddenRestored = rows.filter((r) => r.classList.contains('toggle-hidden')).length;
    const ok =
      rows.length > 0 &&
      hiddenBefore === rows.length &&
      hiddenAfter === 0 &&
      hiddenRestored === rows.length;
    console.log(
      `${kind} [${target}]: ${rows.length} rows — ${hiddenBefore} → click → ${hiddenAfter} → click → ${hiddenRestored} ${ok ? '✓ WORKS' : '✗ BROKEN'}`,
    );
    if (!ok) failures++;
  }
}
process.exit(failures > 0 ? 1 : 0);
