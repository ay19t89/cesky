# České pády — SvelteKit

SvelteKit and TypeScript version of the Czech noun declension checker. The app
uses the Internetová jazyková příručka through the Sites worker, stores each
user's words in Supabase with row-level security, links to Czech to English and
Russian translations, and exports Unicode CSV, XLSX, A4 PDF, and A3 PDF files.

## Development

```bash
npm install
npm run dev
```

## Verification and build

```bash
npm run check
npm test
npm run build
```

The SvelteKit output and Sites worker bundle are written to `build/` and
configured in `.openai/hosting.json`.

## GitHub Pages

The `main` branch deploys the static SvelteKit build through GitHub Actions.
That build uses the `/cesky` base path and the public ChatGPT Sites dictionary
worker. The regular Sites build keeps using the same worker through its
same-origin `/api/dictionary` route.

## Supabase

The existing project URL and publishable key are stored in `src/lib/config.ts`.
Database access is enforced by Supabase Auth and row-level security. The schema
and shared dictionary source are retained under `supabase/`.
