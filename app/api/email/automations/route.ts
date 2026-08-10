import { NextResponse } from "next/server";
import { assertEmailApiAccess } from "@/lib/frizeo-email/access";
import { listAutomationsWithStats } from "@/lib/frizeo-email/automations";

export async function GET() {
  const auth = await assertEmailApiAccess();
  if (!auth.ok) return auth.response;

  try {
    const automations = await listAutomationsWithStats();
    return NextResponse.json({ automations });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nu am putut încărca automations.",
      },
      { status: 500 },
    );
  }
}
