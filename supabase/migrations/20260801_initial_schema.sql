-- 4IN1 / Green Data Development Revolution
-- Apply this file in Supabase SQL Editor (or `supabase db push`) before enabling the live client.

create extension if not exists pgcrypto;

create type public.account_role as enum ('student', 'admin');
create type public.purchase_status as enum ('paid', 'return_claimed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null default 'student',
  register_number text unique,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint register_number_format check (register_number is null or register_number ~ '^[A-Za-z0-9_-]{4,32}$')
);

create table if not exists public.bundle_catalog (
  code text primary key,
  ordinal smallint not null unique check (ordinal between 1 and 4),
  name text not null,
  period_date date not null,
  amount_inr integer not null default 2000 check (amount_inr = 2000),
  return_date date not null,
  return_fee_inr integer not null default 1800 check (return_fee_inr = 1800),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('phonepe', 'card_relay')),
  payment_reference_hash text not null unique,
  bill_email text not null,
  amount_inr integer not null check (amount_inr > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bundle_code text not null references public.bundle_catalog(code),
  transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  amount_inr integer not null check (amount_inr = 2000),
  return_fee_inr integer not null check (return_fee_inr = 1800),
  return_date date not null,
  status public.purchase_status not null default 'paid',
  purchased_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (user_id, bundle_code)
);

create table if not exists public.payment_qr_config (
  provider text primary key check (provider = 'phonepe'),
  storage_path text not null,
  public_url text not null,
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.action_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  context jsonb not null default '{}'::jsonb,
  rating smallint check (rating between 1 and 5),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_status_idx on public.purchases (user_id, status, return_date);
create index if not exists transactions_user_created_idx on public.payment_transactions (user_id, created_at desc);
create index if not exists feedback_user_created_idx on public.action_feedback (user_id, created_at desc);

create or replace function public.set_profile_from_auth()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, register_number, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'register_number', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    register_number = coalesce(excluded.register_number, public.profiles.register_number),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.set_profile_from_auth();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.complete_bundle_purchase(
  p_bundle_codes text[],
  p_method text,
  p_reference_hash text,
  p_email text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_amount integer;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_method not in ('phonepe', 'card_relay') then raise exception 'Unsupported payment method'; end if;
  if coalesce(array_length(p_bundle_codes, 1), 0) = 0 then raise exception 'Select at least one bundle'; end if;
  if exists (select 1 from unnest(p_bundle_codes) code group by code having count(*) > 1) then raise exception 'Duplicate bundle selection'; end if;
  if exists (select 1 from unnest(p_bundle_codes) code left join public.bundle_catalog b on b.code = code where b.code is null or not b.active) then raise exception 'Unknown or unavailable bundle'; end if;
  if exists (select 1 from public.purchases where user_id = auth.uid() and bundle_code = any(p_bundle_codes)) then raise exception 'A selected bundle is already purchased'; end if;

  select count(*), coalesce(sum(amount_inr), 0) into v_count, v_amount
  from public.bundle_catalog where code = any(p_bundle_codes) and active;
  if v_count <> array_length(p_bundle_codes, 1) then raise exception 'Invalid bundle selection'; end if;

  insert into public.payment_transactions (user_id, method, payment_reference_hash, bill_email, amount_inr)
  values (auth.uid(), p_method, p_reference_hash, lower(p_email), v_amount)
  returning id into v_transaction_id;

  insert into public.purchases (user_id, bundle_code, transaction_id, amount_inr, return_fee_inr, return_date)
  select auth.uid(), b.code, v_transaction_id, b.amount_inr, b.return_fee_inr, b.return_date
  from public.bundle_catalog b where b.code = any(p_bundle_codes);

  return jsonb_build_object('transaction_id', v_transaction_id, 'bundle_count', v_count, 'amount_inr', v_amount);
end;
$$;

create or replace function public.claim_bundle_return(p_bundle_code text)
returns public.purchases
language plpgsql security definer set search_path = public
as $$
declare v_purchase public.purchases;
begin
  update public.purchases
  set status = 'return_claimed', claimed_at = now()
  where user_id = auth.uid()
    and bundle_code = p_bundle_code
    and status = 'paid'
    and return_date <= current_date
  returning * into v_purchase;
  if v_purchase.id is null then raise exception 'Return is not available for this bundle yet'; end if;
  return v_purchase;
end;
$$;

create or replace function public.record_action_feedback(
  p_action text,
  p_context jsonb default '{}'::jsonb,
  p_rating smallint default null,
  p_message text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.action_feedback (user_id, action, context, rating, message)
  values (auth.uid(), left(p_action, 120), coalesce(p_context, '{}'::jsonb), p_rating, nullif(left(p_message, 2000), ''))
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.bundle_catalog enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.purchases enable row level security;
alter table public.payment_qr_config enable row level security;
alter table public.action_feedback enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "catalog readable by signed in users" on public.bundle_catalog for select to authenticated using (true);
create policy "admins manage catalog" on public.bundle_catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own transactions" on public.payment_transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "users read own purchases" on public.purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "active payment qr publicly readable" on public.payment_qr_config for select to anon, authenticated using (active = true or public.is_admin());
create policy "admins manage payment qr" on public.payment_qr_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read their feedback" on public.action_feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());

grant execute on function public.complete_bundle_purchase(text[], text, text, text) to authenticated;
grant execute on function public.claim_bundle_return(text) to authenticated;
grant execute on function public.record_action_feedback(text, jsonb, smallint, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "payment qr files are publicly readable" on storage.objects for select to public using (bucket_id = 'payment-qr');
create policy "admins upload payment qr files" on storage.objects for insert to authenticated with check (bucket_id = 'payment-qr' and public.is_admin());
create policy "admins update payment qr files" on storage.objects for update to authenticated using (bucket_id = 'payment-qr' and public.is_admin()) with check (bucket_id = 'payment-qr' and public.is_admin());
create policy "admins delete payment qr files" on storage.objects for delete to authenticated using (bucket_id = 'payment-qr' and public.is_admin());

insert into public.bundle_catalog (code, ordinal, name, period_date, return_date)
values
  ('quadrature', 1, 'Quadrature Neural Foundation', date '2026-07-20', date '2026-08-30'),
  ('canopy', 2, 'Ambient Canopy Systems', date '2026-07-25', date '2026-09-30'),
  ('mycelial', 3, 'Mycelial Data Routing', date '2026-07-25', date '2026-10-30'),
  ('quantum', 4, 'Post-Quantum Architecture', date '2026-07-28', date '2026-11-30')
on conflict (code) do update set
  ordinal = excluded.ordinal, name = excluded.name, period_date = excluded.period_date,
  amount_inr = 2000, return_date = excluded.return_date, return_fee_inr = 1800, active = true;

-- After creating the first administrator in Supabase Auth, promote that account once:
-- update public.profiles set role = 'admin' where email = 'your-admin-email@example.com';
