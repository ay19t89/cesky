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

function addCorsHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

function handlePreflightRequest(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function buildMethodNotAllowedResponse(): Response {
  return addCorsHeaders(
    Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'GET' } }
    )
  );
}

async function handlePublicDictionaryRequest(
  request: Request
): Promise<Response> {
  if (request.method === 'OPTIONS') return handlePreflightRequest();
  if (request.method !== 'GET') return buildMethodNotAllowedResponse();

  return addCorsHeaders(await handleDictionary(request));
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/dictionary') {
      return handlePublicDictionaryRequest(request);
    }

    return environment.ASSETS.fetch(request);
  }
};
