import { createServerClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/stripe/guards";
import { PrintButton } from "@/components/audit-pack/print-button";

type BusinessRow = {
  id: string;
  name: string | null;
  business_type: string | null;
  address: string | null;
  postcode: string | null;
  employee_count: number | null;
  current_waste_provider: string | null;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
  sells_packaged_goods: boolean | null;
  compliance_score: number | null;
  compliance_status: string | null;
};

type AlertRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  document_type: string | null;
  ai_risk_level: string | null;
  ai_summary: string | null;
  extracted_date: string | null;
  expiry_date: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-slate-200 py-2 text-sm">
      <p className="font-medium text-slate-600">{label}</p>
      <p className="text-slate-900">{value}</p>
    </div>
  );
}

export default async function AuditPackPage() {
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
    .select(
      "id,name,business_type,address,postcode,employee_count,current_waste_provider,produces_food_waste,produces_hazardous_waste,sells_packaged_goods,compliance_score,compliance_status"
    )
    .eq("user_id", user.id)
    .maybeSingle<BusinessRow>();

  if (!business) {
    return null;
  }

  const [{ data: openAlerts }, { data: resolvedAlerts }, { data: documents }] = await Promise.all([
    supabase
      .from("alerts")
      .select("id,title,description,severity,status,due_date,created_at")
      .eq("business_id", business.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("id,title,description,severity,status,due_date,created_at")
      .eq("business_id", business.id)
      .eq("status", "resolved")
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id,file_name,document_type,ai_risk_level,ai_summary,extracted_date,expiry_date,created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
  ]);

  const generatedAt = new Date().toISOString();

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-start justify-between gap-4 print:block">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">WComp Audit Pack</h1>
          <p className="mt-1 text-sm text-slate-600">Generated {formatDate(generatedAt)}</p>
        </div>
        <PrintButton />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Business Profile</h2>
        <div className="mt-3">
          <Row label="Business name" value={business.name ?? "N/A"} />
          <Row label="Business type" value={business.business_type ?? "N/A"} />
          <Row label="Address" value={business.address ?? "N/A"} />
          <Row label="Postcode" value={business.postcode ?? "N/A"} />
          <Row label="Employee count" value={business.employee_count ? String(business.employee_count) : "N/A"} />
          <Row label="Waste provider" value={business.current_waste_provider ?? "N/A"} />
          <Row label="Food waste" value={business.produces_food_waste ? "Yes" : "No"} />
          <Row label="Hazardous waste" value={business.produces_hazardous_waste ? "Yes" : "No"} />
          <Row label="Packaged goods" value={business.sells_packaged_goods ? "Yes" : "No"} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Compliance Overview</h2>
        <div className="mt-3">
          <Row label="Compliance score" value={business.compliance_score !== null ? `${business.compliance_score}%` : "N/A"} />
          <Row label="Compliance status" value={business.compliance_status ?? "N/A"} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Open Alerts</h2>
        <div className="mt-3 space-y-3">
          {(openAlerts as AlertRow[] | null)?.length ? (
            (openAlerts as AlertRow[]).map((alert) => (
              <article key={alert.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-700">{alert.description ?? "No description"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Severity: {alert.severity ?? "N/A"} | Due: {formatDate(alert.due_date)}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">No open alerts.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Resolved Alerts</h2>
        <div className="mt-3 space-y-3">
          {(resolvedAlerts as AlertRow[] | null)?.length ? (
            (resolvedAlerts as AlertRow[]).map((alert) => (
              <article key={alert.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-700">{alert.description ?? "No description"}</p>
                <p className="mt-1 text-xs text-slate-500">Resolved item | Created: {formatDate(alert.created_at)}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">No resolved alerts.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Uploaded Documents & AI Summaries</h2>
        <div className="mt-3 space-y-3">
          {(documents as DocumentRow[] | null)?.length ? (
            (documents as DocumentRow[]).map((doc) => (
              <article key={doc.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{doc.file_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Type: {doc.document_type ?? "unknown"} | Risk: {doc.ai_risk_level ?? "N/A"} | Uploaded: {formatDate(doc.created_at)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Extracted date: {formatDate(doc.extracted_date)} | Expiry: {formatDate(doc.expiry_date)}
                </p>
                <p className="mt-2 text-sm text-slate-700">{doc.ai_summary ?? "No AI summary available."}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-600">No documents uploaded.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 print:bg-white print:border-slate-300">
        <p className="text-sm text-amber-900 print:text-slate-700">
          Disclaimer: This audit pack is generated for operational guidance and record review only. It is not legal advice.
        </p>
      </section>
    </div>
  );
}
