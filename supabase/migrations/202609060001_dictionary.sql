-- Run once in the Supabase SQL editor. No service key belongs in the website.
begin;
create table public.dictionary_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.dictionary_members enable row level security;
revoke all on public.dictionary_members from anon, authenticated;
grant select on public.dictionary_members to authenticated;
create policy "Members can check their own access" on public.dictionary_members
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.czech_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 80),
  result jsonb not null check (jsonb_typeof(result) = 'object' and octet_length(result::text) < 200000),
  updated_at timestamptz not null default now(),
  unique (user_id, word)
);
alter table public.czech_words enable row level security;
revoke all on public.czech_words from anon, authenticated;
grant select, insert, update, delete on public.czech_words to authenticated;
create policy "Private dictionary for approved members" on public.czech_words
  for all to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.dictionary_members where user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.dictionary_members where user_id = (select auth.uid())
  ));
create index czech_words_recent on public.czech_words(user_id, updated_at desc);
commit;

-- After creating your email/password user in Authentication > Users,
-- replace the email below and execute this separately:
-- insert into public.dictionary_members(user_id)
-- select id from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict do nothing;
