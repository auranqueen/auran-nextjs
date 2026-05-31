export type Segment = 'cycle' | 'male' | 'transition'

export function trackToSegment(track?: string | null): Segment {
  const t = (track || 'general').toLowerCase()
  if (t === 'male' || t === 'male_menopause') return 'male'
  if (t === 'menopause_peri' || t === 'menopause_post') return 'transition'
  return 'cycle'
}
