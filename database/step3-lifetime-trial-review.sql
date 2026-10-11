-- Genius Vault four-scan lifetime trial: REVIEW ONLY.
-- Apply separately to a TEST Supabase project after explicit approval.
-- This migration does not run when committed to GitHub.
-- Usage records already have a globally unique request_id.
create table if not exists public.gv_trial_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.gv_trial_accounts enable row level security;
revoke all on public.gv_trial_accounts from anon, authenticated;
grant select on public.gv_trial_accounts to authenticated;
drop policy if exists gv_trial_accounts_select_own on public.gv_trial_accounts;
create policy gv_trial_accounts_select_own on public.gv_trial_accounts
for select to authenticated using (auth.uid() = user_id);

create or replace function public.gv_reserve_scan(p_user_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  e public.gv_entitlements%rowtype;
  used_count bigint;
  verified boolean;
  lifetime_start constant timestamptz := '2000-01-01 00:00:00+00';
begin
  if auth.role() <> 'service_role' then raise exception 'server only'; end if;
  -- Serialize all reservations for one account, including subscription users.
  insert into public.gv_trial_accounts(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  perform 1 from public.gv_trial_accounts where user_id=p_user_id for update;
  if not found then return false; end if;
  -- Server-trusted confirmation state, never a client-supplied flag.
  select (email_confirmed_at is not null) into verified
  from auth.users where id=p_user_id;
  if not found then return false; end if;
  if exists (select 1 from public.gv_scan_usage
             where user_id=p_user_id and request_id=p_request_id) then return true; end if;
  select * into e from public.gv_entitlements
   where user_id=p_user_id;
  if found and e.status in ('active','trialing')
    and e.period_start is not null and e.period_start <= now()
    and e.period_end > now() then
    select count(*) into used_count from public.gv_scan_usage
      where user_id=p_user_id and period_start=e.period_start;
    if e.unlimited_scans or used_count < e.scan_limit then
      insert into public.gv_scan_usage(user_id,period_start,request_id)
      values(p_user_id,e.period_start,p_request_id);
      return true;
    end if;
  end if;
  select count(*) into used_count from public.gv_scan_usage
     where user_id=p_user_id and period_start=lifetime_start;
  if used_count >= case when verified then 4 else 2 end then return false; end if;
  insert into public.gv_scan_usage(user_id,period_start,request_id)
    values(p_user_id,lifetime_start,p_request_id);
  return true;
end $$;
revoke all on function public.gv_reserve_scan(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gv_reserve_scan(uuid,uuid) to service_role;
-- IMPORTANT: Supabase email-confirmation-required configuration may prevent
-- unverified users from acquiring a session. The 2-before-verification policy
-- needs an auth-flow test before this migration can be considered launch-ready.
-- Identity anti-abuse and paid-overlap billing rules also require review.
