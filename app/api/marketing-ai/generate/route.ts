import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { buildMarketingContext } from "@/lib/marketing-ai/buildContext";
import { generateMarketingContent } from "@/lib/marketing-ai/generate";
import {
  MARKETING_CONTENT_TYPES,
  type MarketingContentType,
} from "@/lib/marketing-ai/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isMarketingContentType(value: string): value is MarketingContentType {
  return MARKETING_CONTENT_TYPES.includes(value as MarketingContentType);
}

export async function POST(req: Request) {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  let body: {
    contentType?: string;
    barberId?: string;
    serviceId?: string;
    extraNotes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const contentType = body.contentType;
  if (!contentType || !isMarketingContentType(contentType)) {
    return NextResponse.json({ error: "Tip conținut invalid" }, { status: 400 });
  }

  let barberId = body.barberId;

  if (auth.role === "barber") {
    const currentBarberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
    if (!currentBarberId) {
      return NextResponse.json({ error: "Frizer negăsit" }, { status: 403 });
    }
    barberId = currentBarberId;
  }

  if (!barberId) {
    return NextResponse.json({ error: "Alege frizerul" }, { status: 400 });
  }

  const belongs = await barberBelongsToTenant(
    supabaseAdmin,
    barberId,
    auth.tenantId,
  );
  if (!belongs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (contentType === "service_promo" && !body.serviceId) {
    return NextResponse.json(
      { error: "Alege serviciul de promovat" },
      { status: 400 },
    );
  }

  const context = await buildMarketingContext(auth.tenantId, barberId);
  if (!context) {
    return NextResponse.json({ error: "Date salon indisponibile" }, { status: 404 });
  }

  if (body.serviceId) {
    const serviceExists = context.services.some(
      (service) => service.id === body.serviceId,
    );
    if (!serviceExists) {
      return NextResponse.json({ error: "Serviciu invalid" }, { status: 400 });
    }
  }

  try {
    const result = await generateMarketingContent(context, {
      contentType,
      serviceId: body.serviceId,
      extraNotes: body.extraNotes,
    });

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Eroare la generare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
