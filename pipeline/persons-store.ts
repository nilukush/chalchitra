/**
 * Persons dataset loader (session 16): persons live as first-letter chunks in
 * data/persons/<LETTER>.json ('#' bucket → _.json). One reader for every
 * pipeline script that used to read the monolithic persons.json.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export function personsChunksDir(dataDir: string): string {
  return path.join(dataDir, 'persons');
}

/** Load every chunk and concatenate; bucket filenames sort A–Z then `_`, and
 *  records are name-sorted within buckets, so the result needs no re-sort. */
export function loadPersons(dataDir: string): any[] {
  const dir = personsChunksDir(dataDir);
  const all: any[] = [];
  if (!existsSync(dir)) return all;
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    try {
      all.push(...JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
    } catch {
      /* corrupt chunk — skip, dataset rebuild regenerates it */
    }
  }
  return all;
}

/** Cheap variant: just the wikiTitles (skip-set for wave discovery). */
export function loadPersonWikiTitles(dataDir: string): Set<string> {
  const titles = new Set<string>();
  for (const person of loadPersons(dataDir)) {
    if (person?.wikiTitle) titles.add(person.wikiTitle);
  }
  return titles;
}
