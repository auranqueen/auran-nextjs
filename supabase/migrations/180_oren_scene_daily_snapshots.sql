-- 180_oren_scene_daily_snapshots.sql
-- Record-only. Daily cumulative metric snapshots for true weekly popularity.
-- Apply in Supabase when ready — do not run from agent.
-- Depends on 165 (oren_scene_posts), 177/178 (VIEW), 179 (get_oren_scene_hub).

CREATE TABLE IF NOT EXISTS public.oren_scene_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_post_id uuid NOT NULL REFERENCES public.oren_scene_posts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  booking_conversion_count integer NOT NULL DEFAULT 0,
  revenue_generated numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oren_scene_daily_stats_post_date_uq UNIQUE (scene_post_id, snapshot_date)
);

COMMENT ON TABLE public.oren_scene_daily_stats IS
  'Daily point-in-time cumulative counters for oren_scene_posts. Weekly popularity = today snap - 7d-ago snap.';

CREATE INDEX IF NOT EXISTS idx_oren_scene_daily_stats_scene_post_id
  ON public.oren_scene_daily_stats (scene_post_id);

CREATE INDEX IF NOT EXISTS idx_oren_scene_daily_stats_snapshot_date
  ON public.oren_scene_daily_stats (snapshot_date);

ALTER TABLE public.oren_scene_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_daily_stats_select_published ON public.oren_scene_daily_stats;
CREATE POLICY oren_scene_daily_stats_select_published
  ON public.oren_scene_daily_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.oren_scene_daily_stats TO anon, authenticated;

-- Replace hub RPC (same signature as 179).
-- - If both today + 7d-ago snaps exist: popularity = weekly delta formula
-- - If only today snap: treat 7d-ago as zeros (first week / new post)
-- - Else: VIEW cumulative (fallback)
-- - When any row exists for (KST today-7): prefer posts with today snap; posts without
--   today snap still use p_days_back created_at window (legacy fallback).
CREATE OR REPLACE FUNCTION public.get_oren_scene_hub(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_content_filter text DEFAULT 'all',
  p_days_back integer DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  salon_id uuid,
  video_url text,
  thumbnail_url text,
  content_type text,
  uploader_type text,
  view_count integer,
  like_count integer,
  popularity_score numeric,
  title text,
  created_at timestamptz,
  salon_name text,
  uploader_name text,
  distance_km double precision,
  distance_bonus numeric,
  sort_score numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH dates AS (
    SELECT
      (timezone('Asia/Seoul', now()))::date AS today_kst,
      ((timezone('Asia/Seoul', now()))::date - 7) AS week_ago_kst
  ),
  weekly_ready AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.oren_scene_daily_stats d
      CROSS JOIN dates dt
      WHERE d.snapshot_date = dt.week_ago_kst
    ) AS ready
  ),
  base AS (
    SELECT
      p.id,
      p.salon_id,
      p.video_url,
      p.thumbnail_url,
      p.content_type,
      p.uploader_type,
      p.view_count,
      p.like_count,
      p.popularity_score AS cumulative_score,
      p.title,
      p.created_at,
      s.name AS salon_name,
      u.name AS uploader_name,
      s.lat AS salon_lat,
      s.lng AS salon_lng,
      t.scene_post_id AS has_today_snap,
      t.like_count AS snap_today_likes,
      t.view_count AS snap_today_views,
      t.booking_conversion_count AS snap_today_conv,
      t.revenue_generated AS snap_today_rev,
      w.scene_post_id AS has_week_snap,
      w.like_count AS snap_week_likes,
      w.view_count AS snap_week_views,
      w.booking_conversion_count AS snap_week_conv,
      w.revenue_generated AS snap_week_rev,
      wr.ready AS weekly_ready
    FROM public.oren_scene_posts_with_popularity p
    CROSS JOIN dates dt
    CROSS JOIN weekly_ready wr
    LEFT JOIN public.salons s ON s.id = p.salon_id
    LEFT JOIN public.users u ON u.id = p.uploader_user_id
    LEFT JOIN public.oren_scene_daily_stats t
      ON t.scene_post_id = p.id AND t.snapshot_date = dt.today_kst
    LEFT JOIN public.oren_scene_daily_stats w
      ON w.scene_post_id = p.id AND w.snapshot_date = dt.week_ago_kst
    WHERE
      (
        p_content_filter IS NULL
        OR p_content_filter = 'all'
        OR p.content_type = p_content_filter
      )
      AND (
        -- True weekly: include any post that has today's snapshot
        (wr.ready AND t.scene_post_id IS NOT NULL)
        OR
        -- Legacy / partial: created_at window (also covers posts missing today snap)
        (
          (NOT wr.ready OR t.scene_post_id IS NULL)
          AND (
            p_days_back IS NULL
            OR p.created_at >= (now() - (p_days_back || ' days')::interval)
          )
        )
      )
  ),
  scored AS (
    SELECT
      b.*,
      CASE
        WHEN b.has_today_snap IS NOT NULL AND b.has_week_snap IS NOT NULL THEN
          (
            GREATEST(0, COALESCE(b.snap_today_likes, 0) - COALESCE(b.snap_week_likes, 0))::numeric * 1
            + GREATEST(0, COALESCE(b.snap_today_views, 0) - COALESCE(b.snap_week_views, 0))::numeric * 0.1
            + GREATEST(0, COALESCE(b.snap_today_conv, 0) - COALESCE(b.snap_week_conv, 0))::numeric * 15
            + GREATEST(0, COALESCE(b.snap_today_rev, 0) - COALESCE(b.snap_week_rev, 0))::numeric * 0.005
          )
        WHEN b.has_today_snap IS NOT NULL THEN
          (
            COALESCE(b.snap_today_likes, 0)::numeric * 1
            + COALESCE(b.snap_today_views, 0)::numeric * 0.1
            + COALESCE(b.snap_today_conv, 0)::numeric * 15
            + COALESCE(b.snap_today_rev, 0)::numeric * 0.005
          )
        ELSE b.cumulative_score
      END AS popularity_score,
      CASE
        WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL::double precision
        WHEN b.salon_id IS NULL THEN NULL::double precision
        WHEN b.salon_lat IS NULL OR b.salon_lng IS NULL THEN NULL::double precision
        ELSE public.haversine_km(p_lat, p_lng, b.salon_lat, b.salon_lng)
      END AS distance_km
    FROM base b
  ),
  with_bonus AS (
    SELECT
      s.*,
      CASE
        WHEN s.distance_km IS NULL THEN 0::numeric
        WHEN s.distance_km <= 3 THEN 30::numeric
        WHEN s.distance_km <= 10 THEN 15::numeric
        ELSE 0::numeric
      END AS distance_bonus
    FROM scored s
  )
  SELECT
    wb.id,
    wb.salon_id,
    wb.video_url,
    wb.thumbnail_url,
    wb.content_type,
    wb.uploader_type,
    wb.view_count,
    wb.like_count,
    wb.popularity_score,
    wb.title,
    wb.created_at,
    wb.salon_name,
    wb.uploader_name,
    wb.distance_km,
    wb.distance_bonus,
    (wb.popularity_score + wb.distance_bonus) AS sort_score
  FROM with_bonus wb
  ORDER BY sort_score DESC, wb.created_at DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(COALESCE(p_limit, 0), 0);
$$;

COMMENT ON FUNCTION public.get_oren_scene_hub(double precision, double precision, text, integer, integer, integer) IS
  'Hub feed. Weekly delta score when snaps exist (180); else VIEW cumulative + optional created_at window. Distance bonus unchanged (179).';

GRANT EXECUTE ON FUNCTION public.get_oren_scene_hub(double precision, double precision, text, integer, integer, integer)
  TO anon, authenticated;