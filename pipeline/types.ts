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
  reception?: string;
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
  sections: string[];
}

export interface SiteStats {
  generatedAt: string;
  movies: number;
  series: number;
  persons: number;
  languages: { language: string; movies: number; series: number }[];
}
