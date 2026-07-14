import type { SupabaseClient } from "@supabase/supabase-js";

// Best-effort activity logging. Never throws — a logging failure must not
// break the user's actual action. Call from server actions with the same
// (already-authenticated) supabase client the action uses.
export async function logActivity(
  supabase: SupabaseClient,
  entry: { action: string; summary: string; entityId?: string | null; customerId?: string | null },
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      actor_id: user.id,
      action: entry.action,
      summary: entry.summary,
      entity_id: entry.entityId ?? null,
      customer_id: entry.customerId ?? null,
    });
  } catch {
    // swallow — logging is non-critical
  }
}
