// Cloudflare Pages Function: AI-powered literature screening via Workers AI
// Uses @cf/meta/llama-3.1-8b-instruct to evaluate article relevance against PICO criteria

interface Env {
  AI: Ai; // Workers AI binding — configure in CF dashboard: Pages > Settings > Functions > AI bindings
}

interface ScreeningRequest {
  pico: {
    population: string;
    intervention: string;
    comparison: string;
    outcome: string;
    studyDesign?: string;
  };
  title: string;
  abstract: string;
}

interface ScreeningResponse {
  verdict: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reason: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `You are a systematic review screening assistant. Your task is to evaluate whether a research article meets the inclusion criteria for a systematic review based on the PICO framework.

You MUST respond with ONLY a JSON object in this exact format, no other text:
{"verdict":"include","confidence":0.85,"reason":"brief explanation"}

Rules for verdict:
- "include": Abstract clearly matches ALL specified PICO criteria
- "exclude": Abstract clearly fails one or more PICO criteria
- "maybe": Insufficient information to decide, or partial match

Important principles:
- Be conservative: when in doubt, say "maybe" (missing relevant studies is worse than keeping irrelevant ones)
- Check population, intervention, comparison, and outcome against the criteria
- If study design is specified, verify it matches
- Keep reason under 50 words
- Only output JSON, nothing else`;

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: ScreeningRequest = await context.request.json();

    // Validate required fields
    if (!body.pico || !body.title) {
      return Response.json(
        { error: 'Missing required fields: pico, title' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // If no abstract, return maybe with low confidence
    if (!body.abstract || body.abstract.trim().length < 20) {
      return Response.json(
        {
          verdict: 'maybe' as const,
          confidence: 0.1,
          reason: 'No abstract available for AI screening. Please load the abstract first.',
        },
        { headers: CORS_HEADERS }
      );
    }

    const userPrompt = `PICO Criteria:
- Population: ${body.pico.population || '(not specified)'}
- Intervention: ${body.pico.intervention || '(not specified)'}
- Comparison: ${body.pico.comparison || '(not specified)'}
- Outcome: ${body.pico.outcome || '(not specified)'}
${body.pico.studyDesign ? `- Study Design: ${body.pico.studyDesign}` : ''}

Article Title: ${body.title}

Abstract: ${body.abstract.slice(0, 2000)}

Evaluate this article. Respond with JSON only.`;

    const aiResponse = await context.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct' as BaseAiTextGenerationModels,
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }
    );

    // Extract the response text
    const responseText = typeof aiResponse === 'string'
      ? aiResponse
      : (aiResponse as { response?: string }).response || '';

    // Parse LLM output — handle potential markdown wrapping or extra text
    const parsed = parseAIResponse(responseText);

    return Response.json(parsed, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=86400', // Cache screening results for 24h
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    // Check for quota exceeded
    if (message.includes('exceeded') || message.includes('limit') || message.includes('quota')) {
      return Response.json(
        {
          verdict: 'maybe' as const,
          confidence: 0,
          reason: 'Daily AI screening quota exceeded. Try again tomorrow.',
          error: 'quota_exceeded',
        },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      {
        verdict: 'maybe' as const,
        confidence: 0,
        reason: 'AI screening temporarily unavailable. Please review manually.',
        error: message,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

function parseAIResponse(text: string): ScreeningResponse {
  // Try direct JSON parse first
  try {
    const result = JSON.parse(text.trim());
    return validateResponse(result);
  } catch {
    // LLM sometimes wraps JSON in markdown code blocks
  }

  // Try extracting JSON from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1]);
      return validateResponse(result);
    } catch {
      // Continue to next strategy
    }
  }

  // Try finding first { ... } in the text
  const braceMatch = text.match(/\{[\s\S]*?\}/);
  if (braceMatch) {
    try {
      const result = JSON.parse(braceMatch[0]);
      return validateResponse(result);
    } catch {
      // Give up
    }
  }

  // Fallback: could not parse
  return {
    verdict: 'maybe',
    confidence: 0,
    reason: 'AI response could not be parsed. Please review manually.',
  };
}

function validateResponse(obj: Record<string, unknown>): ScreeningResponse {
  const validVerdicts = ['include', 'exclude', 'maybe'];
  const verdict = validVerdicts.includes(obj.verdict as string)
    ? (obj.verdict as ScreeningResponse['verdict'])
    : 'maybe';

  const confidence = typeof obj.confidence === 'number'
    ? Math.max(0, Math.min(1, obj.confidence))
    : 0.5;

  const reason = typeof obj.reason === 'string'
    ? obj.reason.slice(0, 200)
    : 'No reason provided.';

  return { verdict, confidence, reason };
}
