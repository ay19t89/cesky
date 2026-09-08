# České pády — SvelteKit

SvelteKit and TypeScript version of the Czech noun declension checker. The app
uses the Internetová jazyková příručka through the Supabase Edge Function,
stores each user's words in Supabase with row-level security, displays Czech to
English or Russian translations from Seznam Slovník, and exports Unicode CSV,
XLSX, A4 PDF, and A3 PDF files.

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

The static SvelteKit output is written to `build/` and configured for OpenAI
Sites in `.openai/hosting.json`.

## Supabase

The existing project URL and publishable key are stored in `src/lib/config.ts`.
Database access is enforced by Supabase Auth and row-level security. The schema
and Edge Function source are retained under `supabase/`.

Deploy the Edge Function after changing its source:

```bash
npx supabase functions deploy dictionary --project-ref vmcegdasdeucdrxngjfv
```
