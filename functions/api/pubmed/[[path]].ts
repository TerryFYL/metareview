// Cloudflare Pages Function: CORS proxy for NCBI E-utilities
// Catches all /api/pubmed/* requests and forwards to eutils.ncbi.nlm.nih.gov

interface Env {
  NCBI_API_KEY?: string;
}

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathSegments = context.params.path as string[];
  const endpoint = pathSegments.join('/');

  // Only allow known E-utilities endpoints
  const allowed = ['esearch.fcgi', 'esummary.fcgi', 'efetch.fcgi'];
  if (!allowed.includes(endpoint)) {
    return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Build NCBI URL with all query params
  const ncbiUrl = new URL(`${NCBI_BASE}/${endpoint}`);
  url.searchParams.forEach((value, key) => ncbiUrl.searchParams.set(key, value));

  // Inject API key if available (raises rate limit from 3/s to 10/s)
  const apiKey = context.env.NCBI_API_KEY;
  if (apiKey) {
    ncbiUrl.searchParams.set('api_key', apiKey);
  }

  try {
    const response = await fetch(ncbiUrl.toString(), {
      headers: { 'User-Agent': 'MetaReview/1.0 (https://metareview-8c1.pages.dev)' },
    });

    const body = await response.text();
    const contentType = response.headers.get('Content-Type') || 'application/json';

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': endpoint === 'esearch.fcgi'
          ? 'public, max-age=86400'   // 24h for search results
          : 'public, max-age=604800', // 7 days for article metadata
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch from PubMed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
};
