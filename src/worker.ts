import { handleDictionary } from '../supabase/functions/_shared/handler.ts';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  ASSETS: AssetsBinding;
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/dictionary') {
      if (request.method !== 'GET') {
        return Response.json(
          { error: 'Method not allowed' },
          { status: 405, headers: { Allow: 'GET' } }
        );
      }
      return handleDictionary(request);
    }

    return environment.ASSETS.fetch(request);
  }
};
