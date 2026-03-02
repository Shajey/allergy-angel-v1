/**
 * Phase 16 – Delete profile (cannot delete last remaining)
 */

import { getSupabaseClient } from "../supabaseClient.js";

export async function deleteProfile(id: string): Promise<void> {
  if (!id) {
    throw new Error("Missing required field: id");
  }

  const supabase = getSupabaseClient();
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Profile count failed: ${countError.message}`);
  }

  if (count !== null && count <= 1) {
    throw new Error("Cannot delete the last profile");
  }

  const { error } = await supabase.from("profiles").delete().eq("id", id);

  if (error) {
    throw new Error(`Profile delete failed: ${error.message}`);
  }
}
