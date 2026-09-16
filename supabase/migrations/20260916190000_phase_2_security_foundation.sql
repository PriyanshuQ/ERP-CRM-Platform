-- Phase 2: organizations, memberships, application RBAC, and tenant isolation.
-- Apply this migration only to a Supabase project or local Supabase database.

create extension if not exists "pgcrypto";
create schema if not exists private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default ''
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);
create index if not exists organization_members_role_id_idx
  on public.organization_members (role_id);

insert into public.roles (code, name, description) values
  ('owner', 'Owner', 'Full control over the organization'),
  ('admin', 'Administrator', 'Manage organization settings and members'),
  ('sales_manager', 'Sales Manager', 'Manage sales teams, leads, and customers'),
  ('sales_rep', 'Sales Representative', 'Manage assigned sales work'),
  ('inventory_manager', 'Inventory Manager', 'Manage products and inventory'),
  ('accountant', 'Accountant', 'Manage invoices and payments'),
  ('viewer', 'Viewer', 'Read-only access')
on conflict (code) do nothing;

insert into public.permissions (code, description) values
  ('organization.read', 'View organization details'),
  ('organization.update', 'Update organization details'),
  ('members.read', 'View organization members'),
  ('members.manage', 'Invite, update, and remove organization members'),
  ('customers.read', 'View customers'),
  ('customers.manage', 'Create and update customers'),
  ('inventory.read', 'View inventory'),
  ('inventory.manage', 'Create and update inventory'),
  ('invoices.read', 'View invoices'),
  ('invoices.manage', 'Create and update invoices'),
  ('analytics.read', 'View analytics')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'owner' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin' and p.code <> 'organization.update' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in
  ('organization.read', 'members.read', 'customers.read', 'customers.manage', 'analytics.read')
where r.code = 'sales_manager' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in
  ('organization.read', 'customers.read', 'customers.manage')
where r.code = 'sales_rep' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in
  ('organization.read', 'inventory.read', 'inventory.manage')
where r.code = 'inventory_manager' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in
  ('organization.read', 'invoices.read', 'invoices.manage')
where r.code = 'accountant' on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in
  ('organization.read', 'customers.read', 'inventory.read', 'invoices.read', 'analytics.read')
where r.code = 'viewer' on conflict do nothing;

-- These private helpers avoid recursive RLS checks on organization_members.
create or replace function private.is_org_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_permission(target_organization_id uuid, required_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid()) and p.code = required_permission
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_permission(uuid, text) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_permission(uuid, text) to authenticated;

-- The only privileged public function is narrowly scoped and requires a signed-in user.
create or replace function public.create_organization(organization_name text, organization_slug text)
returns public.organizations language plpgsql security definer set search_path = ''
as $$
declare
  created_organization public.organizations;
  owner_role_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, slug, owner_id)
  values (trim(organization_name), lower(trim(organization_slug)), (select auth.uid()))
  returning * into created_organization;
  select id into owner_role_id from public.roles where code = 'owner';
  insert into public.organization_members (organization_id, user_id, role_id)
  values (created_organization.id, (select auth.uid()), owner_role_id);
  return created_organization;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_members enable row level security;

revoke all on public.organizations, public.roles, public.permissions,
  public.role_permissions, public.organization_members from anon;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update, delete on public.organizations, public.organization_members to authenticated;

create policy "members can read their organizations" on public.organizations
for select to authenticated using ((select private.is_org_member(id)));

create policy "authenticated users can create organizations" on public.organizations
for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy "organization admins can update organizations" on public.organizations
for update to authenticated
using ((select private.has_org_permission(id, 'organization.update')))
with check ((select private.has_org_permission(id, 'organization.update')));

create policy "organization owners can delete organizations" on public.organizations
for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "authenticated users can read roles" on public.roles
for select to authenticated using (true);
create policy "authenticated users can read permissions" on public.permissions
for select to authenticated using (true);
create policy "authenticated users can read role permissions" on public.role_permissions
for select to authenticated using (true);

create policy "members can read organization members" on public.organization_members
for select to authenticated using ((select private.is_org_member(organization_id)));

create policy "authorized users can add organization members" on public.organization_members
for insert to authenticated
with check ((select private.has_org_permission(organization_id, 'members.manage')));

create policy "authorized users can update organization members" on public.organization_members
for update to authenticated
using ((select private.has_org_permission(organization_id, 'members.manage')))
with check ((select private.has_org_permission(organization_id, 'members.manage')));

create policy "authorized users can remove organization members" on public.organization_members
for delete to authenticated
using ((select private.has_org_permission(organization_id, 'members.manage')));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
