-- 184: brand_chat_channels + brand_chat_messages (브랜드-원장 1:1 상담) tables + RLS
-- Already applied directly on Supabase; recorded here for repo history.

-- 184-1: brand_chat_channels (대화방)
create table if not exists public.brand_chat_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  unread_by_brand integer not null default 0,
  unread_by_owner integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, owner_id)
);
create index if not exists idx_brand_chat_channels_company_last
  on public.brand_chat_channels(company_id, last_message_at desc nulls last);
create index if not exists idx_brand_chat_channels_owner
  on public.brand_chat_channels(owner_id);

-- 184-2: brand_chat_messages (메시지)
create table if not exists public.brand_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.brand_chat_channels(id) on delete cascade,
  sender_type text not null check (sender_type in ('brand', 'owner')),
  sender_staff_id uuid,
  message_type text not null default 'text',
  body text,
  attachment_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_chat_messages_channel_created
  on public.brand_chat_messages(channel_id, created_at asc);

-- 184-3: brand_chat_channels RLS
alter table public.brand_chat_channels enable row level security;
drop policy if exists "brand_chat_channels_brand_access" on public.brand_chat_channels;
create policy "brand_chat_channels_brand_access" on public.brand_chat_channels for all
using (
  exists (
    select 1 from public.brands b
    where b.company_id = brand_chat_channels.company_id
      and (b.user_id = current_user_id() or b.user_id = auth.uid())
  )
  or exists (
    select 1
    from public.brands b
    join public.brand_members bm on bm.brand_id = b.id
    where b.company_id = brand_chat_channels.company_id
      and bm.user_id = current_user_id()
  )
);
drop policy if exists "brand_chat_channels_owner_access" on public.brand_chat_channels;
create policy "brand_chat_channels_owner_access" on public.brand_chat_channels for all
using (owner_id = current_user_id());

-- 184-4: brand_chat_messages RLS
alter table public.brand_chat_messages enable row level security;
drop policy if exists "brand_chat_messages_brand_access" on public.brand_chat_messages;
create policy "brand_chat_messages_brand_access" on public.brand_chat_messages for all
using (
  exists (
    select 1
    from public.brand_chat_channels c
    join public.brands b on b.company_id = c.company_id
    where c.id = brand_chat_messages.channel_id
      and (b.user_id = current_user_id() or b.user_id = auth.uid())
  )
  or exists (
    select 1
    from public.brand_chat_channels c
    join public.brands b on b.company_id = c.company_id
    join public.brand_members bm on bm.brand_id = b.id
    where c.id = brand_chat_messages.channel_id
      and bm.user_id = current_user_id()
  )
);
drop policy if exists "brand_chat_messages_owner_access" on public.brand_chat_messages;
create policy "brand_chat_messages_owner_access" on public.brand_chat_messages for all
using (
  exists (
    select 1 from public.brand_chat_channels c
    where c.id = brand_chat_messages.channel_id
      and c.owner_id = current_user_id()
  )
);