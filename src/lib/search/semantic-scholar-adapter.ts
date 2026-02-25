import type { SearchAdapter, SearchArticle, SearchOptions, SearchResponse } from './types';

const S2_API = 'https://api.semanticscholar.org/graph/v1';

export class SemanticScholarAdapter implements SearchAdapter {
  readonly name = 'Semantic Scholar';
  readonly source = 'semanticscholar' as const;

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { retstart = 0, retmax = 20, dateFrom, dateTo } = options;

    const params = new URLSearchParams({
      query,
      offset: String(retstart),
      limit: String(retmax),
      fields: 'title,authors,venue,year,externalIds,abstract,publicationDate',
    });

    // Date filtering via year range
    if (dateFrom || dateTo) {
      const yearFrom = dateFrom ? dateFrom.slice(0, 4) : '';
      const yearTo = dateTo ? dateTo.slice(0, 4) : '';
      if (yearFrom || yearTo) {
        params.set('year', `${yearFrom}-${yearTo}`);
      }
    }

    const res = await fetch(`${S2_API}/paper/search?${params}`, {
      headers: { 'User-Agent': 'MetaReview/1.0 (https://metareview.cc)' },
    });
    if (!res.ok) throw new Error(`Semantic Scholar search failed: ${res.status}`);
    const data = await res.json();

    const results: SearchArticle[] = (data.data || []).map((paper: S2Paper) => {
      const authors = (paper.authors || []).map((a: { name?: string }) => a.name || '').filter(Boolean);
      const pmid = paper.externalIds?.PubMed || undefined;
      const doi = paper.externalIds?.DOI || '';

      return {
        id: `semanticscholar:${paper.paperId}`,
        source: 'semanticscholar' as const,
        title: paper.title || '',
        authors,
        journal: paper.venue || '',
        pubdate: paper.publicationDate || (paper.year ? String(paper.year) : ''),
        doi,
        pmid,
        abstract: paper.abstract || undefined,
      };
    });

    const totalCount = data.total || 0;
    return { results, totalCount, source: 'semanticscholar' as SearchResponse['source'] };
  }

  async fetchAbstract(id: string): Promise<string> {
    const paperId = id.startsWith('semanticscholar:') ? id.slice(16) : id;
    const res = await fetch(`${S2_API}/paper/${paperId}?fields=abstract`, {
      headers: { 'User-Agent': 'MetaReview/1.0 (https://metareview.cc)' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.abstract || '';
  }
}

interface S2Paper {
  paperId: string;
  title?: string;
  authors?: { name?: string }[];
  venue?: string;
  year?: number;
  publicationDate?: string;
  externalIds?: { PubMed?: string; DOI?: string };
  abstract?: string;
}
