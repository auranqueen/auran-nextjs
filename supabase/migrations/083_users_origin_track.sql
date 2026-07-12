-- 083_users_origin_track.sql
-- users.origin_track: 가입 시점 1회 고정 (A=브랜드 직거래, B=오렌 자체)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS origin_track TEXT NOT NULL DEFAULT 'B'
  CHECK (origin_track IN ('A', 'B'));

COMMENT ON COLUMN public.users.origin_track IS
  'A=브랜드사 직거래 유입(뱃지구매/커미션 절대 노출 금지), B=오렌지사 자체 유입(뱃지구매 가능). 가입 시점 1회 고정, UPDATE 금지.';

CREATE OR REPLACE FUNCTION public.guard_users_origin_track_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.origin_track IS DISTINCT FROM NEW.origin_track THEN
    RAISE EXCEPTION 'origin_track is immutable after signup (old=%, new=%)', OLD.origin_track, NEW.origin_track;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_users_origin_track_immutable ON public.users;

CREATE TRIGGER trg_guard_users_origin_track_immutable
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_origin_track_immutable();
