// Email subscriber list API — returns all subscribers for admin dashboard
// GET /api/emails/list

interface Env {
  EMAILS: KVNamespace;
}

interface EmailRecord {
  email: string;
  source: string;
  lang: string;
  subscribedAt: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // List all email keys
    const listResult = await context.env.EMAILS.list({ prefix: 'email:' });
    const keys = listResult.keys.map(k => k.name);

    // Batch fetch all email records
    const records: EmailRecord[] = [];
    for (const key of keys) {
      const raw = await context.env.EMAILS.get(key);
      if (raw) {
        try {
          records.push(JSON.parse(raw));
        } catch {
          // skip malformed records
        }
      }
    }

    // Sort by subscription date descending (newest first)
    records.sort((a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime());

    return Response.json({
      count: records.length,
      subscribers: records,
    }, { headers: CORS_HEADERS });
  } catch {
    return Response.json(
      { error: 'Failed to fetch subscribers' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
