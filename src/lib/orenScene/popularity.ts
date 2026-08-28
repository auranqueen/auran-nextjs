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

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function distanceBoostKm(km: number): number {
  if (km <= 3) return 8
  if (km <= 10) return 4
  if (km <= 30) return 2
  return 0
}

export function computeSortScore(
  post: PopularityInput & { salonLat?: number | null; salonLng?: number | null },
  opts: { userLat?: number | null; userLng?: number | null; applyDistance?: boolean },
): number {
  let score = computePopularityScore(post)
  if (
    opts.applyDistance &&
    opts.userLat != null &&
    opts.userLng != null &&
    post.salonLat != null &&
    post.salonLng != null
  ) {
    score += distanceBoostKm(haversineKm(opts.userLat, opts.userLng, post.salonLat, post.salonLng))
  }
  return score
}

export function isHotRank(rankIndex: number, total: number, score: number): boolean {
  if (total === 0 || score <= 0) return false
  const hotCount = Math.max(1, Math.ceil(total * 0.2))
  return rankIndex < hotCount
}

export function sevenDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}