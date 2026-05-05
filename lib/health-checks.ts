import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildHealthCheckReportForBusiness } from "@/lib/health-check-report";
const ADMIN_BYPASS_EMAIL = "admin@lithmira.com";

export type HealthCheckRow = {
  id: string;
  business_id: string;
  user_id: string;
  status: "active" | "completed" | "expired" | "cancelled";
  locked_at: string | null;
  expires_at: string | null;
  final_score: number | null;
  final_status: string | null;
  final_confidence: string | null;
  final_report: Record<string, unknown> | null;
  created_at: string;
};

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

async function isAdminBypassUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return false;
  return data.user.email.toLowerCase() === ADMIN_BYPASS_EMAIL;
}

export async function getLatestHealthCheckForBusiness(businessId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("health_checks")
    .select("id,business_id,user_id,status,locked_at,expires_at,final_score,final_status,final_confidence,final_report,created_at")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<HealthCheckRow>();

  return data ?? null;
}

export async function getEditableActiveHealthCheck(businessId: string, userId: string) {
  const isAdmin = await isAdminBypassUser(userId);
  const { data } = await supabaseAdmin
    .from("health_checks")
    .select("id,business_id,user_id,status,locked_at,expires_at,final_score,final_status,final_confidence,final_report,created_at")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("locked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<HealthCheckRow>();

  if (!data) {
    if (!isAdmin) return null;
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("health_checks")
      .insert({
        business_id: businessId,
        user_id: userId,
        status: "active",
        paid_at: new Date().toISOString(),
        expires_at: null
      })
      .select("id,business_id,user_id,status,locked_at,expires_at,final_score,final_status,final_confidence,final_report,created_at")
      .single<HealthCheckRow>();

    if (insertError || !inserted) {
      throw new Error(`Could not create admin bypass health check: ${insertError?.message ?? "Unknown error."}`);
    }
    return inserted;
  }

  if (isExpired(data.expires_at)) {
    if (isAdmin) return data;
    await supabaseAdmin
      .from("health_checks")
      .update({ status: "expired", locked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "active")
      .is("locked_at", null);
    return null;
  }

  return data;
}

export async function requireEditableHealthCheckForDocument(documentId: string, userId: string) {
  const isAdmin = await isAdminBypassUser(userId);
  const { data: doc, error } = await supabaseAdmin
    .from("documents")
    .select("id,user_id,business_id,health_check_id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; user_id: string; business_id: string; health_check_id: string | null }>();

  if (error || !doc) {
    throw new Error("Document not found or access denied.");
  }

  if (!doc.health_check_id && !isAdmin) {
    throw new Error("Document is not linked to a health check session.");
  }

  if (isAdmin) {
    return { doc, healthCheckId: doc.health_check_id ?? "admin-bypass" };
  }

  const { data: healthCheck } = await supabaseAdmin
    .from("health_checks")
    .select("id,status,locked_at,expires_at")
    .eq("id", doc.health_check_id)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; status: string; locked_at: string | null; expires_at: string | null }>();

  if (!healthCheck) {
    throw new Error("Health check session not found.");
  }

  if (healthCheck.status !== "active" || healthCheck.locked_at || isExpired(healthCheck.expires_at)) {
    throw new Error("This health check is locked. Start a new Health Check - £99 to make changes.");
  }

  return { doc, healthCheckId: healthCheck.id };
}

export async function buildFinalReportSnapshot(params: { businessId: string; userId: string }) {
  const report = await buildHealthCheckReportForBusiness({ businessId: params.businessId, userId: params.userId });

  return {
    finalScore: report.score.score,
    finalStatus: report.score.status,
    finalConfidence: report.confidence,
    finalReport: report
  };
}

export async function completeHealthCheck(params: { healthCheckId: string; businessId: string; userId: string }) {
  const isAdmin = await isAdminBypassUser(params.userId);
  const editable = await getEditableActiveHealthCheck(params.businessId, params.userId);
  if (!editable || (!isAdmin && editable.id !== params.healthCheckId)) {
    throw new Error("No active editable health check found.");
  }

  const snapshot = await buildFinalReportSnapshot({ businessId: params.businessId, userId: params.userId });

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("health_checks")
    .update({
      status: "completed",
      completed_at: now,
      locked_at: now,
      final_score: snapshot.finalScore,
      final_status: snapshot.finalStatus,
      final_confidence: snapshot.finalConfidence,
      final_report: snapshot.finalReport
    })
    .eq("id", params.healthCheckId)
    .eq("status", "active")
    .is("locked_at", null);

  return snapshot;
}
