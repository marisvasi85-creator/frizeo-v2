import { NextResponse } from "next/server";
import { requireManagedBarber } from "@/lib/barber-access/authorization";
import {
  notifyClientAccessApproved,
  notifyClientAccessApprovedOnce,
} from "@/lib/barber-access/notifications";
import {
  isQuickApprovalSchemaReady,
  markAccessRequestTokensProcessed,
} from "@/lib/barber-access/quickApprovalServer";
import { getAppUrlForRequest } from "@/lib/app/getAppUrl";
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
    const skippedBlocked = isApproval
      ? requestedPhones.filter(
          (phone) => currentByPhone.get(phone)?.status === "blocked",
        ).length
      : 0;
    const actionablePhones = isApproval
      ? requestedPhones.filter(
          (phone) => currentByPhone.get(phone)?.status !== "blocked",
        )
      : requestedPhones;
    const nextStatus = isApproval
      ? "approved"
      : action === "block"
        ? "blocked"
        : action === "reopen"
          ? "pending"
          : "rejected";

    const rows = actionablePhones.map((phone) => {
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

    if (rows.length > 0) {
      if (isApproval) {
        // Insert missing relations without ever overwriting a row that may
        // have become blocked after the read above. The conditional update
        // then re-checks `blocked` in Postgres at write time.
        const { error: insertError } = await supabaseAdmin
          .from("barber_client_access")
          .upsert(rows, {
            onConflict: "barber_id,phone_normalized",
            ignoreDuplicates: true,
          });
        if (insertError) throw insertError;

        const { error: updateError } = await supabaseAdmin
          .from("barber_client_access")
          .update({
            status: "approved",
            decision_source:
              action === "approve_all_existing"
                ? "existing_client"
                : "manual_admin",
            decided_at: now,
            decided_by: context.auth.user.id,
            updated_by: context.auth.user.id,
          })
          .eq("tenant_id", context.auth.tenantId)
          .eq("barber_id", barberId)
          .in("phone_normalized", actionablePhones)
          .neq("status", "blocked");
        if (updateError) throw updateError;
      } else {
        const { error: upsertError } = await supabaseAdmin
          .from("barber_client_access")
          .upsert(rows, { onConflict: "barber_id,phone_normalized" });

        if (upsertError) throw upsertError;
      }
    }

    let affected = rows.length;
    let finalSkippedBlocked = skippedBlocked;

    if (!isApproval && nextStatus !== "pending") {
      const processedRequestIds = actionablePhones
        .map((phone) => currentByPhone.get(phone)?.id)
        .filter((id): id is string => Boolean(id));
      try {
        await markAccessRequestTokensProcessed(processedRequestIds);
      } catch (tokenError) {
        console.error("BARBER ACCESS TOKEN CONSUME:", tokenError);
      }
    }

    if (isApproval) {
      const { data: finalRows, error: finalError } = await supabaseAdmin
        .from("barber_client_access")
        .select("id, phone_normalized, status")
        .eq("tenant_id", context.auth.tenantId)
        .eq("barber_id", barberId)
        .in("phone_normalized", requestedPhones);
      if (finalError) throw finalError;

      const finallyApproved = new Set(
        (finalRows ?? [])
          .filter((row) => row.status === "approved")
          .map((row) => row.phone_normalized),
      );
      finalSkippedBlocked = (finalRows ?? []).filter(
        (row) => row.status === "blocked",
      ).length;
      affected = finallyApproved.size;

      const newlyApproved = rows.filter(
        (row) =>
          finallyApproved.has(row.phone_normalized) &&
          currentByPhone.get(row.phone_normalized)?.status !== "approved",
      );
      const finalByPhone = new Map(
        (finalRows ?? []).map((row) => [row.phone_normalized, row]),
      );
      const newlyApprovedRequestIds = newlyApproved
        .map((row) => finalByPhone.get(row.phone_normalized)?.id)
        .filter((id): id is string => Boolean(id));
      const appUrl = getAppUrlForRequest(req.url);
      try {
        const quickApprovalReady = await isQuickApprovalSchemaReady();

        if (quickApprovalReady) {
          await Promise.allSettled([
            markAccessRequestTokensProcessed(newlyApprovedRequestIds),
            ...newlyApprovedRequestIds.map((requestId) =>
              notifyClientAccessApprovedOnce({ requestId, appUrl }),
            ),
          ]);
        } else {
          await Promise.allSettled(
            newlyApproved.map((row) =>
              notifyClientAccessApproved({
                barberId,
                clientEmail: row.client_email,
                clientName: row.client_name,
                appUrl,
              }),
            ),
          );
        }
      } catch (notificationError) {
        console.error("BARBER ACCESS APPROVAL NOTIFICATION:", notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      affected,
      skippedBlocked: finalSkippedBlocked,
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
