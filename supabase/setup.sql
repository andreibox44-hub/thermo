-- Личный кабинет: профили покупателей и история заказов.
-- Выполнить один раз в панели Supabase: SQL Editor → New query → вставить весь файл → Run.
--
-- Сколько людей зарегистрировалось — в панели: Authentication → Users,
-- или запросом: select count(*) from auth.users;

-- ---------- Профили ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  city text not null default '',
  address text not null default '',
  country text not null default 'RO'     -- код страны (ISO), список — assets/js/countries.js
    constraint profiles_country_code check (country ~ '^[A-Z]{2}$'),
  region text not null default '',       -- регион: уезд (județ), провинция, область…
  postal_code text not null default '',
  favorites text[] not null default '{}' -- избранные товары (id из products.js)
    constraint profiles_favorites_limit check (coalesce(array_length(favorites, 1), 0) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Каждый видит и меняет только свой профиль
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Профиль создаётся сам при регистрации; имя берётся из формы регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

-- Срабатывает только как триггер; вызывать через API не нужно
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Заказы ----------

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  -- После удаления аккаунта заказ остаётся (бухгалтерский учёт), но без привязки к аккаунту
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  items jsonb not null,                -- [{ "id": "pkn-1", "qty": 2, "price": 0 }]
  name text not null,
  phone text not null,
  email text,
  country text not null default 'RO'
    constraint orders_country_code check (country ~ '^[A-Z]{2}$'),
  region text,
  postal_code text,
  city text not null,
  address text not null,
  comment text,
  payment text not null check (payment in ('card', 'cash')),
  status text not null default 'new',  -- new, processing, shipped, done, cancelled
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Покупатель видит свои заказы и может создать новый; менять статус — только из панели
create policy "orders: read own" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "orders: create own" on public.orders
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'new');

-- ---------- Удаление аккаунта (право на удаление по GDPR) ----------

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ---------- Обновление уже созданной базы (2026-10-25) ----------
-- Если база создана по старой версии файла: адрес доставки (уезд, индекс) и избранное.
alter table public.profiles
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists favorites text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_favorites_limit;
alter table public.profiles
  add constraint profiles_favorites_limit check (coalesce(array_length(favorites, 1), 0) <= 100);

-- ---------- Обновление (2026-10-25): адрес под разные страны ----------
-- Если в базе ещё есть столбец county — переименовать: alter table public.profiles rename column county to region;
alter table public.profiles
  add column if not exists country text not null default 'RO';
alter table public.orders
  add column if not exists country text not null default 'RO',
  add column if not exists region text,
  add column if not exists postal_code text;
