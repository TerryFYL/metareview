import type { SearchAdapter, SearchArticle, SearchOptions, SearchResponse } from './types';

const OPENALEX_API = 'https://api.openalex.org';

export class OpenAlexAdapter implements SearchAdapter {
  readonly name = 'OpenAlex';
  readonly source = 'openalex' as const;

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { retstart = 0, retmax = 20, dateFrom, dateTo } = options;
    const page = Math.floor(retstart / retmax) + 1;

    const params = new URLSearchParams({
      search: query,
      per_page: String(retmax),
      page: String(page),
      mailto: 'contact@metareview.cc',
    });

    // Build filters
    const filters: string[] = ['type:article'];
    if (dateFrom) filters.push(`from_publication_date:${dateFrom}`);
    if (dateTo) filters.push(`to_publication_date:${dateTo}`);
    params.set('filter', filters.join(','));

    // Select only needed fields to reduce payload
    params.set('select', 'id,title,authorships,primary_location,publication_date,doi,abstract_inverted_index');

    const res = await fetch(`${OPENALEX_API}/works?${params}`);
    if (!res.ok) throw new Error(`OpenAlex search failed: ${res.status}`);
    const data = await res.json();

    const results: SearchArticle[] = (data.results || []).map((work: OpenAlexWork) => {
      const authors = (work.authorships || [])
        .map((a: { author?: { display_name?: string } }) => a.author?.display_name || '')
        .filter(Boolean);

      const journal = work.primary_location?.source?.display_name || '';
      const pubdate = work.publication_date || '';
      const doi = (work.doi || '').replace('https://doi.org/', '');

      // Extract PMID from OpenAlex IDs if available
      const oaId = (work.id || '').replace('https://openalex.org/', '');
      const pmid = extractPmidFromIds(work);

      // Reconstruct abstract from inverted index
      const abstract = reconstructAbstract(work.abstract_inverted_index);

      return {
        id: `openalex:${oaId}`,
        source: 'openalex' as const,
        title: work.title || '',
        authors,
        journal,
        pubdate,
        doi,
        pmid,
        abstract: abstract || undefined,
      };
    });

    const totalCount = data.meta?.count || 0;
    return { results, totalCount, source: 'openalex' };
  }

  // OpenAlex returns abstracts inline — no separate fetch needed
  async fetchAbstract(id: string): Promise<string> {
    const oaId = id.startsWith('openalex:') ? id.slice(9) : id;
    const params = new URLSearchParams({
      mailto: 'contact@metareview.cc',
      select: 'abstract_inverted_index',
    });
    const res = await fetch(`${OPENALEX_API}/works/${oaId}?${params}`);
    if (!res.ok) return '';
    const work = await res.json();
    return reconstructAbstract(work.abstract_inverted_index) || '';
  }
}

interface OpenAlexWork {
  id?: string;
  title?: string;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string } };
  publication_date?: string;
  doi?: string;
  abstract_inverted_index?: Record<string, number[]>;
  ids?: { pmid?: string };
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string {
  if (!invertedIndex) return '';
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map(w => w[1]).join(' ');
}

function extractPmidFromIds(work: OpenAlexWork): string | undefined {
  const pmid = work.ids?.pmid;
  if (!pmid) return undefined;
  // Format: "https://pubmed.ncbi.nlm.nih.gov/12345678"
  const match = pmid.match(/(\d+)$/);
  return match ? match[1] : undefined;
}
