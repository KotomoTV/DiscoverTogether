-- Discover Together: Supabase schema, RLS, and RPC functions.
--
-- Apply this file in the Supabase SQL editor (paste & run).
-- It is idempotent enough to re-run during development: it drops the
-- public RPC functions before recreating them, and uses IF NOT EXISTS
-- on tables. If you change a table definition, drop the table by hand.
--
-- Architecture notes:
--   * No Supabase Auth. Identity = a server-issued opaque session_token
--     stored on the user row and held in the browser's localStorage.
--   * The publishable anon key is shipped in the client. RLS is enabled
--     on every table with NO policies, which denies all direct table
--     access from the anon role. All reads/writes go through the
--     SECURITY DEFINER RPC functions below, which validate the
--     session_token themselves and return only what the caller is
--     allowed to see (never the partner's raw answers).
--   * PIN hashing happens in the browser (SHA-256 + a fixed app salt).
--     The database only ever sees the hash.

-- =========================================================================
-- Extensions
-- =========================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid, gen_random_bytes

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.couples (
  id          uuid        primary key default gen_random_uuid(),
  pin_hash    text        not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.users (
  id             uuid        primary key default gen_random_uuid(),
  couple_id      uuid        not null references public.couples(id) on delete cascade,
  name           text        not null check (char_length(name) between 1 and 80),
  role           text        not null check (role in ('her', 'him')),
  session_token  text        not null unique,
  joined_at      timestamptz not null default now(),
  completed_at   timestamptz,
  unique (couple_id, role)
);

create index if not exists users_couple_id_idx on public.users (couple_id);

create table if not exists public.answers (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users(id) on delete cascade,
  question_id  int         not null check (question_id between 1 and 55),
  response     int         not null check (response between 1 and 4),
  answered_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists answers_user_id_idx on public.answers (user_id);

-- =========================================================================
-- Row Level Security: lock everything down. All access via RPCs.
-- =========================================================================

alter table public.couples enable row level security;
alter table public.users   enable row level security;
alter table public.answers enable row level security;

-- Intentionally NO policies. With RLS on and no policies, the anon role
-- cannot select/insert/update/delete these tables directly. The
-- SECURITY DEFINER functions below run as the table owner and bypass RLS.

-- =========================================================================
-- Helpers
-- =========================================================================

-- Generate a URL-safe opaque session token (256 bits of entropy).
create or replace function public._generate_session_token()
returns text
language plpgsql
as $$
declare
  v_bytes bytea;
begin
  v_bytes := gen_random_bytes(32);
  return replace(replace(replace(encode(v_bytes, 'base64'), '+', '-'), '/', '_'), '=', '');
end;
$$;

-- Resolve a session token to a user row. Raises on invalid token.
create or replace function public._user_for_token(p_session_token text)
returns public.users
language plpgsql
security definer
set search_path = public
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

-- =========================================================================
-- RPC: prepare_join
--
-- Called when a user types in a PIN, before showing the confirmation
-- screen. Tells the client what state the PIN is in.
--
-- Returns one of:
--   { status: 'empty' }                                  -- no couple yet, you'll create one
--   { status: 'partner_pending', partner_name: '...', partner_role: 'her'|'him' }
--   { status: 'role_taken',     other_role: 'her'|'him' } -- requested role is already taken; suggest other
--   { status: 'couple_full' }                            -- both roles in this couple are filled
-- =========================================================================

create or replace function public.prepare_join(
  p_pin_hash text,
  p_role     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_count     int;
  v_partner   public.users;
begin
  if p_pin_hash is null or char_length(p_pin_hash) < 16 then
    raise exception 'invalid_pin_hash' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('her', 'him') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select id into v_couple_id from public.couples where pin_hash = p_pin_hash;
  if not found then
    return jsonb_build_object('status', 'empty');
  end if;

  select count(*) into v_count from public.users where couple_id = v_couple_id;
  if v_count >= 2 then
    return jsonb_build_object('status', 'couple_full');
  end if;

  select * into v_partner from public.users where couple_id = v_couple_id limit 1;

  if v_partner.role = p_role then
    return jsonb_build_object(
      'status',     'role_taken',
      'other_role', case when p_role = 'her' then 'him' else 'her' end
    );
  end if;

  return jsonb_build_object(
    'status',        'partner_pending',
    'partner_name',  v_partner.name,
    'partner_role',  v_partner.role
  );
end;
$$;

-- =========================================================================
-- RPC: commit_join
--
-- Creates the couple (if first) or joins it (if second). Returns the
-- new user's session_token plus enough state to bootstrap the UI.
--
-- Returns:
--   { user_id, session_token, role, is_first, partner_name? }
-- =========================================================================

create or replace function public.commit_join(
  p_pin_hash text,
  p_name     text,
  p_role     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id  uuid;
  v_count      int;
  v_partner    public.users;
  v_user_id    uuid;
  v_token      text;
  v_is_first   boolean;
begin
  if p_pin_hash is null or char_length(p_pin_hash) < 16 then
    raise exception 'invalid_pin_hash' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 1 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('her', 'him') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select id into v_couple_id from public.couples where pin_hash = p_pin_hash;

  if not found then
    insert into public.couples (pin_hash) values (p_pin_hash) returning id into v_couple_id;
    v_is_first := true;
  else
    select count(*) into v_count from public.users where couple_id = v_couple_id;
    if v_count >= 2 then
      raise exception 'couple_full' using errcode = '23505';
    end if;
    select * into v_partner from public.users where couple_id = v_couple_id limit 1;
    if v_partner.role = p_role then
      raise exception 'role_taken' using errcode = '23505';
    end if;
    v_is_first := false;
  end if;

  v_token := public._generate_session_token();

  insert into public.users (couple_id, name, role, session_token)
  values (v_couple_id, btrim(p_name), p_role, v_token)
  returning id into v_user_id;

  return jsonb_build_object(
    'user_id',       v_user_id,
    'session_token', v_token,
    'role',          p_role,
    'is_first',      v_is_first,
    'partner_name',  case when v_is_first then null else v_partner.name end
  );
end;
$$;

-- =========================================================================
-- RPC: get_my_state
--
-- Returns the caller's own state plus partner's progress (name + done?).
-- Never reveals the partner's individual answers.
--
-- Returns:
--   {
--     user: { id, name, role, completed_at },
--     partner: { name, role, joined, completed } | null,
--     my_answers: [{ question_id, response }, ...]    -- only your own
--   }
-- =========================================================================

create or replace function public.get_my_state(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
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
           'question_id', question_id,
           'response',    response
         ) order by question_id), '[]'::jsonb)
    into v_answers
  from public.answers
  where user_id = v_me.id;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id',           v_me.id,
      'name',         v_me.name,
      'role',         v_me.role,
      'completed_at', v_me.completed_at
    ),
    'partner', case
      when v_partner.id is null then null
      else jsonb_build_object(
        'name',      v_partner.name,
        'role',      v_partner.role,
        'joined',    true,
        'completed', v_partner.completed_at is not null
      )
    end,
    'my_answers', v_answers
  );
end;
$$;

-- =========================================================================
-- RPC: submit_answer
--
-- Upserts a single answer. Locked once the user has marked themselves
-- complete.
-- =========================================================================

create or replace function public.submit_answer(
  p_session_token text,
  p_question_id   int,
  p_response      int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me public.users;
begin
  v_me := public._user_for_token(p_session_token);

  if v_me.completed_at is not null then
    raise exception 'answers_locked' using errcode = '55000';
  end if;

  if p_question_id is null or p_question_id < 1 or p_question_id > 55 then
    raise exception 'invalid_question' using errcode = '22023';
  end if;
  if p_response is null or p_response < 1 or p_response > 4 then
    raise exception 'invalid_response' using errcode = '22023';
  end if;

  insert into public.answers (user_id, question_id, response)
  values (v_me.id, p_question_id, p_response)
  on conflict (user_id, question_id)
    do update set response = excluded.response, answered_at = now();
end;
$$;

-- =========================================================================
-- RPC: complete_questionnaire
--
-- Marks the caller as done. Idempotent. Locks further edits.
-- =========================================================================

create or replace function public.complete_questionnaire(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

-- =========================================================================
-- RPC: get_results
--
-- Returns the categorized results, but only once BOTH partners have
-- marked themselves complete. Never returns individual responses, only
-- the bucket each question landed in, plus a "both_anytime" flag for
-- visual emphasis on the To-Do list.
--
-- Hidden items (where either answered 1) are entirely omitted.
--
-- Returns:
--   {
--     ready: true|false,
--     partner_name?: text,             -- present when !ready
--     to_do: [    { question_id, both_anytime } ],
--     to_discuss: [{ question_id } ]
--   }
-- =========================================================================

create or replace function public.get_results(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      public.users;
  v_partner public.users;
  v_to_do      jsonb;
  v_to_discuss jsonb;
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
      'ready',        false,
      'partner_name', v_partner.name
    );
  end if;

  with paired as (
    select a.question_id,
           a.response as r_me,
           b.response as r_partner
    from public.answers a
    join public.answers b
      on b.user_id = v_partner.id
     and b.question_id = a.question_id
    where a.user_id = v_me.id
  ),
  todo as (
    select question_id,
           (r_me = 4 and r_partner = 4) as both_anytime,
           -- sort key: 0 = (4,4), 1 = mixed 3/4, 2 = (3,3)
           case
             when r_me = 4 and r_partner = 4 then 0
             when r_me = 3 and r_partner = 3 then 2
             else 1
           end as sort_key
    from paired
    where r_me   in (3, 4)
      and r_partner in (3, 4)
  ),
  discuss as (
    select question_id,
           -- sort key: 0 = has a 4, 1 = has a 3, 2 = (2,2)
           case
             when r_me = 4 or r_partner = 4 then 0
             when r_me = 3 or r_partner = 3 then 1
             else 2
           end as sort_key
    from paired
    where (r_me = 2 or r_partner = 2)
      and r_me <> 1
      and r_partner <> 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
              'question_id',  question_id,
              'both_anytime', both_anytime
            ) order by sort_key, question_id), '[]'::jsonb)
       from todo),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'question_id', question_id
            ) order by sort_key, question_id), '[]'::jsonb)
       from discuss)
  into v_to_do, v_to_discuss;

  return jsonb_build_object(
    'ready',      true,
    'to_do',      v_to_do,
    'to_discuss', v_to_discuss
  );
end;
$$;

-- =========================================================================
-- RPC: delete_couple_data
--
-- Wipes the entire couple, both users, and all answers. Cascades.
-- =========================================================================

create or replace function public.delete_couple_data(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me public.users;
begin
  v_me := public._user_for_token(p_session_token);
  delete from public.couples where id = v_me.couple_id;
end;
$$;

-- =========================================================================
-- Permissions: expose only the RPCs to anon and authenticated roles.
-- Tables remain unreachable (RLS on, no policies).
-- =========================================================================

revoke all on public.couples from anon, authenticated;
revoke all on public.users   from anon, authenticated;
revoke all on public.answers from anon, authenticated;

-- Anon and authenticated need USAGE on the schema to resolve the RPC
-- functions by name. Supabase grants this by default but we re-state
-- it so the schema is self-contained.
grant usage on schema public to anon, authenticated;

grant execute on function public.prepare_join(text, text)              to anon, authenticated;
grant execute on function public.commit_join(text, text, text)         to anon, authenticated;
grant execute on function public.get_my_state(text)                    to anon, authenticated;
grant execute on function public.submit_answer(text, int, int)         to anon, authenticated;
grant execute on function public.complete_questionnaire(text)          to anon, authenticated;
grant execute on function public.get_results(text)                     to anon, authenticated;
grant execute on function public.delete_couple_data(text)              to anon, authenticated;

-- The helper functions stay internal.
revoke all on function public._generate_session_token()       from anon, authenticated;
revoke all on function public._user_for_token(text)           from anon, authenticated;
