import { NextRequest, NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { importContactsFromCsv } from "@/lib/frizeo-email/csvImport";

export async function POST(req: NextRequest) {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const grantConsent = form.get("grant_consent") === "true";

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Fișierul CSV lipsește." },
          { status: 400 },
        );
      }

      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Fișierul depășește 2MB." },
          { status: 400 },
        );
      }

      const text = await file.text();
      const result = await importContactsFromCsv(text, { grantConsent });
      return NextResponse.json(result);
    }

    const body = await req.json();
    const csv = String(body.csv || "");
    const grantConsent = Boolean(body.grant_consent);
    const result = await importContactsFromCsv(csv, { grantConsent });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import eșuat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
