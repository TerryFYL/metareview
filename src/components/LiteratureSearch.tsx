import { useState, useCallback, useMemo, useRef } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { Study, PICO, ScreeningScore } from '../lib/types';
import type { EffectMeasure } from '../lib/types';
import type { PRISMAData } from './PRISMAFlow';
import { scorePICORelevance } from '../lib/screening/pico-scorer';
import { batchScreen } from '../lib/screening/ai-screener';
import type { AIScreeningResult } from '../lib/screening/ai-screener';
import { rerank, computeStats } from '../lib/screening/active-learner';
import type { ALArticle, ScreeningDecision, ScreeningStats } from '../lib/screening/active-learner';
import { trackFeature, trackEvent } from '../lib/analytics';
import { getAdapter } from '../lib/search';
import type { SearchSource } from '../lib/search';

interface PubMedArticle {
  pmid: string;
  source: SearchSource;
  title: string;
  authors: string[];
  journal: string;
  pubdate: string;
  doi: string;
  abstract?: string;
}

interface Props {
  lang: Lang;
  measure: EffectMeasure;
  studies: Study[];
  pico: PICO;
  onStudiesChange: (studies: Study[]) => void;
  onSwitchToInput: () => void;
  onSwitchToExtract?: () => void;
  onPRISMAUpdate?: (updates: Partial<PRISMAData>) => void;
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

export default function LiteratureSearch({ lang, measure, studies, pico, onStudiesChange, onSwitchToInput, onSwitchToExtract, onPRISMAUpdate }: Props) {
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

  // AI Screening (Phase 2)
  const [aiResults, setAiResults] = useState<Map<string, AIScreeningResult>>(new Map());
  const [aiScreening, setAiScreening] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Active Learning screening state
  const [alMode, setAlMode] = useState(false);
  const [alDecisions, setAlDecisions] = useState<Map<string, ScreeningDecision>>(new Map());
  const [alRanked, setAlRanked] = useState(false);
  const STOPPING_THRESHOLD = 10;

  // Search history
  const [history, setHistory] = useState<string[]>(loadHistory);

  // Search source
  const [searchSource, setSearchSource] = useState<SearchSource>('pubmed');

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

  // AI screening summary counts
  const aiSummary = useMemo(() => {
    if (aiResults.size === 0) return null;
    let include = 0, exclude = 0, maybe = 0;
    for (const r of aiResults.values()) {
      if (r.verdict === 'include') include++;
      else if (r.verdict === 'exclude') exclude++;
      else maybe++;
    }
    return { include, exclude, maybe };
  }, [aiResults]);

  const aiIncludeCount = useMemo(() => {
    if (aiResults.size === 0) return 0;
    return results.filter(r => aiResults.get(r.pmid)?.verdict === 'include').length;
  }, [results, aiResults]);

  const selectAllAiInclude = useCallback(() => {
    const pmids = results
      .filter(r => aiResults.get(r.pmid)?.verdict === 'include')
      .map(r => r.pmid);
    setSelected(new Set(pmids));
  }, [results, aiResults]);

  // Active Learning: build ALArticle array from results + decisions
  const alArticles = useMemo<ALArticle[]>(() => {
    if (!alMode) return [];
    return results.map(r => ({
      pmid: r.pmid,
      title: r.title,
      abstract: abstracts[r.pmid] || '',
      decision: alDecisions.get(r.pmid) || null,
      alScore: 50,
    }));
  }, [alMode, results, abstracts, alDecisions]);

  // Active Learning: statistics
  const alStats = useMemo<ScreeningStats | null>(() => {
    if (!alMode || alArticles.length === 0) return null;
    return computeStats(alArticles, STOPPING_THRESHOLD);
  }, [alMode, alArticles]);

  // Active Learning: re-ranked and sorted articles
  const alSortedResults = useMemo(() => {
    if (!alMode || !alRanked || alArticles.length === 0) return results;
    const ranked = rerank(alArticles);
    const scoreMap = new Map(ranked.map(a => [a.pmid, a.alScore]));
    return [...results].sort((a, b) => {
      const sa = scoreMap.get(a.pmid) ?? 50;
      const sb = scoreMap.get(b.pmid) ?? 50;
      // Unreviewed first, sorted by AL score
      const da = alDecisions.has(a.pmid) ? 1 : 0;
      const db = alDecisions.has(b.pmid) ? 1 : 0;
      if (da !== db) return da - db;
      return sb - sa;
    });
  }, [alMode, alRanked, alArticles, results, alDecisions]);

  // AL: included count for import
  const alIncludedCount = useMemo(() => {
    let count = 0;
    for (const d of alDecisions.values()) {
      if (d === 'include') count++;
    }
    return count;
  }, [alDecisions]);

  // AL: label an article
  const alLabel = useCallback((pmid: string, decision: ScreeningDecision) => {
    setAlDecisions(prev => {
      const next = new Map(prev);
      next.set(pmid, decision);
      return next;
    });
    // Auto re-rank after labeling
    setAlRanked(true);
    trackEvent('al_label', { decision });
  }, []);

  // AL: undo label
  const alUndoLabel = useCallback((pmid: string) => {
    setAlDecisions(prev => {
      const next = new Map(prev);
      next.delete(pmid);
      return next;
    });
  }, []);

  // AL: select all included for import
  const alSelectIncluded = useCallback(() => {
    const pmids = new Set<string>();
    for (const [pmid, decision] of alDecisions.entries()) {
      if (decision === 'include') pmids.add(pmid);
    }
    setSelected(pmids);
  }, [alDecisions]);

  // AL: exit mode
  const alExit = useCallback(() => {
    setAlMode(false);
    setAlRanked(false);
    trackEvent('al_exit', { labels: String(alDecisions.size) });
  }, [alDecisions.size]);

  // Batch fetch abstracts for articles that don't have them yet
  const fetchAbstractsBatch = useCallback(async (pmids: string[]): Promise<Record<string, string>> => {
    const missing = pmids.filter(p => !abstracts[p]);
    if (missing.length === 0) return abstracts;

    const adapter = getAdapter(searchSource);
    const newAbstracts: Record<string, string> = {};

    if (adapter.fetchAbstract) {
      // Fetch in batches of 5
      for (let i = 0; i < missing.length; i += 5) {
        const batch = missing.slice(i, i + 5);
        const fetches = batch.map(async (pmid) => {
          try {
            const text = await adapter.fetchAbstract!(pmid);
            if (text) newAbstracts[pmid] = text;
          } catch {
            // Skip failed abstracts
          }
        });
        await Promise.all(fetches);
        if (i + 5 < missing.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    const merged = { ...abstracts, ...newAbstracts };
    setAbstracts(merged);
    return merged;
  }, [abstracts, searchSource]);

  // Start AI screening
  const startAiScreening = useCallback(async () => {
    if (!hasPICO || results.length === 0) return;

    setAiScreening(true);
    setAiDone(false);
    setAiError(null);
    setAiProgress({ done: 0, total: results.length });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Step 1: Batch load abstracts for all current results
      const allAbstracts = await fetchAbstractsBatch(results.map(r => r.pmid));

      // Step 2: Prepare articles with abstracts
      const articlesForScreening = results
        .filter(r => {
          const abs = allAbstracts[r.pmid];
          return abs && abs.trim().length >= 20;
        })
        .map(r => ({
          pmid: r.pmid,
          title: r.title,
          abstract: allAbstracts[r.pmid] || '',
        }));

      if (articlesForScreening.length === 0) {
        setAiError('no_abstracts');
        setAiScreening(false);
        return;
      }

      setAiProgress({ done: 0, total: articlesForScreening.length });

      // Step 3: Run batch AI screening
      const screeningResults = await batchScreen(
        articlesForScreening,
        pico,
        (progress) => {
          setAiProgress({ done: progress.completed, total: progress.total });
          setAiResults(new Map(progress.results));
        },
        controller.signal,
      );

      setAiResults(screeningResults);
      setAiDone(true);

      // Auto-update PRISMA with screening results
      if (onPRISMAUpdate) {
        let excludeCount = 0;
        for (const r of screeningResults.values()) {
          if (r.verdict === 'exclude') excludeCount++;
        }
        onPRISMAUpdate({
          recordsScreened: String(screeningResults.size),
          recordsExcluded: String(excludeCount),
        });
      }
    } catch {
      setAiError('error');
    } finally {
      setAiScreening(false);
      abortRef.current = null;
    }
  }, [hasPICO, results, pico, fetchAbstractsBatch, onPRISMAUpdate]);

  const cancelAiScreening = useCallback(() => {
    abortRef.current?.abort();
    setAiScreening(false);
  }, []);

  const buildFullQuery = useCallback((baseQuery: string): string => {
    const parts = [baseQuery.trim()];
    if (searchSource === 'pubmed') {
      // PubMed-specific query syntax
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
    }
    // For OpenAlex/Europe PMC, just use the base query
    // Date filtering is handled via adapter options
    return baseQuery.trim();
  }, [dateFrom, dateTo, articleType, langFilter, searchSource]);

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
      const adapter = getAdapter(searchSource);
      const response = await adapter.search(searchQuery, {
        retstart,
        retmax: PAGE_SIZE,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      setTotalCount(response.totalCount);

      const articles: PubMedArticle[] = response.results.map((r) => ({
        pmid: r.pmid || r.id,
        source: r.source,
        title: r.title,
        authors: r.authors,
        journal: r.journal,
        pubdate: r.pubdate,
        doi: r.doi,
        abstract: r.abstract,
      }));

      // Pre-fill abstracts cache from sources that return them inline
      const newAbstracts: Record<string, string> = {};
      for (const a of articles) {
        if (a.abstract) newAbstracts[a.pmid] = a.abstract;
      }
      if (Object.keys(newAbstracts).length > 0) {
        setAbstracts(prev => ({ ...prev, ...newAbstracts }));
      }

      setResults(articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('search.error', lang));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [lang, searchSource, dateFrom, dateTo]);

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
      const adapter = getAdapter(searchSource);
      if (!adapter.fetchAbstract) throw new Error('No abstract fetch');
      const text = await adapter.fetchAbstract(pmid);
      if (!text) throw new Error('Empty abstract');
      setAbstracts((prev) => ({ ...prev, [pmid]: text }));
    } catch {
      setAbstracts((prev) => ({ ...prev, [pmid]: lang === 'zh' ? '(无法加载摘要)' : '(Failed to load abstract)' }));
    }
  }, [abstracts, expandedPmid, lang, searchSource]);

  const importSelected = useCallback(() => {
    const selectedArticles = results.filter((r) => selected.has(r.pmid));
    if (selectedArticles.length === 0) return;

    const isBinary = measure === 'OR' || measure === 'RR';
    const isHRMeasure = measure === 'HR';

    const newStudies: Study[] = selectedArticles.map((article) => {
      const firstAuthor = article.authors[0]?.split(' ')[0] || 'Unknown';
      const yearMatch = article.pubdate.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;
      const name = year ? `${firstAuthor} ${year}` : firstAuthor;

      const exists = studies.some(
        (s) => s.name === name || s.name.includes(article.pmid)
      );
      if (exists) return null;

      const data = isHRMeasure
        ? { hr: 0, ciLower: 0, ciUpper: 0 }
        : isBinary
        ? { events1: 0, total1: 0, events2: 0, total2: 0 }
        : { mean1: 0, sd1: 0, n1: 0, mean2: 0, sd2: 0, n2: 0 };

      return {
        id: `${article.source || 'pubmed'}-${article.pmid}`,
        name,
        year,
        data,
      };
    }).filter(Boolean) as Study[];

    if (newStudies.length > 0) {
      onStudiesChange([...studies, ...newStudies]);
      setImportedCount(newStudies.length);
      setSelected(new Set());

      // Auto-update PRISMA flowchart
      if (onPRISMAUpdate && totalCount > 0) {
        onPRISMAUpdate({ dbRecords: String(totalCount) });
        setPrismaNotice(true);
        setTimeout(() => setPrismaNotice(false), 3000);
      }

      // Auto-switch to Input tab after brief delay so user sees the imported studies
      setTimeout(() => {
        setImportedCount(0);
        onSwitchToInput();
      }, 1500);
    }
  }, [results, selected, studies, measure, onStudiesChange, onPRISMAUpdate, totalCount, onSwitchToInput]);

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
          <select
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value as SearchSource)}
            style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff', flexShrink: 0 }}
          >
            <option value="pubmed">{t('search.source.pubmed', lang)}</option>
            <option value="openalex">{t('search.source.openalex', lang)}</option>
            <option value="europepmc">{t('search.source.europepmc', lang)}</option>
            <option value="semanticscholar">{t('search.source.semanticscholar', lang)}</option>
          </select>
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
          {t('search.importedBridge', lang).replace('{n}', String(importedCount))}
          {' '}
          {onSwitchToExtract && (
            <>
              <button onClick={onSwitchToExtract} style={{ color: '#2563eb', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {t('search.goToExtract', lang)}
              </button>
              {' | '}
            </>
          )}
          <button onClick={onSwitchToInput} style={{ color: '#6b7280', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
            {t('search.goToInputManual', lang)}
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

      {/* AI Screening controls */}
      {hasResults && hasPICO && (
        <div style={{ marginBottom: 12 }}>
          {/* AI Screen button / progress */}
          {!aiScreening && !aiDone && (
            <button
              onClick={startAiScreening}
              style={aiScreenBtnStyle}
            >
              {t('screening.aiBtn', lang)}
            </button>
          )}

          {/* Progress bar during screening */}
          {aiScreening && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  {t('screening.aiProgress', lang)
                    .replace('{done}', String(aiProgress.done))
                    .replace('{total}', String(aiProgress.total))}
                </div>
                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${aiProgress.total > 0 ? (aiProgress.done / aiProgress.total) * 100 : 0}%`,
                      background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
              <button onClick={cancelAiScreening} style={aiCancelBtnStyle}>
                {t('screening.aiCancel', lang)}
              </button>
            </div>
          )}

          {/* AI screening done summary */}
          {aiDone && aiSummary && (
            <div style={{
              padding: '8px 14px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 6,
              fontSize: 12,
              color: '#5b21b6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <span>
                {t('screening.aiDone', lang)
                  .replace('{include}', String(aiSummary.include))
                  .replace('{exclude}', String(aiSummary.exclude))
                  .replace('{maybe}', String(aiSummary.maybe))}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {aiIncludeCount > 0 && (
                  <button onClick={selectAllAiInclude} style={screeningSelectStyle}>
                    {t('screening.aiSelectInclude', lang)} ({aiIncludeCount})
                  </button>
                )}
                <button
                  onClick={() => { setAiDone(false); setAiResults(new Map()); }}
                  style={{ ...aiCancelBtnStyle, fontSize: 11 }}
                >
                  {t('screening.sortDefault', lang)}
                </button>
              </div>
            </div>
          )}

          {/* AI error messages */}
          {aiError === 'quota_exceeded' && (
            <div style={{ padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, marginTop: 8 }}>
              {t('screening.aiQuota', lang)}
            </div>
          )}
          {aiError === 'error' && (
            <div style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12, marginTop: 8 }}>
              {t('screening.aiError', lang)}
            </div>
          )}
        </div>
      )}

      {/* Active Learning controls */}
      {hasResults && hasPICO && !alMode && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => {
              setAlMode(true);
              trackFeature('al_screening_start');
              // Batch load abstracts for re-ranking quality
              fetchAbstractsBatch(results.map(r => r.pmid));
            }}
            style={alStartBtnStyle}
          >
            {t('screening.alStart', lang)}
          </button>
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
            {t('screening.alDesc', lang)}
          </span>
        </div>
      )}

      {/* Active Learning mode UI */}
      {alMode && hasResults && (
        <div style={{ marginBottom: 12 }}>
          {/* Stats bar */}
          {alStats && (
            <div style={{
              padding: '10px 14px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 8,
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <span style={{ fontSize: 12, color: '#0369a1' }}>
                {t('screening.alStats', lang)
                  .replace('{reviewed}', String(alStats.reviewed))
                  .replace('{total}', String(alStats.total))
                  .replace('{included}', String(alStats.included))
                  .replace('{excluded}', String(alStats.excluded))
                  .replace('{uncertain}', String(alStats.uncertain))}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {alIncludedCount > 0 && (
                  <button onClick={alSelectIncluded} style={screeningSelectStyle}>
                    {t('screening.alImportIncluded', lang).replace('{n}', String(alIncludedCount))}
                  </button>
                )}
                <button onClick={alExit} style={alExitBtnStyle}>
                  {t('screening.alExit', lang)}
                </button>
              </div>
            </div>
          )}

          {/* Stopping indicator */}
          {alStats && alStats.reviewed > 0 && (
            <div style={{
              padding: '8px 14px',
              background: alStats.stoppingReached ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${alStats.stoppingReached ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 8,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* Stopping circle */}
              <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke={alStats.stoppingReached ? '#22c55e' : '#f59e0b'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(alStats.consecutiveExcludes / STOPPING_THRESHOLD) * 94.2} 94.2`}
                    transform="rotate(-90 18 18)"
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                  />
                </svg>
                <span style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: alStats.stoppingReached ? '#16a34a' : '#d97706',
                }}>
                  {alStats.consecutiveExcludes}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {alStats.stoppingReached ? (
                  <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    {t('screening.alStoppingReached', lang).replace('{threshold}', String(STOPPING_THRESHOLD))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#92400e' }}>
                    {t('screening.alStoppingDesc', lang)
                      .replace('{count}', String(alStats.consecutiveExcludes))
                      .replace('{threshold}', String(STOPPING_THRESHOLD))}
                  </div>
                )}
              </div>
            </div>
          )}
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
          {(alMode ? alSortedResults : sortedResults).map((article) => {
            const score = scores[article.pmid];
            const bucketStyle = score ? BUCKET_STYLES[score.bucket] : null;
            const aiResult = aiResults.get(article.pmid);
            const aiVerdictStyle = aiResult ? AI_VERDICT_STYLES[aiResult.verdict] : null;
            const alDecision = alDecisions.get(article.pmid);
            const alDecisionStyle = alDecision ? AL_DECISION_STYLES[alDecision] : null;
            // AL decision > AI result > PICO score for border color
            const borderColor = alDecisionStyle ? alDecisionStyle.border
              : aiVerdictStyle ? aiVerdictStyle.border
              : (bucketStyle ? bucketStyle.border : undefined);

            return (
              <div
                key={article.pmid}
                style={{
                  padding: '12px 14px',
                  background: alDecision === 'include' ? '#f0fdf4'
                    : alDecision === 'exclude' ? '#fef2f2'
                    : selected.has(article.pmid) ? '#eff6ff'
                    : '#fff',
                  border: `1px solid ${selected.has(article.pmid) ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                  marginBottom: 6,
                  borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
                  opacity: alMode && alDecision === 'exclude' ? 0.6 : 1,
                  transition: 'opacity 0.2s, background 0.2s',
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>
                        {article.title}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        {/* AL decision badge (highest priority) */}
                        {alDecision && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            background: alDecisionStyle!.bg,
                            color: alDecisionStyle!.text,
                            whiteSpace: 'nowrap',
                          }}>
                            {t(`screening.al${alDecision.charAt(0).toUpperCase() + alDecision.slice(1)}`, lang)}
                          </span>
                        )}
                        {/* AI verdict badge */}
                        {aiResult && !alDecision && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            background: aiVerdictStyle!.bg,
                            color: aiVerdictStyle!.text,
                            whiteSpace: 'nowrap',
                          }}>
                            {t(`screening.ai${aiResult.verdict.charAt(0).toUpperCase() + aiResult.verdict.slice(1)}`, lang)}
                            {' '}{Math.round(aiResult.confidence * 100)}%
                          </span>
                        )}
                        {/* PICO keyword badge */}
                        {score && hasPICO && !aiResult && !alDecision && (
                          <span style={{
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
                    </div>
                    {/* AI reason (shown when AI result exists) */}
                    {aiResult && aiResult.reason && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, fontStyle: 'italic', lineHeight: 1.3 }}>
                        {aiResult.reason}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {article.authors.slice(0, 3).join(', ')}
                      {article.authors.length > 3 && ` et al.`}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{article.journal}</span>
                      <span>{article.pubdate}</span>
                      <span>{article.source === 'pubmed' ? 'PMID' : article.source === 'openalex' ? 'OpenAlex' : 'EPMC'}: {article.pmid.replace(/^(pubmed|openalex|europepmc):/, '')}</span>
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

                    {/* Active Learning decision buttons */}
                    {alMode && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {alDecision ? (
                          <button
                            onClick={() => alUndoLabel(article.pmid)}
                            style={alUndoBtnStyle}
                          >
                            {t('screening.alUndo', lang)}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => alLabel(article.pmid, 'include')}
                              style={alIncludeBtnStyle}
                            >
                              {t('screening.alInclude', lang)}
                            </button>
                            <button
                              onClick={() => alLabel(article.pmid, 'exclude')}
                              style={alExcludeBtnStyle}
                            >
                              {t('screening.alExclude', lang)}
                            </button>
                            <button
                              onClick={() => alLabel(article.pmid, 'uncertain')}
                              style={alUncertainBtnStyle}
                            >
                              {t('screening.alUncertain', lang)}
                            </button>
                          </>
                        )}
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

const AI_VERDICT_STYLES = {
  include: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  exclude: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  maybe: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
} as const;

const aiScreenBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: 0.3,
};

const aiCancelBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#f3f4f6',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

// Active Learning styles
const AL_DECISION_STYLES = {
  include: { bg: '#dcfce7', text: '#15803d', border: '#22c55e' },
  exclude: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  uncertain: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
} as const;

const alStartBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: 'linear-gradient(135deg, #059669, #0d9488)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: 0.3,
};

const alIncludeBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#dcfce7',
  color: '#15803d',
  border: '1px solid #86efac',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const alExcludeBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fca5a5',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const alUncertainBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#fef3c7',
  color: '#92400e',
  border: '1px solid #fcd34d',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const alUndoBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#f3f4f6',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 11,
  cursor: 'pointer',
};

const alExitBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: '#f3f4f6',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 11,
  cursor: 'pointer',
};
