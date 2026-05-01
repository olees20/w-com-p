import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { DocumentUpload } from "@/components/documents/document-upload";
import { calculateComplianceScore, type ComplianceStatus } from "@/lib/compliance/scoring";
import { runAlertMonitoringForBusiness } from "@/lib/alerts/monitoring";
import { markAlertResolved } from "@/app/(dashboard)/dashboard/actions";
import { requireActiveSubscription } from "@/lib/stripe/guards";

type RiskLevel = "low" | "medium" | "high";

type DocumentRow = {
  id: string;
  file_name: string;
  created_at: string;
  document_type: string | null;
  expiry_date: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  waste_type: string | null;
  ai_summary: string | null;
};

type AlertRow = {
  id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | null;
  status: string | null;
  due_date: string | null;
};

const riskStyles: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-red-100 text-red-700 border-red-200"
};

const fallbackAuditReadiness = {
  value: "81%",
  blockers: "3 blockers",
  note: "Missing signatures on two chain-of-custody forms."
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function mapStatusToUi(status: ComplianceStatus): { label: string; level: RiskLevel } {
  if (status === "compliant") {
    return { label: "Compliant", level: "low" };
  }

  if (status === "attention_needed") {
    return { label: "Attention Needed", level: "medium" };
  }

  return { label: "At Risk", level: "high" };
}

function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[level]}`}>
      {label}
    </span>
  );
}

function DashboardCard({
  title,
  children,
  className = ""
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  await requireActiveSubscription();
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id,produces_food_waste,produces_hazardous_waste,compliance_score,compliance_status")
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      produces_food_waste: boolean | null;
      produces_hazardous_waste: boolean | null;
      compliance_score: number | null;
      compliance_status: ComplianceStatus | null;
    }>();

  if (!business) {
    return null;
  }

  await runAlertMonitoringForBusiness(business.id);

  const { data: documents } = await supabase
    .from("documents")
    .select("id,file_name,created_at,document_type,expiry_date,ai_risk_level,waste_type,ai_summary")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const allDocuments = (documents ?? []) as DocumentRow[];
  const recentDocuments = allDocuments.slice(0, 5);

  let openAlerts: AlertRow[] = [];
  const alertsQuery = await supabase
    .from("alerts")
    .select("id,title,description,severity,status,due_date")
    .eq("business_id", business.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!alertsQuery.error) {
    openAlerts = (alertsQuery.data ?? []) as AlertRow[];
  }

  const scoring = calculateComplianceScore({
    businessProfile: {
      id: business.id,
      produces_food_waste: business.produces_food_waste,
      produces_hazardous_waste: business.produces_hazardous_waste
    },
    uploadedDocuments: allDocuments,
    openAlerts
  });

  await supabase
    .from("businesses")
    .update({ compliance_score: scoring.score, compliance_status: scoring.status })
    .eq("id", business.id);

  const statusUi = mapStatusToUi(scoring.status);
  const scoreRisk: RiskLevel = scoring.score >= 80 ? "low" : scoring.score >= 50 ? "medium" : "high";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live Compliance Summary</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-slate-900">Are we compliant right now?</p>
            <p className="mt-1 text-sm text-slate-600">{scoring.explanation}</p>
          </div>
          <RiskBadge level={statusUi.level} label={statusUi.label} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="1. Compliance Status">
          <div className="space-y-3">
            <RiskBadge level={statusUi.level} label={statusUi.label} />
            <p className="text-sm text-slate-600">{scoring.explanation}</p>
            <Button className="w-full">Resolve critical actions</Button>
          </div>
        </DashboardCard>

        <DashboardCard title="2. Compliance Score">
          <div className="space-y-3">
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{scoring.score}%</p>
            <p className="text-sm text-slate-600">Updated from business profile, uploaded documents, and open alerts.</p>
            <RiskBadge level={scoreRisk} label={scoreRisk === "low" ? "Low risk" : scoreRisk === "medium" ? "Moderate risk" : "High risk"} />
            <Button variant="secondary" className="w-full">
              Improve score
            </Button>
          </div>
        </DashboardCard>

        <DashboardCard title="3. Alerts & Actions">
          <div className="space-y-3">
            <ul className="space-y-2">
              {openAlerts.length ? (
                openAlerts.map((alert) => (
                  <li key={alert.id} className="space-y-2 rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{alert.title}</p>
                      <RiskBadge level={alert.severity ?? "medium"} label={alert.severity ?? "medium"} />
                    </div>
                    {alert.description ? <p className="text-sm text-slate-600">{alert.description}</p> : null}
                    {alert.due_date ? <p className="text-xs text-slate-500">Due {formatDate(alert.due_date)}</p> : null}
                    <form action={markAlertResolved}>
                      <input type="hidden" name="alert_id" value={alert.id} />
                      <Button type="submit" variant="secondary" className="w-full">
                        Mark resolved
                      </Button>
                    </form>
                  </li>
                ))
              ) : (
                <li className="rounded-md border border-slate-200 p-2 text-sm text-slate-600">No open alerts.</li>
              )}
            </ul>
          </div>
        </DashboardCard>

        <DashboardCard title="4. Recent Documents">
          <div className="space-y-3">
            <ul className="space-y-2">
              {recentDocuments.length ? (
                recentDocuments.map((doc) => (
                  <li key={doc.id} className="rounded-md border border-slate-200 p-2">
                    <p className="text-sm font-medium text-slate-800">{doc.file_name}</p>
                    <p className="text-xs text-slate-500">Uploaded {formatDate(doc.created_at)}</p>
                  </li>
                ))
              ) : (
                <li className="rounded-md border border-slate-200 p-2 text-sm text-slate-600">No documents uploaded yet.</li>
              )}
            </ul>
            <DocumentUpload />
          </div>
        </DashboardCard>

        <DashboardCard title="5. Audit Readiness">
          <div className="space-y-3">
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{fallbackAuditReadiness.value}</p>
            <p className="text-sm text-slate-600">{fallbackAuditReadiness.blockers}</p>
            <p className="text-sm text-slate-600">{fallbackAuditReadiness.note}</p>
            <Button className="w-full">Prepare for next audit</Button>
          </div>
        </DashboardCard>

        <DashboardCard title="6. AI Assistant" className="bg-brand-50">
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Ask WComp AI what is driving risk and what to do next across your sites.
            </p>
            <div className="rounded-md border border-brand-100 bg-white p-3 text-sm text-slate-700">
              Try: "What should I fix first to reduce risk this week?"
            </div>
            <Button href="/dashboard/assistant" className="w-full">Open AI Assistant</Button>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
