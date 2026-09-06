-- Upgrade for a database that used the earlier dictionary_members allowlist.
-- Run once in Supabase > SQL Editor. Existing words are preserved.
begin;
drop policy if exists "Private dictionary for approved members" on public.czech_words;
drop policy if exists "Private dictionary for authenticated users" on public.czech_words;
create policy "Private dictionary for authenticated users" on public.czech_words
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
