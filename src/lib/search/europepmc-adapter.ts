import type { SearchAdapter, SearchArticle, SearchOptions, SearchResponse } from './types';

const EPMC_API = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

export class EuropePMCAdapter implements SearchAdapter {
  readonly name = 'Europe PMC';
  readonly source = 'europepmc' as const;

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { retstart = 0, retmax = 20 } = options;
    const page = Math.floor(retstart / retmax) + 1;

    const params = new URLSearchParams({
      query,
      format: 'json',
      pageSize: String(retmax),
      cursorMark: page === 1 ? '*' : '*', // cursor pagination for first page
      resultType: 'core', // includes abstract
    });

    // For page > 1 we use page-based offset
    if (retstart > 0) {
      // Europe PMC doesn't have offset; use page parameter approach
      // Actually Europe PMC REST API v7 uses cursorMark for deep paging
      // For simplicity, we use the synonym endpoint approach
      params.delete('cursorMark');
      params.set('page', String(page));
    }

    const res = await fetch(`${EPMC_API}/search?${params}`);
    if (!res.ok) throw new Error(`Europe PMC search failed: ${res.status}`);
    const data = await res.json();

    const results: SearchArticle[] = (data.resultList?.result || []).map((article: EPMCArticle) => {
      const authors = (article.authorString || '')
        .split(', ')
        .filter(Boolean);

      return {
        id: `europepmc:${article.source || 'MED'}:${article.id || ''}`,
        source: 'europepmc' as const,
        title: article.title || '',
        authors,
        journal: article.journalTitle || '',
        pubdate: article.firstPublicationDate || article.pubYear?.toString() || '',
        doi: article.doi || '',
        pmid: article.pmid || undefined,
        abstract: article.abstractText || undefined,
      };
    });

    const totalCount = data.hitCount || 0;
    return { results, totalCount, source: 'europepmc' };
  }

  // Europe PMC returns abstracts in core results, but we can fetch individually too
  async fetchAbstract(id: string): Promise<string> {
    // id format: "europepmc:MED:12345678"
    const parts = id.startsWith('europepmc:') ? id.slice(10).split(':') : id.split(':');
    const source = parts[0] || 'MED';
    const articleId = parts[1] || parts[0];

    const params = new URLSearchParams({
      format: 'json',
      resultType: 'core',
    });

    const res = await fetch(`${EPMC_API}/${source}/${articleId}?${params}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.result?.abstractText || '';
  }
}

interface EPMCArticle {
  id?: string;
  source?: string;
  pmid?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  firstPublicationDate?: string;
  pubYear?: number;
  doi?: string;
  abstractText?: string;
}
