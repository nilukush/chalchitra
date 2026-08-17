// Behavioral verification of the show-all toggles using a real DOM (jsdom).
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const pages = [
  ['movie', 'dist/movies/toxic/index.html'],
  ['series', 'dist/series/matka-king/index.html'],
  ['person', 'dist/people/vijay-varma/index.html'],
];

let failures = 0;
for (const [kind, file] of pages) {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const { document } = dom.window;

  // execute every inline module script (Astro-bundled component scripts)
  const scripts = [...document.querySelectorAll('script[type="module"]')];
  for (const s of scripts) dom.window.eval(s.textContent ?? '');

  const buttons = [...document.querySelectorAll('.toggle-btn')];
  if (buttons.length === 0) {
    console.log(`${kind}: no toggle buttons (may have ≤ collapsed threshold)`);
    continue;
  }
  for (const btn of buttons) {
    const target = btn.dataset.target;
    const rows = [...document.querySelectorAll('.' + target)];
    const hiddenBefore = rows.filter((r) => r.classList.contains('hidden')).length;
    btn.click();
    const hiddenAfter = rows.filter((r) => r.classList.contains('hidden')).length;
    const label = btn.textContent?.trim();
    btn.click();
    const hiddenRestored = rows.filter((r) => r.classList.contains('hidden')).length;
    const ok = hiddenBefore === rows.length && hiddenAfter === 0 && label !== null && hiddenRestored === rows.length;
    console.log(
      `${kind} [${target}]: ${rows.length} rows — before:${hiddenBefore} hidden → click:${hiddenAfter} hidden ("${label}") → click:${hiddenRestored} hidden ${ok ? '✓ WORKS' : '✗ BROKEN'}`,
    );
    if (!ok) failures++;
  }
}
process.exit(failures > 0 ? 1 : 0);
