import { fetchIjp, lookup, validateWord } from './dictionary.ts';

function jsonResponse(body: unknown, cacheControl: string): Response {
  return Response.json(body, {
    headers: { 'Cache-Control': cacheControl }
  });
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

    return await buildLookupResponse(word);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
