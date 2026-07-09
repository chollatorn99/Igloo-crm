import { createClient } from "@supabase/supabase-js";

const [email, fullName, role, password] = process.argv.slice(2);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error("AUTH ERROR:", error.message); process.exit(1); }

const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, full_name: fullName, role });
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("PROFILE ERROR:", profileError.message);
  process.exit(1);
}
console.log("OK", data.user.id, email, fullName, role);
