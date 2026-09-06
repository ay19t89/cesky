-- Fresh setup: run once in the Supabase SQL editor.
-- Every Supabase Authentication user gets a separate private dictionary.
-- No service key belongs in the website.
begin;

create table public.czech_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 80),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and octet_length(result::text) < 200000
  ),
  updated_at timestamptz not null default now(),
  unique (user_id, word)
);

alter table public.czech_words enable row level security;

revoke all on public.czech_words from anon, authenticated;
grant select, insert, update, delete on public.czech_words to authenticated;

create policy "Private dictionary for authenticated users"
  on public.czech_words
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index czech_words_recent
  on public.czech_words (user_id, updated_at desc);

commit;
