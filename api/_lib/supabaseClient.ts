import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase client for server-side persistence.
 *
 * Required env vars (set in .env.local):
 *   SUPABASE_URL             – your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to the browser)
 *
 * The client is created lazily on first call and reused for the lifetime of the
 * serverless function instance.  We intentionally do NOT log secrets.
 */

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL environment variable. " +
        "Add it to .env.local (local dev) or Vercel project settings (production)."
    );
  }

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "Add it to .env.local (local dev) or Vercel project settings (production)."
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
