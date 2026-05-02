const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_DOC_EXTRACTION || "gpt-4.1-mini";

export type ExtractedDocument = {
  document_type: "waste_transfer_note" | "carrier_licence" | "invoice" | "recycling_report" | "contract" | "unknown";
  extracted_supplier: string | null;
  extracted_date: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  ai_risk_level: "low" | "medium" | "high";
  ai_summary: string;
  missing_information: string[];
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: {
      type: "string",
      enum: ["waste_transfer_note", "carrier_licence", "invoice", "recycling_report", "contract", "unknown"]
    },
    extracted_supplier: {
      type: ["string", "null"]
    },
    extracted_date: {
      type: ["string", "null"],
      description: "Date in YYYY-MM-DD when confidently present, otherwise null"
    },
    expiry_date: {
      type: ["string", "null"],
      description: "Date in YYYY-MM-DD when confidently present, otherwise null"
    },
    waste_type: {
      type: ["string", "null"]
    },
    extracted_ewc_code: {
      type: ["string", "null"]
    },
    extracted_licence_number: {
      type: ["string", "null"]
    },
    ai_risk_level: {
      type: "string",
      enum: ["low", "medium", "high"]
    },
    ai_summary: {
      type: "string"
    },
    missing_information: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "document_type",
    "extracted_supplier",
    "extracted_date",
    "expiry_date",
    "waste_type",
    "extracted_ewc_code",
    "extracted_licence_number",
    "ai_risk_level",
    "ai_summary",
    "missing_information"
  ]
} as const;

function fallbackExtraction(reason: string): ExtractedDocument {
  return {
    document_type: "unknown",
    extracted_supplier: null,
    extracted_date: null,
    expiry_date: null,
    waste_type: null,
    extracted_ewc_code: null,
    extracted_licence_number: null,
    ai_risk_level: "medium",
    ai_summary: `AI extraction unavailable: ${reason}`,
    missing_information: ["supplier_name", "document_date", "expiry_date", "waste_type"]
  };
}

async function uploadFileToOpenAI(file: File) {
  const formData = new FormData();
  formData.append("purpose", "user_data");
  formData.append("file", file);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI file upload failed (${response.status}): ${text}`);
  }

  return (await response.json()) as { id: string };
}

async function runExtraction(fileId: string, context?: { text?: string; fileName?: string }) {
  const extractedTextSnippet = (context?.text ?? "").slice(0, 12000);
  const fileName = context?.fileName ?? "unknown-file";
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
                "You extract structured waste-compliance document data. Only use evidence from the document. If uncertain, return null or unknown."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Classify and extract: supplier name, document date, expiry date, waste type, EWC code, licence number, risk level (low/medium/high), short summary, and missing information.
File name: ${fileName}
Extracted text snippet:
${extractedTextSnippet || "[no text extracted]"}`
            },
            {
              type: "input_file",
              file_id: fileId
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

export async function extractDocumentWithAI(
  file: File,
  businessProfile?: { name?: string | null; business_type?: string | null },
  extractedText?: string
): Promise<ExtractedDocument> {
  if (!OPENAI_API_KEY) {
    return fallbackExtraction("OPENAI_API_KEY is not set.");
  }

  try {
    const uploaded = await uploadFileToOpenAI(file);
    const extracted = await runExtraction(uploaded.id, { text: extractedText, fileName: file.name });

    if (!extracted.output_text) {
      return fallbackExtraction("No structured output returned.");
    }

    const parsed = JSON.parse(extracted.output_text) as ExtractedDocument;
    if (businessProfile?.name && parsed.extracted_supplier === businessProfile.name) {
      parsed.extracted_supplier = null;
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fallbackExtraction(message);
  }
}
