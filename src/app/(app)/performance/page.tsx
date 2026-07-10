import { redirect } from "next/navigation";

// The dashboard now lives on the home page ("/"). Keep this route as a
// redirect so old links/bookmarks still work.
export default function PerformanceRedirect() {
  redirect("/");
}
