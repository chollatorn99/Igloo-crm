// Shared renewal-supersession logic.
//
// A policy is "superseded" (already renewed) when the same customer has a
// newer-term policy of the SAME category — i.e. its coverage_end_date is older
// than the latest coverage_end_date in its (customer, category) group. Mirrors
// the "one reminder per customer+category, newest wins" rule the reminder page
// (/renewals) already applies, so the renewal-due drill-down and the dashboard
// renewal-rate hide/exclude old terms that have already been renewed as a new
// policy instead of via the explicit "ต่ออายุ" button.
//
// Pass ALL of each relevant customer's win/non-endorsement terms (not just the
// ones inside a date window), or a later term that falls outside the window
// won't be seen and the old one won't be recognised as renewed.
export type RenewalTerm = {
  id: string;
  customer_id: string | null;
  category_id: string | null;
  coverage_end_date: string | null;
};

export function supersededPolicyIds(terms: RenewalTerm[]): Set<string> {
  const maxEnd = new Map<string, string>();
  for (const t of terms) {
    if (!t.customer_id || !t.coverage_end_date) continue;
    const key = `${t.customer_id}|${t.category_id ?? ""}`;
    const cur = maxEnd.get(key);
    if (!cur || t.coverage_end_date > cur) maxEnd.set(key, t.coverage_end_date);
  }
  const superseded = new Set<string>();
  for (const t of terms) {
    if (!t.customer_id || !t.coverage_end_date) continue;
    const key = `${t.customer_id}|${t.category_id ?? ""}`;
    const latest = maxEnd.get(key);
    if (latest && t.coverage_end_date < latest) superseded.add(t.id);
  }
  return superseded;
}
