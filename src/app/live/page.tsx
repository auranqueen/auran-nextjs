'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'

interface BroadcastRow {
  id: number
  owner_id: string | null
  title: string
  description: string | null
  scheduled_at: string | null
  status: string
  started_at: string | null
  owner_name: string | null
  viewer_count?: number | null
  thumbnail_url?: string | null
}

const TABS = ['홈', '이벤트', '예고', '카테고리']
const CATEGORIES = ['전체', '뷰티', '스킨케어', '기기', '시술관리', '바디']
const GRADIENTS = [
  'bg-gradient-to-br from-purple-400 via-fuchsia-300 to-pink-300',
  'bg-gradient-to-br from-indigo-400 via-purple-300 to-rose-200',
  'bg-gradient-to-br from-rose-300 via-pink-300 to-purple-300',
  'bg-gradient-to-br from-violet-500 via-purple-400 to-amber-200',
]

function formatElapsed(startedAt: string) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분째 방송 중`
  return `${m}분째 방송 중`
}

function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`
  return n.toLocaleString('ko-KR')
}

function formatDate(iso: string | null) {
  if (!iso) return '일정 미정'
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function dDay(iso: string | null) {
  if (!iso) return 'D-?'
  const start = new Date(iso)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((start.getTime() - today.getTime()) / 86400000)
  return diff <= 0 ? 'D-DAY' : `D-${diff}`
}

function timeOf(iso: string | null, fallback: number) {
  return iso ? new Date(iso).getTime() : fallback
}

function hostName(b: BroadcastRow) {
  return b.owner_name || '원장님'
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function LiveBadge() {
  return <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white">LIVE</span>
}

function UpcomingBadge() {
  return <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[10px] text-white">예정</span>
}

function Thumb({ b, className, children }: { b: BroadcastRow; className: string; children?: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden ${GRADIENTS[b.id % GRADIENTS.length]} ${className}`}>
      {b.thumbnail_url && <img src={b.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {children}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 px-4">
      <div className="text-[15px] text-gray-900">{title}</div>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function Empty() {
  return <div className="mx-4 rounded-xl bg-gray-50 py-8 text-center text-xs text-gray-400">방송이 없습니다</div>
}

function ProductsPlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm text-gray-900">{label}</div>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-[11px] text-gray-400">
            연결 예정
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LiveListPage() {
  const router = useRouter()
  const supabase = createClient()
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(TABS[0])
  const [category, setCategory] = useState(CATEGORIES[0])
  const [sheetB, setSheetB] = useState<BroadcastRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notified, setNotified] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('oren_live_broadcasts_public')
      .select('id, owner_id, title, description, scheduled_at, status, started_at, viewer_count, thumbnail_url')
      .in('status', ['upcoming', 'live', 'ended'])
      .order('scheduled_at', { ascending: false })
      .limit(50)
    const rows: BroadcastRow[] = (data || []).map((r) => ({ ...r, owner_name: null }))
    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v)))
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase.from('profiles').select('id, owner_store_name, full_name').in('id', ownerIds)
      const names = new Map<string, string>()
      for (const o of owners || []) names.set(o.id, o.owner_store_name || o.full_name || '')
      for (const r of rows) r.owner_name = r.owner_id ? names.get(r.owner_id) || null : null
    }
    const sorted = rows.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1
      if (a.status !== 'live' && b.status === 'live') return 1
      return 0
    })
    setBroadcasts(sorted)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const liveBroadcasts = broadcasts.filter((b) => b.status === 'live')
  const upcomingBroadcasts = broadcasts
    .filter((b) => b.status === 'upcoming')
    .sort((a, b) => timeOf(a.scheduled_at, Number.MAX_SAFE_INTEGER) - timeOf(b.scheduled_at, Number.MAX_SAFE_INTEGER))
  const endedBroadcasts = broadcasts
    .filter((b) => b.status === 'ended')
    .sort((a, b) => timeOf(b.started_at || b.scheduled_at, 0) - timeOf(a.started_at || a.scheduled_at, 0))
    .slice(0, 6)
  const ranking = [...liveBroadcasts, ...upcomingBroadcasts]
    .sort((a, b) =>
      (b.viewer_count ?? 0) - (a.viewer_count ?? 0)
      || timeOf(a.scheduled_at, Number.MAX_SAFE_INTEGER) - timeOf(b.scheduled_at, Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 5)
  const featured = liveBroadcasts[0]

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const openSheet = (b: BroadcastRow) => {
    setSheetB(b)
    setSheetOpen(true)
  }

  const closeSheet = () => setSheetOpen(false)

  const toggleNotify = (id: number) => {
    const next = !notified[id]
    setNotified((prev) => ({ ...prev, [id]: next }))
    showToast(next ? '방송 알림을 신청했어요' : '알림 신청을 취소했어요')
  }

  const share = async (b: BroadcastRow) => {
    const url = `${window.location.origin}/live/${b.id}`
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: b.title, url }) } catch {}
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('링크를 복사했어요')
    } catch {
      showToast('링크 복사에 실패했어요')
    }
  }

  const closeButton = (
    <button type="button" aria-label="닫기" onClick={closeSheet}
      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-lg text-white">
      ×
    </button>
  )

  return (
    <div className="min-h-screen bg-white pb-20 text-gray-900">
      <div className="mx-auto max-w-[390px]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div className="text-lg text-gray-900">오렌 <span className="text-purple-600">라이브</span></div>
            <div className="flex items-center gap-3 text-gray-700">
              <button type="button" aria-label="검색" onClick={() => showToast('검색은 준비 중이에요')} className="p-1"><SearchIcon /></button>
              <button type="button" aria-label="알림" onClick={() => showToast('알림은 준비 중이에요')} className="p-1"><BellIcon /></button>
            </div>
          </div>
          <div className="flex gap-5 px-4">
            {TABS.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`border-b-2 pb-2 text-sm ${tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${category === c ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>
                {c}
              </button>
            ))}
          </div>
        </header>

        {featured && (
          <button type="button" onClick={() => openSheet(featured)} className="flex w-full items-center gap-2 bg-red-50 px-4 py-2.5 text-left">
            <LiveBadge />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{featured.title}</span>
            <span className="shrink-0 text-xs text-red-500">👀 {formatCount(featured.viewer_count ?? 0)}</span>
          </button>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <div className="space-y-8 pt-5">
            <section>
              <SectionTitle title="지금 라이브" sub={liveBroadcasts.length > 0 ? `${liveBroadcasts.length}개 방송 중` : undefined} />
              {liveBroadcasts.length === 0 ? <Empty /> : (
                <div className="grid grid-cols-2 gap-3 px-4">
                  {liveBroadcasts.map((b) => (
                    <button key={b.id} type="button" onClick={() => openSheet(b)} className="text-left">
                      <Thumb b={b} className="aspect-[3/4] rounded-xl">
                        <div className="absolute left-2 top-2 flex items-center gap-1">
                          <LiveBadge />
                          <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">👀 {formatCount(b.viewer_count ?? 0)}</span>
                        </div>
                      </Thumb>
                      <div className="mt-1.5 truncate text-xs text-purple-600">{hostName(b)}</div>
                      <div className="line-clamp-2 text-sm text-gray-900">{b.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle title="예정된 방송" />
              {upcomingBroadcasts.length === 0 ? <Empty /> : (
                <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {upcomingBroadcasts.map((b) => (
                    <button key={b.id} type="button" onClick={() => openSheet(b)} className="w-36 shrink-0 rounded-xl border border-gray-100 bg-white p-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-purple-600">{dDay(b.scheduled_at)}</span>
                        <span className={notified[b.id] ? 'text-purple-600' : 'text-gray-400'}><BellIcon size={16} /></span>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">{formatDate(b.scheduled_at)}</div>
                      <div className="mt-2 line-clamp-2 text-sm text-gray-900">{b.title}</div>
                      <div className="mt-1 truncate text-[11px] text-gray-400">{hostName(b)}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle title="인기 방송 랭킹" sub="시청자 순" />
              {ranking.length === 0 ? <Empty /> : (
                <div className="space-y-2 px-4">
                  {ranking.map((b, i) => (
                    <button key={b.id} type="button" onClick={() => openSheet(b)} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-2.5 text-left">
                      <span className={`w-5 text-center text-lg ${i < 3 ? 'text-purple-600' : 'text-gray-400'}`}>{i + 1}</span>
                      <Thumb b={b} className="h-14 w-14 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {b.status === 'live' ? <LiveBadge /> : <UpcomingBadge />}
                          <span className="truncate text-[11px] text-gray-500">{hostName(b)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-sm text-gray-900">{b.title}</div>
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {b.status === 'live' ? `👀 ${formatCount(b.viewer_count ?? 0)}명 시청 중` : `⏰ ${formatDate(b.scheduled_at)}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle title="다시보기" />
              {endedBroadcasts.length === 0 ? <Empty /> : (
                <div className="grid grid-cols-2 gap-3 px-4">
                  {endedBroadcasts.map((b) => (
                    <div key={b.id}>
                      <Thumb b={b} className="aspect-[3/4] rounded-xl">
                        <div className="absolute left-2 top-2 flex items-center gap-1">
                          <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-white">종료</span>
                          <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">👀 총 {formatCount(b.viewer_count ?? 0)}</span>
                        </div>
                      </Thumb>
                      <div className="mt-1.5 truncate text-xs text-purple-600">{hostName(b)}</div>
                      <div className="line-clamp-2 text-sm text-gray-900">{b.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div onClick={closeSheet}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <div className={`fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[390px] rounded-t-2xl bg-white transition-transform duration-300 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        {sheetB && (
          <div className="max-h-[85vh] overflow-y-auto pb-6">
            <div className="relative">
              {closeButton}
              <Thumb b={sheetB} className="aspect-video w-full rounded-t-2xl">
                {sheetB.status === 'live' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 pl-1 text-2xl text-purple-600">▶</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white">
                    <div className="text-3xl">{dDay(sheetB.scheduled_at)}</div>
                    <div className="mt-1 text-sm">{formatDate(sheetB.scheduled_at)}</div>
                  </div>
                )}
              </Thumb>
            </div>
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2">
                {sheetB.status === 'live' ? <LiveBadge /> : <UpcomingBadge />}
                <span className="truncate text-xs text-purple-600">{hostName(sheetB)}</span>
                {sheetB.status === 'live' && sheetB.started_at && (
                  <span className="ml-auto shrink-0 text-[11px] text-red-500">{formatElapsed(sheetB.started_at)}</span>
                )}
              </div>
              <div className="mt-2 text-base text-gray-900">{sheetB.title}</div>
              {sheetB.description && <div className="mt-1 text-sm leading-relaxed text-gray-500">{sheetB.description}</div>}

              {sheetB.status === 'live' ? (
                <>
                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>👀 시청 {formatCount(sheetB.viewer_count ?? 0)}</span>
                    <span>💬 채팅 -</span>
                  </div>
                  <ProductsPlaceholder label="방송 제품" />
                  <button type="button" onClick={() => router.push(`/live/${sheetB.id}`)}
                    className="mt-6 w-full rounded-xl bg-red-500 py-3.5 text-sm text-white">
                    지금 시청하기
                  </button>
                </>
              ) : (
                <>
                  <ProductsPlaceholder label="예정 제품" />
                  <div className="mt-6 flex gap-2">
                    <button type="button" onClick={() => toggleNotify(sheetB.id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3.5 text-sm ${notified[sheetB.id] ? 'border border-purple-600 bg-white text-purple-600' : 'bg-purple-600 text-white'}`}>
                      <BellIcon size={16} />
                      {notified[sheetB.id] ? '알림 신청됨' : '알림 신청하기'}
                    </button>
                    <button type="button" onClick={() => void share(sheetB)}
                      className="flex-1 rounded-xl border border-gray-200 py-3.5 text-sm text-gray-700">
                      방송 공유하기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-purple-600 px-4 py-2 text-xs text-white">
          {toast}
        </div>
      )}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
