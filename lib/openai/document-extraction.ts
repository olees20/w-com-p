const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_DOC_EXTRACTION || "gpt-4.1-mini";

export type StructuredExtraction = {
  document_type:
    | "waste_transfer_note"
    | "carrier_licence"
    | "invoice"
    | "recycling_report"
    | "contract"
    | "hazardous_waste_note"
    | "unknown";
  supplier: string | null;
  document_date: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  licence_number: string | null;
  risk_level: "low" | "medium" | "high";
  summary: string;
  missing_fields: string[];
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: {
      type: "string",
      enum: ["waste_transfer_note", "carrier_licence", "invoice", "recycling_report", "contract", "hazardous_waste_note", "unknown"]
    },
    supplier: { type: ["string", "null"] },
    document_date: { type: ["string", "null"], description: "Date in YYYY-MM-DD when confidently present, otherwise null" },
    expiry_date: { type: ["string", "null"], description: "Date in YYYY-MM-DD when confidently present, otherwise null" },
    waste_type: { type: ["string", "null"] },
    ewc_code: { type: ["string", "null"] },
    licence_number: { type: ["string", "null"] },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    missing_fields: { type: "array", items: { type: "string" } }
  },
  required: [
    "document_type",
    "supplier",
    "document_date",
    "expiry_date",
    "waste_type",
    "ewc_code",
    "licence_number",
    "risk_level",
    "summary",
    "missing_fields"
  ]
} as const;

function assertDateOrNull(value: unknown, field: string) {
  if (value === null) return;
  if (typeof value !== "string") throw new Error(`Invalid type for ${field}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date format for ${field}; expected YYYY-MM-DD or null.`);
}

function validateStructuredExtraction(data: unknown): StructuredExtraction {
  if (!data || typeof data !== "object") {
    throw new Error("Extraction is not an object.");
  }
  const value = data as Record<string, unknown>;
  const required = [
    "document_type",
    "supplier",
    "document_date",
    "expiry_date",
    "waste_type",
    "ewc_code",
    "licence_number",
    "risk_level",
    "summary",
    "missing_fields"
  ] as const;
  for (const key of required) {
    if (!(key in value)) {
      throw new Error(`Missing required field: ${key}`);
    }
  }

  const allowedDocTypes = new Set([
    "waste_transfer_note",
    "carrier_licence",
    "invoice",
    "recycling_report",
    "contract",
    "hazardous_waste_note",
    "unknown"
  ]);
  const allowedRisk = new Set(["low", "medium", "high"]);

  if (typeof value.document_type !== "string" || !allowedDocTypes.has(value.document_type)) {
    throw new Error("Invalid document_type.");
  }
  if (value.supplier !== null && typeof value.supplier !== "string") throw new Error("Invalid supplier.");
  assertDateOrNull(value.document_date, "document_date");
  assertDateOrNull(value.expiry_date, "expiry_date");
  if (value.waste_type !== null && typeof value.waste_type !== "string") throw new Error("Invalid waste_type.");
  if (value.ewc_code !== null && typeof value.ewc_code !== "string") throw new Error("Invalid ewc_code.");
  if (value.licence_number !== null && typeof value.licence_number !== "string") throw new Error("Invalid licence_number.");
  if (typeof value.risk_level !== "string" || !allowedRisk.has(value.risk_level)) throw new Error("Invalid risk_level.");
  if (typeof value.summary !== "string" || value.summary.trim().length === 0) throw new Error("Invalid summary.");
  if (!Array.isArray(value.missing_fields) || value.missing_fields.some((m) => typeof m !== "string")) {
    throw new Error("Invalid missing_fields.");
  }

  return value as StructuredExtraction;
}

async function uploadFileToOpenAI(file: File) {
  const formData = new FormData();
  formData.append("purpose", "user_data");
  formData.append("file", file);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI file upload failed (${response.status}): ${text}`);
  }

  return (await response.json()) as { id: string };
}

async function runExtraction(params: { fileId: string; text: string; fileName: string }) {
  const extractedTextSnippet = params.text.slice(0, 12000);

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
                "Return strict JSON matching the schema exactly. Only use document evidence. Use null for unknown values. Never return prose outside JSON."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract structured fields from this UK waste compliance document.
File name: ${params.fileName}
Extracted text snippet:
${extractedTextSnippet}`
            },
            {
              type: "input_file",
              file_id: params.fileId
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "wcomp_document_extraction",
          strict: true,
          schema: extractionSchema
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI extraction failed (${response.status}): ${text}`);
  }

  return (await response.json()) as { output_text?: string };
}

export async function extractDocumentWithAI(params: {
  file: File;
  extractedText: string;
  businessProfile?: { name?: string | null; business_type?: string | null };
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const uploaded = await uploadFileToOpenAI(params.file);
  const response = await runExtraction({
    fileId: uploaded.id,
    text: params.extractedText,
    fileName: params.file.name
  });

  if (!response.output_text) {
    throw new Error("No structured output returned.");
  }

  const parsed = validateStructuredExtraction(JSON.parse(response.output_text));
  return parsed;
}
