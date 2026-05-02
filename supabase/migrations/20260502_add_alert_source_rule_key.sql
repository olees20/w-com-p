alter table public.alerts
add column if not exists source text default 'system',
add column if not exists rule_key text;

create index if not exists idx_alerts_business_rulekey_doc_status
on public.alerts(business_id, rule_key, document_id, status);
