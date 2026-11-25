-- Applied to Supabase as migration "gv_scan_log". One row per scan plus the user's correction.
create table if not exists public.gv_scan_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  ms integer,
  phases jsonb,
  card jsonb,
  verification text,
  confidence text,
  catalog_card_id text,
  catalog_match jsonb,
  parallel_id text,
  parallel_name text,
  comps jsonb,
  correction jsonb,
  corrected_at timestamptz
);
create index if not exists gv_scan_log_created_at_idx on public.gv_scan_log (created_at desc);
alter table public.gv_scan_log enable row level security;

-- Applied as migration "gv_api_usage": daily call totals per API (CardSight free plan = 750 calls/month).
create table if not exists public.gv_api_usage (
  day date not null default (now() at time zone 'utc')::date,
  api text not null,
  calls integer not null default 0,
  primary key (day, api)
);
alter table public.gv_api_usage enable row level security;
create or replace function public.gv_count_api_calls(p_api text, p_calls integer)
returns void language sql security definer set search_path = public as $$
  insert into public.gv_api_usage (day, api, calls)
  values ((now() at time zone 'utc')::date, p_api, greatest(p_calls, 0))
  on conflict (day, api) do update set calls = public.gv_api_usage.calls + excluded.calls;
$$;
revoke all on function public.gv_count_api_calls(text, integer) from public, anon, authenticated;
grant execute on function public.gv_count_api_calls(text, integer) to service_role;
