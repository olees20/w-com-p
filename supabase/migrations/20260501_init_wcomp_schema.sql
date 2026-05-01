create extension if not exists "uuid-ossp";

create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  business_type text not null,
  address text,
  postcode text,
  employee_count integer,
  produces_food_waste boolean default false,
  produces_hazardous_waste boolean default false,
  sells_packaged_goods boolean default false,
  current_waste_provider text,
  compliance_score integer default 0,
  compliance_status text default 'unknown',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  file_url text,
  storage_path text,
  document_type text default 'unknown',
  extracted_supplier text,
  extracted_date date,
  expiry_date date,
  waste_type text,
  ai_summary text,
  ai_risk_level text default 'unknown',
  ai_extracted_json jsonb,
  created_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'medium',
  status text not null default 'open',
  due_date date,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'inactive',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_businesses_user_id on public.businesses(user_id);
create index if not exists idx_documents_business_id on public.documents(business_id);
create index if not exists idx_alerts_business_id_status on public.alerts(business_id, status);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_ai_messages_business_id_created_at on public.ai_messages(business_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
before update on public.businesses
for each row
execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

alter table public.businesses enable row level security;
alter table public.documents enable row level security;
alter table public.alerts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "Users can manage their businesses" on public.businesses;
create policy "Users can manage their businesses"
on public.businesses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their documents" on public.documents;
create policy "Users can manage their documents"
on public.documents
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their alerts" on public.alerts;
create policy "Users can manage their alerts"
on public.alerts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their subscriptions" on public.subscriptions;
create policy "Users can read their subscriptions"
on public.subscriptions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage their AI messages" on public.ai_messages;
create policy "Users can manage their AI messages"
on public.ai_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
