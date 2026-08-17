// Tag-nesting validator: reports elements the HTML parser force-closes or reparents.
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

const file = process.argv[2];
const html = readFileSync(file, 'utf8');

// --- raw tag-order nesting check (stack based, ignoring void elements) ---
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
const stack = [];
const errors = [];
let m;
while ((m = tagRe.exec(html))) {
  const raw = m[0];
  const name = m[1].toLowerCase();
  if (VOID.has(name)) continue;
  if (raw.startsWith('</')) {
    if (stack.length === 0) { errors.push(`line ${html.slice(0, m.index).split('\n').length}: stray </${name}>`); continue; }
    if (stack[stack.length - 1].name === name) { stack.pop(); continue; }
    const idx = [...stack].reverse().findIndex((e) => e.name === name);
    if (idx === -1) {
      errors.push(`line ${html.slice(0, m.index).split('\n').length}: </${name}> closes nothing (open: ${stack.slice(-4).map((e) => e.name).join('>')})`);
    } else {
      const unclosed = stack.slice(stack.length - 1 - idx);
      errors.push(`line ${html.slice(0, m.index).split('\n').length}: </${name}> implicitly closes [${unclosed.map((e) => `${e.name}@L${e.line}`).join(', ')}]`);
      stack.length = stack.length - 1 - idx;
    }
  } else if (!raw.endsWith('/>')) {
    stack.push({ name, line: html.slice(0, m.index).split('\n').length });
  }
}
if (stack.length) errors.push(`unclosed at EOF: ${stack.map((e) => `${e.name}@L${e.line}`).join(', ')}`);

// --- parse5: find <p> containing flow blocks (browsers auto-close p, splitting layout) ---
const doc = parse(html);
const blockInP = [];
const walk = (node, openP = null) => {
  if (node.tagName === 'p') openP = node;
  for (const child of node.childNodes ?? []) {
    if (openP && child.tagName && ['div','ul','ol','table','section','article','details','dialog','h1','h2','h3','h4','figure','aside','nav','form','blockquote','pre','hr'].includes(child.tagName)) {
      const line = 0;
      blockInP.push(`<${child.tagName}> inside <p>`);
    }
    if (child.childNodes) walk(child, openP);
  }
};
walk(doc);

console.log(`=== ${file} ===`);
console.log(`tag-order errors: ${errors.length}`);
errors.slice(0, 12).forEach((e) => console.log('  ' + e));
console.log(`block-inside-p: ${blockInP.length}`);
[...new Set(blockInP)].slice(0, 8).forEach((e) => console.log('  ' + e));
