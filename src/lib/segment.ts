export type Segment = 'cycle' | 'male' | 'transition' | 'unknown'

export function trackToSegment(track?: string | null): Segment {
  const t = (track || '').toLowerCase()
  if (t === 'male' || t === 'male_menopause') return 'male'
  if (t === 'menopause_peri' || t === 'menopause_post') return 'transition'
  if (t === 'general' || t === 'pregnant' || t === 'postpartum') return 'cycle'
  if (!t) return 'cycle'
  return 'unknown'
}
