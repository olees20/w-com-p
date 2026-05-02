alter table public.alerts
add column if not exists rule_id text;

create index if not exists idx_alerts_business_rule_status
on public.alerts(business_id, rule_id, status);
