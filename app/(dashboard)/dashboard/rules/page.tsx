import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { seedComplianceRules, syncBusinessRuleStatuses, type RuleStatus } from "@/lib/regulatory/rules";
import { RefreshGuidanceButton } from "@/components/admin/refresh-guidance-button";

function statusClasses(status: RuleStatus) {
  if (status === "complete") return "bg-green-50 border-green-200 text-[#16A34A]";
  if (status === "warning") return "bg-amber-50 border-amber-200 text-[#F59E0B]";
  return "bg-red-50 border-red-200 text-[#DC2626]";
}

function statusLabel(status: RuleStatus) {
  if (status === "complete") return "Complete";
  if (status === "warning") return "Warning";
  return "Missing";
}

export default async function RulesPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const isAdmin = user.email?.toLowerCase() === "admin@lithmira.com";

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!business) return null;

  await seedComplianceRules();
  const rules = await syncBusinessRuleStatuses(business.id);

  return (
    <div className="space-y-4">
      <section className="app-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Compliance Rules</h1>
          {isAdmin ? <RefreshGuidanceButton /> : null}
        </div>
        <p className="mt-1 text-sm text-[#6B7280]">Requirements that apply to your business based on profile and processed documents.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {rules.map((rule) => (
          <article key={rule.rule_id} className="app-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-[#111827]">{rule.title}</h2>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(rule.status)}`}>
                {statusLabel(rule.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#374151]">{rule.explanation}</p>
            <p className="mt-2 text-sm text-[#6B7280]">
              <span className="font-semibold text-[#111827]">Why this applies:</span> {rule.why_it_applies}
            </p>
            <p className="mt-2 text-sm text-[#6B7280]">
              <span className="font-semibold text-[#111827]">Action required:</span> {rule.action_required}
            </p>
            <Link href={rule.govuk_url} target="_blank" className="mt-3 inline-block text-sm font-semibold text-[#1E3A8A] hover:underline">
              View GOV.UK source
            </Link>
          </article>
        ))}
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Checklist</h2>
        <div className="mt-3 space-y-2">
          {rules.map((rule) => (
            <div key={`${rule.rule_id}-check`} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
              <label className="flex items-center gap-3 text-sm text-[#111827]">
                <input type="checkbox" checked={rule.status === "complete"} readOnly className="h-4 w-4 rounded border-[#CBD5E1]" />
                <span>{rule.title}</span>
              </label>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(rule.status)}`}>
                {statusLabel(rule.status)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
