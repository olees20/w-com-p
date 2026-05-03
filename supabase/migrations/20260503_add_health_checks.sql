create table if not exists public.health_checks (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  paid_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  locked_at timestamptz,
  expires_at timestamptz,
  final_score integer,
  final_status text,
  final_confidence text,
  final_report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
add column if not exists health_check_id uuid references public.health_checks(id) on delete set null;

create index if not exists idx_health_checks_business_status on public.health_checks(business_id, status);
create index if not exists idx_health_checks_user_created_at on public.health_checks(user_id, created_at desc);
create index if not exists idx_health_checks_checkout_session on public.health_checks(stripe_checkout_session_id);
create index if not exists idx_documents_health_check_id on public.documents(health_check_id);

alter table public.health_checks enable row level security;

drop policy if exists "Users can manage their health checks" on public.health_checks;
create policy "Users can manage their health checks"
on public.health_checks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop trigger if exists set_health_checks_updated_at on public.health_checks;
create trigger set_health_checks_updated_at
before update on public.health_checks
for each row
execute function public.set_updated_at();
