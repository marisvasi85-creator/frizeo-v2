import { createHash } from "crypto";

export function fgoHash(parts: string[]): string {
  return createHash("sha1").update(parts.join("")).digest("hex").toUpperCase();
}

export function fgoEmitereHash(
  codUnic: string,
  cheiePrivata: string,
  clientName: string,
): string {
  return fgoHash([codUnic, cheiePrivata, clientName]);
}

export function fgoInvoiceHash(
  codUnic: string,
  cheiePrivata: string,
  invoiceNumber: string,
): string {
  return fgoHash([codUnic, cheiePrivata, invoiceNumber]);
}
