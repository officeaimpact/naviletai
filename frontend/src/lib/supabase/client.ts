import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  client = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      storageKey: "navylet_auth_token",
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
