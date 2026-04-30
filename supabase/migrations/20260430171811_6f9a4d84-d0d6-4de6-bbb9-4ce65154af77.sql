do $$
begin
  if not exists (select 1 from pg_type where typname = 'homepage_card_type') then
    create type public.homepage_card_type as enum ('benefit', 'promo');
  end if;
end$$;

create table if not exists public.homepage_cards (
  id uuid primary key default gen_random_uuid(),
  card_type public.homepage_card_type not null,
  title text not null,
  description text,
  icon text,
  image_url text,
  link_url text,
  link_label text,
  visual_variant text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_homepage_cards_type_active_order
  on public.homepage_cards (card_type, is_active, sort_order);

alter table public.homepage_cards
  drop constraint if exists homepage_cards_title_len_chk;
alter table public.homepage_cards
  add constraint homepage_cards_title_len_chk
  check (char_length(title) between 1 and 80);

alter table public.homepage_cards
  drop constraint if exists homepage_cards_desc_len_chk;
alter table public.homepage_cards
  add constraint homepage_cards_desc_len_chk
  check (description is null or char_length(description) <= 240);

create or replace function public.touch_homepage_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_homepage_cards_touch on public.homepage_cards;
create trigger trg_homepage_cards_touch
  before update on public.homepage_cards
  for each row execute function public.touch_homepage_cards_updated_at();

alter table public.homepage_cards enable row level security;

drop policy if exists homepage_cards_admin_all on public.homepage_cards;
create policy homepage_cards_admin_all
  on public.homepage_cards
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists homepage_cards_public_read on public.homepage_cards;
create policy homepage_cards_public_read
  on public.homepage_cards
  for select
  using (
    is_active = true
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
  );

create table if not exists public.homepage_featured_categories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  custom_title text,
  custom_description text,
  custom_image_url text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_featured_categories_unique_category unique (category_id)
);

create index if not exists idx_homepage_featured_categories_active_order
  on public.homepage_featured_categories (is_active, sort_order);

create or replace function public.touch_homepage_featured_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_homepage_featured_categories_touch on public.homepage_featured_categories;
create trigger trg_homepage_featured_categories_touch
  before update on public.homepage_featured_categories
  for each row execute function public.touch_homepage_featured_categories_updated_at();

alter table public.homepage_featured_categories enable row level security;

drop policy if exists homepage_featured_categories_admin_all on public.homepage_featured_categories;
create policy homepage_featured_categories_admin_all
  on public.homepage_featured_categories
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists homepage_featured_categories_public_read on public.homepage_featured_categories;
create policy homepage_featured_categories_public_read
  on public.homepage_featured_categories
  for select
  using (is_active = true);
