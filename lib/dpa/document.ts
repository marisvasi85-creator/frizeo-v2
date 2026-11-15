import { createHash } from "node:crypto";
import { DPA_CANONICAL_TEXT } from "@/lib/dpa/canonicalText";

export const DPA_VERSION = "dpa-2026-11-15";
export const DPA_VERSION_DATE = "15 noiembrie 2026";

export { DPA_CANONICAL_TEXT };

export function dpaDocumentHash(text: string = DPA_CANONICAL_TEXT): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
