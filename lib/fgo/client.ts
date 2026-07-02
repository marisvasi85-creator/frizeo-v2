import { getFgoConfig } from "@/lib/fgo/config";
import { fgoEmitereHash } from "@/lib/fgo/hash";
import type {
  FgoClientPayload,
  FgoEmitInvoicePayload,
  FgoEmitInvoiceResponse,
  FgoLinePayload,
} from "@/lib/fgo/types";

async function fgoPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const config = getFgoConfig();
  if (!config) {
    throw new Error("FGO nu este configurat.");
  }

  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as T;

  if (!res.ok) {
    throw new Error(`FGO HTTP ${res.status}`);
  }

  return data;
}

export async function emitFgoInvoice(params: {
  client: FgoClientPayload;
  lines: FgoLinePayload[];
  idExtern: string;
  dataEmitere?: string;
  currency?: string;
}): Promise<FgoEmitInvoiceResponse> {
  const config = getFgoConfig();
  if (!config) {
    throw new Error("FGO nu este configurat.");
  }

  const clientName = params.client.Denumire.trim();
  const payload: FgoEmitInvoicePayload = {
    CodUnic: config.codUnic,
    Hash: fgoEmitereHash(config.codUnic, config.cheiePrivata, clientName),
    Serie: config.serie,
    Valuta: params.currency ?? "RON",
    TipFactura: config.tipFactura,
    DataEmitere: params.dataEmitere,
    IdExtern: params.idExtern,
    VerificareDuplicat: true,
    Client: params.client,
    Continut: params.lines,
    PlatformaUrl: config.platformUrl,
  };

  const result = await fgoPost<FgoEmitInvoiceResponse>(
    "/factura/emitere",
    payload as unknown as Record<string, unknown>,
  );

  if (!result.Success) {
    throw new Error(result.Message || "FGO: emiterea facturii a eșuat.");
  }

  return result;
}
