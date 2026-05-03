alter table public.businesses
add column if not exists sites_count integer;

create index if not exists idx_businesses_user_id_sites_count
on public.businesses(user_id, sites_count);
