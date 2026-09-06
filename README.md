# České pády

Czech noun declension checker with IJP (ÚJČ) and MorphoDiTa/MorfFlex (ÚFAL), a private Supabase dictionary, and Unicode CSV, XLSX and PDF exports.

## Finish Supabase setup

The supplied project URL and **public publishable key** are configured in `lib/config.ts`. No service-role key is needed in the application. The publishable key cannot create tables or manage users.

1. Open your project's Supabase SQL editor and run `supabase/migrations/202609060001_dictionary.sql` once. It creates two new tables and per-user row-level access policies. If tables with these names already exist, inspect them before applying the migration; it intentionally does not overwrite them.
2. In Authentication → Users, create your email/password account. Disable public sign-ups in Authentication settings. The app has no signup flow.
3. Run the membership statement at the bottom of the migration, replacing `YOUR_EMAIL_HERE` with the account's email. Only approved members can use lookups and storage. Every member has a separate private dictionary.
4. Sign in on the website and check a word, then choose **Uložit slovo**. Reload and open **Můj slovník** to verify persistence. A public key alone cannot complete these administrator actions.

For the existing `ay19t89@gmail.com` account, `supabase/fix-access-ay19t89.sql` contains the exact one-time approval query. A successful login proves that Supabase Auth is configured; the separate `dictionary_members` row is the allowlist that protects dictionary lookups and saved data.

## GitHub Pages

Yes: the frontend has a separate static build. GitHub Pages cannot execute Python or a dictionary proxy, so its frontend calls a Supabase Edge Function. Both deployments use the same TypeScript implementation of the supplied Python parser.

1. Install Node.js 22.13+ and run `npm ci`.
2. Finish the Supabase setup above.
3. Install/sign in to the Supabase CLI with your own administrator account. Run:
   ```sh
   npm run prepare:edge
   supabase functions deploy dictionary --project-ref vmcegdasdeucdrxngjfv
   ```
   `verify_jwt = false` disables the legacy gateway check only. The function itself validates the bearer token through Supabase Auth and checks the approved-member table on every request.
4. Put this folder's source into your GitHub repository. In Settings → Pages select **GitHub Actions**. The included workflow publishes on pushes to `main`. `npm run build:pages` creates `dist-pages/index.html` with relative asset paths, so repository subpaths work.
5. No service keys, access tokens, or passwords belong in GitHub. The public configuration is intentionally visible; database RLS is the security boundary. The static page itself is public, but unapproved/anonymous users cannot query saved words or use the dictionary function.

The private Sites deployment uses `/api/dictionary` directly, so it does not require the Edge Function. Both routes verify the Supabase session and membership.

## Local development and checks

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run build:pages
```

## Data handling

- Scope: **podstatná jména** (nouns). Verbs/adjectives do not all have one of the four noun genders. Unknown genders remain unspecified.
- M → masculine animate; I → masculine inanimate; F → feminine (Ž); N → neuter (S). Lemmas/senses and genders from MorphoDiTa are kept separately; conflicting sources are never silently combined.
- Suggestions use a small built-in set of common nouns and the user's saved words, ignoring accents and allowing small spelling errors. After login a debounced IJP request also suggests its resolved spelling. This is not an exhaustive Czech spellchecker. IJP accent corrections are displayed explicitly, and the corrected lemma is submitted to both sources.
- All seven singular and plural positions are preserved. Missing forms appear as a dash, not guessed replacements. IJP footnote numbers are removed; follow the source link for usage notes. Source failure is distinct from a missing entry.
- MorphoDiTa is first queried without guessing. If no noun is found, it retries with the requested `guesser=yes` and labels generated results as estimates. The original tags and model identifier remain in the saved JSON. Nonstandard/rare variants are not silently filtered.
- Save is explicit. It upserts the current word for the authenticated user. In **Můj slovník**, gender filters affect exports; otherwise exports include the displayed result. CSV is UTF-8 with BOM and quoted semicolon-separated fields; formula-like values are escaped. XLSX uses string cells. PDF embeds the included OFL-licensed Noto Sans font.
- Dictionary fetches use fixed HTTPS destinations, validated single words and timeouts. User tokens are forwarded only to the configured Supabase project. Upstream HTML is parsed as text and is never rendered as HTML.
- The optional WebMCP `check_czech_noun` tool uses the same authenticated lookup action and does not save words.

## Sources and licenses

- Internetová jazyková příručka: https://prirucka.ujc.cas.cz/
- MorphoDiTa and model acknowledgements: https://ufal.mff.cuni.cz/morphodita and the `acknowledgements` links returned in each response. This app is not an official ÚJČ or ÚFAL product.
- Noto Sans: `public/fonts/OFL.txt`.

The website depends on the availability and HTML/API formats of the two upstream sources. Changes in the IJP layout may require a parser update.

## Verification status

Automated checks passed for all four genders against the live sources, accent correction, parser edge cases, rejected unauthenticated requests, CSV contents, XLSX round-trip, and PDF text extraction with Czech accents. Both Sites and static Pages builds pass. Authenticated save/reload and multi-account RLS still need verification after the administrator creates and approves accounts. Browser interaction tests and the optional WebMCP contract were not run; a supported WebMCP validation context was not available.
