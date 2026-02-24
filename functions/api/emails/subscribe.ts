// Email collection endpoint for MetaReview
// Stores subscriber emails in KV for future outreach

interface Env {
  EMAILS: KVNamespace;
}

interface SubscribeRequest {
  email: string;
  source?: string; // 'hero' | 'guide' | etc.
  lang?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: SubscribeRequest = await context.request.json();

    if (!body.email || !EMAIL_REGEX.test(body.email)) {
      return Response.json(
        { ok: false, error: 'invalid_email' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const email = body.email.toLowerCase().trim();
    const kvKey = `email:${email}`;

    // Check if already subscribed
    const existing = await context.env.EMAILS.get(kvKey);
    if (existing) {
      return Response.json(
        { ok: true, already: true },
        { headers: CORS_HEADERS }
      );
    }

    // Store email with metadata
    const record = {
      email,
      source: body.source || 'unknown',
      lang: body.lang || 'zh',
      subscribedAt: new Date().toISOString(),
    };

    await context.env.EMAILS.put(kvKey, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365 * 2, // 2 years
    });

    // Also maintain a count
    const countKey = '_count';
    const currentCount = await context.env.EMAILS.get(countKey);
    const count = (currentCount ? parseInt(currentCount, 10) : 0) + 1;
    await context.env.EMAILS.put(countKey, count.toString());

    return Response.json({ ok: true, count }, { headers: CORS_HEADERS });
  } catch {
    return Response.json(
      { ok: false, error: 'server_error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
