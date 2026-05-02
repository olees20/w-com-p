create extension if not exists "uuid-ossp";

create table if not exists public.regulatory_sources (
  id uuid primary key default uuid_generate_v4(),
  title text,
  url text unique not null,
  source_domain text,
  source_type text,
  jurisdiction text default 'england',
  category text,
  last_fetched_at timestamptz,
  last_modified text,
  content_hash text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.regulatory_chunks (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references public.regulatory_sources(id) on delete cascade,
  chunk_index integer,
  heading text,
  content text not null,
  embedding jsonb,
  token_count integer,
  content_hash text,
  created_at timestamptz default now()
);

create table if not exists public.compliance_rules (
  id uuid primary key default uuid_generate_v4(),
  rule_key text unique not null,
  title text not null,
  plain_english_summary text not null,
  requirement_text text,
  applies_to jsonb,
  evidence_required jsonb,
  severity text default 'medium',
  source_id uuid references public.regulatory_sources(id),
  source_url text,
  source_quote text,
  active_from date,
  active_until date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_rule_statuses (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade,
  rule_id uuid references public.compliance_rules(id) on delete cascade,
  status text default 'unknown',
  evidence_document_ids uuid[],
  explanation text,
  last_checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_id, rule_id)
);

create table if not exists public.regulatory_refresh_logs (
  id uuid primary key default uuid_generate_v4(),
  source_url text not null,
  previous_hash text,
  new_hash text,
  changed boolean default false,
  fetched_at timestamptz default now(),
  error text
);

create index if not exists idx_regulatory_sources_url on public.regulatory_sources(url);
create index if not exists idx_regulatory_sources_domain_active on public.regulatory_sources(source_domain, is_active);
create index if not exists idx_regulatory_chunks_source_id on public.regulatory_chunks(source_id);
create index if not exists idx_regulatory_chunks_source_chunk on public.regulatory_chunks(source_id, chunk_index);
create index if not exists idx_compliance_rules_rule_key on public.compliance_rules(rule_key);
create index if not exists idx_business_rule_statuses_business_rule on public.business_rule_statuses(business_id, rule_id);
create index if not exists idx_business_rule_statuses_business_checked on public.business_rule_statuses(business_id, last_checked_at desc);

alter table public.business_rule_statuses enable row level security;

drop policy if exists "Users can read business rule statuses" on public.business_rule_statuses;
create policy "Users can read business rule statuses"
on public.business_rule_statuses
for select
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_rule_statuses.business_id
      and b.user_id = auth.uid()
  )
);
