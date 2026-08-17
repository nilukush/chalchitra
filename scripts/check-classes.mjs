// Reports class tokens present in an HTML file that have no matching rule in the page's CSS.
import { readFileSync } from 'node:fs';

const [htmlFile, cssFile] = process.argv.slice(2);
const html = readFileSync(htmlFile, 'utf8');
const css = readFileSync(cssFile, 'utf8');

// collect class attribute values
const classes = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
}
for (const m of html.matchAll(/class:([^=]+)="(?:true|false)"/g)) classes.add(m[1].trim());

const escapeCss = (s) => s.replace(/[.:()[\]#%/,%^&*!'"`~$@?<>|+=;{}\\]/g, (ch) => '\\' + ch);

const missing = [];
for (const c of classes) {
  const sel = '.' + escapeCss(c);
  if (!css.includes(sel)) missing.push(c);
}

// ignore toggler-added runtime classes (added by JS after parse)
const runtime = new Set(['toggle-hidden', 'ep-overflow']);
const real = missing.filter((c) => !runtime.has(c));

console.log(`${htmlFile}: ${classes.size} classes, ${real.length} missing from CSS`);
const byPrefix = {};
for (const c of real) {
  const p = (c.match(/^[a-z-]+(?::[^[\]]+)/) || [c])[0];
  (byPrefix[p] ??= []).push(c);
}
for (const [p, list] of Object.entries(byPrefix).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${p} (${list.length}): ${list.slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}`);
}
