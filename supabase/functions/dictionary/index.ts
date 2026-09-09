import { handleDictionary } from '../_shared/handler.ts';
// Lookup is public. Personal dictionary reads and writes happen separately
// through authenticated Supabase clients and remain protected by RLS.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET')
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: cors }
    );
  const response = await handleDictionary(request);
  for (const [key, value] of Object.entries(cors))
    response.headers.set(key, value);
  return response;
});
