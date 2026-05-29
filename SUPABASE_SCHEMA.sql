-- ============================================================
-- ESQUEMA BASE - Cancha Sintética (reservas por hora)
-- ============================================================
-- Ejecuta esto en Supabase -> SQL Editor

-- 1) Profiles (rol por usuario)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- Trigger: crear profile al registrarse (email/password o Google)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, phone, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'full_name',
      new.email
    ),
    new.raw_user_meta_data->>'phone',
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2) Canchas
create table if not exists public.courts (
  id smallint primary key,
  name text not null
);

insert into public.courts (id, name) values
(1, 'Cancha 1'),
(2, 'Cancha 2')
on conflict (id) do nothing;


-- 3) Reglas de precio (por cancha y rango de horas)
create table if not exists public.pricing_rules (
  id bigserial primary key,
  court_id smallint not null references public.courts(id),
  start_hour smallint not null,
  end_hour smallint not null,
  price_cop integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Nota: para reservas por hora, usamos rangos INCLUSIVOS.
-- Mañana: 06..17  (06:00–17:59)
-- Noche:  18..23  (18:00–23:59)
insert into public.pricing_rules (court_id, start_hour, end_hour, price_cop) values
(1, 6, 17, 80000),
(1, 18, 23, 100000),
(2, 6, 17, 80000),
(2, 18, 23, 100000);


-- 4) Reservas
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_by text not null,
  court_id smallint not null references public.courts(id),
  date date not null,
  hour smallint not null check (hour between 6 and 23),
  price_cop integer not null,
  status text not null default 'active' check (status in ('active','cancelled','pending_payment')),
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  attended boolean not null default false,
  attended_at timestamptz,
  -- Pago (anticipo) por Wompi
  deposit_percent smallint,
  deposit_cop integer,
  deposit_status text,
  deposit_payment_reference text,
  deposit_paid boolean not null default false,
  deposit_paid_at timestamptz,
  wompi_transaction_id text,
  created_at timestamptz not null default now()
);

-- Evitar doble reserva (misma cancha+fecha+hora) si está activa
create unique index if not exists reservations_unique_active
on public.reservations (court_id, date, hour)
where status = 'active';


-- ============================================================
-- RLS + POLÍTICAS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.reservations enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.courts enable row level security;

-- Profiles: cada usuario ve su perfil
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
using (id = auth.uid());

-- Profiles: cada usuario puede actualizar su propio perfil (p.ej. teléfono)
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Función para evitar recursión infinita al revisar si es admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles: admin puede ver/editar todos los perfiles
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles"
on public.profiles for select
using (public.is_admin());

drop policy if exists "admin update all profiles" on public.profiles;
create policy "admin update all profiles"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

-- Courts: lectura pública (para mostrar canchas)
drop policy if exists "read courts" on public.courts;
create policy "read courts"
on public.courts for select
using (true);

-- Courts: admin CRUD
drop policy if exists "admin insert courts" on public.courts;
create policy "admin insert courts"
on public.courts for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update courts" on public.courts;
create policy "admin update courts"
on public.courts for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin delete courts" on public.courts;
create policy "admin delete courts"
on public.courts for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Pricing: lectura pública (para calcular precio)
drop policy if exists "read pricing" on public.pricing_rules;
create policy "read pricing"
on public.pricing_rules for select
using (active = true);

-- Pricing: admin CRUD
drop policy if exists "admin insert pricing" on public.pricing_rules;
create policy "admin insert pricing"
on public.pricing_rules for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update pricing" on public.pricing_rules;
create policy "admin update pricing"
on public.pricing_rules for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin delete pricing" on public.pricing_rules;
create policy "admin delete pricing"
on public.pricing_rules for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Reservations: usuarios ven/crean las suyas
drop policy if exists "users read own reservations" on public.reservations;
create policy "users read own reservations"
on public.reservations for select
using (user_id = auth.uid());

drop policy if exists "users insert own reservations" on public.reservations;
create policy "users insert own reservations"
on public.reservations for insert
with check (user_id = auth.uid());

-- Admin: ver todo y actualizar todo (cancelar)
drop policy if exists "admin read all reservations" on public.reservations;
create policy "admin read all reservations"
on public.reservations for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update all reservations" on public.reservations;
create policy "admin update all reservations"
on public.reservations for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- ============================================================
-- INVENTARIO + VENTAS + CUADRE DE CAJA (BEBIDAS / PRODUCTOS)
-- ============================================================

create table if not exists public.products (
  id bigserial primary key,
  name text not null,
  stock_qty integer not null default 0,
  price_cop integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  sold_at timestamptz not null default now(),
  total_cop integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id bigserial primary key,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id bigint not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_price_cop integer not null,
  line_total_cop integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_closings (
  id bigserial primary key,
  date date not null,
  created_by uuid references auth.users(id),
  sales_total_cop integer not null,
  counted_cop integer not null,
  difference_cop integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists cash_closings_unique_date
on public.cash_closings (date);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_closings enable row level security;

-- Products: admin CRUD
drop policy if exists "admin read products" on public.products;
create policy "admin read products"
on public.products for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin insert products" on public.products;
create policy "admin insert products"
on public.products for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update products" on public.products;
create policy "admin update products"
on public.products for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin delete products" on public.products;
create policy "admin delete products"
on public.products for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Sales + items: admin read/insert (las ventas solo las registra el admin)
drop policy if exists "admin read sales" on public.sales;
create policy "admin read sales"
on public.sales for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin insert sales" on public.sales;
create policy "admin insert sales"
on public.sales for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin read sale_items" on public.sale_items;
create policy "admin read sale_items"
on public.sale_items for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin insert sale_items" on public.sale_items;
create policy "admin insert sale_items"
on public.sale_items for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Cash closings: admin read/insert
drop policy if exists "admin read cash_closings" on public.cash_closings;
create policy "admin read cash_closings"
on public.cash_closings for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin insert cash_closings" on public.cash_closings;
create policy "admin insert cash_closings"
on public.cash_closings for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update cash_closings" on public.cash_closings;
create policy "admin update cash_closings"
on public.cash_closings for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Función para registrar una venta de forma atómica (descuenta inventario)
-- items: jsonb = [{ "product_id": 1, "qty": 2 }, ...]
create or replace function public.create_sale(items jsonb)
returns uuid
language plpgsql
security definer
as $$
declare
  is_admin boolean;
  new_sale_id uuid;
  it jsonb;
  pid bigint;
  q integer;
  p_price integer;
  p_stock integer;
  line_total integer;
  total integer := 0;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Solo admin puede registrar ventas';
  end if;

  insert into public.sales(created_by)
  values (auth.uid())
  returning id into new_sale_id;

  for it in select * from jsonb_array_elements(items)
  loop
    pid := (it->>'product_id')::bigint;
    q := (it->>'qty')::integer;

    if q is null or q <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select price_cop, stock_qty into p_price, p_stock
    from public.products
    where id = pid and active = true
    for update;

    if p_price is null then
      raise exception 'Producto no existe o inactivo (%).', pid;
    end if;

    if p_stock < q then
      raise exception 'Stock insuficiente para producto % (stock %, pedido %).', pid, p_stock, q;
    end if;

    update public.products
    set stock_qty = stock_qty - q
    where id = pid;

    line_total := q * p_price;
    total := total + line_total;

    insert into public.sale_items(sale_id, product_id, qty, unit_price_cop, line_total_cop)
    values (new_sale_id, pid, q, p_price, line_total);
  end loop;

  update public.sales
  set total_cop = total
  where id = new_sale_id;

  return new_sale_id;
end;
$$;

-- ============================================================
-- Wompi: configuración + pagos de reservas (anticipo)
-- ============================================================

create table if not exists public.payment_settings (
  id smallint primary key default 1,
  deposit_percent smallint not null default 30 check (deposit_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id, deposit_percent)
values (1, 30)
on conflict (id) do nothing;

create table if not exists public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  reference text not null unique,
  amount_cop integer not null,
  amount_in_cents integer not null,
  status text not null default 'PENDING',
  wompi_transaction_id text,
  wompi_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_settings enable row level security;
alter table public.reservation_payments enable row level security;

-- payment_settings: admin read/update
drop policy if exists "admin read payment_settings" on public.payment_settings;
create policy "admin read payment_settings"
on public.payment_settings for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin insert payment_settings" on public.payment_settings;
create policy "admin insert payment_settings"
on public.payment_settings for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admin update payment_settings" on public.payment_settings;
create policy "admin update payment_settings"
on public.payment_settings for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- reservation_payments: admin read all
drop policy if exists "admin read reservation_payments" on public.reservation_payments;
create policy "admin read reservation_payments"
on public.reservation_payments for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- reservation_payments: user read own (por su reserva)
drop policy if exists "users read own reservation_payments" on public.reservation_payments;
create policy "users read own reservation_payments"
on public.reservation_payments for select
using (
  exists (
    select 1
    from public.reservations r
    where r.id = reservation_id and r.user_id = auth.uid()
  )
);


-- ============================================================
-- FACTURAS (INVOICES)
-- ============================================================

create sequence if not exists public.invoice_number_seq start with 1001;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default 'FAC-' || nextval('public.invoice_number_seq'::regclass)::text,
  reservation_id uuid unique references public.reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_total integer not null,
  amount_paid integer not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'partially_paid', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

-- Invoices: admin CRUD
drop policy if exists "admin read all invoices" on public.invoices;
create policy "admin read all invoices"
on public.invoices for select
using (public.is_admin());

drop policy if exists "admin update all invoices" on public.invoices;
create policy "admin update all invoices"
on public.invoices for update
using (public.is_admin())
with check (public.is_admin());

-- Invoices: user read own
drop policy if exists "users read own invoices" on public.invoices;
create policy "users read own invoices"
on public.invoices for select
using (user_id = auth.uid());

-- Trigger para sincronizar facturas con reservas
create or replace function public.sync_reservation_invoice()
returns trigger as $$
declare
  computed_paid integer := 0;
  computed_status text := 'pending';
begin
  -- Calcular monto pagado y estado
  if new.status = 'cancelled' then
    computed_status := 'cancelled';
  elsif new.deposit_paid = true then
    computed_paid := coalesce(new.deposit_cop, 0);
    if computed_paid >= new.price_cop then
      computed_status := 'paid';
    else
      computed_status := 'partially_paid';
    end if;
  else
    computed_paid := 0;
    computed_status := 'pending';
  end if;

  insert into public.invoices (reservation_id, user_id, amount_total, amount_paid, payment_status)
  values (
    new.id,
    new.user_id,
    new.price_cop,
    computed_paid,
    computed_status
  )
  on conflict (reservation_id) do update
  set
    amount_total = excluded.amount_total,
    amount_paid = excluded.amount_paid,
    payment_status = excluded.payment_status,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_reservation_changed on public.reservations;
create trigger on_reservation_changed
  after insert or update of status, deposit_paid, deposit_cop, price_cop on public.reservations
  for each row execute procedure public.sync_reservation_invoice();

