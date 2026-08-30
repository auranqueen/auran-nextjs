-- 184: brand_chat_channels + brand_chat_messages (브랜드-원장 1:1 상담) tables + RLS
-- Already applied directly on Supabase; recorded here for repo history.
create table if not exists public.brand_chat_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  unread_by_brand int not null default 0,
  unread_by_owner int not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, owner_id)
);
create index if not exists idx_brand_chat_channels_company on public.brand_chat_channels(company_id, last_message_at desc);
create table if not exists public.brand_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.brand_chat_channels(id) on delete cascade,
  sender_type text not null check (sender_type in ('brand','owner')),
  sender_staff_id uuid,
  message_type text not null default 'text' check (message_type in ('text','image','video')),
  body text,
  attachment_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_chat_messages_channel on public.brand_chat_messages(channel_id, created_at);
alter table public.brand_chat_channels enable row level security;
drop policy if exists "brand_chat_channels_brand_side" on public.brand_chat_channels;
create policy "brand_chat_channels_brand_side" on public.brand_chat_channels for all
using (exists (
  select 1 from public.brands b
  where b.company_id = brand_chat_channels.company_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));
drop policy if exists "brand_chat_channels_owner_side" on public.brand_chat_channels;
create policy "brand_chat_channels_owner_side" on public.brand_chat_channels for all
using (owner_id = current_user_id() or owner_id in (select id from public.users where auth_id = auth.uid()))
with check (owner_id = current_user_id() or owner_id in (select id from public.users where auth_id = auth.uid()));
alter table public.brand_chat_messages enable row level security;
drop policy if exists "brand_chat_messages_access" on public.brand_chat_messages;
create policy "brand_chat_messages_access" on public.brand_chat_messages for all
using (exists (
  select 1 from public.brand_chat_channels ch
  join public.brands b on b.company_id = ch.company_id
  where ch.id = brand_chat_messages.channel_id
    and (
      (b.user_id = current_user_id() or b.user_id = auth.uid())
      or ch.owner_id = current_user_id()
      or ch.owner_id in (select id from public.users where auth_id = auth.uid())
    )
));
