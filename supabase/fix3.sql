-- =========================================================================
-- Crave — fix3.sql
--
-- Live-database migration from the v1 (pre-Crave) schema to the
-- current Crave schema. Run this once in the Supabase SQL Editor and
-- the live database will match supabase/schema.sql.
--
-- What changes:
--   * couples.pin_hash         → couples.code_hash
--   * users.role ('her'|'him') → users.gender ('woman'|'man')
--   * users (couple_id, role) UNIQUE is dropped
--   * answers.question_id INT  → answers.match_key TEXT
--   * RPCs prepare_join + commit_join are dropped and replaced with
--     create_session + join_session (no partner-confirmation step).
--
-- Data: all existing rows in couples, users, and answers are deleted
-- before the column changes. The previous deployment was a test bed;
-- there is no production data to preserve, and the question_id integers
-- would not map cleanly to the new string match_keys anyway.
--
-- Safe to run on a fresh Crave schema (the DROPs are IF EXISTS, the
-- column ops are idempotent: nothing happens if columns already match).
-- =========================================================================

begin;

-- Step 1: wipe test data (cascades to users + answers).
delete from public.couples;

-- Step 2: rename couples.pin_hash → code_hash (idempotent).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couples' and column_name='pin_hash'
  ) then
    alter table public.couples rename column pin_hash to code_hash;
  end if;
end$$;

-- Step 3: drop the role-uniqueness constraint (was: couple_id + role).
alter table public.users drop constraint if exists users_couple_id_role_key;

-- Step 4: rename users.role → gender and swap the CHECK constraint.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='role'
  ) then
    alter table public.users rename column role to gender;
  end if;
end$$;

alter table public.users drop constraint if exists users_role_check;
alter table public.users drop constraint if exists users_gender_check;
alter table public.users add  constraint users_gender_check check (gender in ('woman', 'man'));

-- Step 5: replace answers.question_id (INT 1..55) with match_key (TEXT).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='answers' and column_name='question_id'
  ) then
    alter table public.answers drop constraint if exists answers_user_id_question_id_key;
    alter table public.answers drop constraint if exists answers_question_id_check;
    alter table public.answers drop column question_id;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='answers' and column_name='match_key'
  ) then
    alter table public.answers add column match_key text not null;
  end if;
end$$;

alter table public.answers drop constraint if exists answers_match_key_check;
alter table public.answers add  constraint answers_match_key_check
  check (char_length(match_key) between 1 and 80);

alter table public.answers drop constraint if exists answers_user_id_match_key_key;
alter table public.answers add  constraint answers_user_id_match_key_key unique (user_id, match_key);

-- Step 6: drop old RPCs so the role/question_id signatures don't linger.
drop function if exists public.prepare_join(text, text);
drop function if exists public.commit_join(text, text, text);
drop function if exists public.submit_answer(text, int, int);

-- Step 7: install the new RPCs. These mirror the bodies in schema.sql.

create or replace function public._generate_session_token()
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_bytes bytea;
begin
  v_bytes := extensions.gen_random_bytes(32);
  return replace(replace(replace(encode(v_bytes, 'base64'), '+', '-'), '/', '_'), '=', '');
end;
$$;

create or replace function public._user_for_token(p_session_token text)
returns public.users
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.users;
begin
  if p_session_token is null or char_length(p_session_token) < 16 then
    raise exception 'invalid_session' using errcode = '28000';
  end if;
  select * into v_user from public.users where session_token = p_session_token;
  if not found then
    raise exception 'invalid_session' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

create or replace function public.create_session(
  p_code_hash text,
  p_name      text,
  p_gender    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id uuid;
  v_user_id   uuid;
  v_token     text;
  v_exists    boolean;
begin
  if p_code_hash is null or char_length(p_code_hash) < 16 then
    raise exception 'invalid_code_hash' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 1 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('woman', 'man') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;

  select exists(select 1 from public.couples where code_hash = p_code_hash) into v_exists;
  if v_exists then
    raise exception 'code_in_use' using errcode = '23505';
  end if;

  insert into public.couples (code_hash) values (p_code_hash) returning id into v_couple_id;

  v_token := public._generate_session_token();
  insert into public.users (couple_id, name, gender, session_token)
  values (v_couple_id, btrim(p_name), p_gender, v_token)
  returning id into v_user_id;

  return jsonb_build_object(
    'user_id',       v_user_id,
    'session_token', v_token,
    'gender',        p_gender
  );
end;
$$;

create or replace function public.join_session(
  p_code_hash text,
  p_name      text,
  p_gender    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple_id  uuid;
  v_count      int;
  v_partner    public.users;
  v_user_id    uuid;
  v_token      text;
begin
  if p_code_hash is null or char_length(p_code_hash) < 16 then
    raise exception 'invalid_code_hash' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 1 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('woman', 'man') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;

  select id into v_couple_id from public.couples where code_hash = p_code_hash;
  if not found then
    raise exception 'code_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.users where couple_id = v_couple_id;
  if v_count >= 2 then
    raise exception 'couple_full' using errcode = '23505';
  end if;

  select * into v_partner from public.users where couple_id = v_couple_id limit 1;

  v_token := public._generate_session_token();
  insert into public.users (couple_id, name, gender, session_token)
  values (v_couple_id, btrim(p_name), p_gender, v_token)
  returning id into v_user_id;

  return jsonb_build_object(
    'user_id',       v_user_id,
    'session_token', v_token,
    'gender',        p_gender,
    'partner_name',  v_partner.name
  );
end;
$$;

create or replace function public.get_my_state(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me      public.users;
  v_partner public.users;
  v_answers jsonb;
begin
  v_me := public._user_for_token(p_session_token);

  select * into v_partner
  from public.users
  where couple_id = v_me.couple_id and id <> v_me.id
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'match_key', match_key,
           'response',  response
         ) order by match_key), '[]'::jsonb)
    into v_answers
  from public.answers
  where user_id = v_me.id;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id',           v_me.id,
      'name',         v_me.name,
      'gender',       v_me.gender,
      'completed_at', v_me.completed_at
    ),
    'partner', case
      when v_partner.id is null then null
      else jsonb_build_object(
        'name',      v_partner.name,
        'gender',    v_partner.gender,
        'completed', v_partner.completed_at is not null
      )
    end,
    'my_answers', v_answers
  );
end;
$$;

create or replace function public.submit_answer(
  p_session_token text,
  p_match_key     text,
  p_response      int
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me public.users;
begin
  v_me := public._user_for_token(p_session_token);

  if v_me.completed_at is not null then
    raise exception 'answers_locked' using errcode = '55000';
  end if;

  if p_match_key is null or char_length(p_match_key) < 1 then
    raise exception 'invalid_match_key' using errcode = '22023';
  end if;
  if p_response is null or p_response < 1 or p_response > 4 then
    raise exception 'invalid_response' using errcode = '22023';
  end if;

  insert into public.answers (user_id, match_key, response)
  values (v_me.id, p_match_key, p_response)
  on conflict (user_id, match_key)
    do update set response = excluded.response, answered_at = now();
end;
$$;

create or replace function public.complete_questionnaire(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me public.users;
begin
  v_me := public._user_for_token(p_session_token);

  if v_me.completed_at is null then
    update public.users
      set completed_at = now()
      where id = v_me.id
      returning * into v_me;
  end if;

  return jsonb_build_object('completed_at', v_me.completed_at);
end;
$$;

create or replace function public.get_results(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me      public.users;
  v_partner public.users;
  v_anytime jsonb;
  v_keen    jsonb;
  v_talk    jsonb;
begin
  v_me := public._user_for_token(p_session_token);

  select * into v_partner
  from public.users
  where couple_id = v_me.couple_id and id <> v_me.id
  limit 1;

  if v_partner.id is null
     or v_me.completed_at is null
     or v_partner.completed_at is null then
    return jsonb_build_object(
      'ready',           false,
      'partner_present', v_partner.id is not null,
      'partner_name',    case when v_partner.id is null then null else v_partner.name end
    );
  end if;

  with paired as (
    select a.match_key,
           a.response as r_me,
           b.response as r_partner
    from public.answers a
    join public.answers b
      on b.user_id = v_partner.id
     and b.match_key = a.match_key
    where a.user_id = v_me.id
  )
  select
    (select coalesce(jsonb_agg(match_key order by match_key), '[]'::jsonb)
       from paired
       where r_me = 4 and r_partner = 4),
    (select coalesce(jsonb_agg(match_key order by match_key), '[]'::jsonb)
       from paired
       where r_me in (3, 4) and r_partner in (3, 4)
         and not (r_me = 4 and r_partner = 4)),
    (select coalesce(jsonb_agg(match_key order by match_key), '[]'::jsonb)
       from paired
       where ((r_me = 2 and r_partner in (3, 4))
           or (r_partner = 2 and r_me in (3, 4))))
  into v_anytime, v_keen, v_talk;

  return jsonb_build_object(
    'ready',           true,
    'partner_present', true,
    'both_anytime',    v_anytime,
    'both_keen',       v_keen,
    'worth_talking',   v_talk
  );
end;
$$;

create or replace function public.delete_couple_data(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me public.users;
begin
  v_me := public._user_for_token(p_session_token);
  delete from public.couples where id = v_me.couple_id;
end;
$$;

-- Step 8: re-grant.
revoke all on public.couples from anon, authenticated;
revoke all on public.users   from anon, authenticated;
revoke all on public.answers from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant execute on function public.create_session(text, text, text)        to anon, authenticated;
grant execute on function public.join_session(text, text, text)          to anon, authenticated;
grant execute on function public.get_my_state(text)                      to anon, authenticated;
grant execute on function public.submit_answer(text, text, int)          to anon, authenticated;
grant execute on function public.complete_questionnaire(text)            to anon, authenticated;
grant execute on function public.get_results(text)                       to anon, authenticated;
grant execute on function public.delete_couple_data(text)                to anon, authenticated;

revoke all on function public._generate_session_token()       from anon, authenticated;
revoke all on function public._user_for_token(text)           from anon, authenticated;

commit;

-- =========================================================================
-- Smoke test (outside the transaction so a failure here doesn't roll
-- back the migration).
--
-- Generates a random code-hash, calls create_session, and immediately
-- deletes the couple it created. Returns a single jsonb row with the
-- new user_id + session_token + gender — proves end-to-end that the
-- RPC, the search_path, and gen_random_bytes all work.
-- =========================================================================

do $$
declare
  v_hash text := encode(extensions.gen_random_bytes(32), 'hex');
  v_resp jsonb;
begin
  v_resp := public.create_session(v_hash, 'smoke', 'woman');
  raise notice 'create_session OK: %', v_resp;
  delete from public.couples where code_hash = v_hash;
end$$;
