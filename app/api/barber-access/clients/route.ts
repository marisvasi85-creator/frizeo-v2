import { NextResponse } from "next/server";
import { requireManagedBarber } from "@/lib/barber-access/authorization";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ExistingClient = {
  tenant_id: string;
  barber_id: string;
  phone_normalized: string;
  client_name: string | null;
  client_email: string | null;
  appointment_count: number;
  last_appointment: string | null;
  cancellation_count: number;
  no_show_count: number;
};

type AccessClient = {
  id: string;
  phone_normalized: string;
  client_name: string;
  client_email: string | null;
  referral: string | null;
  request_message: string | null;
  status: "pending" | "approved" | "rejected" | "blocked";
  source: string;
  requested_at: string;
  decided_at: string | null;
  updated_at: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const barberId = url.searchParams.get("barberId") ?? "";
    const statusFilter = url.searchParams.get("status") ?? "all";
    const search = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    if (!barberId) {
      return NextResponse.json({ error: "Lipsește frizerul." }, { status: 400 });
    }

    const context = await requireManagedBarber(barberId);
    if (context instanceof NextResponse) return context;

    const [{ data: existing, error: existingError }, { data: access, error: accessError }] =
      await Promise.all([
        supabaseAdmin
          .from("barber_existing_clients")
          .select("*")
          .eq("tenant_id", context.auth.tenantId)
          .eq("barber_id", barberId)
          .limit(5000),
        supabaseAdmin
          .from("barber_client_access")
          .select(
            "id, phone_normalized, client_name, client_email, referral, request_message, status, source, requested_at, decided_at, updated_at",
          )
          .eq("tenant_id", context.auth.tenantId)
          .eq("barber_id", barberId)
          .limit(5000),
      ]);

    if (existingError) throw existingError;
    if (accessError) throw accessError;

    const rows = new Map<string, ExistingClient & { access: AccessClient | null }>();

    for (const client of (existing ?? []) as ExistingClient[]) {
      rows.set(client.phone_normalized, { ...client, access: null });
    }

    for (const relation of (access ?? []) as AccessClient[]) {
      const current = rows.get(relation.phone_normalized);
      rows.set(relation.phone_normalized, {
        tenant_id: context.auth.tenantId,
        barber_id: barberId,
        phone_normalized: relation.phone_normalized,
        client_name: relation.client_name || current?.client_name || null,
        client_email: relation.client_email || current?.client_email || null,
        appointment_count: current?.appointment_count ?? 0,
        last_appointment: current?.last_appointment ?? null,
        cancellation_count: current?.cancellation_count ?? 0,
        no_show_count: current?.no_show_count ?? 0,
        access: relation,
      });
    }

    const merged = [...rows.values()]
      .filter((row) => {
        if (statusFilter === "existing") return row.appointment_count > 0;
        if (statusFilter !== "all") return row.access?.status === statusFilter;
        return true;
      })
      .filter((row) => {
        if (!search) return true;
        return `${row.client_name ?? ""} ${row.client_email ?? ""} ${row.phone_normalized}`
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => {
        if (a.access?.status === "pending" && b.access?.status !== "pending") return -1;
        if (b.access?.status === "pending" && a.access?.status !== "pending") return 1;
        return (b.access?.updated_at ?? b.last_appointment ?? "").localeCompare(
          a.access?.updated_at ?? a.last_appointment ?? "",
        );
      });

    const statusCounts = (access ?? []).reduce<Record<string, number>>(
      (counts, row) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        return counts;
      },
      { pending: 0, approved: 0, rejected: 0, blocked: 0 },
    );

    return NextResponse.json({
      clients: merged,
      totalExisting: (existing ?? []).length,
      statusCounts,
    });
  } catch (error) {
    console.error("BARBER ACCESS CLIENTS GET:", error);
    return NextResponse.json(
      { error: "Nu am putut încărca lista de clienți." },
      { status: 500 },
    );
  }
}
