import { AuditLogTable } from "@/components/audit/audit-log-table";
import { createServerClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/stripe/guards";

type AuditEvent = {
  id: string;
  timestamp: string;
  timestampRaw: string;
  category: string;
  action: string;
  resourceType: string;
  resource: string;
  detail: string;
  actor: string;
  status: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function AuditLogPage() {
  await requireActiveSubscription();

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,updated_at")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; name: string; updated_at: string | null }>();

  if (!business) return null;

  const [docsRes, alertsRes, aiMessagesRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id,file_name,document_type,created_at,ai_risk_level")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("alerts")
      .select("id,title,severity,status,created_at,resolved_at,due_date")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("ai_messages")
      .select("id,role,content,created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const events: AuditEvent[] = [];

  if (business.updated_at) {
    events.push({
      id: `business-update-${business.id}`,
      timestamp: formatDateTime(business.updated_at),
      timestampRaw: business.updated_at,
      category: "profile",
      action: "edit",
      resourceType: "business",
      resource: business.name,
      detail: "Business profile was updated.",
      actor: "You",
      status: "success"
    });
  }

  for (const doc of docsRes.data ?? []) {
    events.push({
      id: `doc-upload-${doc.id}`,
      timestamp: formatDateTime(doc.created_at),
      timestampRaw: doc.created_at,
      category: "documents",
      action: "upload",
      resourceType: doc.document_type || "document",
      resource: doc.file_name,
      detail: `Risk: ${doc.ai_risk_level || "unknown"}.`,
      actor: "You",
      status: "success"
    });
  }

  for (const alert of alertsRes.data ?? []) {
    events.push({
      id: `alert-create-${alert.id}`,
      timestamp: formatDateTime(alert.created_at),
      timestampRaw: alert.created_at,
      category: "alerts",
      action: "create",
      resourceType: "alert",
      resource: alert.title,
      detail: `Severity: ${alert.severity || "unknown"}${alert.due_date ? ` • Due: ${alert.due_date}` : ""}`,
      actor: "System",
      status: alert.status || "open"
    });

    if (alert.resolved_at) {
      events.push({
        id: `alert-resolve-${alert.id}`,
        timestamp: formatDateTime(alert.resolved_at),
        timestampRaw: alert.resolved_at,
        category: "alerts",
        action: "resolve",
        resourceType: "alert",
        resource: alert.title,
        detail: "Alert was marked resolved.",
        actor: "You",
        status: "resolved"
      });
    }
  }

  for (const message of aiMessagesRes.data ?? []) {
    const preview = message.content.length > 120 ? `${message.content.slice(0, 120)}...` : message.content;
    events.push({
      id: `ai-${message.id}`,
      timestamp: formatDateTime(message.created_at),
      timestampRaw: message.created_at,
      category: "assistant",
      action: message.role === "user" ? "search" : "response",
      resourceType: "ai_message",
      resource: message.role === "user" ? "User query" : "Assistant answer",
      detail: preview,
      actor: message.role === "user" ? "You" : "Assistant",
      status: "success"
    });
  }

  events.sort((a, b) => +new Date(b.timestampRaw) - +new Date(a.timestampRaw));

  return (
    <div className="space-y-4">
      <section className="app-panel p-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Audit Log</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Track uploads, searches, alerts, edits, and other system actions. Use the filters to drill down by any field.
        </p>
      </section>
      <AuditLogTable events={events} />
    </div>
  );
}
