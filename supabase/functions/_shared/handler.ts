import { fetchIjp, lookup, validateWord } from './dictionary.ts';

export async function handleDictionary(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const word = validateWord(url.searchParams.get('word'));
    if (url.searchParams.get('action') === 'suggest') {
      const data = await fetchIjp(word);
      return Response.json(
        { suggestions: [...new Set(data.entries.map((x) => x.lemma))] },
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      );
    }
    return Response.json(await lookup(word), {
      headers: { 'Cache-Control': 'public, max-age=60' }
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Ověření se nezdařilo.'
      },
      { status: 400 }
    );
  }
}
