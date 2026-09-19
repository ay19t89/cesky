import { handleDictionary } from '../_shared/handler.ts';

// Lookup is public. Personal dictionary reads and writes happen separately
// through authenticated Supabase clients and remain protected by RLS.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handlePreflightRequest();
  if (request.method !== 'GET') return buildMethodNotAllowedResponse();

  return addCorsHeaders(await handleDictionary(request));
});
