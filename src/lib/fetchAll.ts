// Supabase caps every query at 1000 rows by default — harmless with test
// data, silently wrong with the real dataset (1968 customers, ~6000
// policies). Pages that genuinely need the full result set page through it
// in 1000-row chunks with this helper.
export async function fetchAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
