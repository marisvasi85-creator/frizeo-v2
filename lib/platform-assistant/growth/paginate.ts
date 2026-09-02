import { supabaseAdmin } from "@/lib/supabase/admin";

const PAGE = 1000;

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Walk PostgREST pages (default 1000-row cap) until exhausted.
 */
export async function paginateTable<T>(
  run: (from: number, to: number) => PromiseLike<QueryResult<T>>,
  maxRows = 40000,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let from = 0;
  while (from < maxRows) {
    const to = Math.min(from + PAGE - 1, maxRows - 1);
    const { data, error } = await run(from, to);
    if (error) return { rows, error: error.message };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { rows, error: null };
}

export async function listAllAuthUsers(): Promise<
  Map<
    string,
    {
      email: string | null;
      last_sign_in_at: string | null;
      created_at: string | null;
      full_name: string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      email: string | null;
      last_sign_in_at: string | null;
      created_at: string | null;
      full_name: string | null;
    }
  >();

  for (let page = 1; page <= 30; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error("growth listUsers:", error.message);
      break;
    }
    const users = data.users ?? [];
    for (const user of users) {
      const meta = user.user_metadata as
        | { full_name?: string; name?: string }
        | undefined;
      map.set(user.id, {
        email: user.email ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        created_at: user.created_at ?? null,
        full_name: meta?.full_name || meta?.name || null,
      });
    }
    if (users.length < 1000) break;
  }

  return map;
}
