// Analytics dashboard API — multi-day summary + email subscriber count
// GET /api/analytics/dashboard?days=30

interface Env {
  ANALYTICS: KVNamespace;
  EMAILS: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 90);

    // Build date range
    const today = new Date();
    const dailyData: Array<{ date: string; events: Record<string, number> }> = [];
    const totals: Record<string, number> = {};

    // Fetch all daily summaries in parallel
    const dateKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateKeys.push(formatDate(d));
    }

    const summaryPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_summary`)
    );
    const emailCountPromise = context.env.EMAILS.get('_count');

    const [summaries, emailCountStr] = await Promise.all([
      Promise.all(summaryPromises),
      emailCountPromise,
    ]);

    for (let i = 0; i < dateKeys.length; i++) {
      const raw = summaries[i];
      const events: Record<string, number> = raw ? JSON.parse(raw) : {};
      dailyData.push({ date: dateKeys[i], events });
      for (const [key, val] of Object.entries(events)) {
        totals[key] = (totals[key] || 0) + val;
      }
    }

    const emailSubscribers = emailCountStr ? parseInt(emailCountStr, 10) : 0;

    return Response.json({
      range: { from: dateKeys[dateKeys.length - 1], to: dateKeys[0], days },
      totals,
      emailSubscribers,
      daily: dailyData,
    }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500, headers: CORS_HEADERS });
  }
};
