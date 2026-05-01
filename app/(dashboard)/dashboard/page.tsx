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
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function mapStatusToUi(status: ComplianceStatus): { label: string; level: RiskLevel } {
  if (status === "compliant") return { label: "Compliant", level: "low" };
  if (status === "attention_needed") return { label: "Attention Needed", level: "medium" };
  return { label: "At Risk", level: "high" };
}

function Badge({ level, label }: { level: RiskLevel; label: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskStyles[level]}`}>{label}</span>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-panel p-5">
      <h2 className="text-sm font-bold text-[#1c3a31]">{title}</h2>
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

  if (!user) return null;

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

  if (!business) return null;

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

  if (!alertsQuery.error) openAlerts = (alertsQuery.data ?? []) as AlertRow[];

  const scoring = calculateComplianceScore({
    businessProfile: {
      id: business.id,
      produces_food_waste: business.produces_food_waste,
      produces_hazardous_waste: business.produces_hazardous_waste
    },
    uploadedDocuments: allDocuments,
    openAlerts
  });

  await supabase.from("businesses").update({ compliance_score: scoring.score, compliance_status: scoring.status }).eq("id", business.id);

  const statusUi = mapStatusToUi(scoring.status);
  const scoreRisk: RiskLevel = scoring.score >= 80 ? "low" : scoring.score >= 50 ? "medium" : "high";

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4a6a60]">Compliance Health Summary</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#123026]">Are we compliant right now?</h1>
            <p className="mt-1 text-sm text-[#5b746b]">{scoring.explanation}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge level={statusUi.level} label={statusUi.label} />
            <div className="rounded-xl bg-[#0f4b3b] px-4 py-2 text-white">
              <p className="text-xs uppercase text-emerald-100">Score</p>
              <p className="text-lg font-extrabold">{scoring.score}%</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Open Alerts">
          <div className="space-y-3">
            {openAlerts.length ? (
              openAlerts.map((alert) => (
                <article key={alert.id} className="rounded-xl border border-[#dce6e2] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1c3a31]">{alert.title}</p>
                    <Badge level={alert.severity ?? "medium"} label={alert.severity ?? "medium"} />
                  </div>
                  {alert.description ? <p className="mt-1 text-sm text-[#5f746d]">{alert.description}</p> : null}
                  {alert.due_date ? <p className="mt-1 text-xs text-[#7a8f88]">Due {formatDate(alert.due_date)}</p> : null}
                  <form action={markAlertResolved} className="mt-2">
                    <input type="hidden" name="alert_id" value={alert.id} />
                    <Button type="submit" variant="secondary" className="w-full">
                      Mark resolved
                    </Button>
                  </form>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#5f746d]">No open alerts.</p>
            )}
          </div>
        </Panel>

        <Panel title="Recent Documents">
          <div className="space-y-3">
            <ul className="space-y-2">
              {recentDocuments.length ? (
                recentDocuments.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-[#dce6e2] bg-[#fafcfb] p-3">
                    <p className="text-sm font-semibold text-[#1d3a31]">{doc.file_name}</p>
                    <p className="mt-1 text-xs text-[#6f857e]">Uploaded {formatDate(doc.created_at)}</p>
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-[#dce6e2] p-3 text-sm text-[#5f746d]">No documents uploaded yet.</li>
              )}
            </ul>
            <DocumentUpload />
          </div>
        </Panel>

        <Panel title="Action Center">
          <div className="space-y-3">
            <div className="rounded-lg border border-[#dce6e2] bg-[#fafcfb] p-3">
              <p className="text-sm font-semibold text-[#1d3a31]">Compliance status</p>
              <p className="mt-1 text-sm text-[#5f746d]">{statusUi.label}</p>
            </div>
            <div className="rounded-lg border border-[#dce6e2] bg-[#fafcfb] p-3">
              <p className="text-sm font-semibold text-[#1d3a31]">Risk level</p>
              <p className="mt-1 text-sm text-[#5f746d]">{scoreRisk === "low" ? "Low" : scoreRisk === "medium" ? "Moderate" : "High"}</p>
            </div>
            <Button className="w-full">Resolve critical actions</Button>
            <Button href="/dashboard/assistant" variant="secondary" className="w-full">
              Ask AI Assistant
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
