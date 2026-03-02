/**
 * Phase 16 – Create a new profile
 */

import { getSupabaseClient } from "../supabaseClient.js";

export interface CreateProfileInput {
  name: string;
}

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

export async function createProfile(input: CreateProfileInput): Promise<ProfileRow> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error("Missing required field: name");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      display_name: name,
      known_allergies: [],
      current_medications: [],
      supplements: [],
      is_primary: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Profile create failed: ${error.message}`);
  }
  return data as ProfileRow;
}
