'use client'

/*
 * Supabase SQL Editor에서 테이블/컬럼이 없을 때 실행 (요약):
 *
 * create extension if not exists "pgcrypto";
 *
 * alter table public.contests add column if not exists status text default 'scheduled';
 * alter table public.contests add column if not exists winner_entry_id uuid references public.contest_entries(id);
 * alter table public.contests add column if not exists winner_selected_at timestamptz;
 *
 * create table if not exists public.contest_voter_coupons (
 *   id uuid primary key default gen_random_uuid(),
 *   contest_id uuid not null references public.contests(id) on delete cascade,
 *   user_id uuid not null references public.users(id) on delete cascade,
 *   entry_id uuid references public.contest_entries(id) on delete set null,
 *   discount_rate text not null default '50',
 *   expires_at timestamptz not null,
 *   created_at timestamptz not null default now(),
 *   unique (contest_id, user_id)
 * );
 *
 * alter table public.contest_entries add column if not exists title text;
 *
 * -- admin_settings (contest 카테고리) 예시 시드
 * insert into public.admin_settings (category, key, value) values
 *   ('contest','contest_vote_cost','10'),
 *   ('contest','contest_voter_discount','50'),
 *   ('contest','contest_subscription_price','300'),
 *   ('contest','contest_prize_1st','50000'),
 *   ('contest','contest_prize_2nd','30000'),
 *   ('contest','contest_prize_3rd','10000'),
 *   ('contest','contest_store_price_default','1000'),
 *   ('contest','contest_max_entries','100'),
 *   ('contest','contest_min_prize','1000'),
 *   ('contest','contest_winner_brand_id','')
 * on conflict (category, key) do nothing;
 *
 * (기존 contests / contest_entries / contest_votes / myworld_site_config 정의는 이전 마이그레이션 참고)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ListTab = 'active' | 'upcoming' | 'ended' | 'all'

const SETTING_KEYS = [
  { key: 'contest_vote_cost', label: '투표 1표당 토스트 비용', fallback: '10' },
  { key: 'contest_voter_discount', label: '투표 참여자 할인율 %', fallback: '50' },
  { key: 'contest_subscription_price', label: '월 구독 패스 가격 T', fallback: '300' },
  { key: 'contest_prize_1st', label: '1등 상금 원', fallback: '50000' },
  { key: 'contest_prize_2nd', label: '2등 상금 원', fallback: '30000' },
  { key: 'contest_prize_3rd', label: '3등 상금 원', fallback: '10000' },
  { key: 'contest_store_price_default', label: '스토어 기본 정가 T', fallback: '1000' },
  { key: 'contest_max_entries', label: '최대 참여 작품 수', fallback: '100' },
  { key: 'contest_min_prize', label: '작가 최소 상금 원', fallback: '1000' },
] as const

function contestPhase(c: { starts_at: string; ends_at: string }, now: Date): '진행중' | '예정' | '종료' {
  const s = new Date(c.starts_at).getTime()
  const e = new Date(c.ends_at).getTime()
  const t = now.getTime()
  if (t < s) return '예정'
  if (t > e) return '종료'
  return '진행중'
}

function dDayLabel(c: { starts_at: string; ends_at: string }, now: Date): string {
  const phase = contestPhase(c, now)
  const end = new Date(c.ends_at)
  const start = new Date(c.starts_at)
  const t = now.getTime()
  if (phase === '예정') {
    const d = Math.ceil((start.getTime() - t) / 86400000)
    return d <= 0 ? 'D-DAY' : `D-${d}`
  }
  if (phase === '진행중') {
    const d = Math.ceil((end.getTime() - t) / 86400000)
    return d < 0 ? '종료' : d === 0 ? 'D-DAY' : `D-${d}`
  }
  return '종료됨'
}

export default function AdminMarketingContestsPage() {
  const supabase = createClient()
  const [now, setNow] = useState(() => new Date())
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [contests, setContests] = useState<any[]>([])
  const [contestAgg, setContestAgg] = useState<Record<string, { entries: number; voteCount: number; toastSum: number }>>({})
  const [kpi, setKpi] = useState({ active: 0, entries: 0, votes: 0, toastTotal: 0, toastMonth: 0 })
  const [listTab, setListTab] = useState<ListTab>('active')
  const [toast, setToast] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fTitle, setFTitle] = useState('')
  const [fTheme, setFTheme] = useState('봄')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [fVoteMode, setFVoteMode] = useState<'toast' | 'free' | 'auction'>('toast')
  const [fToastN, setFToastN] = useState(1)
  const [fMaxEntries, setFMaxEntries] = useState(100)
  const [fP1Type, setFP1Type] = useState<'toast' | 'cash'>('toast')
  const [fP1Val, setFP1Val] = useState(0)
  const [fP2, setFP2] = useState(0)
  const [fP3, setFP3] = useState(0)
  const [fAur, setFAur] = useState(false)
  const [fElig, setFElig] = useState<'creators_only' | 'customers_ok'>('creators_only')
  const [fPublic, setFPublic] = useState(true)

  const [manageId, setManageId] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [votes, setVotes] = useState<any[]>([])
  const [busyEntry, setBusyEntry] = useState<string | null>(null)
  const [awarding, setAwarding] = useState(false)
  const [selectedWinnerEntryId, setSelectedWinnerEntryId] = useState('')

  const getSetting = useCallback((key: string, fallback: string) => settings[key] ?? fallback, [settings])

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2800)
  }

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.from('admin_settings').select('key, value').eq('category', 'contest')
    if (error) return
    const m: Record<string, string> = {}
    ;(data || []).forEach((r: { key: string; value: string | null }) => {
      m[r.key] = String(r.value ?? '')
    })
    setSettings(m)
  }, [])

  const persistSetting = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    const { error } = await supabase.from('admin_settings').upsert(
      { category: 'contest', key, value },
      { onConflict: 'category,key' }
    )
    if (error) {
      showToast(error.message)
      return
    }
    showToast('저장됐어요 ✅')
    await loadSettings()
  }

  const refreshAll = useCallback(async () => {
    setLoadErr(null)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [cRes, activeRes, eRes, vCountRes, voteRowsRes, voteMonthRes] = await Promise.all([
      supabase.from('contests').select('*').order('starts_at', { ascending: false }),
      supabase.from('contests').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('contest_entries').select('id', { count: 'exact', head: true }),
      supabase.from('contest_votes').select('id', { count: 'exact', head: true }),
      supabase.from('contest_votes').select('contest_id, toast_spent, votes_count'),
      supabase.from('contest_votes').select('toast_spent').gte('created_at', monthStart.toISOString()),
    ])

    if (cRes.error && (cRes.error as any).code === '42P01') {
      setLoadErr('contests 테이블이 없습니다. 이 파일 상단 SQL을 Supabase에서 실행하세요.')
      return
    }
    if (cRes.error) {
      setLoadErr(String(cRes.error.message || cRes.error))
      return
    }

    const list = cRes.data || []
    setContests(list)
    const entListRes = await supabase.from('contest_entries').select('contest_id, vote_count, toast_burned')
    const agg: Record<string, { entries: number; voteCount: number; toastSum: number }> = {}
    ;(entListRes.data || []).forEach((row: any) => {
      const cid = String(row.contest_id)
      if (!agg[cid]) agg[cid] = { entries: 0, voteCount: 0, toastSum: 0 }
      agg[cid].entries += 1
    })
    ;(voteRowsRes.data || []).forEach((row: any) => {
      const cid = String(row.contest_id)
      if (!agg[cid]) agg[cid] = { entries: 0, voteCount: 0, toastSum: 0 }
      agg[cid].voteCount += Number(row.votes_count || 0)
      agg[cid].toastSum += Number(row.toast_spent || 0)
    })
    setContestAgg(agg)

    let activeNum = typeof activeRes.count === 'number' ? activeRes.count : 0
    if (activeRes.error) {
      activeNum = list.filter((c) => c.status === 'active').length
    }

    const entriesCount = typeof eRes.count === 'number' ? eRes.count : 0
    const votesRowCount = typeof vCountRes.count === 'number' ? vCountRes.count : 0

    let toastTotal = 0
    ;(voteRowsRes.data || []).forEach((row: any) => {
      toastTotal += Number(row.toast_spent || 0)
    })
    let toastMonth = 0
    if (!voteMonthRes.error && voteMonthRes.data) {
      voteMonthRes.data.forEach((row: any) => {
        toastMonth += Number(row.toast_spent || 0)
      })
    }

    setKpi({
      active: activeNum,
      entries: entriesCount,
      votes: votesRowCount,
      toastTotal,
      toastMonth,
    })
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!modalOpen) return
    setFToastN(Number(getSetting('contest_vote_cost', '10')) || 10)
    setFMaxEntries(Number(getSetting('contest_max_entries', '100')) || 100)
    setFP1Val(Number(getSetting('contest_prize_1st', '50000')) || 0)
    setFP2(Number(getSetting('contest_prize_2nd', '30000')) || 0)
    setFP3(Number(getSetting('contest_prize_3rd', '10000')) || 0)
  }, [modalOpen, getSetting])

  const loadPanel = useCallback(
    async (cid: string) => {
      const [en, vo] = await Promise.all([
        supabase.from('contest_entries').select('*').eq('contest_id', cid).order('submitted_at', { ascending: false }),
        supabase.from('contest_votes').select('*').eq('contest_id', cid),
      ])
      if (en.error) {
        showToast(en.error.message)
        return
      }
      if (vo.error) {
        showToast(vo.error.message)
        return
      }
      setEntries(en.data || [])
      setVotes(vo.data || [])
    },
    []
  )

  useEffect(() => {
    if (!manageId) return
    loadPanel(manageId)
    const iv = setInterval(() => loadPanel(manageId), 5000)
    return () => clearInterval(iv)
  }, [manageId, loadPanel])

  useEffect(() => {
    setSelectedWinnerEntryId('')
  }, [manageId])

  const filteredContests = useMemo(() => {
    return contests.filter((c) => {
      const p = contestPhase(c, now)
      if (listTab === 'all') return true
      if (listTab === 'active') return p === '진행중'
      if (listTab === 'upcoming') return p === '예정'
      return p === '종료'
    })
  }, [contests, listTab, now])

  const manageContest = useMemo(() => contests.find((c) => c.id === manageId) || null, [contests, manageId])

  const rankSorted = useMemo(() => {
    const map = new Map<string, { votes: number; toast: number }>()
    votes.forEach((v) => {
      const eid = String(v.entry_id)
      const cur = map.get(eid) || { votes: 0, toast: 0 }
      cur.votes += Number(v.votes_count || 0)
      cur.toast += Number(v.toast_spent || 0)
      map.set(eid, cur)
    })
    return [...entries]
      .map((e) => ({
        e,
        agg: map.get(String(e.id)) || { votes: Number(e.vote_count || 0), toast: Number(e.toast_burned || 0) },
      }))
      .sort((a, b) => b.agg.votes - a.agg.votes)
  }, [entries, votes])

  const maxRankVotes = useMemo(() => Math.max(1, ...rankSorted.map((r) => r.agg.votes)), [rankSorted])

  const entryDisplayName = (e: any) => String(e?.title || e?.artist_name || '작품').slice(0, 32)

  const hourBuckets = useMemo(() => {
    const h = Array(24).fill(0)
    votes.forEach((v) => {
      const hr = new Date(v.created_at).getHours()
      h[hr] += Number(v.votes_count || 0)
    })
    return h
  }, [votes])
  const hourPeak = useMemo(() => {
    let m = 0
    let idx = 0
    hourBuckets.forEach((n, i) => {
      if (n > m) {
        m = n
        idx = i
      }
    })
    return { hr: idx, n: m }
  }, [hourBuckets])

  const gradeBuckets = useMemo(() => {
    const g: Record<string, number> = {}
    votes.forEach((v) => {
      const k = String(v.voter_grade || '미상')
      g[k] = (g[k] || 0) + Number(v.votes_count || 0)
    })
    return g
  }, [votes])
  const gradeTotal = useMemo(() => Object.values(gradeBuckets).reduce((a, b) => a + b, 0) || 1, [gradeBuckets])

  const voteToastSum = useMemo(() => votes.reduce((s, v) => s + Number(v.toast_spent || 0), 0), [votes])

  const resetForm = () => {
    setFTitle('')
    setFTheme('봄')
    setFStart('')
    setFEnd('')
    setFVoteMode('toast')
    setFToastN(Number(getSetting('contest_vote_cost', '10')) || 10)
    setFMaxEntries(Number(getSetting('contest_max_entries', '100')) || 100)
    setFP1Type('toast')
    setFP1Val(Number(getSetting('contest_prize_1st', '50000')) || 0)
    setFP2(Number(getSetting('contest_prize_2nd', '30000')) || 0)
    setFP3(Number(getSetting('contest_prize_3rd', '10000')) || 0)
    setFAur(false)
    setFElig('creators_only')
    setFPublic(true)
  }

  const saveContest = async () => {
    if (!fTitle.trim() || !fStart || !fEnd) {
      showToast('제목·시작일·종료일을 입력하세요')
      return
    }
    setSaving(true)
    const s = new Date(fStart).getTime()
    const e = new Date(fEnd).getTime()
    const t = Date.now()
    const derivedStatus = t < s ? 'scheduled' : t > e ? 'completed' : 'active'
    const row = {
      title: fTitle.trim(),
      theme: fTheme,
      starts_at: new Date(fStart).toISOString(),
      ends_at: new Date(fEnd).toISOString(),
      vote_mode: fVoteMode,
      toast_per_vote: fVoteMode === 'toast' ? Math.max(1, fToastN) : 0,
      max_entries: Math.max(1, fMaxEntries),
      prize_1st_type: fP1Type,
      prize_1st_value: Math.max(0, fP1Val),
      prize_2nd_toast: Math.max(0, fP2),
      prize_3rd_toast: Math.max(0, fP3),
      aur_exclusive: fAur,
      eligibility: fElig,
      is_public: fPublic,
      awards_processed: false,
      status: derivedStatus,
    }
    const { error } = await supabase.from('contests').insert(row as any)
    setSaving(false)
    if (error) {
      showToast(error.message)
      return
    }
    showToast('컨테스트가 생성됐습니다')
    setModalOpen(false)
    resetForm()
    refreshAll()
  }

  const setEntryStatus = async (id: string, status: string) => {
    setBusyEntry(id)
    const { error } = await supabase.from('contest_entries').update({ status }).eq('id', id)
    setBusyEntry(null)
    if (error) showToast(error.message)
    else if (manageId) loadPanel(manageId)
  }

  const setEntryRank = async (id: string, rank_place: number | null) => {
    setBusyEntry(id)
    const { error } = await supabase
      .from('contest_entries')
      .update({ rank_place, status: rank_place ? '수상' : '승인' })
      .eq('id', id)
    setBusyEntry(null)
    if (error) showToast(error.message)
    else if (manageId) loadPanel(manageId)
  }

  const processWinner = async () => {
    if (!manageContest || !manageId || !selectedWinnerEntryId) {
      showToast('당선 작품을 선택하세요')
      return
    }
    if (manageContest.status === 'completed') {
      showToast('이미 완료된 컨테스트입니다')
      return
    }
    const entry = entries.find((x) => String(x.id) === String(selectedWinnerEntryId))
    if (!entry?.user_id) {
      showToast('작품에 작가(user_id)가 없습니다')
      return
    }
    const prize1st = Number(getSetting('contest_prize_1st', '50000'))
    const minPrize = Number(getSetting('contest_min_prize', '1000'))
    if (prize1st < minPrize) {
      showToast(`1등 상금은 최소 ${minPrize} 이상이어야 합니다 (설정: contest_min_prize)`)
      return
    }
    const brandId = String(getSetting('contest_winner_brand_id', '') || '').trim()
    if (!brandId) {
      showToast('당선작 상품 등록을 위해 설정의 contest_winner_brand_id 를 입력하세요')
      return
    }

    setAwarding(true)
    const nowIso = new Date().toISOString()
    const exp = new Date()
    exp.setDate(exp.getDate() + 30)
    const discountRate = getSetting('contest_voter_discount', '50')
    const storePrice = Number(getSetting('contest_store_price_default', '1000')) || 0
    const workTitle = entryDisplayName(entry)

    try {
      const { error: cuErr } = await supabase
        .from('contests')
        .update({
          winner_entry_id: selectedWinnerEntryId,
          winner_selected_at: nowIso,
          status: 'completed',
          awards_processed: true,
        })
        .eq('id', manageId)
      if (cuErr) {
        showToast(cuErr.message)
        return
      }

      const { data: authorRow } = await supabase.from('users').select('auth_id').eq('id', entry.user_id).maybeSingle()
      const authUid = authorRow?.auth_id ? String(authorRow.auth_id) : String(entry.user_id)

      const { error: ptErr } = await supabase.from('point_transactions').insert({
        user_id: authUid,
        amount: prize1st,
        type: 'contest_prize',
        description: '컨테스트 상금',
      })
      if (ptErr) showToast(ptErr.message)
      else {
        const { data: curPts } = await supabase.from('users').select('points').eq('id', entry.user_id).maybeSingle()
        const nextPts = Number(curPts?.points || 0) + prize1st
        await supabase.from('users').update({ points: nextPts }).eq('id', entry.user_id)
      }

      const voterIds = Array.from(new Set(votes.map((v) => v.voter_user_id).filter(Boolean))) as string[]
      const couponRows = voterIds.map((uid) => ({
        contest_id: manageId,
        user_id: uid,
        entry_id: selectedWinnerEntryId,
        discount_rate: discountRate,
        expires_at: exp.toISOString(),
      }))
      if (couponRows.length > 0) {
        const { error: cpErr } = await supabase.from('contest_voter_coupons').insert(couponRows as any)
        if (cpErr) showToast(`쿠폰 일부 실패: ${cpErr.message}`)
      }

      const voterSet = new Set(voterIds)
      const voterNotifRows = voterIds.map((uid) => ({
        user_id: uid,
        type: 'contest',
        title: '🏆 컨테스트',
        body: `투표하신 작품이 당선됐어요! 🎉 ${discountRate}% 할인 쿠폰 지급됐어요`,
        icon: '🏆',
        is_read: false,
        link: '/community?tab=contest',
        created_at: nowIso,
      }))
      if (voterNotifRows.length > 0) {
        const { error: vnErr } = await supabase.from('notifications').insert(voterNotifRows as any)
        if (vnErr) showToast(`투표자 알림: ${vnErr.message}`)
      }

      const PAGE = 200
      let start = 0
      for (;;) {
        const { data: batch, error: ubErr } = await supabase
          .from('users')
          .select('id')
          .not('auth_id', 'is', null)
          .order('id')
          .range(start, start + PAGE - 1)
        if (ubErr) {
          showToast(`비투표자 목록: ${ubErr.message}`)
          break
        }
        if (!batch?.length) break
        const nonVoterNotifs = batch
          .filter((u) => u?.id && !voterSet.has(String(u.id)))
          .map((u) => ({
            user_id: String(u.id),
            type: 'contest',
            title: '🏆 컨테스트',
            body: '이달의 당선작이 발표됐어요 🏆 지금 구매하세요',
            icon: '🏆',
            is_read: false,
            link: '/myworld',
            created_at: nowIso,
          }))
        if (nonVoterNotifs.length > 0) {
          const { error: nnErr } = await supabase.from('notifications').insert(nonVoterNotifs as any)
          if (nnErr) showToast(`비투표자 알림: ${nnErr.message}`)
        }
        if (batch.length < PAGE) break
        start += PAGE
      }

      const { error: prErr } = await supabase.from('products').insert({
        brand_id: brandId,
        name: `${workTitle} (당선작)`,
        retail_price: storePrice,
        category: 'myworld_item',
        thumb_img: entry.media_url || null,
        storage_thumb_url: entry.media_url || null,
        status: 'active',
        stock: 9999,
        description: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
      if (prErr) showToast(`제품 등록: ${prErr.message}`)

      if (manageContest.aur_exclusive && entry.media_url) {
        await supabase.from('myworld_site_config').upsert({
          id: 1,
          myworld_default_bg: String(entry.media_url),
          updated_at: nowIso,
        })
      }

      showToast('당선 처리 완료')
      refreshAll()
      loadPanel(manageId)
      setSelectedWinnerEntryId('')
    } finally {
      setAwarding(false)
    }
  }

  const inp = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '9px 11px',
    borderRadius: 8,
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: 12,
    outline: 'none',
  }

  const storeDefaultHint = getSetting('contest_store_price_default', '1000')

  return (
    <div className="admin-contests-page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🏆 컨테스트 관리</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>MARKETING · 설정값 DB · 심사 · 당선</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-gy" onClick={() => setSettingsOpen(true)}>
            ⚙️ 설정
          </button>
          <button type="button" className="btn btn-gd" onClick={() => setModalOpen(true)}>
            ＋ 컨테스트 생성
          </button>
        </div>
      </div>

      {loadErr ? <div className="alert alert-warn">{loadErr}</div> : null}

      <div className="sg sg-4" style={{ marginBottom: 20 }}>
        {[
          { k: '진행중 (status=active)', v: kpi.active, sub: 'contests', c: 'var(--green)' },
          { k: '총 출품작', v: kpi.entries, sub: 'contest_entries count', c: 'var(--blue)' },
          { k: '총 투표수', v: kpi.votes, sub: 'contest_votes count', c: 'var(--purple)' },
          { k: '이달 토스트 소각', v: kpi.toastMonth.toLocaleString(), sub: 'Σ toast_spent (당월)', c: 'var(--gold)' },
        ].map((x) => (
          <div key={x.k} className="sc">
            <div className="lbl">{x.k}</div>
            <div className="val" style={{ color: x.c }}>
              {typeof x.v === 'number' ? x.v.toLocaleString() : x.v}
            </div>
            <div className="sub dim">{x.sub}</div>
          </div>
        ))}
      </div>
      <div className="sc" style={{ marginBottom: 16 }}>
        <div className="lbl">전체 누적 토스트 소각</div>
        <div className="val" style={{ color: 'var(--gold2)' }}>
          {kpi.toastTotal.toLocaleString()}
        </div>
        <div className="sub dim">Σ contest_votes.toast_spent</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(
          [
            ['active', '진행중'],
            ['upcoming', '예정'],
            ['ended', '종료'],
            ['all', '전체'],
          ] as const
        ).map(([k, lab]) => (
          <button
            key={k}
            type="button"
            className={`btn ${listTab === k ? 'btn-gd' : 'btn-gy'}`}
            onClick={() => setListTab(k)}
          >
            {lab}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredContests.length === 0 ? (
          <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            목록이 없습니다
          </div>
        ) : (
          filteredContests.map((c) => {
            const phase = contestPhase(c, now)
            const a = contestAgg[String(c.id)] || { entries: 0, voteCount: 0, toastSum: 0 }
            return (
              <div key={c.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{c.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                      테마 {c.theme} · {new Date(c.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(c.ends_at).toLocaleDateString('ko-KR')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="b b-pu">{dDayLabel(c, now)}</span>
                      <span className={phase === '진행중' ? 'b b-gr' : phase === '예정' ? 'b b-bl' : 'b b-gy'}>{phase}</span>
                      {c.status ? <span className="b b-tl">DB:{String(c.status)}</span> : null}
                      <span className="b b-gy">투표: {c.vote_mode === 'toast' ? '토스트' : c.vote_mode === 'free' ? '무료' : '경매'}</span>
                      {c.is_public === false ? <span className="b b-re">비공개</span> : <span className="b b-gr">공개</span>}
                    </div>
                  </div>
                  <button type="button" className="btn btn-bl" onClick={() => setManageId(c.id)}>
                    관리
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12, fontSize: 10, color: 'var(--text2)' }}>
                  <div>
                    참여 작품
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                      {a.entries}
                    </div>
                  </div>
                  <div>
                    총 투표
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                      {a.voteCount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    토스트 소각
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                      {a.toastSum.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    최대 작품
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                      {c.max_entries ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {settingsOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-title" style={{ marginBottom: 8 }}>
              컨테스트 설정값
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>변경 즉시 반영됩니다. 배포 불필요.</div>
            {SETTING_KEYS.map(({ key, label, fallback }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type="number"
                  style={inp}
                  value={getSetting(key, fallback)}
                  onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
                  onBlur={(e) => persistSetting(key, e.target.value)}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>당선작 등록 브랜드 ID (UUID)</label>
              <input
                type="text"
                style={inp}
                value={getSetting('contest_winner_brand_id', '')}
                onChange={(e) => setSettings((p) => ({ ...p, contest_winner_brand_id: e.target.value }))}
                onBlur={(e) => persistSetting('contest_winner_brand_id', e.target.value.trim())}
                placeholder="products.brand_id"
              />
            </div>
            <button type="button" className="btn btn-gy" onClick={() => setSettingsOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-title" style={{ marginBottom: 14 }}>
              새 컨테스트
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
              당선 시 스토어 정가(설정): {storeDefaultHint} T · 최대 참여(설정 기본): {getSetting('contest_max_entries', '100')}
            </div>
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>컨테스트명</label>
            <input style={{ ...inp, marginBottom: 10 }} value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="제목" />
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>테마</label>
            <select style={{ ...inp, marginBottom: 10 }} value={fTheme} onChange={(e) => setFTheme(e.target.value)}>
              {['봄', '여름', '가을', '겨울', '한국전통', '브랜드콜라보', '고객참여', '특별'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text3)' }}>시작일</label>
                <input type="date" style={inp} value={fStart} onChange={(e) => setFStart(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text3)' }}>종료일</label>
                <input type="date" style={inp} value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>투표 방식</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name="vm" checked={fVoteMode === 'toast'} onChange={() => setFVoteMode('toast')} />① 토스트 투표 (1표 = NT 소각)
              </label>
              {fVoteMode === 'toast' ? (
                <input
                  type="number"
                  min={1}
                  style={{ ...inp, marginLeft: 22 }}
                  value={fToastN}
                  onChange={(e) => setFToastN(Number(e.target.value))}
                  placeholder={getSetting('contest_vote_cost', '10')}
                />
              ) : null}
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name="vm" checked={fVoteMode === 'free'} onChange={() => setFVoteMode('free')} />② 무료 투표 (1회 제한)
              </label>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name="vm" checked={fVoteMode === 'auction'} onChange={() => setFVoteMode('auction')} />③ 경매 방식 (최고가 낙찰)
              </label>
            </div>
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>최대 참여 작품 수</label>
            <input type="number" min={1} style={{ ...inp, marginBottom: 10 }} value={fMaxEntries} onChange={(e) => setFMaxEntries(Number(e.target.value))} />
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>상금 설정</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select style={inp} value={fP1Type} onChange={(e) => setFP1Type(e.target.value as 'toast' | 'cash')}>
                <option value="toast">1등: 토스트</option>
                <option value="cash">1등: 현금(원)</option>
              </select>
              <input type="number" min={0} style={inp} value={fP1Val} onChange={(e) => setFP1Val(Number(e.target.value))} placeholder={getSetting('contest_prize_1st', '50000')} />
            </div>
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>2등 토스트</label>
            <input type="number" min={0} style={{ ...inp, marginBottom: 8 }} value={fP2} onChange={(e) => setFP2(Number(e.target.value))} placeholder={getSetting('contest_prize_2nd', '30000')} />
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>3등 토스트</label>
            <input type="number" min={0} style={{ ...inp, marginBottom: 10 }} value={fP3} onChange={(e) => setFP3(Number(e.target.value))} placeholder={getSetting('contest_prize_3rd', '10000')} />
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={fAur} onChange={(e) => setFAur(e.target.checked)} />
              AURAN 독점 구매 (ON 시 1등 작품 → 전 고객 기본 배경)
            </label>
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>참여 자격</label>
            <select style={{ ...inp, marginBottom: 10 }} value={fElig} onChange={(e) => setFElig(e.target.value as 'creators_only' | 'customers_ok')}>
              <option value="creators_only">작가만</option>
              <option value="customers_ok">고객도 참여</option>
            </select>
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <input type="checkbox" checked={fPublic} onChange={(e) => setFPublic(e.target.checked)} />
              공개
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-gy" onClick={() => setModalOpen(false)}>
                취소
              </button>
              <button type="button" className="btn btn-gr" disabled={saving} onClick={saveContest}>
                {saving ? '저장…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manageId && manageContest ? (
        <div
          style={{
            position: 'fixed',
            top: 54,
            right: 0,
            width: 'min(440px, 100vw)',
            bottom: 0,
            background: 'var(--bg2)',
            borderLeft: '1px solid var(--border)',
            zIndex: 40,
            overflowY: 'auto',
            padding: 16,
            boxShadow: '-8px 0 28px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>심사 · {manageContest.title}</div>
            <button type="button" className="btn btn-gy" onClick={() => setManageId(null)}>
              닫기
            </button>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="card-title" style={{ fontSize: 12 }}>
              참여 작품
            </div>
            {entries.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', padding: 8 }}>제출 작품이 없습니다</div>
            ) : (
              entries.map((en) => (
                <div
                  key={en.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)' }}>
                    {en.media_url ? <img src={en.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{entryDisplayName(en)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(en.submitted_at).toLocaleString('ko-KR')}</div>
                    <div style={{ fontSize: 9, marginTop: 4 }}>
                      투표 {en.vote_count} · 토스트 {Number(en.toast_burned || 0).toLocaleString()} · {en.status}
                      {en.rank_place ? ` · ${en.rank_place}등 지정` : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <button type="button" className="btn btn-gr" disabled={busyEntry === en.id} onClick={() => setEntryStatus(en.id, '승인')}>
                        승인
                      </button>
                      <button type="button" className="btn btn-re" disabled={busyEntry === en.id} onClick={() => setEntryStatus(en.id, '거절')}>
                        거절
                      </button>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>수상</span>
                      <select
                        disabled={busyEntry === en.id}
                        value={en.rank_place == null ? '' : String(en.rank_place)}
                        onChange={(e) => {
                          const v = e.target.value
                          setEntryRank(en.id, v === '' ? null : Number(v))
                        }}
                        style={{ ...inp, width: 'auto', minWidth: 120, fontSize: 10 }}
                      >
                        <option value="">등수 미정</option>
                        <option value="1">1등 (수상)</option>
                        <option value="2">2등 (수상)</option>
                        <option value="3">3등 (수상)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>당선 작품 (수상 처리 시 반영)</label>
            <select
              style={inp}
              value={selectedWinnerEntryId}
              onChange={(e) => setSelectedWinnerEntryId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {entries.map((en) => (
                <option key={en.id} value={en.id}>
                  {entryDisplayName(en)} · {String(en.id).slice(0, 8)}…
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-gd"
            style={{ width: '100%', marginBottom: 14 }}
            disabled={awarding || manageContest.status === 'completed'}
            onClick={processWinner}
          >
            {awarding ? '처리 중…' : '수상 처리'}
          </button>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="card-title" style={{ fontSize: 12 }}>
              투표 현황 (5초 갱신)
            </div>
            {rankSorted.map(({ e, agg }) => (
              <div key={e.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>
                  {entryDisplayName(e)} · 투표 {agg.votes} · 소각토스트 {agg.toast.toLocaleString()}
                </div>
                <div className="bar-track" style={{ height: 10 }}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(agg.votes / maxRankVotes) * 100}%`,
                      background: 'linear-gradient(90deg,#6b4f9e,#9568d4,#c9a84c)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="card-title" style={{ fontSize: 12 }}>
              통계
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 6 }}>
              시간대별 투표 집중: {hourPeak.n > 0 ? `${hourPeak.hr}시대 (${hourPeak.n}표)` : '데이터 없음'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {hourBuckets.map((n, hr) =>
                n > 0 ? (
                  <div key={hr} style={{ fontSize: 9, color: 'var(--text3)' }}>
                    {hr}h:{n}
                  </div>
                ) : null
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>등급별 투표 비율</div>
            {Object.entries(gradeBuckets).map(([g, n]) => (
              <div key={g} className="bar-row">
                <div className="bar-label">{g}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(n / gradeTotal) * 100}%`, background: 'var(--blue)' }} />
                </div>
                <div className="bar-val">{n}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, marginTop: 10, color: 'var(--gold)' }}>총 토스트 소각량: {voteToastSum.toLocaleString()}</div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 120,
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 12,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
