-- =========================================================================
-- Discover Together — fix2.sql
--
-- Live-database patch for the pgcrypto schema-resolution bug.
--
-- Root cause: Supabase installs pgcrypto in the `extensions` schema, not
-- public. Our SECURITY DEFINER functions were declared with
-- `set search_path = public`, so `gen_random_bytes(32)` inside
-- _generate_session_token() failed with:
--   ERROR: function gen_random_bytes(integer) does not exist  (42883)
--
-- The fix:
--   1. Use `extensions.gen_random_bytes(...)` explicitly.
--   2. Broaden each affected function's `search_path` to include
--      `extensions` so any unqualified pgcrypto call still resolves.
--
-- Safe to run multiple times. Each statement is CREATE OR REPLACE.
-- =========================================================================

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

create or replace function public.prepare_join(
  p_pin_hash text,
  p_role     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function public.commit_join(
  p_pin_hash text,
  p_name     text,
  p_role     text
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
-- Smoke test
--
-- After running the three CREATE OR REPLACE FUNCTION statements above,
-- this select MUST return a single jsonb row equal to {"status": "empty"}.
-- If it instead errors with 42883 / "function gen_random_bytes(integer)
-- does not exist", the patch did not take effect.
-- =========================================================================

select public.prepare_join(repeat('0', 64), 'her');
