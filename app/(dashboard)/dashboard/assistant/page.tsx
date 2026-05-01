import { createServerClient } from "@/lib/supabase/server";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { requireActiveSubscription } from "@/lib/stripe/guards";

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
};

export default async function AssistantPage() {
  await requireActiveSubscription();

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();

  if (!business) return null;

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("role,content")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true })
    .limit(100);

  const initialMessages = ((messages ?? []) as StoredMessage[]).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );

  return (
    <div className="space-y-4">
      <div className="app-panel p-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#123026]">Ask anything about your compliance documents</h1>
        <p className="mt-1 text-sm text-[#5f746d]">Get guidance from your business profile, uploaded records, alerts, and score.</p>
      </div>
      <AssistantChat initialMessages={initialMessages} />
    </div>
  );
}
