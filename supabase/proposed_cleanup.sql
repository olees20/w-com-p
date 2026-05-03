-- Waste Compliance Platform - Proposed Cleanup (COMMENTED OUT / NON-DESTRUCTIVE)
-- IMPORTANT: Every statement is intentionally commented.
-- Review `supabase/cleanup_review.sql` output before uncommenting anything.

-- -------------------------------------------------------------------
-- SAFE-TO-DELETE STATUS
-- -------------------------------------------------------------------
-- Current review result: no table/column is proven safe to delete yet.
-- Reason: each main table is referenced by app routes, server logic, RLS, or FK graph.

-- -------------------------------------------------------------------
-- HIDE-BUT-KEEP CANDIDATES (do not delete now)
-- -------------------------------------------------------------------
-- Assistant data model is still referenced by active code paths.
-- If assistant is permanently removed in future, re-run dependency review first.

-- -- drop policy if exists "Users can manage their AI messages" on public.ai_messages;
-- -- drop table if exists public.ai_messages;

-- Subscription model is still referenced by Stripe webhook/checkout/portal code.
-- If product moves fully one-off, keep data until Stripe + code migration is complete.

-- -- drop policy if exists "Users can read their subscriptions" on public.subscriptions;
-- -- drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
-- -- drop table if exists public.subscriptions;

-- Legacy business fields are still selected in audit/account code and may hold historical value.
-- Only consider removal after code cleanup + data migration.

-- -- alter table public.businesses drop column if exists address;
-- -- alter table public.businesses drop column if exists postcode;
-- -- alter table public.businesses drop column if exists employee_count;
-- -- alter table public.businesses drop column if exists current_waste_provider;
-- -- alter table public.businesses drop column if exists sells_packaged_goods;

-- -------------------------------------------------------------------
-- DO NOT DELETE (explicitly protected)
-- -------------------------------------------------------------------
-- Required for health-check core + processing + scoring + reporting:
-- public.businesses
-- public.documents
-- public.alerts
-- public.regulatory_sources
-- public.regulatory_chunks
-- public.compliance_rules
-- public.business_rule_statuses
-- public.regulatory_refresh_logs

-- -------------------------------------------------------------------
-- Rollback guidance (if any destructive change is later made)
-- -------------------------------------------------------------------
-- 1) Take a full backup before uncommenting any DROP statement.
-- 2) Prefer soft-deprecation: stop writing/reading columns first.
-- 3) If a column is dropped accidentally, recreate via migration and backfill from backup.
-- 4) If a table is dropped accidentally, restore from backup, then re-apply grants/RLS/policies/indexes.
-- 5) Re-run cleanup_review.sql after each schema change.
