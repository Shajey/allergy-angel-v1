/**
 * Phase 16 – List all profiles
 */

import { getSupabaseClient } from "../supabaseClient.js";

export interface ProfileRow {
  id: string;
  display_name: string;
  known_allergies: string[];
  current_medications: unknown[];
  supplements: string[];
  is_primary?: boolean;
  created_at: string;
  updated_at?: string;
}

export async function getProfiles(): Promise<ProfileRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Profiles query failed: ${error.message}`);
  }
  return (data ?? []) as ProfileRow[];
}
