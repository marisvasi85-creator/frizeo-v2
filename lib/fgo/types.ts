export type FgoClientPayload = {
  Denumire: string;
  Tip: "PF" | "PJ";
  Tara: string;
  Judet?: string;
  Localitate?: string;
  Adresa?: string;
  Email?: string;
  Telefon?: string;
  CodUnic?: string;
  NrRegCom?: string;
};

export type FgoLinePayload = {
  Denumire: string;
  NrProduse: number;
  UM: string;
  CotaTVA: number;
  PretTotal: number;
};

export type FgoEmitInvoicePayload = {
  CodUnic: string;
  Hash: string;
  Serie: string;
  Valuta: string;
  TipFactura: string;
  DataEmitere?: string;
  IdExtern?: string;
  VerificareDuplicat?: boolean;
  Client: FgoClientPayload;
  Continut: FgoLinePayload[];
  PlatformaUrl: string;
};

export type FgoEmitInvoiceResponse = {
  Success: boolean;
  Message?: string;
  Factura?: {
    Numar?: string;
    Serie?: string;
    Link?: string;
    LinkPlata?: string;
  };
};
