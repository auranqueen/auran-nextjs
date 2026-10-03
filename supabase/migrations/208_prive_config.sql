-- 홈 ORÆN PRIVÉ 배너 설정 (항상 1행)
create table if not exists public.prive_config (
  id          int primary key default 1 check (id = 1),
  title       text not null default 'PRIVÉ Collection',
  subtitle    text,
  image_url   text,   -- 우측 이미지 (권장 220×192px, 2x 기준)
  video_url   text,   -- mp4 영상 (▶ 버튼 클릭 시 재생)
  link_url    text default '/membership/checkout',
  updated_at  timestamptz default now()
);

insert into public.prive_config (id, title, subtitle)
values (1, 'PRIVÉ Collection', '오렌 프라이빗 큐레이션')
on conflict (id) do nothing;

alter table public.prive_config enable row level security;

drop policy if exists "prive_read" on public.prive_config;
create policy "prive_read" on public.prive_config for select using (true);

drop policy if exists "prive_admin_write" on public.prive_config;
create policy "prive_admin_write" on public.prive_config for all
  using (exists (select 1 from public.users where auth_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where auth_id = auth.uid() and role = 'admin'));
