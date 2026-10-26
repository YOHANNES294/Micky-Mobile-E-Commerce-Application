-- Add network column for Samsung phones
alter table public.phones 
add column if not exists network text;

-- Change price column from numeric/integer to text to support ranges
-- This converts existing values to string format
alter table public.phones 
alter column price type text using price::text;
