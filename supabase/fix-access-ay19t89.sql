-- Run this once in Supabase > SQL Editor.
-- It approves the account that is already able to sign in to the website.
insert into public.dictionary_members (user_id)
select id
from auth.users
where lower(email) = lower('ay19t89@gmail.com')
on conflict (user_id) do nothing;

-- The result should be one row with this email.
select u.email, m.user_id
from public.dictionary_members m
join auth.users u on u.id = m.user_id
where lower(u.email) = lower('ay19t89@gmail.com');
