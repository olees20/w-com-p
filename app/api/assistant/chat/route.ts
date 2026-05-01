import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_ASSISTANT || "gpt-4.1-mini";

type BusinessContext = {
  id: string;
  name: string | null;
  business_type: string | null;
  postcode: string | null;
  employee_count: number | null;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
  sells_packaged_goods: boolean | null;
  current_waste_provider: string | null;
  compliance_score: number | null;
  compliance_status: string | null;
};

function buildContextText(params: {
  business: BusinessContext;
  documents: Array<{ file_name: string; document_type: string | null; ai_summary: string | null; ai_risk_level: string | null }>;
  alerts: Array<{ title: string; description: string | null; severity: string | null; due_date: string | null }>;
}) {
  const { business, documents, alerts } = params;

  const businessProfile = {
    name: business.name,
    business_type: business.business_type,
    postcode: business.postcode,
    employee_count: business.employee_count,
    produces_food_waste: business.produces_food_waste,
    produces_hazardous_waste: business.produces_hazardous_waste,
    sells_packaged_goods: business.sells_packaged_goods,
    current_waste_provider: business.current_waste_provider,
    compliance_score: business.compliance_score,
    compliance_status: business.compliance_status
  };

  return JSON.stringify(
    {
      business_profile: businessProfile,
      uploaded_document_summaries: documents,
      open_alerts: alerts,
      compliance_score: business.compliance_score,
      compliance_status: business.compliance_status
    },
    null,
    2
  );
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string };
  const message = (body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id,name,business_type,postcode,employee_count,produces_food_waste,produces_hazardous_waste,sells_packaged_goods,current_waste_provider,compliance_score,compliance_status"
    )
    .eq("user_id", user.id)
    .maybeSingle<BusinessContext>();

  if (!business) {
    return NextResponse.json({ error: "Business profile not found." }, { status: 400 });
  }

  const [{ data: documents }, { data: alerts }, { data: history }] = await Promise.all([
    supabase
      .from("documents")
      .select("file_name,document_type,ai_summary,ai_risk_level")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("alerts")
      .select("title,description,severity,due_date")
      .eq("business_id", business.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("ai_messages")
      .select("role,content")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true })
      .limit(20)
  ]);

  const contextText = buildContextText({
    business,
    documents: (documents ?? []) as Array<{ file_name: string; document_type: string | null; ai_summary: string | null; ai_risk_level: string | null }>,
    alerts: (alerts ?? []) as Array<{ title: string; description: string | null; severity: string | null; due_date: string | null }>
  });

  await supabase.from("ai_messages").insert({
    user_id: user.id,
    business_id: business.id,
    role: "user",
    content: message
  });

  if (!OPENAI_API_KEY) {
    const fallback =
      "I cannot generate guidance right now because the AI service is not configured. This is guidance only and not legal advice.";

    await supabase.from("ai_messages").insert({
      user_id: user.id,
      business_id: business.id,
      role: "assistant",
      content: fallback
    });

    return NextResponse.json({ answer: fallback });
  }

  const conversation = (history ?? []).map((item: { role: string; content: string }) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: [{ type: "input_text", text: item.content }]
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are Waste Compliance Monitor Assistant. Answer using only the provided context data. Do not hallucinate laws, regulations, or legal requirements. If data is missing or uncertainty exists, clearly say you are unsure and advise the user to check official guidance or speak to a qualified advisor. Always include this exact sentence once in each reply: This is guidance only and not legal advice. Keep answers concise, practical, and prioritized."
            }
          ]
        },
        {
          role: "system",
          content: [{ type: "input_text", text: `CONTEXT:\n${contextText}` }]
        },
        ...conversation,
        {
          role: "user",
          content: [{ type: "input_text", text: message }]
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `AI request failed: ${err}` }, { status: 500 });
  }

  const data = (await response.json()) as { output_text?: string };
  const answer =
    data.output_text?.trim() ||
    "I am unsure based on your current records. Please check official guidance or speak to a qualified advisor. This is guidance only and not legal advice.";

  await supabase.from("ai_messages").insert({
    user_id: user.id,
    business_id: business.id,
    role: "assistant",
    content: answer
  });

  return NextResponse.json({ answer });
}
