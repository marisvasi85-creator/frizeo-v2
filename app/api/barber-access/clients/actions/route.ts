import { NextResponse } from "next/server";
import { requireManagedBarber } from "@/lib/barber-access/authorization";
import { notifyClientAccessApproved } from "@/lib/barber-access/notifications";
import { normalizeRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIONS = [
  "approve",
  "bulk_approve",
  "approve_all_existing",
  "reject",
  "revoke",
  "block",
  "unblock",
  "reopen",
] as const;

type Action = (typeof ACTIONS)[number];

type ClientSeed = {
  phone_normalized: string;
  client_name: string | null;
  client_email: string | null;
};

type CurrentAccess = ClientSeed & {
  id: string;
  referral: string | null;
  request_message: string | null;
  status: string;
  source: string;
  requested_at: string;
  created_by: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const barberId = typeof body?.barberId === "string" ? body.barberId : "";
    const action = body?.action as Action;

    if (!barberId || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Acțiune invalidă." }, { status: 400 });
    }

    const context = await requireManagedBarber(barberId);
    if (context instanceof NextResponse) return context;

    let requestedPhones: string[] = Array.isArray(body?.phones)
      ? body.phones
          .map((phone: unknown) =>
            typeof phone === "string" ? normalizeRomanianPhone(phone) : null,
          )
          .filter((phone: string | null): phone is string => Boolean(phone))
      : [];
    requestedPhones = [...new Set(requestedPhones)].slice(0, 5000);

    let existingClients: ClientSeed[] = [];
    if (action === "bulk_approve" && requestedPhones.length === 0) {
      return NextResponse.json(
        { error: "Selectează cel puțin un client." },
        { status: 400 },
      );
    }

    if (action === "approve_all_existing" || requestedPhones.length > 0) {
      let query = supabaseAdmin
        .from("barber_existing_clients")
        .select("phone_normalized, client_name, client_email")
        .eq("tenant_id", context.auth.tenantId)
        .eq("barber_id", barberId)
        .limit(5000);

      if (action !== "approve_all_existing") {
        query = query.in("phone_normalized", requestedPhones);
      }

      const { data, error } = await query;
      if (error) throw error;
      existingClients = (data ?? []) as ClientSeed[];
      if (action === "approve_all_existing") {
        requestedPhones = existingClients.map(
          (client) => client.phone_normalized,
        );
      }
    }

    if (requestedPhones.length === 0) {
      return NextResponse.json(
        { error: "Nu există clienți valizi pentru această acțiune." },
        { status: 400 },
      );
    }

    const { data: currentRows, error: currentError } = await supabaseAdmin
      .from("barber_client_access")
      .select("*")
      .eq("tenant_id", context.auth.tenantId)
      .eq("barber_id", barberId)
      .in("phone_normalized", requestedPhones);

    if (currentError) throw currentError;

    const currentByPhone = new Map<string, CurrentAccess>(
      ((currentRows ?? []) as CurrentAccess[]).map((row) => [
        row.phone_normalized,
        row,
      ]),
    );
    const existingByPhone = new Map(
      existingClients.map((row) => [row.phone_normalized, row]),
    );

    const now = new Date().toISOString();
    const isApproval = ["approve", "bulk_approve", "approve_all_existing"].includes(
      action,
    );
    const nextStatus = isApproval
      ? "approved"
      : action === "block"
        ? "blocked"
        : action === "reopen"
          ? "pending"
          : "rejected";

    const rows = requestedPhones.map((phone) => {
      const current = currentByPhone.get(phone);
      const existing = existingByPhone.get(phone);

      return {
        tenant_id: context.auth.tenantId,
        barber_id: barberId,
        phone_normalized: phone,
        client_name:
          current?.client_name || existing?.client_name || "Client existent",
        client_email: current?.client_email || existing?.client_email || null,
        referral: current?.referral || null,
        request_message: current?.request_message || null,
        status: nextStatus,
        source:
          current?.source || (existing ? "existing_client" : "manual_admin"),
        decision_source:
          action === "approve_all_existing"
            ? "existing_client"
            : "manual_admin",
        requested_at: current?.requested_at || now,
        decided_at: nextStatus === "pending" ? null : now,
        decided_by: nextStatus === "pending" ? null : context.auth.user.id,
        created_by: current?.created_by || context.auth.user.id,
        updated_by: context.auth.user.id,
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from("barber_client_access")
      .upsert(rows, { onConflict: "barber_id,phone_normalized" });

    if (upsertError) throw upsertError;

    if (isApproval) {
      const newlyApproved = rows.filter(
        (row) => currentByPhone.get(row.phone_normalized)?.status !== "approved",
      );
      await Promise.allSettled(
        newlyApproved.map((row) =>
          notifyClientAccessApproved({
            barberId,
            clientEmail: row.client_email,
            clientName: row.client_name,
          }),
        ),
      );
    }

    return NextResponse.json({
      success: true,
      affected: rows.length,
      status: nextStatus,
    });
  } catch (error) {
    console.error("BARBER ACCESS CLIENT ACTION:", error);
    return NextResponse.json(
      { error: "Nu am putut aplica acțiunea." },
      { status: 500 },
    );
  }
}
