const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL = process.env.SUPABASE_URL;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let sum = 0;
let withPremium = 0;
let total = 0;
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(`${URL}/rest/v1/policies?select=net_premium&offset=${offset}&limit=1000`, { headers: H });
  const rows = await res.json();
  total += rows.length;
  for (const r of rows) {
    if (r.net_premium != null) {
      sum += Number(r.net_premium);
      withPremium++;
    }
  }
  if (rows.length < 1000) break;
}
console.log(`policies: ${total}, with premium: ${withPremium}, premium sum: ${sum.toFixed(2)}`);
console.log(`source file premium sum: 181080580.52 -> match: ${Math.abs(sum - 181080580.52) < 1}`);
