// POST /api/share/create — Save analysis data and return a share ID

interface Env {
  SHARES: KVNamespace;
  ANALYTICS: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await context.request.text();

    // Validate size (100KB max)
    if (body.length > 102400) {
      return new Response(
        JSON.stringify({ error: 'Payload too large (max 100KB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate it's valid JSON
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Basic structure validation
    const d = data as Record<string, unknown>;
    if (!d.studies || !Array.isArray(d.studies) || d.studies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty studies array' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate short ID (8 chars from crypto)
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

    // Store in KV with 1-year TTL
    await context.env.SHARES.put(`share:${id}`, body, {
      expirationTtl: 365 * 24 * 60 * 60,
    });

    // Track share creation event
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = `day:${today}`;
      const raw = await context.env.ANALYTICS.get(key);
      const stats = raw ? JSON.parse(raw) : {};
      stats.share_create = (stats.share_create || 0) + 1;
      await context.env.ANALYTICS.put(key, JSON.stringify(stats), { expirationTtl: 90 * 86400 });
    } catch {
      // Analytics tracking is best-effort
    }

    return new Response(
      JSON.stringify({ id, url: `/?s=${id}` }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
