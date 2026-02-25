// In-product feedback collection — stores to KV for analysis

interface Env {
  ANALYTICS: KVNamespace;
}

interface FeedbackPayload {
  role: string;
  completed: string;
  stuck: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: FeedbackPayload = await context.request.json();

    if (!body.role && !body.completed && !body.stuck) {
      return Response.json({ ok: false, error: 'empty' }, { status: 400, headers: CORS_HEADERS });
    }

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const id = now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);
    const key = `feedback:${day}:${id}`;

    await context.env.ANALYTICS.put(key, JSON.stringify({
      role: body.role || '',
      completed: body.completed || '',
      stuck: body.stuck || '',
      ts: now.toISOString(),
    }), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year retention
    });

    // Increment daily feedback count in summary
    const countKey = `${day}:feedback_submit`;
    const current = await context.env.ANALYTICS.get(countKey);
    const count = (current ? parseInt(current, 10) : 0) + 1;
    await context.env.ANALYTICS.put(countKey, count.toString(), {
      expirationTtl: 60 * 60 * 24 * 90,
    });

    return Response.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
};

// GET: List recent feedback (admin)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const list = await context.env.ANALYTICS.list({ prefix: 'feedback:', limit });
    const items = await Promise.all(
      list.keys.map(async (k) => {
        const val = await context.env.ANALYTICS.get(k.name);
        return val ? { id: k.name, ...JSON.parse(val) } : null;
      })
    );

    return Response.json({
      feedback: items.filter(Boolean),
      total: list.keys.length,
    }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ feedback: [], total: 0 }, { headers: CORS_HEADERS });
  }
};
