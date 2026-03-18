import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("tenant_id", tenantId, {
    httpOnly: true,
    path: "/",
  });

  return response;
}