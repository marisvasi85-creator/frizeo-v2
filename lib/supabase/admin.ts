import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  canUseServiceRoleAdmin,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";

async function userAccessToken(): Promise<string | null> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function createAdminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  if (canUseServiceRoleAdmin()) {
    return createClient(url, getSupabaseServiceRoleKey());
  }

  const anon = getSupabaseAnonKey();
  return createClient(url, anon, {
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        const token = await userAccessToken();
        headers.set("apikey", anon);
        headers.set("Authorization", `Bearer ${token || anon}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

let cachedAdmin: SupabaseClient | null = null;
let cachedAdminUrl = "";

function adminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  if (!cachedAdmin || cachedAdminUrl !== url) {
    cachedAdmin = createAdminClient();
    cachedAdminUrl = url;
  }
  return cachedAdmin;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = adminClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
