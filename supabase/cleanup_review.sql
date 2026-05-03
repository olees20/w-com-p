-- Waste Compliance Platform - Database Cleanup Review (SAFE INSPECTION ONLY)
-- This file is non-destructive. Run sections individually in Supabase SQL editor.

-- 1) Core row counts for product-critical tables
select 'businesses' as table_name, count(*) as row_count from public.businesses
union all select 'documents', count(*) from public.documents
union all select 'alerts', count(*) from public.alerts
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'ai_messages', count(*) from public.ai_messages
union all select 'regulatory_sources', count(*) from public.regulatory_sources
union all select 'regulatory_chunks', count(*) from public.regulatory_chunks
union all select 'compliance_rules', count(*) from public.compliance_rules
union all select 'business_rule_statuses', count(*) from public.business_rule_statuses
union all select 'regulatory_refresh_logs', count(*) from public.regulatory_refresh_logs
order by table_name;

-- 2) Documents pipeline status distribution
select processing_status, count(*)
from public.documents
group by processing_status
order by count(*) desc;

-- 3) Alerts health distribution
select source, rule_key, status, severity, count(*)
from public.alerts
group by source, rule_key, status, severity
order by count(*) desc;

-- 4) Subscription status distribution
select status, count(*)
from public.subscriptions
group by status
order by count(*) desc;

-- 5) Regulatory refresh quality
select source_url, changed, count(*) as runs,
       max(fetched_at) as last_fetched,
       sum(case when error is null then 0 else 1 end) as error_runs
from public.regulatory_refresh_logs
group by source_url, changed
order by source_url, changed;

-- 6) Tables/columns present in public schema
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 7) Foreign key dependency graph
select
  con.conname as constraint_name,
  n1.nspname as source_schema,
  c1.relname as source_table,
  a1.attname as source_column,
  n2.nspname as target_schema,
  c2.relname as target_table,
  a2.attname as target_column,
  con.confdeltype as on_delete_type
from pg_constraint con
join pg_class c1 on c1.oid = con.conrelid
join pg_namespace n1 on n1.oid = c1.relnamespace
join pg_class c2 on c2.oid = con.confrelid
join pg_namespace n2 on n2.oid = c2.relnamespace
join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
join unnest(con.confkey) with ordinality as fk(attnum, ord) on fk.ord = ck.ord
join pg_attribute a1 on a1.attrelid = c1.oid and a1.attnum = ck.attnum
join pg_attribute a2 on a2.attrelid = c2.oid and a2.attnum = fk.attnum
where con.contype = 'f'
  and n1.nspname = 'public'
order by source_table, constraint_name;

-- 8) RLS enabled tables
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
order by c.relname;

-- 9) Policy definitions
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 10) Trigger/function dependencies in public schema
select
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid, true) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
order by c.relname, t.tgname;

-- 11) Public functions (for manual cleanup audit)
select n.nspname as schema_name, p.proname as function_name, pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 12) Index inventory
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 13) Nullable / potentially legacy business fields occupancy
select
  count(*) as total_businesses,
  sum(case when address is null or btrim(address) = '' then 1 else 0 end) as missing_address,
  sum(case when postcode is null or btrim(postcode) = '' then 1 else 0 end) as missing_postcode,
  sum(case when employee_count is null then 1 else 0 end) as missing_employee_count,
  sum(case when current_waste_provider is null or btrim(current_waste_provider) = '' then 1 else 0 end) as missing_current_waste_provider,
  sum(case when sells_packaged_goods is false then 1 else 0 end) as sells_packaged_goods_false_count,
  sum(case when sites_count is null then 1 else 0 end) as missing_sites_count
from public.businesses;

-- 14) AI messages usage audit
select role, count(*)
from public.ai_messages
group by role
order by count(*) desc;

-- 15) Candidate tables with no rows (manual verification before considering cleanup)
select table_name
from (
  select 'ai_messages' as table_name, count(*)::bigint as row_count from public.ai_messages
  union all select 'subscriptions', count(*)::bigint from public.subscriptions
  union all select 'regulatory_refresh_logs', count(*)::bigint from public.regulatory_refresh_logs
  union all select 'business_rule_statuses', count(*)::bigint from public.business_rule_statuses
) t
where row_count = 0
order by table_name;
