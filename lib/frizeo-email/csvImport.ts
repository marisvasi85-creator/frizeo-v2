import { isValidEmail } from "@/lib/auth/credentials";
import { upsertContactSoft } from "@/lib/frizeo-email/contacts";

export type CsvImportResult = {
  imported: number;
  duplicate: number;
  invalid: number;
  totalRows: number;
  errors: string[];
};

type ParsedRow = {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  marketing_consent?: string;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_");
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  email: "email",
  e_mail: "email",
  mail: "email",
  first_name: "first_name",
  firstname: "first_name",
  prenume: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  nume: "last_name",
  phone: "phone",
  telefon: "phone",
  mobile: "phone",
  marketing_consent: "marketing_consent",
  consent: "marketing_consent",
  acord: "marketing_consent",
};

function parseConsent(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return ["1", "true", "yes", "da", "y", "acord"].includes(v);
}

export function parseContactsCsv(csvText: string): {
  rows: ParsedRow[];
  error?: string;
} {
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return { rows: [], error: "Fișierul CSV este gol." };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      error: "CSV-ul trebuie să aibă header + cel puțin un rând.",
    };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const mapped = headers.map((h) => HEADER_ALIASES[h] ?? null);

  if (!mapped.includes("email")) {
    return {
      rows: [],
      error: "Lipște coloana email (acceptă: email, mail).",
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row: ParsedRow = {};
    mapped.forEach((key, idx) => {
      if (!key) return;
      row[key] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  return { rows };
}

export async function importContactsFromCsv(
  csvText: string,
  options?: { grantConsent?: boolean },
): Promise<CsvImportResult> {
  const parsed = parseContactsCsv(csvText);
  const result: CsvImportResult = {
    imported: 0,
    duplicate: 0,
    invalid: 0,
    totalRows: 0,
    errors: [],
  };

  if (parsed.error) {
    result.errors.push(parsed.error);
    return result;
  }

  result.totalRows = parsed.rows.length;

  // Cap Phase 1 imports to keep a single request safe.
  const maxRows = 2000;
  if (parsed.rows.length > maxRows) {
    result.errors.push(
      `Importul este limitat la ${maxRows} rânduri pe request. Împarte fișierul.`,
    );
    return result;
  }

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const row = parsed.rows[i];
    const email = row.email?.trim() || "";
    if (!email || !isValidEmail(email)) {
      result.invalid += 1;
      if (result.errors.length < 20) {
        result.errors.push(`Rând ${i + 2}: email invalid (${email || "gol"}).`);
      }
      continue;
    }

    const consentFromRow = parseConsent(row.marketing_consent);
    const marketingConsent = options?.grantConsent
      ? true
      : consentFromRow;

    const outcome = await upsertContactSoft({
      email,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      phone: row.phone || null,
      source: "csv",
      marketing_consent: marketingConsent,
      consent_source: marketingConsent ? "csv_import" : null,
    });

    result[outcome] += 1;
  }

  return result;
}
