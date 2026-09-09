import { fetchIjp, lookup, validateWord } from './dictionary.ts';
import { fetchTranslations } from './translation-source.ts';
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
    if (url.searchParams.get('action') === 'translations') {
      return Response.json(
        { translations: await fetchTranslations(word) },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      );
    }
    return Response.json(await lookup(word), {
      headers: { 'Cache-Control': 'no-store' }
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
