import { useState, useCallback, useMemo } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { Study, BinaryData, ContinuousData, PICO, ScreeningScore } from '../lib/types';
import type { EffectMeasure } from '../lib/types';
import { scorePICORelevance } from '../lib/screening/pico-scorer';

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
  pico: PICO;
  onStudiesChange: (studies: Study[]) => void;
  onSwitchToInput: () => void;
  onPRISMAUpdate?: (dbRecords: number) => void;
}

const PAGE_SIZE = 20;
const HISTORY_KEY = 'metareview-search-history';
const MAX_HISTORY = 10;

const ARTICLE_TYPES = [
  { value: '', labelKey: 'search.articleTypeAll' },
  { value: 'Randomized Controlled Trial', labelKey: 'search.articleTypeRCT' },
  { value: 'Meta-Analysis', labelKey: 'search.articleTypeMeta' },
  { value: 'Systematic Review', labelKey: 'search.articleTypeSR' },
  { value: 'Clinical Trial', labelKey: 'search.articleTypeCT' },
];

const LANG_FILTERS = [
  { value: '', labelKey: 'search.langAll' },
  { value: 'english', labelKey: 'search.langEn' },
  { value: 'chinese', labelKey: 'search.langZh' },
];

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function LiteratureSearch({ lang, measure, studies, pico, onStudiesChange, onSwitchToInput, onPRISMAUpdate }: Props) {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [results, setResults] = useState<PubMedArticle[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedPmid, setExpandedPmid] = useState<string | null>(null);
  const [abstracts, setAbstracts] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState(0);
  const [prismaNotice, setPrismaNotice] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);

  // Search history
  const [history, setHistory] = useState<string[]>(loadHistory);

  // Advanced search
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [articleType, setArticleType] = useState('');
  const [langFilter, setLangFilter] = useState('');

  // PICO scoring: compute scores for all results
  const hasPICO = !!(pico.population.trim() || pico.intervention.trim() || pico.comparison.trim() || pico.outcome.trim());

  const scores = useMemo<Record<string, ScreeningScore>>(() => {
    if (!hasPICO || results.length === 0) return {};
    const map: Record<string, ScreeningScore> = {};
    for (const article of results) {
      map[article.pmid] = scorePICORelevance(
        article.title,
        abstracts[article.pmid] || '',
        pico
      );
    }
    return map;
  }, [results, pico, hasPICO, abstracts]);

  const sortedResults = useMemo(() => {
    if (!sortByScore || !hasPICO) return results;
    return [...results].sort((a, b) => {
      const sa = scores[a.pmid]?.score ?? 0;
      const sb = scores[b.pmid]?.score ?? 0;
      return sb - sa;
    });
  }, [results, sortByScore, scores, hasPICO]);

  const selectAllLikely = useCallback(() => {
    if (!hasPICO) return;
    const likelyPmids = results
      .filter(r => scores[r.pmid]?.bucket === 'likely')
      .map(r => r.pmid);
    setSelected(new Set(likelyPmids));
  }, [results, scores, hasPICO]);

  const likelyCount = useMemo(() => {
    if (!hasPICO) return 0;
    return results.filter(r => scores[r.pmid]?.bucket === 'likely').length;
  }, [results, scores, hasPICO]);

  const buildFullQuery = useCallback((baseQuery: string): string => {
    const parts = [baseQuery.trim()];
    if (dateFrom || dateTo) {
      const from = dateFrom || '1900';
      const to = dateTo || '3000';
      parts.push(`${from}:${to}[dp]`);
    }
    if (articleType) {
      parts.push(`"${articleType}"[pt]`);
    }
    if (langFilter) {
      parts.push(`${langFilter}[la]`);
    }
    return parts.join(' AND ');
  }, [dateFrom, dateTo, articleType, langFilter]);

  const addToHistory = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const updated = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  const search = useCallback(async (searchQuery: string, retstart: number) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
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
    if (!query.trim()) return;
    setPage(0);
    setSelected(new Set());
    const fullQuery = buildFullQuery(query);
    setActiveQuery(fullQuery);
    addToHistory(query.trim());
    search(fullQuery, 0);
  }, [query, search, buildFullQuery, addToHistory]);

  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    setPage(0);
    setSelected(new Set());
    const fullQuery = buildFullQuery(historyQuery);
    setActiveQuery(fullQuery);
    search(fullQuery, 0);
  }, [search, buildFullQuery]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    search(activeQuery, newPage * PAGE_SIZE);
  }, [activeQuery, search]);

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
      setTimeout(() => setImportedCount(0), 3000);

      // Auto-update PRISMA flowchart
      if (onPRISMAUpdate && totalCount > 0) {
        onPRISMAUpdate(totalCount);
        setPrismaNotice(true);
        setTimeout(() => setPrismaNotice(false), 3000);
      }
    }
  }, [results, selected, studies, measure, onStudiesChange, onPRISMAUpdate, totalCount]);

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

        {/* Advanced search toggle + tips */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {t('search.advanced', lang)} {showAdvanced ? '\u25B2' : '\u25BC'}
          </button>
          <details style={{ flex: 1 }}>
            <summary style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
              {t('search.tips', lang)}
            </summary>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, padding: '8px 12px', background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ marginBottom: 4 }}>{t('search.tip1', lang)}</div>
              <div style={{ marginBottom: 4 }}>{t('search.tip2', lang)}</div>
              <div>{t('search.tip3', lang)}</div>
            </div>
          </details>
        </div>

        {/* Advanced search form */}
        {showAdvanced && (
          <div style={{
            marginTop: 8,
            padding: '12px 16px',
            background: '#f9fafb',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}>
            {/* Date range */}
            <div style={{ minWidth: 160 }}>
              <label style={filterLabelStyle}>{t('search.dateRange', lang)}</label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="2000"
                  min="1900"
                  max="2030"
                  style={yearInputStyle}
                />
                <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>
                <input
                  type="number"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="2025"
                  min="1900"
                  max="2030"
                  style={yearInputStyle}
                />
              </div>
            </div>

            {/* Article type */}
            <div style={{ minWidth: 140 }}>
              <label style={filterLabelStyle}>{t('search.articleType', lang)}</label>
              <select
                value={articleType}
                onChange={(e) => setArticleType(e.target.value)}
                style={filterSelectStyle}
              >
                {ARTICLE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey, lang)}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div style={{ minWidth: 120 }}>
              <label style={filterLabelStyle}>{t('search.language', lang)}</label>
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
                style={filterSelectStyle}
              >
                {LANG_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey, lang)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Search history */}
      {history.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
            {t('search.history', lang)}:
          </span>
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => handleHistoryClick(h)}
              style={chipStyle}
              title={h}
            >
              {h.length > 30 ? h.slice(0, 30) + '...' : h}
            </button>
          ))}
          <button onClick={clearHistory} style={clearBtnStyle}>
            {t('search.clearHistory', lang)}
          </button>
        </div>
      )}

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

      {/* PRISMA auto-update notice */}
      {prismaNotice && (
        <div style={{ padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#2563eb', fontSize: 13, marginBottom: 16 }}>
          {t('search.prismaUpdated', lang).replace('{n}', totalCount.toLocaleString())}
        </div>
      )}

      {/* PICO screening notice */}
      {hasResults && !hasPICO && (
        <div style={{ padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, marginBottom: 12 }}>
          {t('screening.noPICO', lang)}
        </div>
      )}

      {/* Results count + screening controls */}
      {hasResults && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {t('search.found', lang)
                .replace('{total}', totalCount.toLocaleString())
                .replace('{from}', String(page * PAGE_SIZE + 1))
                .replace('{to}', String(Math.min((page + 1) * PAGE_SIZE, totalCount)))}
            </span>
            {hasPICO && (
              <button
                onClick={() => setSortByScore(!sortByScore)}
                style={{
                  ...screeningToggleStyle,
                  background: sortByScore ? '#dbeafe' : '#f3f4f6',
                  color: sortByScore ? '#1d4ed8' : '#6b7280',
                  borderColor: sortByScore ? '#93c5fd' : '#e5e7eb',
                }}
              >
                {sortByScore ? t('screening.sortByScore', lang) : t('screening.sortDefault', lang)}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasPICO && likelyCount > 0 && (
              <button onClick={selectAllLikely} style={screeningSelectStyle}>
                {t('screening.selectLikely', lang)} ({likelyCount})
              </button>
            )}
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
          {sortedResults.map((article) => {
            const score = scores[article.pmid];
            const bucketStyle = score ? BUCKET_STYLES[score.bucket] : null;

            return (
              <div
                key={article.pmid}
                style={{
                  padding: '12px 14px',
                  background: selected.has(article.pmid) ? '#eff6ff' : '#fff',
                  border: `1px solid ${selected.has(article.pmid) ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                  marginBottom: 6,
                  borderLeft: bucketStyle ? `3px solid ${bucketStyle.border}` : undefined,
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>
                        {article.title}
                      </div>
                      {/* PICO screening badge */}
                      {score && hasPICO && (
                        <span style={{
                          flexShrink: 0,
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          background: bucketStyle!.bg,
                          color: bucketStyle!.text,
                          whiteSpace: 'nowrap',
                        }}>
                          {t(`screening.${score.bucket}`, lang)} {score.score}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {article.authors.slice(0, 3).join(', ')}
                      {article.authors.length > 3 && ` et al.`}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{article.journal}</span>
                      <span>{article.pubdate}</span>
                      <span>PMID: {article.pmid}</span>
                      {/* Matched PICO terms */}
                      {score && score.matchedTerms.length > 0 && (
                        <span style={{ color: '#6366f1', fontSize: 11 }}>
                          {t('screening.matched', lang)}: {score.matchedTerms.join(', ')}
                        </span>
                      )}
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
            );
          })}
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

const filterLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  display: 'block',
  marginBottom: 4,
};

const filterSelectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  outline: 'none',
  background: '#fff',
  width: '100%',
};

const yearInputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  outline: 'none',
  width: 70,
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  fontSize: 11,
  cursor: 'pointer',
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const clearBtnStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
};

const screeningToggleStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 500,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const screeningSelectStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#ecfdf5',
  color: '#059669',
  border: '1px solid #a7f3d0',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const BUCKET_STYLES = {
  likely: { bg: '#dcfce7', text: '#15803d', border: '#22c55e' },
  maybe: { bg: '#fef9c3', text: '#a16207', border: '#eab308' },
  unlikely: { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' },
} as const;
