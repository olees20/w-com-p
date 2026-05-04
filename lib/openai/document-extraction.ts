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
  destination?: string | null;
  waste_destination?: string | null;
  disposal_site?: string | null;
  receiving_facility?: string | null;
  treatment_facility?: string | null;
  destination_name?: string | null;
  destination_address?: string | null;
  facility?: string | null;
  producer_name?: string | null;
  customer_name?: string | null;
  client_name?: string | null;
  current_holder?: string | null;
  transferor?: string | null;
  site_name?: string | null;
  carrier_name?: string | null;
  waste_carrier?: string | null;
  registered_carrier?: string | null;
  collector?: string | null;
  transporter?: string | null;
  transferee?: string | null;
  collected_by?: string | null;
  business_taking_waste?: string | null;
  carrier_licence_number?: string | null;
  registration_number?: string | null;
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
    missing_fields: { type: "array", items: { type: "string" } },
    destination: { type: ["string", "null"] },
    waste_destination: { type: ["string", "null"] },
    disposal_site: { type: ["string", "null"] },
    receiving_facility: { type: ["string", "null"] },
    treatment_facility: { type: ["string", "null"] },
    destination_name: { type: ["string", "null"] },
    destination_address: { type: ["string", "null"] },
    facility: { type: ["string", "null"] },
    producer_name: { type: ["string", "null"] },
    customer_name: { type: ["string", "null"] },
    client_name: { type: ["string", "null"] },
    current_holder: { type: ["string", "null"] },
    transferor: { type: ["string", "null"] },
    site_name: { type: ["string", "null"] },
    carrier_name: { type: ["string", "null"] },
    waste_carrier: { type: ["string", "null"] },
    registered_carrier: { type: ["string", "null"] },
    collector: { type: ["string", "null"] },
    transporter: { type: ["string", "null"] },
    transferee: { type: ["string", "null"] },
    collected_by: { type: ["string", "null"] },
    business_taking_waste: { type: ["string", "null"] },
    carrier_licence_number: { type: ["string", "null"] },
    registration_number: { type: ["string", "null"] }
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
    "missing_fields",
    "destination",
    "waste_destination",
    "disposal_site",
    "receiving_facility",
    "treatment_facility",
    "destination_name",
    "destination_address",
    "facility",
    "producer_name",
    "customer_name",
    "client_name",
    "current_holder",
    "transferor",
    "site_name",
    "carrier_name",
    "waste_carrier",
    "registered_carrier",
    "collector",
    "transporter",
    "transferee",
    "collected_by",
    "business_taking_waste",
    "carrier_licence_number",
    "registration_number"
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
  const optionalDestinationFields = [
    "destination",
    "waste_destination",
    "disposal_site",
    "receiving_facility",
    "treatment_facility",
    "destination_name",
    "destination_address",
    "facility"
  ] as const;
  for (const field of optionalDestinationFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== "string") {
      throw new Error(`Invalid ${field}.`);
    }
  }
  const optionalRoleFields = [
    "producer_name",
    "customer_name",
    "client_name",
    "current_holder",
    "transferor",
    "site_name",
    "carrier_name",
    "waste_carrier",
    "registered_carrier",
    "collector",
    "transporter",
    "transferee",
    "collected_by",
    "business_taking_waste",
    "carrier_licence_number",
    "registration_number"
  ] as const;
  for (const field of optionalRoleFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== "string") {
      throw new Error(`Invalid ${field}.`);
    }
  }
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
${extractedTextSnippet}

Role mapping is mandatory:
- Producer/customer/current holder/transferor/site business labels (including "From", "Collected from", "Current holder", "Transferor") must map to producer/customer fields, not carrier fields.
- Carrier/transferee/collector/transporter/registered carrier labels (including "Carrier", "Waste carrier", "Collected by", "Transferee") must map to carrier fields.
- Destination/facility labels (Destination, Disposal site, Receiving facility, Treatment facility, Transfer station, Waste facility) must map to destination fields.
- Licence labels (Licence, Carrier licence, Registration number, Waste carrier registration) must map to carrier_licence_number or registration_number.

Important: do not infer the first business name on a WTN is the carrier when an explicit carrier label is present.`
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

  return (await response.json()) as Record<string, unknown>;
}

function extractStructuredPayload(response: Record<string, unknown>) {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text;
  }

  const output = response.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const parsed = (part as { parsed?: unknown }).parsed;
        if (parsed && typeof parsed === "object") {
          return JSON.stringify(parsed);
        }
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string" && text.trim().length > 0) {
          return text;
        }
      }
    }
  }

  return null;
}

async function extractWithRetry(params: { fileId: string; text: string; fileName: string }) {
  const first = await runExtraction(params);
  const firstPayload = extractStructuredPayload(first);
  console.log("OpenAI raw response (attempt 1)", JSON.stringify(first).slice(0, 6000));
  if (firstPayload) {
    try {
      const parsed = validateStructuredExtraction(JSON.parse(firstPayload));
      return parsed;
    } catch (error) {
      console.log("Structured parse failed (attempt 1)", error);
    }
  }

  const retryResponse = await fetch("https://api.openai.com/v1/responses", {
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
          content: [{ type: "input_text", text: "Return ONLY valid JSON matching the schema. No markdown. No explanation." }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract structured fields from this UK waste compliance document.\nFile name: ${params.fileName}\nExtracted text snippet:\n${params.text.slice(0, 12000)}`
            },
            { type: "input_file", file_id: params.fileId }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "wcomp_document_extraction_retry",
          strict: true,
          schema: extractionSchema
        }
      }
    })
  });

  if (!retryResponse.ok) {
    const retryText = await retryResponse.text();
    throw new Error(`OpenAI extraction retry failed (${retryResponse.status}): ${retryText}`);
  }

  const second = (await retryResponse.json()) as Record<string, unknown>;
  console.log("OpenAI raw response (attempt 2)", JSON.stringify(second).slice(0, 6000));
  const secondPayload = extractStructuredPayload(second);
  if (!secondPayload) {
    throw new Error("AI returned invalid structured output");
  }

  try {
    const parsed = validateStructuredExtraction(JSON.parse(secondPayload));
    return parsed;
  } catch (error) {
    console.log("Structured parse failed (attempt 2)", error);
    throw new Error("AI returned invalid structured output");
  }
}

export async function extractDocumentWithAI(params: {
  file: File;
  extractedText: string;
  businessProfile?: { name?: string | null; business_type?: string | null };
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  console.log("Extracted text length", params.extractedText.length);
  console.log("Extracted text preview", params.extractedText.slice(0, 500));

  const uploaded = await uploadFileToOpenAI(params.file);
  const parsed = await extractWithRetry({
    fileId: uploaded.id,
    text: params.extractedText,
    fileName: params.file.name
  });
  console.log("Parsed JSON", parsed);
  console.log("Validation result", "ok");
  return parsed;
}
