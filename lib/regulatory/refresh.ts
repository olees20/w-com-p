import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ALLOWED_REGULATORY_DOMAINS, REGULATORY_SOURCE_SEEDS } from "@/lib/regulatory/constants";

type RegulatorySourceRow = {
  id: string;
  title: string | null;
  url: string;
  content_hash: string | null;
};

type RefreshResult = {
  url: string;
  previousHash: string | null;
  newHash: string | null;
  changed: boolean;
  fetchedAt: string;
  error: string | null;
};

type Chunk = {
  heading: string;
  content: string;
  token_count: number;
  content_hash: string;
  embedding: number[] | null;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

function getDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isAllowedDomain(url: string) {
  const domain = getDomain(url);
  return ALLOWED_REGULATORY_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

function hashContent(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text: string, maxChars = 1800) {
  const chunks: string[] = [];
  let current = "";

  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if ((current + " " + sentence).trim().length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
      continue;
    }
    current = `${current} ${sentence}`.trim();
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function createEmbedding(input: string) {
  if (!OPENAI_API_KEY) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input })
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
  return data.data?.[0]?.embedding ?? null;
}

async function buildChunks(title: string, text: string): Promise<Chunk[]> {
  const rawChunks = splitIntoChunks(text);
  const chunks: Chunk[] = [];

  for (const rawChunk of rawChunks) {
    const embedding = await createEmbedding(rawChunk);
    chunks.push({
      heading: title,
      content: rawChunk,
      token_count: Math.ceil(rawChunk.length / 4),
      content_hash: hashContent(rawChunk),
      embedding
    });
  }

  return chunks;
}

async function saveRefreshLog(entry: RefreshResult) {
  await supabaseAdmin.from("regulatory_refresh_logs").insert({
    source_url: entry.url,
    previous_hash: entry.previousHash,
    new_hash: entry.newHash,
    changed: entry.changed,
    fetched_at: entry.fetchedAt,
    error: entry.error
  });
}

async function upsertSource(params: {
  seed: (typeof REGULATORY_SOURCE_SEEDS)[number];
  text: string;
  hash: string;
  fetchedAt: string;
  lastModified: string | null;
}) {
  const { seed, text, hash, fetchedAt, lastModified } = params;

  const { data: existing } = await supabaseAdmin
    .from("regulatory_sources")
    .select("id,title,url,content_hash")
    .eq("url", seed.url)
    .maybeSingle<RegulatorySourceRow>();

  const domain = getDomain(seed.url);
  const sourcePayload = {
    title: seed.title,
    url: seed.url,
    source_domain: domain,
    source_type: seed.source_type,
    category: seed.category,
    jurisdiction: "england",
    content_hash: hash,
    last_fetched_at: fetchedAt,
    last_modified: lastModified,
    is_active: true
  };

  if (!existing) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("regulatory_sources")
      .insert(sourcePayload)
      .select("id")
      .single<{ id: string }>();

    if (createError || !created) {
      throw new Error(createError?.message || "Failed to create source");
    }

    const chunks = await buildChunks(seed.title, text);
    if (chunks.length > 0) {
      await supabaseAdmin.from("regulatory_chunks").insert(
        chunks.map((chunk, idx) => ({
          source_id: created.id,
          chunk_index: idx,
          heading: chunk.heading,
          content: chunk.content,
          token_count: chunk.token_count,
          content_hash: chunk.content_hash,
          embedding: chunk.embedding
        }))
      );
    }

    return { previousHash: null, changed: true };
  }

  const previousHash = existing.content_hash;
  const changed = previousHash !== hash;

  await supabaseAdmin.from("regulatory_sources").update(sourcePayload).eq("id", existing.id);

  if (changed) {
    await supabaseAdmin.from("regulatory_chunks").delete().eq("source_id", existing.id);

    const chunks = await buildChunks(seed.title, text);
    if (chunks.length > 0) {
      await supabaseAdmin.from("regulatory_chunks").insert(
        chunks.map((chunk, idx) => ({
          source_id: existing.id,
          chunk_index: idx,
          heading: chunk.heading,
          content: chunk.content,
          token_count: chunk.token_count,
          content_hash: chunk.content_hash,
          embedding: chunk.embedding
        }))
      );
    }

    await supabaseAdmin.from("compliance_rules").update({ is_active: false }).eq("source_url", seed.url).eq("is_active", true);
  }

  return { previousHash, changed };
}

export async function refreshRegulatorySources() {
  const results: RefreshResult[] = [];

  for (const seed of REGULATORY_SOURCE_SEEDS) {
    const fetchedAt = new Date().toISOString();

    if (!isAllowedDomain(seed.url)) {
      const result: RefreshResult = {
        url: seed.url,
        previousHash: null,
        newHash: null,
        changed: false,
        fetchedAt,
        error: "Source domain not allowed"
      };
      await saveRefreshLog(result);
      results.push(result);
      continue;
    }

    try {
      const response = await fetch(seed.url, {
        headers: {
          "User-Agent": "Waste Compliance Platform Regulatory Refresher"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const html = await response.text();
      const text = stripHtmlToText(html);
      if (!text) {
        throw new Error("No readable content extracted from source page.");
      }

      const newHash = hashContent(text);
      const lastModified = response.headers.get("last-modified");
      const { previousHash, changed } = await upsertSource({
        seed,
        text,
        hash: newHash,
        fetchedAt,
        lastModified
      });

      const result: RefreshResult = {
        url: seed.url,
        previousHash,
        newHash,
        changed,
        fetchedAt,
        error: null
      };
      await saveRefreshLog(result);
      results.push(result);
    } catch (error) {
      const result: RefreshResult = {
        url: seed.url,
        previousHash: null,
        newHash: null,
        changed: false,
        fetchedAt,
        error: error instanceof Error ? error.message : "Unknown refresh error"
      };
      await saveRefreshLog(result);
      results.push(result);
    }
  }

  return results;
}
