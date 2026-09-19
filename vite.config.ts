import { sites } from '@openai/sites-vite-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { handleDictionary } from './supabase/functions/_shared/handler.ts';

function dictionaryApiDev(): Plugin {
  return {
    name: 'dictionary-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost');
        if (url.pathname !== '/api/dictionary') return next();

        const result =
          request.method === 'GET'
            ? await handleDictionary(
                new Request(`http://localhost${url.pathname}${url.search}`)
              )
            : Response.json(
                { error: 'Method not allowed' },
                { status: 405, headers: { Allow: 'GET' } }
              );

        response.statusCode = result.status;
        result.headers.forEach((value, name) =>
          response.setHeader(name, value)
        );
        response.end(new Uint8Array(await result.arrayBuffer()));
      });
    }
  };
}

export default defineConfig({
  build: {
    rolldownOptions: {
      // jsPDF loads this only for SVG conversion, which our PDF export does not use.
      external: ['canvg']
    }
  },
  plugins: [
    dictionaryApiDev(),
    tailwindcss(),
    sveltekit(),
    ...(process.env.GITHUB_PAGES === 'true' ? [] : [sites()])
  ],
  server: {
    allowedHosts: ['.zrok.io']
  }
});
