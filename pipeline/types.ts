import type { EpisodeRow } from './wikitext/episodes.js';
import type { Soundtrack } from './wikitext/soundtrack.js';
import type { ReferenceEntry } from './wikitext/references.js';

export interface ArticleSection {
  title: string;
  text: string;
}

export interface CastMember {
  name: string;
  /** site slug when the person has a page on Chalachitra, else null */
  slug: string | null;
  role: string;
}

export interface ExternalLinkRef {
  label: string;
  url: string;
}

export interface ExternalRefs {
  imdbId?: string;
  official?: string;
  links: ExternalLinkRef[];
}

export type Kind = 'movie' | 'series';

export interface TitleRecord {
  kind: Kind;
  slug: string;
  title: string;
  wikiTitle: string;
  wikiUrl: string;
  pageid: number;
  origin: 'in';
  language: string;
  year: number;
  poster?: string;
  summary?: string;
  plot?: string;
  /** plot with internal links to people/title pages (safe HTML) */
  plotHtml?: string;
  reception?: string;
  /** full text of article sections rendered neither as plot nor tables
   *  (Production, Release, Box office, Critical response, Home media, …) */
  articleSections: ArticleSection[];
  nativeName?: string;
  lastAired?: string;
  relatedTitles: string[];
  releaseDate?: string;
  runtime?: string;
  genres: string[];
  directedBy: string[];
  createdBy: string[];
  writtenBy: string[];
  musicBy: string[];
  producedBy: string[];
  cinematographyBy: string[];
  editedBy: string[];
  studios: string[];
  distributor: string[];
  network: string[];
  seasons?: string;
  episodes?: string;
  budget?: string;
  gross?: string;
  /** poster/tagline hook shown under the title (TMDB tagline or derived) */
  tagline?: string;
  /** thematic mood tags (AI enrichment, future) */
  moods?: string[];
  /** TMDB id (persisted even when nothing was merged, for source links) */
  tmdbId?: number;
  /** TMDB backdrop (image.tmdb.org) used as the hero band background */
  backdrop?: string;
  /** community rating (TMDB) shown in the hero chips */
  rating?: { source: 'tmdb'; value: number; votes: number };
  /** official trailer (YouTube) discovered via enrichment */
  trailer?: string;
  /** non-Wikipedia sources that contributed fields to this record */
  enrichedFrom?: string[];
  episodesList: EpisodeRow[];
  soundtrack?: Soundtrack;
  references: ReferenceEntry[];
  cast: CastMember[];
  crew: { name: string; role: string; slug: string | null }[];
  referenceCount: number;
  sections: string[];
  external: ExternalRefs;
}

export interface Credit {
  titleSlug: string;
  title: string;
  kind: Kind;
  role: string;
  year: number;
  poster?: string;
}

export interface PersonFact {
  label: string;
  value: string;
}

export interface PersonRecord {
  slug: string;
  name: string;
  wikiTitle: string;
  wikiUrl: string;
  pageid: number;
  image?: string;
  summary?: string;
  occupations: string[];
  facts: PersonFact[];
  credits: Credit[];
  external: ExternalRefs;
  references: ReferenceEntry[];
  sections: string[];
}

export interface SiteStats {
  generatedAt: string;
  movies: number;
  series: number;
  persons: number;
  /** catalogue years, newest first — drives all "of YYYY" copy */
  years: number[];
  languages: { language: string; movies: number; series: number }[];
}
