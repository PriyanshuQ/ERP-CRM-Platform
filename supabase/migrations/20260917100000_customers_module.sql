-- Phase 3: organization-scoped customer management.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  company text not null default '',
  email text not null default '' check (email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text not null default '',
  status text not null default 'lead' check (status in ('lead', 'active', 'inactive')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_organization_created_at_idx
  on public.customers (organization_id, created_at desc);
create index if not exists customers_organization_status_idx
  on public.customers (organization_id, status);
create index if not exists customers_organization_name_idx
  on public.customers (organization_id, lower(name));

alter table public.customers enable row level security;
revoke all on public.customers from anon;
grant select, insert, update, delete on public.customers to authenticated;

create policy "members can read organization customers" on public.customers
for select to authenticated
using ((select private.is_org_member(organization_id)));

create policy "sales users can create customers" on public.customers
for insert to authenticated
with check (
  (select private.has_org_permission(organization_id, 'customers.manage'))
  and (select auth.uid()) = created_by
);

create policy "sales users can update customers" on public.customers
for update to authenticated
using ((select private.has_org_permission(organization_id, 'customers.manage')))
with check ((select private.has_org_permission(organization_id, 'customers.manage')));

create policy "sales users can delete customers" on public.customers
for delete to authenticated
using ((select private.has_org_permission(organization_id, 'customers.manage')));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
