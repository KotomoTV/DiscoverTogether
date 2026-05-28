-- Discover Together — re-grant RPC execute permissions.
--
-- Safe to paste into the Supabase SQL Editor and run as many times as
-- needed. It only re-applies the GRANTs from supabase/schema.sql; it
-- does not alter table data, RLS, or function bodies.
--
-- Use this if any RPC call from the browser returns a "permission
-- denied for function …" / 42501 error, or if grants were dropped
-- after a CREATE OR REPLACE of one of the functions.

grant usage on schema public to anon, authenticated;

grant execute on function public.prepare_join(text, text)              to anon, authenticated;
grant execute on function public.commit_join(text, text, text)         to anon, authenticated;
grant execute on function public.get_my_state(text)                    to anon, authenticated;
grant execute on function public.submit_answer(text, int, int)         to anon, authenticated;
grant execute on function public.complete_questionnaire(text)          to anon, authenticated;
grant execute on function public.get_results(text)                     to anon, authenticated;
grant execute on function public.delete_couple_data(text)              to anon, authenticated;

-- Internal helpers stay locked down.
revoke all on function public._generate_session_token()  from anon, authenticated;
revoke all on function public._user_for_token(text)      from anon, authenticated;

-- Quick smoke-test: should return { "status": "empty" } with no error.
-- (The hash here is just a 64-char placeholder; it does not match any
-- existing couple.)
select public.prepare_join(
  repeat('0', 64),
  'her'
);
