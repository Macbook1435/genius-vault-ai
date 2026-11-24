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
