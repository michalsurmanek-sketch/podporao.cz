-- Podporao: new Supabase foundation (non-destructive).
-- Run after reviewing existing Cloudflare D1 data and migration mapping.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 bio text not null default '',
 website text not null default '',
 ico text not null default '',
 avatar_url text not null default '',
 role text not null default 'user' check (role in ('user','admin','moderator')),
 blocked boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 slug text not null unique,
 title text not null,
 category text not null default 'technologie',
 summary text not null default '',
 description text not null default '',
 purpose text not null default '',
 website text not null default '',
 image_url text not null default '',
 gallery jsonb not null default '[]'::jsonb,
 recipient text not null default '',
 bank_account text not null default '',
 variable_symbol text not null default '',
 status text not null default 'draft' check (status in ('draft','pending','changes','published','rejected','paused','archived')),
 featured boolean not null default false,
 payment_enabled boolean not null default false,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_public_idx on public.projects(status,published_at desc);
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
create policy "Profiles public safe fields read" on public.profiles for select to anon,authenticated using (not blocked);
create policy "Profiles own read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Profiles own insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()) and role='user' and blocked=false);
-- Role/blocked changes must be made only by trusted backend. No direct profile update policy.
create policy "Published projects read" on public.projects for select to anon,authenticated using (status='published' and published_at is not null and exists (select 1 from public.profiles p where p.id=owner_id and not p.blocked));
create policy "Own projects read" on public.projects for select to authenticated using (owner_id=(select auth.uid()));
-- Project writes are routed through authenticated backend for moderation and field restrictions.
