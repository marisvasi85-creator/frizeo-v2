import ContactsClient from "./ContactsClient";
import { listContacts } from "@/lib/frizeo-email/contacts";
import type {
  MarketingContactSource,
  MarketingContactStatus,
} from "@/lib/frizeo-email/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = first(sp.q) || "";
  const status = (first(sp.status) || "all") as MarketingContactStatus | "all";
  const source = (first(sp.source) || "all") as MarketingContactSource | "all";
  const consent = (first(sp.consent) || "all") as "all" | "yes" | "no";

  let contacts: Awaited<ReturnType<typeof listContacts>>["contacts"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const result = await listContacts(
      { q, status, source, consent },
      { limit: 100, offset: 0 },
    );
    contacts = result.contacts;
    total = result.total;
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Nu am putut încărca contactele. Verifică migrarea Supabase.";
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}
      <ContactsClient
        initialContacts={contacts}
        initialTotal={total}
        initialQuery={{ q, status, source, consent }}
      />
    </div>
  );
}
