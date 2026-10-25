-- RepairMe production schema
-- Run in the Supabase SQL editor as the project owner, then configure Google OAuth.
-- All monetary amounts are stored in integer minor units (paise for INR).

create extension if not exists pgcrypto;

create type public.repair_role as enum ('customer', 'repair_partner');
create type public.partner_verification as enum ('pending', 'approved', 'rejected', 'action_required');
create type public.repair_request_status as enum ('REQUESTED', 'ACCEPTED', 'INSPECTION', 'QUOTE_PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.repair_role not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  verification_status public.partner_verification,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_status_only_for_partners check ((role = 'repair_partner') = (verification_status is not null))
);

create table public.repair_partner_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  business_name text check (char_length(business_name) <= 160),
  introduction text check (char_length(introduction) <= 1000),
  service_locality text check (char_length(service_locality) <= 160),
  experience_years smallint check (experience_years >= 0 and experience_years <= 80),
  categories text[] not null default '{}',
  brands text[] not null default '{}',
  contact_preferences jsonb not null default '{}'::jsonb,
  working_hours jsonb not null default '{}'::jsonb,
  available_slots jsonb not null default '[]'::jsonb,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 120),
  brand_model text check (char_length(brand_model) <= 160),
  approximate_age text check (char_length(approximate_age) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_requests (
  id text primary key,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  customer_name text,
  partner_id uuid references public.profiles(id) on delete set null,
  partner_name text,
  device_category text not null check (char_length(device_category) between 2 and 120),
  brand_model text,
  device_age text,
  symptoms text not null check (char_length(symptoms) between 8 and 4000),
  locality text,
  photo_name text,
  diagnosis_json jsonb not null,
  estimate_json jsonb not null,
  inspection_notes text,
  appointment_slot text,
  status public.repair_request_status not null default 'REQUESTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.repair_requests(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete restrict,
  labor_amount integer not null check (labor_amount >= 0),
  parts_amount integer not null check (parts_amount >= 0),
  visit_fee integer not null check (visit_fee >= 0),
  total_amount integer not null check (total_amount >= 0),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique(request_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique references public.repair_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  slot_label text not null check (char_length(slot_label) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_status_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.repair_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role public.repair_role,
  status public.repair_request_status not null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index repair_requests_customer_idx on public.repair_requests(customer_id, created_at desc);
create index repair_requests_partner_idx on public.repair_requests(partner_id, created_at desc);
create index repair_events_request_idx on public.repair_status_events(request_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger partner_profiles_updated before update on public.repair_partner_profiles for each row execute function public.touch_updated_at();
create trigger devices_updated before update on public.devices for each row execute function public.touch_updated_at();
create trigger requests_updated before update on public.repair_requests for each row execute function public.touch_updated_at();
create trigger appointments_updated before update on public.appointments for each row execute function public.touch_updated_at();

-- A signed-in user may never change their own account role or verification result.
create or replace function public.protect_profile_identity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role then raise exception 'Account role cannot be changed here'; end if;
  if auth.uid() = old.id and old.verification_status is distinct from new.verification_status then
    raise exception 'Verification status can only be changed by an authorized administrator';
  end if;
  return new;
end; $$;
create trigger protect_profile_identity before update on public.profiles for each row execute function public.protect_profile_identity();

alter table public.profiles enable row level security;
alter table public.repair_partner_profiles enable row level security;
alter table public.devices enable row level security;
alter table public.repair_requests enable row level security;
alter table public.repair_quotes enable row level security;
alter table public.appointments enable row level security;
alter table public.repair_status_events enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (
  auth.uid() = id and role in ('customer', 'repair_partner') and
  ((role = 'customer' and verification_status is null) or (role = 'repair_partner' and verification_status = 'pending'))
);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "partner_profile_own" on public.repair_partner_profiles for all using (auth.uid() = id) with check (auth.uid() = id);
-- The authenticated directory exposes only approved business profiles. Keep contact data in a separate private table if added later.
create policy "partner_profile_directory" on public.repair_partner_profiles for select using (
  exists (select 1 from public.profiles p where p.id = repair_partner_profiles.id and p.verification_status = 'approved')
);

-- A deliberately narrow public directory for authenticated customers. It does not expose private contact preferences.
create view public.repair_partner_directory as
select p.id, p.display_name, rp.business_name, rp.introduction, rp.service_locality,
  rp.experience_years, rp.categories, rp.brands, rp.available_slots
from public.profiles p
join public.repair_partner_profiles rp on rp.id = p.id
where p.role = 'repair_partner' and p.verification_status = 'approved' and rp.is_draft = false;
grant select on public.repair_partner_directory to authenticated;

create policy "devices_owned_by_customer" on public.devices for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
create policy "requests_customer_read" on public.repair_requests for select using (auth.uid() = customer_id);
create policy "requests_partner_read" on public.repair_requests for select using (auth.uid() = partner_id);
-- No direct insert or update policy: request creation and all state changes go through security-definer functions below.
create policy "quotes_visible_to_parties" on public.repair_quotes for select using (
  exists (select 1 from public.repair_requests r where r.id = repair_quotes.request_id and (r.customer_id = auth.uid() or r.partner_id = auth.uid()))
);
create policy "appointments_visible_to_parties" on public.appointments for select using (auth.uid() in (customer_id, partner_id));
create policy "events_visible_to_parties" on public.repair_status_events for select using (
  exists (select 1 from public.repair_requests r where r.id = repair_status_events.request_id and (r.customer_id = auth.uid() or r.partner_id = auth.uid()))
);

create or replace function public.create_repair_request(p_request jsonb)
returns public.repair_requests language plpgsql security definer set search_path = public as $$
declare
  request_row public.repair_requests;
  partner_uuid uuid;
  partner_display text;
  selected_slot text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Only a customer profile can create a repair request';
  end if;
  if coalesce(length(p_request->>'symptoms'), 0) < 12 then raise exception 'More symptom detail is required'; end if;
  if coalesce(length(p_request->>'deviceCategory'),0) < 2 then
    raise exception 'Valid appliance or device name required';
  end if;
  if nullif(p_request->>'partnerId','') is not null then
    partner_uuid := (p_request->>'partnerId')::uuid;
    select display_name into partner_display from public.profiles where id = partner_uuid and role = 'repair_partner' and verification_status = 'approved';
    if partner_display is null then
      raise exception 'Selected Repair Partner is not available';
    end if;
  end if;
  selected_slot := nullif(left(coalesce(p_request->>'appointment',''),160),'');
  if partner_uuid is null and selected_slot is not null then raise exception 'An appointment needs a selected Repair Partner'; end if;

  insert into public.repair_requests(id, customer_id, customer_name, partner_id, partner_name, device_category, brand_model, device_age, symptoms, locality, photo_name, diagnosis_json, estimate_json, appointment_slot, status)
  values (
    left(coalesce(nullif(p_request->>'id',''), encode(gen_random_bytes(12), 'hex')), 80), auth.uid(), left(coalesce(p_request->>'customerName','Customer'),120),
    partner_uuid, partner_display, p_request->>'deviceCategory', left(coalesce(p_request->>'brandModel',''),160),
    left(coalesce(p_request->>'deviceAge',''),80), p_request->>'symptoms', left(coalesce(p_request->>'locality',''),160), left(coalesce(p_request->>'photoName',''),220),
    coalesce(p_request->'diagnosis','{}'::jsonb), coalesce(p_request->'estimate','{}'::jsonb), selected_slot, 'REQUESTED'
  ) returning * into request_row;
  insert into public.repair_status_events(request_id, actor_id, actor_role, status, note)
    values (request_row.id, auth.uid(), 'customer', 'REQUESTED', 'Repair request created');
  if partner_uuid is not null and selected_slot is not null then
    insert into public.appointments(request_id, customer_id, partner_id, slot_label) values (request_row.id, auth.uid(), partner_uuid, selected_slot);
  end if;
  return request_row;
end; $$;

create or replace function public.transition_repair_request(
  p_request_id text,
  p_target_status public.repair_request_status,
  p_note text default null,
  p_quote jsonb default null,
  p_inspection_notes text default null
) returns public.repair_requests language plpgsql security definer set search_path = public as $$
declare
  request_row public.repair_requests;
  actor_role public.repair_role;
  permitted boolean := false;
  labor integer; parts integer; visit integer; quote_total integer;
begin
  select * into request_row from public.repair_requests where id = p_request_id for update;
  if not found then raise exception 'Repair request not found'; end if;
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role is null then raise exception 'Authenticated RepairMe profile required'; end if;

  if actor_role = 'customer' and request_row.customer_id = auth.uid() then
    permitted := (request_row.status = 'REQUESTED' and p_target_status = 'CANCELLED')
      or (request_row.status = 'ACCEPTED' and p_target_status = 'CANCELLED')
      or (request_row.status = 'INSPECTION' and p_target_status = 'CANCELLED')
      or (request_row.status = 'QUOTE_PENDING' and p_target_status in ('APPROVED', 'CANCELLED'));
  elsif actor_role = 'repair_partner' and request_row.partner_id = auth.uid() then
    permitted := (request_row.status = 'REQUESTED' and p_target_status in ('ACCEPTED', 'CANCELLED'))
      or (request_row.status = 'ACCEPTED' and p_target_status in ('INSPECTION', 'CANCELLED'))
      or (request_row.status = 'INSPECTION' and p_target_status in ('QUOTE_PENDING', 'CANCELLED'))
      or (request_row.status = 'APPROVED' and p_target_status = 'IN_PROGRESS')
      or (request_row.status = 'IN_PROGRESS' and p_target_status = 'COMPLETED');
  end if;
  if not permitted then raise exception 'Invalid or unauthorized repair request transition'; end if;

  if p_target_status = 'QUOTE_PENDING' then
    if p_quote is null then raise exception 'An itemized quote is required'; end if;
    labor := (p_quote->>'labor')::integer; parts := (p_quote->>'parts')::integer; visit := (p_quote->>'visit')::integer; quote_total := (p_quote->>'total')::integer;
    if labor < 0 or parts < 0 or visit < 0 or quote_total <> labor + parts + visit then raise exception 'Invalid quote amounts'; end if;
    insert into public.repair_quotes(request_id, partner_id, labor_amount, parts_amount, visit_fee, total_amount, note)
      values (p_request_id, auth.uid(), labor, parts, visit, quote_total, left(coalesce(p_quote->>'note',''),1000))
      on conflict (request_id) do update set labor_amount = excluded.labor_amount, parts_amount = excluded.parts_amount, visit_fee = excluded.visit_fee, total_amount = excluded.total_amount, note = excluded.note, created_at = now();
  end if;

  update public.repair_requests set status = p_target_status, inspection_notes = coalesce(p_inspection_notes, inspection_notes) where id = p_request_id returning * into request_row;
  insert into public.repair_status_events(request_id, actor_id, actor_role, status, note) values (p_request_id, auth.uid(), actor_role, p_target_status, left(coalesce(p_note,''),1000));
  return request_row;
end; $$;

revoke all on function public.transition_repair_request(text, public.repair_request_status, text, jsonb, text) from public;
grant execute on function public.transition_repair_request(text, public.repair_request_status, text, jsonb, text) to authenticated;
revoke all on function public.create_repair_request(jsonb) from public;
grant execute on function public.create_repair_request(jsonb) to authenticated;
