export type FgoConfig = {
  apiBase: string;
  codUnic: string;
  cheiePrivata: string;
  serie: string;
  platformUrl: string;
  tva: number;
  tipFactura: string;
};

export function getFgoConfig(): FgoConfig | null {
  const codUnic = process.env.FGO_COD_UNIC?.trim();
  const cheiePrivata = process.env.FGO_CHEIE_PRIVATA?.trim();
  const serie = process.env.FGO_SERIE?.trim();
  const platformUrl = process.env.FGO_PLATFORM_URL?.trim();

  if (!codUnic || !cheiePrivata || !serie || !platformUrl) {
    return null;
  }

  const tvaRaw = Number(process.env.FGO_TVA ?? "21");
  const tva = Number.isFinite(tvaRaw) ? tvaRaw : 21;

  return {
    apiBase: (process.env.FGO_API_BASE?.trim() || "https://api.fgo.ro/v1").replace(
      /\/$/,
      "",
    ),
    codUnic,
    cheiePrivata,
    serie,
    platformUrl,
    tva,
    tipFactura: process.env.FGO_TIP_FACTURA?.trim() || "Factura",
  };
}

export function isFgoConfigured(): boolean {
  return getFgoConfig() !== null;
}
