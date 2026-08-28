export type OrenScenePostItem = {
  id: string
  salon_id: string | null
  video_url: string
  thumbnail_url: string | null
  content_type: string | null
  uploader_type: string | null
  view_count: number | null
  like_count: number | null
  highlight_tag: string | null
  title: string | null
  created_at: string
}

export type OrenSceneHighlightGroup = {
  tag: string
  totalViews: number
  repPostId: string
  repThumbnail: string | null
  repVideoUrl: string | null
}

export function orenSceneBadgeLabel(
  post: Pick<OrenScenePostItem, 'content_type' | 'uploader_type'>,
): string {
  if (post.uploader_type === 'owner') return '👤 원장'
  if (post.content_type === 'verified') return '✓ 인증'
  if (post.content_type === 'free') return '✨ 자유'
  if (post.content_type === 'owner') return '👤 원장'
  return '✨ 자유'
}

export function normalizeHighlightTag(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/\s+/g, '').toLowerCase()
  return s || null
}

export function groupOrenSceneByHighlightTag(posts: OrenScenePostItem[]): OrenSceneHighlightGroup[] {
  const map = new Map<string, OrenScenePostItem[]>()
  for (const post of posts) {
    const tag = normalizeHighlightTag(post.highlight_tag)
    if (!tag) continue
    const list = map.get(tag) || []
    list.push(post)
    map.set(tag, list)
  }
  const groups: OrenSceneHighlightGroup[] = []
  for (const [tag, list] of Array.from(map.entries())) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const rep = sorted[0]
    groups.push({
      tag,
      totalViews: list.reduce((sum, p) => sum + Number(p.view_count || 0), 0),
      repPostId: rep.id,
      repThumbnail: rep.thumbnail_url,
      repVideoUrl: rep.video_url,
    })
  }
  groups.sort((a, b) => b.totalViews - a.totalViews)
  return groups
}

export function dedupeHighlightTags(rows: { highlight_tag: string | null }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    const tag = normalizeHighlightTag(row.highlight_tag)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}
