import { handleDictionary } from '../supabase/functions/_shared/handler.ts';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  ASSETS: AssetsBinding;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};

function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/dictionary') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (request.method !== 'GET') {
        return withCors(
          Response.json(
            { error: 'Method not allowed' },
            { status: 405, headers: { Allow: 'GET' } }
          )
        );
      }
      return withCors(await handleDictionary(request));
    }

    return environment.ASSETS.fetch(request);
  }
};
