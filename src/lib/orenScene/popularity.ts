/** Mirrors oren_scene_posts_with_popularity VIEW (177/178). Sorting uses the VIEW server-side. */

export type PopularityInput = {
  like_count?: number | null
  view_count?: number | null
  booking_conversion_count?: number | null
  revenue_generated?: number | null
}

export function computePopularityScore(post: PopularityInput): number {
  return (
    Number(post.like_count || 0) * 1 +
    Number(post.view_count || 0) * 0.1 +
    Number(post.booking_conversion_count || 0) * 15 +
    Number(post.revenue_generated || 0) * 0.005
  )
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
