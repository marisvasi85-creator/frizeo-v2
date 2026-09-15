import { NextResponse } from "next/server";
import {
  ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
  ACCOUNT_DELETION_PRODUCTION_DB_CODE,
  accountDeletionWritesAllowed,
} from "@/lib/account-deletion/decisions";
import { getSupabaseUrl } from "@/lib/supabase/config";

export function currentSupabaseUrl(hostname?: string | null): string {
  return getSupabaseUrl(hostname);
}

export function accountDeletionWritesAreAllowed(
  hostname?: string | null,
): boolean {
  return accountDeletionWritesAllowed({
    supabaseUrl: currentSupabaseUrl(hostname),
  });
}

export function accountDeletionWriteBlockResponse(
  hostname?: string | null,
): NextResponse | null {
  if (accountDeletionWritesAreAllowed(hostname)) return null;
  return NextResponse.json(
    {
      error: ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
      code: ACCOUNT_DELETION_PRODUCTION_DB_CODE,
    },
    { status: 409 },
  );
}
