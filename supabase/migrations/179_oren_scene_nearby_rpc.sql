-- 179_oren_scene_nearby_rpc.sql
-- Record-only. Oren-scene hub popular/all tabs: server sort with distance bonus via RPC.
-- Depends on 177/178 (oren_scene_posts_with_popularity VIEW) and 169 (salons.lat/lng).
-- Apply in Supabase when ready — do not run from agent.

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 6371.0 * 2 * asin(
    sqrt(
      least(
        1.0,
        sin(radians(lat2 - lat1) / 2) ^ 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
      )
    )
  );
$$;

COMMENT ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) IS
  'Great-circle distance in km between two WGS84 points.';

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
  WITH base AS (
    SELECT
      p.id,
      p.salon_id,
      p.video_url,
      p.thumbnail_url,
      p.content_type,
      p.uploader_type,
      p.view_count,
      p.like_count,
      p.popularity_score,
      p.title,
      p.created_at,
      s.name AS salon_name,
      u.name AS uploader_name,
      CASE
        WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL::double precision
        WHEN p.salon_id IS NULL THEN NULL::double precision
        WHEN s.lat IS NULL OR s.lng IS NULL THEN NULL::double precision
        ELSE public.haversine_km(p_lat, p_lng, s.lat, s.lng)
      END AS distance_km
    FROM public.oren_scene_posts_with_popularity p
    LEFT JOIN public.salons s ON s.id = p.salon_id
    LEFT JOIN public.users u ON u.id = p.uploader_user_id
    WHERE
      (
        p_days_back IS NULL
        OR p.created_at >= (now() - (p_days_back || ' days')::interval)
      )
      AND (
        p_content_filter IS NULL
        OR p_content_filter = 'all'
        OR p.content_type = p_content_filter
      )
  ),
  scored AS (
    SELECT
      b.*,
      CASE
        WHEN b.distance_km IS NULL THEN 0::numeric
        WHEN b.distance_km <= 3 THEN 30::numeric
        WHEN b.distance_km <= 10 THEN 15::numeric
        ELSE 0::numeric
      END AS distance_bonus
    FROM base b
  )
  SELECT
    s.id,
    s.salon_id,
    s.video_url,
    s.thumbnail_url,
    s.content_type,
    s.uploader_type,
    s.view_count,
    s.like_count,
    s.popularity_score,
    s.title,
    s.created_at,
    s.salon_name,
    s.uploader_name,
    s.distance_km,
    s.distance_bonus,
    (s.popularity_score + s.distance_bonus) AS sort_score
  FROM scored s
  ORDER BY sort_score DESC, s.created_at DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(COALESCE(p_limit, 0), 0);
$$;

COMMENT ON FUNCTION public.get_oren_scene_hub(double precision, double precision, text, integer, integer, integer) IS
  'Oren-scene hub feed: VIEW popularity + distance bonus (3km +30, 10km +15). p_days_back NULL = no date filter.';

GRANT EXECUTE ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_oren_scene_hub(double precision, double precision, text, integer, integer, integer)
  TO anon, authenticated;
