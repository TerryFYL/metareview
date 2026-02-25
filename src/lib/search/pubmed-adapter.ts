import type { SearchAdapter, SearchArticle, SearchOptions, SearchResponse } from './types';

export class PubMedAdapter implements SearchAdapter {
  readonly name = 'PubMed';
  readonly source = 'pubmed' as const;

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { retstart = 0, retmax = 20 } = options;

    // Step 1: esearch to get PMIDs
    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: query,
      retmode: 'json',
      retstart: String(retstart),
      retmax: String(retmax),
    });

    const searchRes = await fetch(`/api/pubmed/esearch.fcgi?${searchParams}`);
    if (!searchRes.ok) throw new Error(`PubMed search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const idlist: string[] = searchData?.esearchresult?.idlist || [];
    const totalCount = parseInt(searchData?.esearchresult?.count || '0', 10);

    if (idlist.length === 0) return { results: [], totalCount: 0, source: 'pubmed' };

    // Step 2: esummary to get article metadata
    const summaryParams = new URLSearchParams({
      db: 'pubmed',
      id: idlist.join(','),
      retmode: 'json',
    });

    const summaryRes = await fetch(`/api/pubmed/esummary.fcgi?${summaryParams}`);
    if (!summaryRes.ok) throw new Error(`PubMed summary failed: ${summaryRes.status}`);
    const summaryData = await summaryRes.json();
    const docs = summaryData?.result || {};

    const results: SearchArticle[] = idlist.map((pmid) => {
      const doc = docs[pmid] || {};
      const authors: string[] = (doc.authors || []).map((a: { name?: string }) => a.name || '');
      return {
        id: `pubmed:${pmid}`,
        source: 'pubmed' as const,
        title: doc.title || '',
        authors,
        journal: doc.fulljournalname || doc.source || '',
        pubdate: doc.pubdate || '',
        doi: (doc.elocationid || '').replace('doi: ', ''),
        pmid,
      };
    });

    return { results, totalCount, source: 'pubmed' };
  }

  async fetchAbstract(id: string): Promise<string> {
    const pmid = id.startsWith('pubmed:') ? id.slice(7) : id;
    const params = new URLSearchParams({
      db: 'pubmed',
      id: pmid,
      rettype: 'abstract',
      retmode: 'text',
    });
    const res = await fetch(`/api/pubmed/efetch.fcgi?${params}`);
    if (!res.ok) return '';
    return (await res.text()).trim();
  }
}
