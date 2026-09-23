-- Separate document-delivery address (envelope) from the general address.
alter table customers add column if not exists shipping_address text;
