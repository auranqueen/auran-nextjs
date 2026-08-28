/** Mirrors oren_scene_posts_with_popularity VIEW (177/178) and weekly-delta scoring (180). */

export type PopularityInput = {
  like_count?: number | null
  view_count?: number | null
  booking_conversion_count?: number | null
  revenue_generated?: number | null
}

/** Cumulative formula (VIEW / fallback when 7d snapshots not ready). */
export function computePopularityScore(post: PopularityInput): number {
  return (
    Number(post.like_count || 0) * 1 +
    Number(post.view_count || 0) * 0.1 +
    Number(post.booking_conversion_count || 0) * 15 +
    Number(post.revenue_generated || 0) * 0.005
  )
}

/**
 * True weekly score from two cumulative snapshots (today - 7d ago).
 * Matches get_oren_scene_hub (180) when both snaps exist.
 */
export function computeWeeklyDeltaPopularityScore(
  today: PopularityInput,
  weekAgo: PopularityInput,
): number {
  const d = (a?: number | null, b?: number | null) =>
    Math.max(0, Number(a || 0) - Number(b || 0))
  return computePopularityScore({
    like_count: d(today.like_count, weekAgo.like_count),
    view_count: d(today.view_count, weekAgo.view_count),
    booking_conversion_count: d(today.booking_conversion_count, weekAgo.booking_conversion_count),
    revenue_generated: d(today.revenue_generated, weekAgo.revenue_generated),
  })
}

export function sevenDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

/** Top ~20% badge: score must meet threshold from server (min score at rank ceil(count*0.2)). */
export function isHotByScore(score: number | null | undefined, minThreshold: number | null): boolean {
  if (minThreshold == null) return false
  const s = Number(score || 0)
  return s > 0 && s >= minThreshold
}
