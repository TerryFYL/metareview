// Lightweight KV-based analytics for MetaReview
// Tracks page views, feature usage, and key events without cookies

interface Env {
  ANALYTICS: KVNamespace;
}

interface TrackEvent {
  event: string;    // e.g. "page_view", "tab_switch", "search", "ai_screen", "export_report", "pdf_upload"
  props?: Record<string, string>;  // optional properties
  vid?: string;     // anonymous visitor ID (localStorage-based)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get date key in YYYY-MM-DD format
function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: TrackEvent = await context.request.json();

    if (!body.event || typeof body.event !== 'string') {
      return Response.json({ ok: false }, { status: 400, headers: CORS_HEADERS });
    }

    const day = dateKey();
    const kvKey = `${day}:${body.event}`;

    // Atomic increment via get + put (KV doesn't have native increment)
    const current = await context.env.ANALYTICS.get(kvKey);
    const count = (current ? parseInt(current, 10) : 0) + 1;
    await context.env.ANALYTICS.put(kvKey, count.toString(), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days retention
    });

    // Also track daily unique events list for summary
    const summaryKey = `${day}:_summary`;
    const summary = await context.env.ANALYTICS.get(summaryKey);
    const events: Record<string, number> = summary ? JSON.parse(summary) : {};
    events[body.event] = count;
    await context.env.ANALYTICS.put(summaryKey, JSON.stringify(events), {
      expirationTtl: 60 * 60 * 24 * 90,
    });

    // Track unique visitors per day
    if (body.vid && body.event === 'page_view') {
      const uvKey = `${day}:_uv`;
      const uvRaw = await context.env.ANALYTICS.get(uvKey);
      const uv: Record<string, number> = uvRaw ? JSON.parse(uvRaw) : {};
      if (!uv[body.vid]) {
        uv[body.vid] = 1;
        await context.env.ANALYTICS.put(uvKey, JSON.stringify(uv), {
          expirationTtl: 60 * 60 * 24 * 90,
        });
      }
    }

    // Store referrer/UTM data for page_view events
    if (body.event === 'page_view' && body.props) {
      const source = body.props.utm_source || body.props.referrer || null;
      if (source) {
        const refKey = `${day}:_referrers`;
        const refRaw = await context.env.ANALYTICS.get(refKey);
        const refs: Record<string, number> = refRaw ? JSON.parse(refRaw) : {};
        refs[source] = (refs[source] || 0) + 1;
        await context.env.ANALYTICS.put(refKey, JSON.stringify(refs), {
          expirationTtl: 60 * 60 * 24 * 90,
        });
      }
    }

    // Track MA completions with visitor identity
    if (body.event === 'ma_completed' && body.vid) {
      const maKey = `${day}:_ma`;
      const maRaw = await context.env.ANALYTICS.get(maKey);
      const ma: Record<string, string> = maRaw ? JSON.parse(maRaw) : {};
      ma[body.vid] = body.props?.studies || '0';
      await context.env.ANALYTICS.put(maKey, JSON.stringify(ma), {
        expirationTtl: 60 * 60 * 24 * 90,
      });
    }

    // Track deep usage (≥3 features) with visitor identity
    if (body.event === 'deep_usage' && body.vid) {
      const deepKey = `${day}:_deep`;
      const deepRaw = await context.env.ANALYTICS.get(deepKey);
      const deep: Record<string, number> = deepRaw ? JSON.parse(deepRaw) : {};
      deep[body.vid] = parseInt(body.props?.featureCount || '3', 10);
      await context.env.ANALYTICS.put(deepKey, JSON.stringify(deep), {
        expirationTtl: 60 * 60 * 24 * 90,
      });
    }

    // Track time-to-forest-plot values
    if (body.event === 'time_to_forest_plot' && body.props?.seconds) {
      const ttfpKey = `${day}:_ttfp`;
      const ttfpRaw = await context.env.ANALYTICS.get(ttfpKey);
      const ttfp: number[] = ttfpRaw ? JSON.parse(ttfpRaw) : [];
      ttfp.push(parseInt(body.props.seconds, 10));
      await context.env.ANALYTICS.put(ttfpKey, JSON.stringify(ttfp), {
        expirationTtl: 60 * 60 * 24 * 90,
      });
    }

    return Response.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
};

// GET endpoint to read analytics (simple admin view)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const day = url.searchParams.get('day') || dateKey();

    const summaryKey = `${day}:_summary`;
    const summary = await context.env.ANALYTICS.get(summaryKey);
    const events: Record<string, number> = summary ? JSON.parse(summary) : {};

    return Response.json({ day, events }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ day: dateKey(), events: {} }, { headers: CORS_HEADERS });
  }
};
