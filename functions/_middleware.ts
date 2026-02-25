// Middleware: Dynamic OG meta tags for shared analysis links (?s=<id>)
// Enables rich social media previews (WeChat, Twitter, Facebook, LinkedIn)

interface Env {
  SHARES: KVNamespace;
}

const MEASURE_LABELS: Record<string, string> = {
  OR: 'Odds Ratio',
  RR: 'Risk Ratio',
  HR: 'Hazard Ratio',
  MD: 'Mean Difference',
  SMD: 'Standardized Mean Difference',
};

const BASE_URL = 'https://metareview.cc';

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDescription(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const studies = data.studies as Array<unknown> | undefined;
  if (studies?.length) {
    parts.push(`${studies.length} studies`);
  }
  const measure = data.measure as string | undefined;
  if (measure && MEASURE_LABELS[measure]) {
    parts.push(MEASURE_LABELS[measure]);
  }
  const model = data.model as string | undefined;
  if (model) {
    parts.push(model === 'random' ? 'Random-effects' : 'Fixed-effect');
  }
  const pico = data.pico as Record<string, string> | undefined;
  if (pico) {
    if (pico.intervention && pico.comparison) {
      parts.push(`${pico.intervention} vs ${pico.comparison}`);
    }
    if (pico.outcome) {
      parts.push(pico.outcome);
    }
  }
  return parts.length > 0
    ? `Meta-analysis: ${parts.join(' · ')} | MetaReview`
    : 'Shared meta-analysis results | MetaReview';
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const shareId = url.searchParams.get('s');

  // Only intercept root path with valid ?s= parameter
  if (url.pathname !== '/' || !shareId || !/^[a-f0-9]{8}$/.test(shareId)) {
    return context.next();
  }

  // Fetch the original response first
  const response = await context.next();

  // Only modify HTML responses
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    const raw = await context.env.SHARES.get(`share:${shareId}`);
    if (!raw) return response;

    const data = JSON.parse(raw) as Record<string, unknown>;
    const title = (data.title as string) || 'Shared Analysis';
    const ogTitle = escapeAttr(`${title} | MetaReview`);
    const ogDescription = escapeAttr(buildDescription(data));
    const ogUrl = escapeAttr(`${BASE_URL}/?s=${shareId}`);

    let html = await response.text();

    // Replace <title>
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${ogTitle}</title>`);

    // Replace meta description
    html = html.replace(
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${ogDescription}"`
    );

    // Replace Open Graph tags
    html = html.replace(
      /<meta property="og:url" content="[^"]*"/,
      `<meta property="og:url" content="${ogUrl}"`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${ogTitle}"`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*"/,
      `<meta property="og:description" content="${ogDescription}"`
    );

    // Replace Twitter Card tags
    html = html.replace(
      /<meta name="twitter:url" content="[^"]*"/,
      `<meta name="twitter:url" content="${ogUrl}"`
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${ogTitle}"`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*"/,
      `<meta name="twitter:description" content="${ogDescription}"`
    );

    // Replace canonical URL
    html = html.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="${ogUrl}"`
    );

    // Return modified HTML with same headers
    const newHeaders = new Headers(response.headers);
    return new Response(html, {
      status: response.status,
      headers: newHeaders,
    });
  } catch {
    // On any error, return original response
    return response;
  }
};
