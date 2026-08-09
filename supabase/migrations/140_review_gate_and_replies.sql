-- 리뷰게이트(booking완료건만) + 원장답글. DB는 이미 반영됨 — 레포 기록용
alter table public.reviews
  add column if not exists booking_id uuid references public.bookings(id),
  add column if not exists owner_reply text,
  add column if not exists replied_at timestamptz;
create unique index if not exists uq_reviews_booking_id
  on public.reviews(booking_id) where booking_id is not null;
create index if not exists idx_reviews_target_id on public.reviews(target_id);
drop policy if exists own_insert_reviews on public.reviews;
create policy own_insert_reviews on public.reviews
  for insert with check (
    auth.uid() = (select users.auth_id from users where users.id = reviews.author_id)
    and (
      booking_id is null
      or exists (
        select 1 from public.bookings b
        where b.id = reviews.booking_id
          and b.customer_id = (select id from users where auth_id = auth.uid())
          and b.status = 'completed'
      )
    )
  );
drop policy if exists owner_reply_reviews on public.reviews;
create policy owner_reply_reviews on public.reviews
  for update using (
    target_id in (select id from salons where owner_id = (select id from users where auth_id = auth.uid()))
  ) with check (
    target_id in (select id from salons where owner_id = (select id from users where auth_id = auth.uid()))
  );
create or replace function public.restrict_review_reply_update()
returns trigger as $$
begin
  if (new.rating is distinct from old.rating
      or new.content is distinct from old.content
      or new.status is distinct from old.status
      or new.author_id is distinct from old.author_id)
     and auth.uid() is distinct from (select auth_id from users where id = old.author_id)
  then
    raise exception 'salon owner can only update owner_reply/replied_at';
  end if;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists trg_restrict_review_reply on public.reviews;
create trigger trg_restrict_review_reply
  before update on public.reviews
  for each row execute function public.restrict_review_reply_update();
