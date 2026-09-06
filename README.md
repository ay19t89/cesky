# České pády

Czech noun declension checker using the Internetová jazyková příručka (ÚJČ),
a private Supabase dictionary, and Unicode CSV, XLSX and PDF exports.

## Supabase setup

The supplied project URL and public publishable key are configured in
`lib/config.ts`. The application does not need a service-role key.

1. Open your project's Supabase SQL editor.
2. Run `supabase/migrations/202609060001_dictionary.sql` once. This is the
   complete setup for a new database.
3. Create the permitted email/password accounts in Authentication → Users.
4. Sign in on the website and check a word. A successful result is saved
   automatically. Click **Uloženo** to remove it from the dictionary.

Every account in Supabase Authentication may use the application. Row-level
security still limits every account to its own saved words. The website does
not provide a public sign-up screen.

## GitHub Pages

The frontend has a separate static build. Since GitHub Pages cannot run the
dictionary proxy, the static frontend calls the included Supabase Edge
Function.

1. Install Node.js 22.13+ and run `npm ci`.
2. Complete the Supabase setup above.
3. Install and sign in to the Supabase CLI, then run:

   ```sh
   npm run prepare:edge
   supabase functions deploy dictionary --project-ref vmcegdasdeucdrxngjfv
   ```

   The Edge Function verifies the bearer token through Supabase Auth on every
   request.

4. Put this source in a GitHub repository. In Settings → Pages, select
   **GitHub Actions**. The included workflow publishes pushes to `main`.

No service keys, access tokens or passwords belong in GitHub. The public
configuration is intentionally visible; authentication and database RLS are
the security boundary.

The private Sites deployment uses `/api/dictionary` directly and does not need
the Edge Function.

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

- The application checks nouns in the Internetová jazyková příručka only.
- M means masculine animate, I masculine inanimate, F feminine (Ž), and N
  neuter (S). Unknown genders remain unspecified.
- Suggestions use common nouns and the user's saved words. They ignore accents
  and tolerate small spelling errors. After login, a delayed IJP request can
  also return the spelling resolved by the reference book.
- All seven singular and plural positions are retained. Missing forms appear as
  a dash. IJP footnote numbers are removed; the result links to the original
  entry for additional usage notes.
- A successful lookup is saved automatically for the authenticated user.
  Clicking **Uloženo** removes it; clicking **Uložit slovo** adds it again.
- Gender filters in **Můj slovník** also filter exports. CSV is UTF-8 with BOM,
  XLSX stores strings, and PDF embeds the OFL-licensed Noto Sans font.
- Dictionary requests use a fixed HTTPS destination, validated single-word
  input and timeouts. Upstream HTML is parsed as text and never rendered as
  HTML.
- The optional WebMCP tool performs the same authenticated lookup and automatic
  save action as the visible interface.

## Source and license

- Internetová jazyková příručka: https://prirucka.ujc.cas.cz/
- Noto Sans: `public/fonts/OFL.txt`.

This application is not an official ÚJČ product. It depends on the availability
and HTML structure of the reference-book website.

## Verification status

Automated checks cover all four genders, accent correction, parser edge cases,
rejected unauthenticated requests, single-source CSV contents, XLSX round-trip,
and PDF text extraction with Czech accents. Both Sites and static Pages builds
are checked before publication. An authenticated save/remove flow still needs a
manual check after the new Supabase table is created.
