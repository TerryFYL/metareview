export type SearchSource = 'pubmed' | 'openalex' | 'europepmc' | 'semanticscholar';

export interface SearchArticle {
  id: string;
  source: SearchSource;
  title: string;
  authors: string[];
  journal: string;
  pubdate: string;
  doi: string;
  pmid?: string;
  abstract?: string;
}

export interface SearchOptions {
  retstart?: number;
  retmax?: number;
  dateFrom?: string;
  dateTo?: string;
  articleTypes?: string[];
  language?: string;
}

export interface SearchResponse {
  results: SearchArticle[];
  totalCount: number;
  source: SearchSource;
}

export interface SearchAdapter {
  readonly name: string;
  readonly source: SearchSource;
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
  fetchAbstract?(id: string): Promise<string>;
}
