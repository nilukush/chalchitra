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

export interface ParsedTemplate {
  name: string;
  params: Record<string, string>;
  start: number;
  /** index just past the closing braces */
  end: number;
}

/** Split a template body (no outer braces, no name chunk) into params.
 *  Named params are lowercased; positional params become '1', '2', … */
function splitParams(body: string): Record<string, string> {
  const parts: string[] = [];
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
      parts.push(current);
      current = '';
    } else {
      current += body[i];
    }
  }
  parts.push(current);

  const record: Record<string, string> = {};
  let positional = 0;
  for (const part of parts) {
    const explicit = /^\s*(\d+)\s*=(.*)$/.exec(part);
    const eq = part.indexOf('=');
    if (explicit) {
      record[explicit[1]] = explicit[2].replace(/^\s*\n/, '').trim();
      positional = Math.max(positional, Number(explicit[1]));
    } else if (eq > 0) {
      const key = part.slice(0, eq).trim().toLowerCase();
      const value = part.slice(eq + 1).replace(/^\s*\n/, '').trim();
      if (key) record[key] = value;
    } else if (part.trim().length > 0) {
      positional++;
      record[String(positional)] = part.trim();
    }
  }
  return record;
}

/**
 * Find every {{Template}} whose name matches `namePattern` and parse its
 * top-level params (keys lowercased; nested templates preserved as raw text).
 */
export function findTemplates(text: string, namePattern: RegExp): ParsedTemplate[] {
  const found: ParsedTemplate[] = [];
  let pos = 0;
  while (pos < (text?.length ?? 0)) {
    const at = text.indexOf('{{', pos);
    if (at < 0) break;
    const end = findTemplateEnd(text, at);
    if (end < 0) break;
    const body = text.slice(at + 2, end - 2);
    const nameEnd = body.indexOf('|');
    const name = (nameEnd >= 0 ? body.slice(0, nameEnd) : body).trim();
    if (namePattern.test(name)) {
      const paramBody = nameEnd >= 0 ? body.slice(nameEnd + 1) : '';
      found.push({ name, params: splitParams(paramBody), start: at, end });
    }
    // continue INSIDE this template so nested templates are found too
    pos = at + 2;
  }
  return found;
}

export function parseInfobox(text: string): Record<string, string> | null {
  const match = /\{\{\s*[Ii]nfobox\s/.exec(text);
  if (!match) return null;
  const start = match.index;
  const end = findTemplateEnd(text, start);
  if (end < 0) return null;
  // body excludes the opening {{ and the closing }}
  const body = text.slice(start + 2, end - 2);
  const nameEnd = body.indexOf('|');
  const params = splitParams(nameEnd >= 0 ? body.slice(nameEnd + 1) : '');
  return Object.keys(params).length > 0 ? params : null;
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
