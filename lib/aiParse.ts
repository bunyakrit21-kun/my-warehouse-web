import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParsedCommand =
  | {
      intent: "MOVE_IN" | "MOVE_OUT";
      item_name: string;
      qty: number;
      unit: string;
      note?: string;
      confidence: number;
      need_clarify: boolean;
      clarify_question?: string;
    }
  | {
      intent: "CHECK_STOCK";
      item_name?: string | null;
      confidence: number;
      need_clarify: boolean;
      clarify_question?: string;
    }
  | {
      intent: "ADD_ITEM";
      item_name: string;
      barcode?: string | null;
      unit?: string | null;
      min_qty?: number | null;
      confidence: number;
      need_clarify: boolean;
      clarify_question?: string;
    }
  | {
      intent: "UNKNOWN";
      confidence: number;
      need_clarify: boolean;
      clarify_question: string;
    };

export async function parseThaiCommand(rawText: string): Promise<ParsedCommand> {
  const jsonSchemaDefinition = {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: {
        type: "string",
        enum: ["MOVE_IN", "MOVE_OUT", "CHECK_STOCK", "ADD_ITEM", "UNKNOWN"],
      },
      item_name: { type: ["string", "null"] },
      barcode: { type: ["string", "null"] },
      qty: { type: ["number", "null"] },
      unit: { type: ["string", "null"] },
      min_qty: { type: ["number", "null"] },
      note: { type: ["string", "null"] },
      confidence: { type: "number" },
      need_clarify: { type: "boolean" },
      clarify_question: { type: ["string", "null"] },
    },
    required: ["intent", "confidence", "need_clarify"],
  } as const;

  const res = await client.responses.create({
    model: "gpt-5",
    instructions: [
      "คุณเป็นตัวแยกคำสั่งคลังสินค้า (ภาษาไทย).",
      "งาน: แปลงข้อความธรรมชาติให้เป็น JSON ตาม schema เท่านั้น.",
      "ถ้าข้อมูลไม่พอ (เช่น qty/unit/รับเข้าหรือเบิกออกไม่ชัด) ให้ need_clarify=true และใส่คำถามสั้นๆ ใน clarify_question.",
      "หน่วยที่พบบ่อย: ขวด, กล่อง, ถุง, แพ็ค, ชิ้น, ลัง, กก, กรัม.",
      "ห้ามใส่ข้อความนอก JSON.",
    ].join("\n"),
    input: rawText,
    text: {
      format: {
        type: "json_schema",
        name: "inventory_command", 
        schema: jsonSchemaDefinition, 
        strict: true, 
      },
    },
  });

  const jsonText = res.output_text || "{}";
  const parsed = JSON.parse(jsonText) as ParsedCommand;

  return parsed;
}