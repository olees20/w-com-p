create index if not exists idx_documents_user_business_created
on public.documents(user_id, business_id, created_at desc);

create index if not exists idx_documents_processing_status
on public.documents(processing_status);

create index if not exists idx_alerts_user_business_status
on public.alerts(user_id, business_id, status);

create index if not exists idx_businesses_user_id
on public.businesses(user_id);
