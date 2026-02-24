import { useState, useCallback } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { Study, BinaryData, ContinuousData } from '../lib/types';
import type { EffectMeasure } from '../lib/types';

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubdate: string;
  doi: string;
}

interface Props {
  lang: Lang;
  measure: EffectMeasure;
  studies: Study[];
  onStudiesChange: (studies: Study[]) => void;
  onSwitchToInput: () => void;
}

const PAGE_SIZE = 20;

export default function LiteratureSearch({ lang, measure, studies, onStudiesChange, onSwitchToInput }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PubMedArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null);
  const [abstracts, setAbstracts] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState(0);

  const search = useCallback(async (searchQuery: string, retstart: number) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: esearch to get PMIDs
      const searchUrl = `/api/pubmed/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmode=json&retmax=${PAGE_SIZE}&retstart=${retstart}&sort=relevance`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) throw new Error(`PubMed search failed (${searchRes.status})`);
      const searchData = await searchRes.json();

      const idList: string[] = searchData.esearchresult?.idlist || [];
      const count = parseInt(searchData.esearchresult?.count || '0', 10);
      setTotalCount(count);

      if (idList.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Step 2: esummary to get article metadata
      const summaryUrl = `/api/pubmed/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok) throw new Error(`PubMed summary failed (${summaryRes.status})`);
      const summaryData = await summaryRes.json();

      const articles: PubMedArticle[] = idList.map((pmid) => {
        const item = summaryData.result?.[pmid];
        if (!item) return null;
        return {
          pmid,
          title: item.title || '',
          authors: (item.authors || []).map((a: { name: string }) => a.name),
          journal: item.source || item.fulljournalname || '',
          pubdate: item.pubdate || '',
          doi: item.elocationid || '',
        };
      }).filter(Boolean) as PubMedArticle[];

      setResults(articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('search.error', lang));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const handleSearch = useCallback(() => {
    setPage(0);
    setSelected(new Set());
    search(query, 0);
  }, [query, search]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    search(query, newPage * PAGE_SIZE);
  }, [query, search]);

  const toggleSelect = useCallback((pmid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) next.delete(pmid);
      else next.add(pmid);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.pmid)));
    }
  }, [results, selected.size]);

  const fetchAbstract = useCallback(async (pmid: string) => {
    if (abstracts[pmid]) {
      setExpandedPmid(expandedPmid === pmid ? null : pmid);
      return;
    }
    setExpandedPmid(pmid);
    try {
      const res = await fetch(`/api/pubmed/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text`);
      if (!res.ok) throw new Error('Failed to fetch abstract');
      const text = await res.text();
      setAbstracts((prev) => ({ ...prev, [pmid]: text }));
    } catch {
      setAbstracts((prev) => ({ ...prev, [pmid]: lang === 'zh' ? '(无法加载摘要)' : '(Failed to load abstract)' }));
    }
  }, [abstracts, expandedPmid, lang]);

  const importSelected = useCallback(() => {
    const selectedArticles = results.filter((r) => selected.has(r.pmid));
    if (selectedArticles.length === 0) return;

    const isBinary = measure === 'OR' || measure === 'RR';

    const newStudies: Study[] = selectedArticles.map((article) => {
      const firstAuthor = article.authors[0]?.split(' ')[0] || 'Unknown';
      const yearMatch = article.pubdate.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;
      const name = year ? `${firstAuthor} ${year}` : firstAuthor;

      // Check if study already exists
      const exists = studies.some(
        (s) => s.name === name || s.name.includes(article.pmid)
      );
      if (exists) return null;

      const data: BinaryData | ContinuousData = isBinary
        ? { events1: 0, total1: 0, events2: 0, total2: 0 }
        : { mean1: 0, sd1: 0, n1: 0, mean2: 0, sd2: 0, n2: 0 };

      return {
        id: `pubmed-${article.pmid}`,
        name,
        year,
        data,
      };
    }).filter(Boolean) as Study[];

    if (newStudies.length > 0) {
      onStudiesChange([...studies, ...newStudies]);
      setImportedCount(newStudies.length);
      setSelected(new Set());
      // Auto-clear message after 3s
      setTimeout(() => setImportedCount(0), 3000);
    }
  }, [results, selected, studies, measure, onStudiesChange]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasResults = results.length > 0;

  return (
    <div>
      {/* Search bar */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>{t('search.title', lang)}</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          {t('search.desc', lang)}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('search.placeholder', lang)}
            style={{ ...textInputStyle, flex: 1 }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            style={{
              ...primaryBtnStyle,
              opacity: loading || !query.trim() ? 0.6 : 1,
              cursor: loading || !query.trim() ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? t('search.searching', lang) : t('search.btn', lang)}
          </button>
        </div>

        {/* Search tips */}
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
            {t('search.tips', lang)}
          </summary>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, padding: '8px 12px', background: '#f9fafb', borderRadius: 6 }}>
            <div style={{ marginBottom: 4 }}>{t('search.tip1', lang)}</div>
            <div style={{ marginBottom: 4 }}>{t('search.tip2', lang)}</div>
            <div>{t('search.tip3', lang)}</div>
          </div>
        </details>
      </section>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Import success message */}
      {importedCount > 0 && (
        <div style={{ padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#16a34a', fontSize: 13, marginBottom: 16 }}>
          {t('search.imported', lang).replace('{n}', String(importedCount))}
          {' '}
          <button onClick={onSwitchToInput} style={{ color: '#2563eb', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
            {t('search.goToInput', lang)}
          </button>
        </div>
      )}

      {/* Results count */}
      {hasResults && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {t('search.found', lang)
              .replace('{total}', totalCount.toLocaleString())
              .replace('{from}', String(page * PAGE_SIZE + 1))
              .replace('{to}', String(Math.min((page + 1) * PAGE_SIZE, totalCount)))}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={selected.size === results.length && results.length > 0}
                onChange={toggleSelectAll}
              />
              {t('search.selectAll', lang)}
            </label>
            {selected.size > 0 && (
              <button onClick={importSelected} style={importBtnStyle}>
                {t('search.import', lang).replace('{n}', String(selected.size))}
              </button>
            )}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && totalCount === 0 && query.trim() && results.length === 0 && !error && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          {t('search.noResults', lang)}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
          {t('search.loading', lang)}
        </div>
      )}

      {/* Results list */}
      {!loading && hasResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {results.map((article) => (
            <div
              key={article.pmid}
              style={{
                padding: '12px 14px',
                background: selected.has(article.pmid) ? '#eff6ff' : '#fff',
                border: `1px solid ${selected.has(article.pmid) ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={selected.has(article.pmid)}
                  onChange={() => toggleSelect(article.pmid)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {article.authors.slice(0, 3).join(', ')}
                    {article.authors.length > 3 && ` et al.`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{article.journal}</span>
                    <span>{article.pubdate}</span>
                    <span>PMID: {article.pmid}</span>
                  </div>

                  {/* Abstract toggle */}
                  <button
                    onClick={() => fetchAbstract(article.pmid)}
                    style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 6 }}
                  >
                    {expandedPmid === article.pmid ? t('search.hideAbstract', lang) : t('search.showAbstract', lang)}
                  </button>

                  {/* Abstract content */}
                  {expandedPmid === article.pmid && abstracts[article.pmid] && (
                    <div style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      background: '#f9fafb',
                      borderRadius: 6,
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: '#374151',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}>
                      {abstracts[article.pmid]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 0}
            style={{ ...pageBtnStyle, opacity: page === 0 ? 0.4 : 1 }}
          >
            &lt; {t('search.prev', lang)}
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages - 1}
            style={{ ...pageBtnStyle, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            {t('search.next', lang)} &gt;
          </button>
        </div>
      )}
    </div>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 24 };
const h2Style: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 };

const textInputStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: 14,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const importBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
