export type { SearchSource, SearchArticle, SearchOptions, SearchResponse, SearchAdapter } from './types';
export { PubMedAdapter } from './pubmed-adapter';
export { OpenAlexAdapter } from './openalex-adapter';
export { EuropePMCAdapter } from './europepmc-adapter';
export { SemanticScholarAdapter } from './semantic-scholar-adapter';

import { PubMedAdapter } from './pubmed-adapter';
import { OpenAlexAdapter } from './openalex-adapter';
import { EuropePMCAdapter } from './europepmc-adapter';
import { SemanticScholarAdapter } from './semantic-scholar-adapter';
import type { SearchAdapter, SearchSource } from './types';

const adapters: Record<SearchSource, SearchAdapter> = {
  pubmed: new PubMedAdapter(),
  openalex: new OpenAlexAdapter(),
  europepmc: new EuropePMCAdapter(),
  semanticscholar: new SemanticScholarAdapter(),
};

export function getAdapter(source: SearchSource): SearchAdapter {
  return adapters[source];
}

export function getAllAdapters(): SearchAdapter[] {
  return Object.values(adapters);
}
