export type BillingType = "individual" | "company";

export type TenantBillingProfile = {
  type: BillingType | null;
  name: string | null;
  cui: string | null;
  regCom: string | null;
  addressLine1: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string;
};

export type TenantBillingRow = {
  billing_type: BillingType | null;
  billing_name: string | null;
  billing_cui: string | null;
  billing_reg_com: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_county: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
};

export function rowToBillingProfile(
  row: TenantBillingRow | null | undefined
): TenantBillingProfile {
  return {
    type: row?.billing_type ?? null,
    name: row?.billing_name?.trim() || null,
    cui: row?.billing_cui?.trim() || null,
    regCom: row?.billing_reg_com?.trim() || null,
    addressLine1: row?.billing_address_line1?.trim() || null,
    city: row?.billing_city?.trim() || null,
    county: row?.billing_county?.trim() || null,
    postalCode: row?.billing_postal_code?.trim() || null,
    country: row?.billing_country?.trim() || "RO",
  };
}

export function normalizeCui(raw: string): string {
  return raw.replace(/^RO/i, "").replace(/\s/g, "").toUpperCase();
}

function isValidCui(cui: string): boolean {
  const normalized = normalizeCui(cui);
  return /^\d{2,10}$/.test(normalized);
}

export function validateBillingProfileInput(input: {
  type?: string;
  name?: string;
  cui?: string;
  regCom?: string;
  addressLine1?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  country?: string;
}):
  | { ok: true; profile: TenantBillingProfile }
  | { ok: false; error: string } {
  const type = input.type;

  if (type !== "individual" && type !== "company") {
    return { ok: false, error: "Selectează tipul de facturare: persoană fizică sau juridică." };
  }

  const name = input.name?.trim() ?? "";
  const addressLine1 = input.addressLine1?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const county = input.county?.trim() ?? "";
  const postalCode = input.postalCode?.trim() ?? "";
  const country = (input.country?.trim() || "RO").toUpperCase();
  const regCom = input.regCom?.trim() ?? "";
  const cuiRaw = input.cui?.trim() ?? "";

  if (name.length < 2) {
    return {
      ok: false,
      error:
        type === "company"
          ? "Introdu denumirea firmei."
          : "Introdu numele complet pentru facturare.",
    };
  }

  if (!addressLine1 || !city) {
    return { ok: false, error: "Adresa și localitatea sunt obligatorii." };
  }

  if (!county) {
    return { ok: false, error: "Județul este obligatoriu pentru factura fiscală." };
  }

  if (type === "company") {
    if (!cuiRaw) {
      return { ok: false, error: "CUI/CIF este obligatoriu pentru persoană juridică." };
    }

    if (!isValidCui(cuiRaw)) {
      return { ok: false, error: "CUI/CIF invalid. Introdu doar cifre (2–10), fără prefix RO." };
    }
  }

  return {
    ok: true,
    profile: {
      type,
      name,
      cui: type === "company" ? normalizeCui(cuiRaw) : null,
      regCom: type === "company" ? regCom || null : null,
      addressLine1,
      city,
      county: county || null,
      postalCode: postalCode || null,
      country,
    },
  };
}

export function isIndividualBillingProfileReady(
  profile: TenantBillingProfile | null | undefined
): boolean {
  if (!profile || profile.type !== "individual") {
    return false;
  }

  return Boolean(
    profile.name &&
      profile.addressLine1 &&
      profile.city &&
      profile.county &&
      profile.country,
  );
}

export function isCompanyBillingProfileReady(
  profile: TenantBillingProfile | null | undefined
): boolean {
  if (!profile || profile.type !== "company") {
    return false;
  }

  return Boolean(
    profile.name &&
      profile.cui &&
      isValidCui(profile.cui) &&
      profile.addressLine1 &&
      profile.city &&
      profile.county &&
      profile.country,
  );
}

/** Profil PF sau PJ complet — obligatoriu înainte de checkout Stripe / FGO. */
export function isBillingProfileComplete(
  profile: TenantBillingProfile | null | undefined
): boolean {
  return (
    isIndividualBillingProfileReady(profile) ||
    isCompanyBillingProfileReady(profile)
  );
}

export function validateIndividualBillingProfileInput(input: {
  name?: string;
  addressLine1?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  country?: string;
}):
  | { ok: true; profile: TenantBillingProfile }
  | { ok: false; error: string } {
  const name = input.name?.trim() ?? "";
  const addressLine1 = input.addressLine1?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const county = input.county?.trim() ?? "";
  const postalCode = input.postalCode?.trim() ?? "";
  const country = (input.country?.trim() || "RO").toUpperCase();

  if (name.length < 2) {
    return { ok: false, error: "Introdu numele complet pentru facturare." };
  }

  if (!addressLine1 || !city) {
    return { ok: false, error: "Adresa și localitatea sunt obligatorii." };
  }

  if (!county) {
    return { ok: false, error: "Județul este obligatoriu pentru factura fiscală." };
  }

  return {
    ok: true,
    profile: {
      type: "individual",
      name,
      cui: null,
      regCom: null,
      addressLine1,
      city,
      county,
      postalCode: postalCode || null,
      country,
    },
  };
}

export function billingProfileToDbUpdate(profile: TenantBillingProfile) {
  return {
    billing_type: profile.type,
    billing_name: profile.name,
    billing_cui: profile.cui,
    billing_reg_com: profile.regCom,
    billing_address_line1: profile.addressLine1,
    billing_city: profile.city,
    billing_county: profile.county,
    billing_postal_code: profile.postalCode,
    billing_country: profile.country,
  };
}
