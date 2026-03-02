/**
 * Phase 16 – Update profile metadata (display_name, is_primary)
 */

import { getSupabaseClient } from "../supabaseClient.js";

export interface UpdateProfileInput {
  id: string;
  display_name?: string;
  is_primary?: boolean;
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

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileRow> {
  const { id, display_name, is_primary } = input;
  if (!id) {
    throw new Error("Missing required field: id");
  }

  const supabase = getSupabaseClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (display_name !== undefined) {
    updates.display_name = display_name.trim();
  }

  if (is_primary === true) {
    await supabase
      .from("profiles")
      .update({ is_primary: false })
      .neq("id", id);
    updates.is_primary = true;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Profile update failed: ${error.message}`);
  }
  return data as ProfileRow;
}
