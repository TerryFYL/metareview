// Cloudflare Pages Function: AI-powered data extraction from academic paper text
// Uses decomposed atomic queries via @cf/meta/llama-3.1-8b-instruct
// Same model and error handling pattern as screening endpoint

interface Env {
  AI: Ai;
}

interface ExtractionRequest {
  text: string;           // Extracted text from selected PDF pages
  queryType: 'outcomes' | 'effect_size' | 'sample_sizes' | 'events' | 'continuous';
  outcome?: string;       // Required for per-outcome queries
  studyType?: 'binary' | 'continuous';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Decomposed extraction prompts — each targets a single property
const PROMPTS: Record<string, (ctx: { outcome?: string }) => string> = {
  outcomes: () => `You are a medical research data extractor. List ALL outcome measures reported in this study's results.

You MUST respond with ONLY a JSON object in this exact format:
{"outcomes": ["outcome1", "outcome2"]}

Rules:
- Include primary and secondary outcomes
- Use the exact terminology from the paper
- Only list outcomes that have quantitative results reported
- If no outcomes found, return {"outcomes": []}`,

  effect_size: ({ outcome }) => `You are a medical research data extractor. Extract the effect size for the outcome "${outcome}".

You MUST respond with ONLY a JSON object in this exact format:
{"type": "OR", "value": 0.85, "ci_lower": 0.72, "ci_upper": 1.01, "source_quote": "exact text from paper"}

Rules:
- type must be one of: OR, RR, HR, MD, SMD, WMD
- value, ci_lower, ci_upper must be numbers (not strings)
- source_quote must be the EXACT text passage where you found this data
- If not found, return {"type": null, "value": null, "ci_lower": null, "ci_upper": null, "source_quote": ""}`,

  sample_sizes: () => `You are a medical research data extractor. Extract the sample sizes for the treatment/intervention group and the control/comparison group.

You MUST respond with ONLY a JSON object in this exact format:
{"treatment_n": 150, "control_n": 148, "source_quote": "exact text from paper"}

Rules:
- treatment_n is the intervention/experimental group sample size
- control_n is the control/placebo/comparison group sample size
- source_quote must be the EXACT text passage where you found this data
- If not found, return {"treatment_n": null, "control_n": null, "source_quote": ""}`,

  events: ({ outcome }) => `You are a medical research data extractor. Extract event counts per group for the outcome "${outcome}".

You MUST respond with ONLY a JSON object in this exact format:
{"treatment_events": 23, "control_events": 31, "source_quote": "exact text from paper"}

Rules:
- treatment_events: number of events in the intervention group
- control_events: number of events in the control group
- source_quote must be the EXACT text passage where you found this data
- If not found, return {"treatment_events": null, "control_events": null, "source_quote": ""}`,

  continuous: ({ outcome }) => `You are a medical research data extractor. Extract means and standard deviations per group for the outcome "${outcome}".

You MUST respond with ONLY a JSON object in this exact format:
{"treatment_mean": 12.3, "treatment_sd": 4.1, "control_mean": 14.5, "control_sd": 3.8, "source_quote": "exact text from paper"}

Rules:
- Extract mean and SD (standard deviation) for each group
- If SE (standard error) is given instead of SD, note it in source_quote
- source_quote must be the EXACT text passage where you found this data
- If not found, return {"treatment_mean": null, "treatment_sd": null, "control_mean": null, "control_sd": null, "source_quote": ""}`,
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: ExtractionRequest = await context.request.json();

    if (!body.text || !body.queryType) {
      return Response.json(
        { error: 'Missing required fields: text, queryType' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!PROMPTS[body.queryType]) {
      return Response.json(
        { error: `Invalid queryType: ${body.queryType}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Truncate text to ~3000 chars to stay within token budget
    const truncatedText = body.text.slice(0, 3000);

    const systemPrompt = PROMPTS[body.queryType]({ outcome: body.outcome });

    const userPrompt = `Here is the text from the study's results section:\n\n---\n${truncatedText}\n---\n\nExtract the requested data. Respond with JSON only.`;

    const aiResponse = await context.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct' as BaseAiTextGenerationModels,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }
    );

    const responseText = typeof aiResponse === 'string'
      ? aiResponse
      : (aiResponse as { response?: string }).response || '';

    const parsed = parseAIResponse(responseText);

    return Response.json(parsed, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('exceeded') || message.includes('limit') || message.includes('quota')) {
      return Response.json(
        { error: 'quota_exceeded', message: 'Daily AI extraction quota exceeded.' },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { error: 'extraction_failed', message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// Same three-layer parsing pattern as screening endpoint
function parseAIResponse(text: string): Record<string, unknown> {
  // Layer 1: Direct JSON parse
  try {
    return JSON.parse(text.trim());
  } catch { /* continue */ }

  // Layer 2: Extract from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch { /* continue */ }
  }

  // Layer 3: Find first { ... } in text
  const braceMatch = text.match(/\{[\s\S]*?\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch { /* continue */ }
  }

  // Fallback
  return { error: 'parse_failed', raw: text.slice(0, 500) };
}
