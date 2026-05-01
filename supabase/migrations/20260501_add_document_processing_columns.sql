alter table public.documents
add column if not exists processing_status text default 'uploaded',
add column if not exists processing_error text,
add column if not exists extracted_ewc_code text,
add column if not exists extracted_licence_number text;

create index if not exists idx_documents_business_id
on public.documents(business_id);

create index if not exists idx_alerts_business_status
on public.alerts(business_id, status);
