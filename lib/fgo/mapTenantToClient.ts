import type { TenantBillingProfile } from "@/lib/billing/billingProfile";
import type { FgoClientPayload } from "@/lib/fgo/types";

export function mapTenantToFgoClient(
  profile: TenantBillingProfile,
  email?: string | null,
): FgoClientPayload {
  const isCompany = profile.type === "company";

  return {
    Denumire: profile.name!.trim(),
    Tip: isCompany ? "PJ" : "PF",
    Tara: profile.country || "RO",
    Judet: profile.county?.trim() || undefined,
    Localitate: profile.city?.trim() || undefined,
    Adresa: profile.addressLine1?.trim() || undefined,
    Email: email?.trim() || undefined,
    CodUnic: isCompany ? profile.cui?.trim() || undefined : undefined,
    NrRegCom: isCompany ? profile.regCom?.trim() || undefined : undefined,
  };
}
