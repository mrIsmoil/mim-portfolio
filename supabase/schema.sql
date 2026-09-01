-- ============================================
-- MIM Portfolio — Supabase schema
-- Run once in Supabase Studio → SQL Editor → New query → Run.
-- Safe to re-run: every object is guarded (IF NOT EXISTS / DROP ... IF EXISTS).
-- ============================================

-- ─── projects ───
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title_en            text not null,
  title_uz            text not null,
  summary_en          text,
  summary_uz          text,
  description_en      text,
  description_uz      text,
  tech_tags           text[] not null default '{}',
  category            text,
  cover_image_url     text,
  gallery_image_urls  text[] not null default '{}',
  live_url            text,
  code_url            text,
  featured            boolean not null default false,
  is_published        boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── skills ───
create table if not exists public.skills (
  id                uuid primary key default gen_random_uuid(),
  category_en       text,
  category_uz       text,
  name              text not null,
  proficiency_pct   smallint not null check (proficiency_pct between 0 and 100),
  note_en           text,
  note_uz           text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── inquiries (contact form + hire-me form share one table) ───
create table if not exists public.inquiries (
  id                     uuid primary key default gen_random_uuid(),
  type                   text not null check (type in ('contact','hire')),
  name                   text not null,
  email                  text,
  message                text not null,
  project_type           text,
  budget                 text,
  timeline               text,
  reference_project_id   uuid references public.projects(id) on delete set null,
  status                 text not null default 'new' check (status in ('new','replied','won','archived')),
  created_at             timestamptz not null default now()
);

-- ─── site_settings (single row) ───
create table if not exists public.site_settings (
  id                   smallint primary key default 1 check (id = 1),
  bio_en               text,
  bio_uz               text,
  available_for_work   boolean not null default true,
  updated_at           timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- keep updated_at fresh on every UPDATE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_skills_updated_at on public.skills;
create trigger trg_skills_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.site_settings;
create trigger trg_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();


-- ============================================
-- Row Level Security
-- Single-owner site: any authenticated Supabase session IS the admin
-- (only the owner ever holds valid login credentials).
-- ============================================

alter table public.projects      enable row level security;
alter table public.skills        enable row level security;
alter table public.inquiries     enable row level security;
alter table public.site_settings enable row level security;

-- projects: public reads published rows only; owner has full control
drop policy if exists "public read published projects" on public.projects;
create policy "public read published projects" on public.projects
  for select to anon using (is_published = true);

drop policy if exists "owner full access projects" on public.projects;
create policy "owner full access projects" on public.projects
  for all to authenticated using (true) with check (true);

-- skills: public reads everything; owner has full control
drop policy if exists "public read skills" on public.skills;
create policy "public read skills" on public.skills
  for select to anon using (true);

drop policy if exists "owner full access skills" on public.skills;
create policy "owner full access skills" on public.skills
  for all to authenticated using (true) with check (true);

-- inquiries: public can only INSERT — never read/update/delete, so one
-- visitor's contact details can never be read back by another visitor.
-- Owner can read/update/delete for the admin inbox.
drop policy if exists "public insert inquiries" on public.inquiries;
create policy "public insert inquiries" on public.inquiries
  for insert to anon with check (true);

drop policy if exists "owner read inquiries" on public.inquiries;
create policy "owner read inquiries" on public.inquiries
  for select to authenticated using (true);

drop policy if exists "owner update inquiries" on public.inquiries;
create policy "owner update inquiries" on public.inquiries
  for update to authenticated using (true) with check (true);

drop policy if exists "owner delete inquiries" on public.inquiries;
create policy "owner delete inquiries" on public.inquiries
  for delete to authenticated using (true);

-- site_settings: public reads the single row; owner can update it
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings
  for select to anon using (true);

drop policy if exists "owner update settings" on public.site_settings;
create policy "owner update settings" on public.site_settings
  for update to authenticated using (true) with check (true);


-- ============================================
-- Storage — project screenshots
-- ============================================
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

drop policy if exists "public read project-images" on storage.objects;
create policy "public read project-images" on storage.objects
  for select to anon using (bucket_id = 'project-images');

drop policy if exists "owner write project-images" on storage.objects;
create policy "owner write project-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-images');

drop policy if exists "owner update project-images" on storage.objects;
create policy "owner update project-images" on storage.objects
  for update to authenticated using (bucket_id = 'project-images');

drop policy if exists "owner delete project-images" on storage.objects;
create policy "owner delete project-images" on storage.objects
  for delete to authenticated using (bucket_id = 'project-images');
