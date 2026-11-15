import { createHash } from "node:crypto";
import { DPA_CANONICAL_TEXT } from "@/lib/dpa/canonicalText";

/** Draft identifier. A stored row does not make this text a signed contract. */
export const DPA_DRAFT_VERSION = "dpa-proiect-2026-11-15-915";

export { DPA_CANONICAL_TEXT };

export function dpaDocumentHash(text: string = DPA_CANONICAL_TEXT): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
