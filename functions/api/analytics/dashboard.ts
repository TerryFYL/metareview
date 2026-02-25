// Analytics dashboard API — multi-day summary + email subscriber count + Go/No-Go metrics
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

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
    const dailyData: Array<{ date: string; events: Record<string, number>; uniqueVisitors: number }> = [];
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
    const referrerPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_referrers`)
    );
    const uvPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_uv`)
    );
    const maPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_ma`)
    );
    const deepPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_deep`)
    );
    const ttfpPromises = dateKeys.map(dk =>
      context.env.ANALYTICS.get(`${dk}:_ttfp`)
    );
    const emailCountPromise = context.env.EMAILS.get('_count');

    const [summaries, referrerData, uvData, maData, deepData, ttfpData, emailCountStr] = await Promise.all([
      Promise.all(summaryPromises),
      Promise.all(referrerPromises),
      Promise.all(uvPromises),
      Promise.all(maPromises),
      Promise.all(deepPromises),
      Promise.all(ttfpPromises),
      emailCountPromise,
    ]);

    const allVisitorIds = new Set<string>();
    // Track which days each visitor appeared on (for returning visitor calc)
    const visitorDays: Record<string, number> = {};

    for (let i = 0; i < dateKeys.length; i++) {
      const raw = summaries[i];
      const events: Record<string, number> = raw ? JSON.parse(raw) : {};
      // Count daily unique visitors
      const uvRaw = uvData[i];
      const dayUv = uvRaw ? Object.keys(JSON.parse(uvRaw)).length : 0;
      if (uvRaw) {
        for (const vid of Object.keys(JSON.parse(uvRaw))) {
          allVisitorIds.add(vid);
          visitorDays[vid] = (visitorDays[vid] || 0) + 1;
        }
      }
      dailyData.push({ date: dateKeys[i], events, uniqueVisitors: dayUv });
      for (const [key, val] of Object.entries(events)) {
        totals[key] = (totals[key] || 0) + val;
      }
    }
    const totalUniqueVisitors = allVisitorIds.size;

    // Aggregate referrer sources
    const referrers: Record<string, number> = {};
    for (let i = 0; i < dateKeys.length; i++) {
      const raw = referrerData[i];
      if (raw) {
        const refs: Record<string, number> = JSON.parse(raw);
        for (const [src, cnt] of Object.entries(refs)) {
          referrers[src] = (referrers[src] || 0) + cnt;
        }
      }
    }

    // --- Go/No-Go Metrics ---

    // 1. Returning visitors (appeared on 2+ different days)
    let returningVisitors = 0;
    for (const count of Object.values(visitorDays)) {
      if (count >= 2) returningVisitors++;
    }

    // 2. Weekly return rate (visitors in latest 7 days who also visited in the previous 7)
    let weeklyReturnRate: number | null = null;
    if (days >= 14) {
      const thisWeekVids = new Set<string>();
      const lastWeekVids = new Set<string>();
      for (let i = 0; i < 7 && i < dateKeys.length; i++) {
        const uvRaw = uvData[i];
        if (uvRaw) for (const vid of Object.keys(JSON.parse(uvRaw))) thisWeekVids.add(vid);
      }
      for (let i = 7; i < 14 && i < dateKeys.length; i++) {
        const uvRaw = uvData[i];
        if (uvRaw) for (const vid of Object.keys(JSON.parse(uvRaw))) lastWeekVids.add(vid);
      }
      if (lastWeekVids.size > 0) {
        let returning = 0;
        for (const vid of thisWeekVids) {
          if (lastWeekVids.has(vid)) returning++;
        }
        weeklyReturnRate = Math.round((returning / lastWeekVids.size) * 100);
      }
    }

    // 3. MA completions (unique visitors who exported ≥3 studies)
    const maCompletedVids = new Set<string>();
    for (let i = 0; i < dateKeys.length; i++) {
      const raw = maData[i];
      if (raw) {
        const ma: Record<string, string> = JSON.parse(raw);
        for (const vid of Object.keys(ma)) maCompletedVids.add(vid);
      }
    }

    // 4. Deep usage (unique visitors using ≥3 features)
    const deepUsageVids = new Set<string>();
    for (let i = 0; i < dateKeys.length; i++) {
      const raw = deepData[i];
      if (raw) {
        const deep: Record<string, number> = JSON.parse(raw);
        for (const vid of Object.keys(deep)) deepUsageVids.add(vid);
      }
    }
    const deepUsageRate = totalUniqueVisitors > 0
      ? Math.round((deepUsageVids.size / totalUniqueVisitors) * 100)
      : 0;

    // 5. Time to forest plot (median seconds)
    const allTtfp: number[] = [];
    for (let i = 0; i < dateKeys.length; i++) {
      const raw = ttfpData[i];
      if (raw) {
        const times: number[] = JSON.parse(raw);
        allTtfp.push(...times);
      }
    }
    const medianTimeToForestPlot = median(allTtfp);

    const emailSubscribers = emailCountStr ? parseInt(emailCountStr, 10) : 0;

    return Response.json({
      range: { from: dateKeys[dateKeys.length - 1], to: dateKeys[0], days },
      totals,
      uniqueVisitors: totalUniqueVisitors,
      referrers,
      emailSubscribers,
      daily: dailyData,
      goNoGo: {
        uniqueVisitors30d: totalUniqueVisitors,
        returningVisitors,
        weeklyReturnRate,
        maCompletedUsers: maCompletedVids.size,
        deepUsageUsers: deepUsageVids.size,
        deepUsageRate,
        medianTimeToForestPlotSeconds: medianTimeToForestPlot,
        timeToForestPlotSamples: allTtfp.length,
        emailSubscribers,
      },
    }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500, headers: CORS_HEADERS });
  }
};
