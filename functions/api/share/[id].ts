// GET /api/share/:id — Retrieve shared analysis data

interface Env {
  SHARES: KVNamespace;
  ANALYTICS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=3600',
  };

  const id = (context.params as { id: string }).id;

  if (!id || typeof id !== 'string' || !/^[a-f0-9]{8}$/.test(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid share ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const data = await context.env.SHARES.get(`share:${id}`);

  if (!data) {
    return new Response(
      JSON.stringify({ error: 'Share not found or expired' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Track share view event
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `day:${today}`;
    const raw = await context.env.ANALYTICS.get(key);
    const stats = raw ? JSON.parse(raw) : {};
    stats.share_view = (stats.share_view || 0) + 1;
    await context.env.ANALYTICS.put(key, JSON.stringify(stats), { expirationTtl: 90 * 86400 });
  } catch {
    // Best-effort
  }

  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
