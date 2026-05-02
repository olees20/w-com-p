import { supabaseAdmin } from "@/lib/supabase/admin";

type RegulatoryChunk = {
  id: string;
  content: string;
  heading: string | null;
  regulatory_sources:
    | {
        title: string | null;
        url: string;
        source_domain: string | null;
      }
    | Array<{
        title: string | null;
        url: string;
        source_domain: string | null;
      }>
    | null;
};

function unwrapSource(
  source: RegulatoryChunk["regulatory_sources"]
) {
  if (Array.isArray(source)) {
    return source[0] ?? null;
  }
  return source;
}

type RetrievedGuidance = {
  id: string;
  title: string;
  url: string;
  content: string;
  score: number;
};

export async function retrieveRegulatoryGuidance(query: string, limit = 6): Promise<RetrievedGuidance[]> {
  const queryTokens = tokenize(query).slice(0, 12);

  const { data, error } = await supabaseAdmin
    .from("regulatory_chunks")
    .select("id,content,heading,regulatory_sources(title,url,source_domain)")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    return [];
  }

  const scored = (data ?? [])
    .map((raw) => raw as unknown as RegulatoryChunk)
    .map((chunk) => {
      const source = unwrapSource(chunk.regulatory_sources);
      return {
        id: chunk.id,
        title: source?.title || chunk.heading || "Official guidance",
        url: source?.url || "",
        source_domain: source?.source_domain || "",
        content: chunk.content,
        score: scoreChunk(queryTokens, chunk.content)
      };
    })
    .filter((row) => row.url.startsWith("https://"))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreChunk(queryTokens: string[], content: string) {
  const lower = content.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) score += 1;
  }
  return score;
}

export function formatGuidanceContext(
  chunks: Array<{
    title: string;
    url: string;
    content: string;
  }>
) {
  if (chunks.length === 0) {
    return "No stored official guidance matched this question.";
  }

  return chunks
    .map((chunk, idx) => `SOURCE ${idx + 1}\nTitle: ${chunk.title}\nURL: ${chunk.url}\nContent: ${chunk.content}`)
    .join("\n\n");
}
