"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clearMustChangePassword(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Uses the service-role client because profiles has no client-writable
  // update policy — flipping this flag is only ever done server-side,
  // scoped to the caller's own verified session id (never a client-supplied id).
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}
