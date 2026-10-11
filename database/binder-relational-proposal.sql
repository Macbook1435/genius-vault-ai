-- Genius Vault relational binder (proposal; not applied to production)
-- Supabase PostgreSQL. Uses references, NOT bulk copies of third-party catalogs.
-- Apply only after manual security/migration review.
create table if not exists public.gv_catalog_sources (
 id text primary key,
 display_name text not null,
 homepage_url text,
 rights_status text not null default 'unverified'
  check (rights_status in ('unverified','permitted','restricted')),
 checked_at timestamptz
);
create table if not exists public.gv_card_references (
 id uuid primary key default gen_random_uuid(),
 source_id text not null references public.gv_catalog_sources(id),
 external_card_id text not null,
 release_year integer not null check (release_year between 1880 and 2100),
 sport text not null,
 manufacturer text not null,
 product text not null,
 subset text,
 player_name text not null,
 card_number text not null,
 -- Minimal identity metadata only; not entire checklist or copyrighted images.
 created_at timestamptz not null default now(),
 unique (source_id,external_card_id)
);
create index if not exists gv_card_ref_identity
 on public.gv_card_references(release_year,sport,manufacturer,product,card_number);
create table if not exists public.gv_reference_variants (
 id uuid primary key default gen_random_uuid(),
 card_reference_id uuid not null references public.gv_card_references(id) on delete cascade,
 external_parallel_id text,
 name text not null,
 print_run integer check (print_run > 0),
 source_url text,
 verification_status text not null default 'unconfirmed'
  check (verification_status in ('unconfirmed','cross_checked')),
 unique (card_reference_id,name,print_run)
);
create index if not exists gv_reference_variants_card on public.gv_reference_variants(card_reference_id);
-- Physical cards belong to a user, independent of external provider uptime.
create table if not exists public.gv_binder_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 card_reference_id uuid references public.gv_card_references(id) on delete set null,
 variant_id uuid references public.gv_reference_variants(id) on delete set null,
 year integer check (year between 1880 and 2100),
 manufacturer text,
 product text,
 subset text,
 player_name text,
 card_number text,
 parallel_name text,
 serial_sequence integer,
 serial_limit integer,
 autograph boolean,
 memorabilia boolean,
 grading_company text,
 grade text,
 verification_status text not null default 'unconfirmed'
  check (verification_status in ('unconfirmed','suggested','confirmed')),
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((serial_sequence is null and serial_limit is null) or
        (serial_sequence >= 1 and serial_limit >= serial_sequence)),
 check (variant_id is null or card_reference_id is not null)
);
create index if not exists gv_binder_owner_date
 on public.gv_binder_cards(user_id,created_at desc);
create index if not exists gv_binder_owner_player
 on public.gv_binder_cards(user_id,player_name);
-- User-controlled copies of sale evidence; never assume asking price = sale price.
create table if not exists public.gv_binder_sale_comps (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 binder_card_id uuid not null references public.gv_binder_cards(id) on delete cascade,
 external_sale_id text,
 source_url text,
 final_sale_price_usd numeric(12,2) check (final_sale_price_usd > 0),
 sold_at timestamptz,
 verified_final_price boolean not null default false,
 raw_card boolean,
 matched_exact_parallel boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists gv_sale_comps_card_date
 on public.gv_binder_sale_comps(binder_card_id,sold_at desc);
-- No anonymous client writes to shared reference tables.
alter table public.gv_catalog_sources enable row level security;
alter table public.gv_card_references enable row level security;
alter table public.gv_reference_variants enable row level security;
-- All shared reference mutations and lookups are server-service-only until
-- access rights and licensing are independently approved.
alter table public.gv_binder_cards enable row level security;
alter table public.gv_binder_sale_comps enable row level security;
create policy gv_binder_cards_select_self on public.gv_binder_cards
 for select to authenticated using (user_id = auth.uid());
create policy gv_binder_cards_insert_self on public.gv_binder_cards
 for insert to authenticated with check (user_id = auth.uid());
create policy gv_binder_cards_update_self on public.gv_binder_cards
 for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gv_binder_cards_delete_self on public.gv_binder_cards
 for delete to authenticated using (user_id = auth.uid());
-- Prevent a user from attaching a sale record to another user's card.
create policy gv_binder_comps_select_self on public.gv_binder_sale_comps
 for select to authenticated using (user_id=auth.uid()
 and exists (select 1 from public.gv_binder_cards b where b.id=binder_card_id and b.user_id=auth.uid()));
create policy gv_binder_comps_insert_self on public.gv_binder_sale_comps
 for insert to authenticated with check (user_id=auth.uid()
 and exists (select 1 from public.gv_binder_cards b where b.id=binder_card_id and b.user_id=auth.uid()));
create policy gv_binder_comps_update_self on public.gv_binder_sale_comps
 for update to authenticated using (user_id=auth.uid()
 and exists (select 1 from public.gv_binder_cards b where b.id=binder_card_id and b.user_id=auth.uid()))
 with check (user_id=auth.uid()
 and exists (select 1 from public.gv_binder_cards b where b.id=binder_card_id and b.user_id=auth.uid()));
create policy gv_binder_comps_delete_self on public.gv_binder_sale_comps
 for delete to authenticated using (user_id=auth.uid()
 and exists (select 1 from public.gv_binder_cards b where b.id=binder_card_id and b.user_id=auth.uid()));
