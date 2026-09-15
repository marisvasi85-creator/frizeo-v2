import { NextResponse } from "next/server";
import {
  ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
  ACCOUNT_DELETION_PRODUCTION_DB_CODE,
  accountDeletionWritesAllowed,
} from "@/lib/account-deletion/decisions";

export function currentSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

export function accountDeletionWritesAreAllowed(): boolean {
  return accountDeletionWritesAllowed({
    supabaseUrl: currentSupabaseUrl(),
  });
}

export function accountDeletionWriteBlockResponse(): NextResponse | null {
  if (accountDeletionWritesAreAllowed()) return null;
  return NextResponse.json(
    {
      error: ACCOUNT_DELETION_PRODUCTION_BLOCK_MESSAGE,
      code: ACCOUNT_DELETION_PRODUCTION_DB_CODE,
    },
    { status: 409 },
  );
}
