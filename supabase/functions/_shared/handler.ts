import { fetchIjp, lookup, validateWord } from './dictionary.ts';

const lookupIntervalMs = 4_000;
const latestLookupByClient = new Map<string, number>();

function jsonResponse(body: unknown, cacheControl: string): Response {
  return Response.json(body, {
    headers: { 'Cache-Control': cacheControl }
  });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  return (
    request.headers.get('cf-connecting-ip') ||
    forwarded?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimitResponse(request: Request): Response | null {
  const key = clientKey(request);
  const now = Date.now();
  if (latestLookupByClient.size > 1_000) {
    for (const [client, lastLookup] of latestLookupByClient) {
      if (lastLookup + lookupIntervalMs <= now) {
        latestLookupByClient.delete(client);
      }
    }
  }
  const retryAfter = (latestLookupByClient.get(key) || 0) + lookupIntervalMs;
  if (retryAfter > now) {
    return Response.json(
      { error: 'Počkejte čtyři sekundy před dalším hledáním.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((retryAfter - now) / 1_000))
        }
      }
    );
  }
  latestLookupByClient.set(key, now);
  return null;
}

async function buildSuggestionResponse(word: string): Promise<Response> {
  const dictionary = await fetchIjp(word);
  const suggestions = [
    ...new Set(dictionary.entries.map((entry) => entry.lemma))
  ];

  return jsonResponse({ suggestions }, 'public, max-age=300');
}

async function buildLookupResponse(word: string): Promise<Response> {
  const result = await lookup(word);
  return jsonResponse(result, 'public, max-age=60');
}

function buildErrorResponse(error: unknown): Response {
  const message =
    error instanceof Error ? error.message : 'Ověření se nezdařilo.';

  return Response.json({ error: message }, { status: 400 });
}

export async function handleDictionary(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const word = validateWord(url.searchParams.get('word'));

    if (url.searchParams.get('action') === 'suggest') {
      return await buildSuggestionResponse(word);
    }

    const limited = rateLimitResponse(request);
    if (limited) return limited;
    return await buildLookupResponse(word);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
