/**
 * Infobox extraction: locate the first {{Infobox …}} template on a page and
 * split its parameters at top-level pipes (pipes inside nested templates or
 * wikilinks do not split).
 */
import { stripWikitext } from './clean.js';

export function findTemplateEnd(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    if (text.startsWith('{{{', i)) {
      depth += 2;
      i += 3;
    } else if (text.startsWith('{{', i)) {
      depth += 1;
      i += 2;
    } else if (text.startsWith('}}}', i)) {
      depth -= 2;
      i += 3;
      if (depth <= 0) return i;
    } else if (text.startsWith('}}', i)) {
      depth -= 1;
      i += 2;
      if (depth <= 0) return i;
    } else {
      i += 1;
    }
  }
  return -1;
}

export function parseInfobox(text: string): Record<string, string> | null {
  const match = /\{\{\s*[Ii]nfobox\s/.exec(text);
  if (!match) return null;
  const start = match.index;
  const end = findTemplateEnd(text, start);
  if (end < 0) return null;
  // body excludes the opening {{ and the closing }}
  const body = text.slice(start + 2, end - 2);

  const params: string[] = [];
  let braceDepth = 0;
  let linkDepth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{') {
      braceDepth++;
      current += two;
      i++;
    } else if (two === '}}') {
      braceDepth--;
      current += two;
      i++;
    } else if (two === '[[') {
      linkDepth++;
      current += two;
      i++;
    } else if (two === ']]') {
      linkDepth--;
      current += two;
      i++;
    } else if (body[i] === '|' && braceDepth === 0 && linkDepth === 0) {
      params.push(current);
      current = '';
    } else {
      current += body[i];
    }
  }
  params.push(current);

  const record: Record<string, string> = {};
  for (const param of params.slice(1)) {
    const eq = param.indexOf('=');
    if (eq <= 0) continue;
    const key = param.slice(0, eq).trim().toLowerCase();
    const value = param.slice(eq + 1).replace(/^\s*\n/, '').trim();
    if (key) record[key] = value;
  }
  return Object.keys(record).length > 0 ? record : null;
}

const LIST_TEMPLATES = /^(plainlist|flatlist|ubl|unbulleted list|hlist|bulleted list|plain list)$/i;

/** Inner content of the first template in `raw` (for list wrappers). */
function templateInner(raw: string): string | null {
  const match = /\{\{/.exec(raw);
  if (!match) return null;
  const end = findTemplateEnd(raw, match.index);
  if (end < 0) return null;
  let inner = raw.slice(match.index + 2, end - 2);
  const pipe = inner.indexOf('|');
  if (pipe >= 0) inner = inner.slice(pipe + 1);
  return inner;
}

/** Split an infobox list value (plainlist/ubl/hlist templates, <br>, or plain text). */
export function splitListField(raw: string | undefined): string[] {
  if (!raw) return [];
  const value = raw.trim();
  if (!value) return [];

  const nameMatch = /^\{\{\s*([^|}]+)/.exec(value);
  const name = nameMatch ? nameMatch[1].trim() : '';
  const inner = nameMatch ? templateInner(value) : null;

  const parts: string[] = [];
  if (inner !== null && LIST_TEMPLATES.test(name)) {
    if (/^(ubl|unbulleted list|hlist)$/i.test(name)) {
      // pipe-separated inside the template
      for (const piece of splitTopPipes(inner)) parts.push(piece);
    } else {
      // bullet-separated inside the template
      for (const bullet of inner.split(/^\s*\*\s*/m)) parts.push(bullet);
    }
  } else {
    for (const piece of value.split(/<br\s*\/?>/gi)) parts.push(piece);
  }

  return parts
    .map((p) => stripWikitext(String(p)).replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p.length > 0);
}

function splitTopPipes(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let linkDepth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') {
      depth++;
      current += two;
      i++;
    } else if (two === '}}') {
      depth--;
      current += two;
      i++;
    } else if (two === '[[') {
      linkDepth++;
      current += two;
      i++;
    } else if (two === ']]') {
      linkDepth--;
      current += two;
      i++;
    } else if (text[i] === '|' && depth === 0 && linkDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += text[i];
    }
  }
  parts.push(current);
  return parts;
}
