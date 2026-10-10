-- Genius Vault subscription foundation (Supabase Postgres)
-- Run only after a Supabase project is configured. No plans or payments are live.
create table if not exists public.gv_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);
create table if not exists public.gv_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','canceled')),
  period_start timestamptz,
  period_end timestamptz,
  scan_limit integer not null default 0 check (scan_limit >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.gv_scan_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  request_id uuid not null unique,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);
create index if not exists gv_scan_usage_period on public.gv_scan_usage(user_id,period_start);
alter table public.gv_accounts enable row level security;
alter table public.gv_entitlements enable row level security;
alter table public.gv_scan_usage enable row level security;
-- Customers can view their own plan and usage; all writes must use trusted server code.
create policy "gv_accounts_read_self" on public.gv_accounts for select to authenticated using (auth.uid() = user_id);
create policy "gv_entitlements_read_self" on public.gv_entitlements for select to authenticated using (auth.uid() = user_id);
create policy "gv_usage_read_self" on public.gv_scan_usage for select to authenticated using (auth.uid() = user_id);
-- Atomic reservation function for server-side use ONLY (service_role).
create or replace function public.gv_reserve_scan(p_user_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare e public.gv_entitlements%rowtype; n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'server only'; end if;
  select * into e from public.gv_entitlements where user_id = p_user_id for update;
  if not found or e.status not in ('active','trialing') or e.period_start is null
     or e.period_end <= now() or e.period_start > now() then return false; end if;
  if exists(select 1 from public.gv_scan_usage where request_id = p_request_id and user_id = p_user_id) then return true; end if;
  select count(*) into n from public.gv_scan_usage where user_id = p_user_id and period_start = e.period_start;
  if n >= e.scan_limit then return false; end if;
  insert into public.gv_scan_usage(user_id,period_start,request_id)
    values(p_user_id,e.period_start,p_request_id);
  return true;
end $$;
revoke all on function public.gv_reserve_scan(uuid,uuid) from public, anon, authenticated;
grant execute on function public.gv_reserve_scan(uuid,uuid) to service_role;

-- Count usage in the database, not a paginated REST list (which would
-- silently stop at the default API row limit for higher-volume plans).
create or replace function public.gv_usage_count(p_user_id uuid, p_period_start timestamptz)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'server only'; end if;
  if p_period_start is null then return 0; end if;
  return (select count(*) from public.gv_scan_usage
          where user_id = p_user_id and period_start = p_period_start);
end $$;
revoke all on function public.gv_usage_count(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.gv_usage_count(uuid,timestamptz) to service_role;
