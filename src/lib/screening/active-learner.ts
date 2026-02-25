// Active Learning client-side engine for literature screening
// Implements TF-IDF + cosine similarity re-ranking based on user feedback
// Inspired by ASReview's architecture (van de Schoot et al., 2021)

/** User's screening decision */
export type ScreeningDecision = 'include' | 'exclude' | 'uncertain';

/** A labeled or unlabeled article for the AL pipeline */
export interface ALArticle {
  pmid: string;
  title: string;
  abstract: string;
  /** User decision (null = unreviewed) */
  decision: ScreeningDecision | null;
  /** AL priority score (higher = more likely relevant) */
  alScore: number;
}

/** Screening session statistics */
export interface ScreeningStats {
  total: number;
  reviewed: number;
  included: number;
  excluded: number;
  uncertain: number;
  unreviewed: number;
  /** Consecutive excludes since last include/uncertain */
  consecutiveExcludes: number;
  /** Whether stopping threshold is reached */
  stoppingReached: boolean;
}

// --- TF-IDF Engine ---

interface TermFreq {
  [term: string]: number;
}

/** Tokenize and clean text for TF-IDF */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/** Compute term frequencies for a document */
function termFrequency(tokens: string[]): TermFreq {
  const tf: TermFreq = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const t in tf) {
    tf[t] /= len;
  }
  return tf;
}

/** Compute IDF from a corpus of documents */
function inverseDocumentFrequency(corpus: TermFreq[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const doc of corpus) {
    for (const term in doc) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const N = corpus.length || 1;
  const idf: Record<string, number> = {};
  for (const term in df) {
    idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1; // smoothed IDF
  }
  return idf;
}

/** Compute TF-IDF vector for a document */
function tfidfVector(tf: TermFreq, idf: Record<string, number>): Record<string, number> {
  const vec: Record<string, number> = {};
  for (const term in tf) {
    vec[term] = tf[term] * (idf[term] || 1);
  }
  return vec;
}

/** Cosine similarity between two sparse vectors */
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const term in a) {
    normA += a[term] * a[term];
    if (b[term]) dot += a[term] * b[term];
  }
  for (const term in b) {
    normB += b[term] * b[term];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** Compute centroid of multiple TF-IDF vectors */
function centroid(vectors: Record<string, number>[]): Record<string, number> {
  if (vectors.length === 0) return {};
  const c: Record<string, number> = {};
  for (const v of vectors) {
    for (const term in v) {
      c[term] = (c[term] || 0) + v[term];
    }
  }
  const n = vectors.length;
  for (const term in c) {
    c[term] /= n;
  }
  return c;
}

// --- Active Learning Re-ranking ---

/**
 * Re-rank unreviewed articles based on user feedback using TF-IDF cosine similarity.
 * Articles similar to "included" items are boosted; similar to "excluded" are demoted.
 *
 * @param articles All articles (labeled + unlabeled)
 * @returns Articles with updated alScore, sorted by score descending
 */
export function rerank(articles: ALArticle[]): ALArticle[] {
  const included = articles.filter(a => a.decision === 'include');
  const excluded = articles.filter(a => a.decision === 'exclude');

  // Need at least 1 labeled article to re-rank
  if (included.length === 0 && excluded.length === 0) {
    return articles;
  }

  // Build corpus TF-IDF
  const allTokens = articles.map(a => tokenize(`${a.title} ${a.abstract}`));
  const allTf = allTokens.map(t => termFrequency(t));
  const idf = inverseDocumentFrequency(allTf);
  const allVectors = allTf.map(tf => tfidfVector(tf, idf));

  // Build index map: pmid -> vector
  const vecMap = new Map<string, Record<string, number>>();
  articles.forEach((a, i) => vecMap.set(a.pmid, allVectors[i]));

  // Compute centroids for include and exclude sets
  const includeVectors = included.map(a => vecMap.get(a.pmid)!).filter(Boolean);
  const excludeVectors = excluded.map(a => vecMap.get(a.pmid)!).filter(Boolean);
  const includeCentroid = centroid(includeVectors);
  const excludeCentroid = centroid(excludeVectors);

  // Score unreviewed articles
  return articles.map(article => {
    if (article.decision !== null) {
      // Already labeled — keep decision score (include=100, exclude=0, uncertain=50)
      return {
        ...article,
        alScore: article.decision === 'include' ? 100
               : article.decision === 'uncertain' ? 50
               : 0,
      };
    }

    const vec = vecMap.get(article.pmid) || {};
    let score = 50; // neutral baseline

    if (includeVectors.length > 0) {
      const simInclude = cosineSimilarity(vec, includeCentroid);
      score += simInclude * 40; // boost up to +40
    }

    if (excludeVectors.length > 0) {
      const simExclude = cosineSimilarity(vec, excludeCentroid);
      score -= simExclude * 30; // demote up to -30
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, Math.round(score)));

    return { ...article, alScore: score };
  });
}

/**
 * Compute screening statistics from articles.
 */
export function computeStats(
  articles: ALArticle[],
  stoppingThreshold: number = 10,
): ScreeningStats {
  let included = 0;
  let excluded = 0;
  let uncertain = 0;
  let consecutiveExcludes = 0;

  // Count decisions and compute consecutive excludes
  // (we track the streak from the most recent decisions backward)
  const decisions = articles
    .filter(a => a.decision !== null)
    .map(a => a.decision!);

  for (let i = decisions.length - 1; i >= 0; i--) {
    if (decisions[i] === 'exclude') {
      consecutiveExcludes++;
    } else {
      break;
    }
  }

  for (const a of articles) {
    if (a.decision === 'include') included++;
    else if (a.decision === 'exclude') excluded++;
    else if (a.decision === 'uncertain') uncertain++;
  }

  const reviewed = included + excluded + uncertain;

  return {
    total: articles.length,
    reviewed,
    included,
    excluded,
    uncertain,
    unreviewed: articles.length - reviewed,
    consecutiveExcludes,
    stoppingReached: consecutiveExcludes >= stoppingThreshold,
  };
}

/**
 * Get the next unreviewed article (highest AL score first).
 */
export function getNextArticle(articles: ALArticle[]): ALArticle | null {
  const unreviewed = articles
    .filter(a => a.decision === null)
    .sort((a, b) => b.alScore - a.alScore);
  return unreviewed[0] || null;
}
