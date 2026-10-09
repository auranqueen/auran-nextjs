import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const CATEGORIES = ['피부케어', '성분', '루틴', '브랜드', '원장님픽']

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** 매거진 상세가 content를 HTML로 그대로 렌더링하므로 큐레이터 입력은 이스케이프 후 문단으로만 저장 */
const toSafeHtml = (raw: string) =>
  raw
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br />')}</p>`)
    .join('')

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_logged_in' }, { status: 401 })

  const svc = tryCreateAdminClient()
  if (!svc) return NextResponse.json({ error: 'service_unavailable' }, { status: 500 })

  const [{ data: pr }, { data: ur }] = await Promise.all([
    svc.from('profiles').select('active_role, role').eq('auth_id', user.id).maybeSingle(),
    svc.from('users').select('role').eq('auth_id', user.id).maybeSingle(),
  ])
  const p = pr as unknown as { active_role?: string | null; role?: string | null } | null
  const u = ur as unknown as { role?: string | null } | null
  const role = String(p?.active_role || p?.role || u?.role || '')
  if (role !== 'curator') return NextResponse.json({ error: 'curator_only' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const title = text(body.title, 200)
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })

  const category = text(body.category, 40)
  const content = text(body.content, 20000)
  const thumb = text(body.thumbnail_url, 1000)

  const { data, error } = await svc
    .from('magazines')
    .insert({
      title,
      subtitle: text(body.subtitle, 300),
      category: category && CATEGORIES.includes(category) ? category : null,
      content: content ? toSafeHtml(content) : null,
      thumbnail_url: thumb && /^https?:\/\//i.test(thumb) ? thumb : null,
      author_type: 'curator',
      created_by: user.id,
      author_owner_id: user.id,
      is_published: false,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: (data as unknown as { id: string }).id })
}
