import { describe, expect, it } from 'vitest';
import { renderLinkedHtml } from './linked-html.js';

const lookup = new Map<string, { type: 'person' | 'movie' | 'series'; slug: string }>([
  ['Vijay Varma', { type: 'person', slug: 'vijay-varma' }],
  ['Dhurandhar: The Revenge', { type: 'movie', slug: 'dhurandhar-the-revenge' }],
]);

describe('renderLinkedHtml', () => {
  it('links known targets internally, keeping piped labels', () => {
    const html = renderLinkedHtml(
      'Agent [[Vijay Varma]] infiltrates in a sequel to [[Dhurandhar: The Revenge|part one]].',
      lookup,
    );
    expect(html).toContain('<a href="/people/vijay-varma">Vijay Varma</a>');
    expect(html).toContain('<a href="/movies/dhurandhar-the-revenge">part one</a>');
  });

  it('renders unknown links as plain text', () => {
    const html = renderLinkedHtml('He visits [[Karachi]] in [[2026]].', lookup);
    expect(html).toBe('He visits Karachi in 2026.');
  });

  it('drops namespace links and refs, strips templates', () => {
    const html = renderLinkedHtml('[[File:X.jpg|thumb]] Plot<ref>{{cite web|url=x}}</ref> text{{efn|1}}.', lookup);
    expect(html).toBe('Plot text.');
  });

  it('escapes HTML entities and angle brackets in text', () => {
    const html = renderLinkedHtml('Budget < 100 & gross > 500', lookup);
    expect(html).toBe('Budget &lt; 100 &amp; gross &gt; 500');
  });

  it('escapes labels inside links', () => {
    const html = renderLinkedHtml('Starring [[Vijay Varma|"Vijay" & friends]]', lookup);
    expect(html).toBe('Starring <a href="/people/vijay-varma">&quot;Vijay&quot; &amp; friends</a>');
  });

  it('handles empty input', () => {
    expect(renderLinkedHtml('', lookup)).toBe('');
    expect(renderLinkedHtml(undefined as any, lookup)).toBe('');
  });
});
