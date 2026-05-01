import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { DocumentUpload } from "@/components/documents/document-upload";
import { calculateComplianceScore, type ComplianceStatus } from "@/lib/compliance/scoring";
import { runAlertMonitoringForBusiness } from "@/lib/alerts/monitoring";
import { markAlertResolved } from "@/app/(dashboard)/dashboard/actions";
import { requireActiveSubscription } from "@/lib/stripe/guards";
import { DashboardAssistant } from "@/components/assistant/dashboard-assistant";

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

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
};

const riskStyles: Record<RiskLevel, string> = {
  low: "bg-green-50 text-[#16A34A] border-green-200",
  medium: "bg-amber-50 text-[#F59E0B] border-amber-200",
  high: "bg-red-50 text-[#DC2626] border-red-200"
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

function scoreToRisk(score: number): RiskLevel {
  if (score >= 80) return "low";
  if (score >= 50) return "medium";
  return "high";
}

function Badge({ level, label }: { level: RiskLevel; label: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskStyles[level]}`}>{label}</span>;
}

function ragSegments() {
  return [
    { from: 0, to: 49, color: "#DC2626" },
    { from: 50, to: 79, color: "#F59E0B" },
    { from: 80, to: 100, color: "#16A34A" }
  ];
}

function ScoreWheel({ value, size = 96 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
        {ragSegments().map((segment) => {
          const segStart = (segment.from / 100) * circumference;
          const segLength = ((segment.to - segment.from + 1) / 100) * circumference;
          const segValue = Math.max(0, Math.min(clamped - segment.from + 1, segment.to - segment.from + 1));
          const segDraw = (segValue / (segment.to - segment.from + 1)) * segLength;

          return (
            <circle
              key={`${segment.from}-${segment.to}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${segDraw} ${circumference - segDraw}`}
              strokeDashoffset={-segStart}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[#111827]">
        <div className="text-center">
          <p className="text-2xl font-extrabold leading-none">{clamped}%</p>
        </div>
      </div>
    </div>
  );
}

function TopCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-panel p-5">
      <p className="text-sm font-bold text-[#111827]">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="app-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
        {action}
      </div>
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

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("role,content")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const initialMessages = ((messages ?? []) as StoredMessage[]).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );

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
  const openHigh = openAlerts.filter((a) => a.severity === "high").length;
  const openMedium = openAlerts.filter((a) => a.severity === "medium").length;
  const auditReadiness = Math.max(0, Math.min(100, scoring.score - openHigh * 6 - openMedium * 3));

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">Good morning</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Here’s your compliance overview for today.</p>
          </div>
          <Button>Upload Document</Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        <TopCard title="Compliance Status">
          <div className="flex items-center gap-4">
            <ScoreWheel value={scoring.score} />
            <div>
              <p className="text-xl font-extrabold text-[#111827]">{statusUi.label}</p>
              <p className="text-sm text-[#6B7280]">Based on current evidence and open actions.</p>
            </div>
          </div>
        </TopCard>

        <TopCard title="Compliance Score">
          <div className="flex items-center gap-4">
            <ScoreWheel value={scoring.score} />
            <div>
              <p className="text-sm font-bold text-[#111827]">Score updated</p>
              <p className="text-sm text-[#6B7280]">Calculated from profile, documents, and alerts.</p>
            </div>
          </div>
        </TopCard>

        <TopCard title="Open Alerts">
          <div className="space-y-2">
            <p className="text-4xl font-extrabold text-[#DC2626]">{openHigh + openMedium}</p>
            <p className="text-sm text-[#DC2626]">{openHigh} high priority</p>
            <p className="text-sm text-[#F59E0B]">{openMedium} medium priority</p>
          </div>
        </TopCard>

        <TopCard title="Audit Readiness">
          <div className="flex items-center gap-4">
            <ScoreWheel value={auditReadiness} />
            <div>
              <p className="text-sm font-bold text-[#111827]">{auditReadiness >= 80 ? "Almost ready" : "Needs work"}</p>
              <p className="text-sm text-[#6B7280]">Address open alerts to improve your score.</p>
            </div>
          </div>
        </TopCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Alerts & Actions" action={<Button variant="secondary">View all</Button>}>
          <div className="space-y-2">
            {openAlerts.length ? (
              openAlerts.map((alert) => (
                <article key={alert.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{alert.title}</p>
                    {alert.description ? <p className="mt-1 text-sm text-[#6B7280]">{alert.description}</p> : null}
                    {alert.due_date ? <p className="mt-1 text-xs text-[#6B7280]">Due {formatDate(alert.due_date)}</p> : null}
                  </div>
                  <div className="min-w-[120px] space-y-2">
                    <div className="flex justify-end">
                      <Badge level={alert.severity ?? "medium"} label={alert.severity ?? "medium"} />
                    </div>
                    <form action={markAlertResolved}>
                      <input type="hidden" name="alert_id" value={alert.id} />
                      <Button type="submit" variant="secondary" className="w-full">
                        Mark resolved
                      </Button>
                    </form>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#6B7280]">No open alerts.</p>
            )}
          </div>
        </Panel>

        <Panel title="Recent Documents" action={<Button variant="secondary">View all</Button>}>
          <div className="space-y-2">
            {recentDocuments.length ? (
              recentDocuments.map((doc) => {
                const risk = doc.ai_risk_level === "high" ? "high" : doc.ai_risk_level === "medium" ? "medium" : "low";
                return (
                  <article key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] p-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{doc.file_name}</p>
                      <p className="text-xs text-[#6B7280]">Uploaded {formatDate(doc.created_at)}</p>
                    </div>
                    <Badge level={risk} label={risk === "low" ? "processed" : risk === "medium" ? "review" : "urgent"} />
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-[#6B7280]">No documents uploaded yet.</p>
            )}
          </div>
          <div className="mt-3">
            <DocumentUpload />
          </div>
        </Panel>
      </div>

      <DashboardAssistant initialMessages={initialMessages} />
    </div>
  );
}
