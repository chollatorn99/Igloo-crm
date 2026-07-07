-- Lets any authenticated user check whether a phone number already belongs
-- to a customer they can't otherwise see (RLS normally scopes customers to
-- the owner). Returns only enough to resolve the duplicate — never the full
-- customer row — so it doesn't leak cross-tenant data beyond that.
create or replace function check_phone_exists(p_phone text)
returns table (customer_id uuid, customer_name text, owner_name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, p.full_name
  from customers c
  join profiles p on p.id = c.owner_id
  where c.phone = p_phone and p_phone is not null and p_phone <> '';
$$;

revoke all on function check_phone_exists(text) from public;
grant execute on function check_phone_exists(text) to authenticated;
