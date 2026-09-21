-- Final MVP phase: inventory, invoicing, activities, AI jobs, and audit logs.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text not null default '',
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  location text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.inventory_levels (
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  updated_at timestamptz not null default now(),
  primary key (product_id, warehouse_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt', 'sale', 'adjustment', 'transfer')),
  quantity integer not null check (quantity > 0),
  reference text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) generated always as (subtotal + tax) stored,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  activity_type text not null check (activity_type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null check (char_length(trim(subject)) between 2 and 200),
  notes text not null default '',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  generation_type text not null check (generation_type in ('sales_email', 'business_insight')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  model text not null default '',
  prompt_version text not null default 'v1',
  idempotency_key text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, idempotency_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists products_org_name_idx on public.products (organization_id, lower(name));
create index if not exists warehouses_org_idx on public.warehouses (organization_id);
create index if not exists stock_movements_org_created_idx on public.stock_movements (organization_id, created_at desc);
create index if not exists invoices_org_status_idx on public.invoices (organization_id, status, due_date);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists activities_org_due_idx on public.activities (organization_id, due_at);
create index if not exists ai_generations_org_created_idx on public.ai_generations (organization_id, created_at desc);
create index if not exists audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.activities enable row level security;
alter table public.ai_generations enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.products, public.warehouses, public.inventory_levels, public.stock_movements,
  public.invoices, public.invoice_items, public.activities, public.ai_generations, public.audit_logs from anon;
grant select, insert, update, delete on public.products, public.warehouses, public.inventory_levels,
  public.stock_movements, public.invoices, public.invoice_items, public.activities, public.ai_generations to authenticated;
grant select on public.audit_logs to authenticated;

create policy "members can read products" on public.products for select to authenticated using (private.is_org_member(organization_id));
create policy "inventory managers can manage products" on public.products for all to authenticated using (private.has_org_permission(organization_id, 'inventory.manage')) with check (private.has_org_permission(organization_id, 'inventory.manage'));
create policy "members can read warehouses" on public.warehouses for select to authenticated using (private.is_org_member(organization_id));
create policy "inventory managers can manage warehouses" on public.warehouses for all to authenticated using (private.has_org_permission(organization_id, 'inventory.manage')) with check (private.has_org_permission(organization_id, 'inventory.manage'));

create policy "members can read inventory" on public.inventory_levels for select to authenticated using (exists (select 1 from public.products p where p.id = product_id and private.is_org_member(p.organization_id)));
create policy "inventory managers can manage inventory" on public.inventory_levels for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and private.has_org_permission(p.organization_id, 'inventory.manage'))) with check (exists (select 1 from public.products p where p.id = product_id and private.has_org_permission(p.organization_id, 'inventory.manage')));
create policy "members can read stock movements" on public.stock_movements for select to authenticated using (private.is_org_member(organization_id));
create policy "inventory managers can create stock movements" on public.stock_movements for insert to authenticated with check (private.has_org_permission(organization_id, 'inventory.manage') and auth.uid() = created_by);

create policy "members can read invoices" on public.invoices for select to authenticated using (private.is_org_member(organization_id));
create policy "accountants can manage invoices" on public.invoices for all to authenticated using (private.has_org_permission(organization_id, 'invoices.manage')) with check (private.has_org_permission(organization_id, 'invoices.manage'));
create policy "members can read invoice items" on public.invoice_items for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and private.is_org_member(i.organization_id)));
create policy "accountants can manage invoice items" on public.invoice_items for all to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and private.has_org_permission(i.organization_id, 'invoices.manage'))) with check (exists (select 1 from public.invoices i where i.id = invoice_id and private.has_org_permission(i.organization_id, 'invoices.manage')));

create policy "members can read activities" on public.activities for select to authenticated using (private.is_org_member(organization_id));
create policy "sales users can manage activities" on public.activities for all to authenticated using (private.has_org_permission(organization_id, 'customers.manage')) with check (private.has_org_permission(organization_id, 'customers.manage'));
create policy "requesters can read ai generations" on public.ai_generations for select to authenticated using (private.is_org_member(organization_id));
create policy "requesters can create ai generations" on public.ai_generations for insert to authenticated with check (private.is_org_member(organization_id) and auth.uid() = requested_by);
create policy "requesters can update ai generations" on public.ai_generations for update to authenticated using (auth.uid() = requested_by) with check (auth.uid() = requested_by);
create policy "members can read audit logs" on public.audit_logs for select to authenticated using (private.is_org_member(organization_id));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
