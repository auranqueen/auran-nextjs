'use client'

/*
 * Supabase SQL Editor에서 테이블이 없을 때 실행:
 *
 * create extension if not exists "pgcrypto";
 *
 * create table public.contests (
 *   id uuid primary key default gen_random_uuid(),
 *   title text not null,
 *   theme text not null default '특별',
 *   start_at timestamptz not null,
 *   end_at timestamptz not null,
 *   vote_mode text not null default 'toast',
 *   toast_per_vote integer not null default 1,
 *   max_entries integer not null default 50,
 *   prize_1st_type text,
 *   prize_1st_value integer not null default 0,
 *   prize_2nd_toast integer not null default 0,
 *   prize_3rd_toast integer not null default 0,
 *   aur_exclusive boolean not null default false,
 *   eligibility text not null default 'creators_only',
 *   is_public boolean not null default true,
 *   awards_processed boolean not null default false,
 *   created_at timestamptz not null default now()
 * );
 *
 * create table public.contest_entries (
 *   id uuid primary key default gen_random_uuid(),
 *   contest_id uuid not null references public.contests(id) on delete cascade,
 *   user_id uuid references public.users(id) on delete set null,
 *   media_url text,
 *   artist_name text,
 *   status text not null default '심사중',
 *   rank_place smallint,
 *   vote_count integer not null default 0,
 *   toast_burned bigint not null default 0,
 *   submitted_at timestamptz not null default now()
 * );
 * create index contest_entries_contest_id_idx on public.contest_entries(contest_id);
 *
 * create table public.contest_votes (
 *   id uuid primary key default gen_random_uuid(),
 *   contest_id uuid not null references public.contests(id) on delete cascade,
 *   entry_id uuid not null references public.contest_entries(id) on delete cascade,
 *   voter_user_id uuid references public.users(id) on delete set null,
 *   votes_count integer not null default 1,
 *   toast_spent integer not null default 0,
 *   voter_grade text,
 *   created_at timestamptz not null default now()
 * );
 * create index contest_votes_contest_id_idx on public.contest_votes(contest_id);
 * create index contest_votes_entry_id_idx on public.contest_votes(entry_id);
 * create index contest_votes_created_at_idx on public.contest_votes(created_at);
 *
 * create table public.myworld_site_config (
 *   id smallint primary key default 1 check (id = 1),
 *   myworld_default_bg text,
 *   updated_at timestamptz default now()
 * );
 * insert into public.myworld_site_config (id) values (1) on conflict (id) do nothing;
 *
 * alter table public.contest_entries enable row level security;
 * alter table public.contest_votes enable row level security;
 * alter table public.contests enable row level security;
 * alter table public.myworld_site_config enable row level security;
 * -- RLS 정책은 서비스/관리자 역할에 맞게 별도 설정
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ListTab = 'active' | 'upcoming' | 'ended' | 'all'

function contestPhase(c: { start_at: string; end_at: string }, now: Date): '진행중' | '예정' | '종료' {
  const s = new Date(c.start_at).getTime()
  const e = new Date(c.end_at).getTime()
  const t = now.getTime()
  if (t < s) return '예정'
  if (t > e) return '종료'
  return '진행중'
}

function dDayLabel(c: { start_at: string; end_at: string }, now: Date): string {
  const phase = contestPhase(c, now)
  const end = new Date(c.end_at)
  const start = new Date(c.start_at)
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
  const [contests, setContests] = useState<any[]>([])
  const [contestAgg, setContestAgg] = useState<Record<string, { entries: number; voteCount: number; toastSum: number }>>({})
  const [kpi, setKpi] = useState({ active: 0, entries: 0, votes: 0, toastTotal: 0, toastMonth: 0 })
  const [listTab, setListTab] = useState<ListTab>('active')
  const [toast, setToast] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fTitle, setFTitle] = useState('')
  const [fTheme, setFTheme] = useState('봄')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [fVoteMode, setFVoteMode] = useState<'toast' | 'free' | 'auction'>('toast')
  const [fToastN, setFToastN] = useState(1)
  const [fMaxEntries, setFMaxEntries] = useState(50)
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

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2800)
  }

  const refreshAll = useCallback(async () => {
    setLoadErr(null)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [cRes, eRes, vRes, vmRes, entListRes, voteListRes] = await Promise.all([
      supabase.from('contests').select('*').order('start_at', { ascending: false }),
      supabase.from('contest_entries').select('id', { count: 'exact', head: true }),
      supabase.from('contest_votes').select('toast_spent, votes_count', { count: 'exact' }),
      supabase.from('contest_votes').select('toast_spent').gte('created_at', monthStart.toISOString()),
      supabase.from('contest_entries').select('contest_id, vote_count, toast_burned'),
      supabase.from('contest_votes').select('contest_id, toast_spent, votes_count'),
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
    const agg: Record<string, { entries: number; voteCount: number; toastSum: number }> = {}
    ;(entListRes.data || []).forEach((row: any) => {
      const cid = String(row.contest_id)
      if (!agg[cid]) agg[cid] = { entries: 0, voteCount: 0, toastSum: 0 }
      agg[cid].entries += 1
    })
    ;(voteListRes.data || []).forEach((row: any) => {
      const cid = String(row.contest_id)
      if (!agg[cid]) agg[cid] = { entries: 0, voteCount: 0, toastSum: 0 }
      agg[cid].voteCount += Number(row.votes_count || 0)
      agg[cid].toastSum += Number(row.toast_spent || 0)
    })
    setContestAgg(agg)
    const n = new Date()
    const active = list.filter((c) => contestPhase(c, n) === '진행중').length
    const entriesCount = typeof eRes.count === 'number' ? eRes.count : 0
    let toastTotal = 0
    let votesCount = 0
    const voteRowsForSum = voteListRes.data && !voteListRes.error ? voteListRes.data : vRes.data || []
    voteRowsForSum.forEach((row: any) => {
      toastTotal += Number(row.toast_spent || 0)
      votesCount += Number(row.votes_count || 0)
    })
    let toastMonth = 0
    if (!vmRes.error && vmRes.data) {
      vmRes.data.forEach((row: any) => {
        toastMonth += Number(row.toast_spent || 0)
      })
    }
    setKpi({
      active,
      entries: entriesCount,
      votes: votesCount,
      toastTotal,
      toastMonth,
    })
  }, [supabase])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

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
    [supabase]
  )

  useEffect(() => {
    if (!manageId) return
    loadPanel(manageId)
    const iv = setInterval(() => loadPanel(manageId), 5000)
    return () => clearInterval(iv)
  }, [manageId, loadPanel])

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
    setFToastN(1)
    setFMaxEntries(50)
    setFP1Type('toast')
    setFP1Val(0)
    setFP2(0)
    setFP3(0)
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
    const row = {
      title: fTitle.trim(),
      theme: fTheme,
      start_at: new Date(fStart).toISOString(),
      end_at: new Date(fEnd).toISOString(),
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

  const processAwards = async () => {
    if (!manageContest || !manageId) return
    if (manageContest.awards_processed) {
      showToast('이미 수상 처리됨')
      return
    }
    const ranked = entries.filter((e) => e.rank_place === 1 || e.rank_place === 2 || e.rank_place === 3)
    if (ranked.length === 0) {
      showToast('1~3등(rank_place)을 먼저 지정하세요')
      return
    }
    setAwarding(true)
    const titleBase = manageContest.title || '컨테스트'
    try {
      for (const en of ranked) {
        const profileUserId = en.user_id
        if (!profileUserId) continue
        const { data: urow } = await supabase.from('users').select('auth_id').eq('id', profileUserId).maybeSingle()
        const authUid = urow?.auth_id ? String(urow.auth_id) : String(profileUserId)
        const r = Number(en.rank_place)
        let toastAmt = 0
        if (r === 1 && manageContest.prize_1st_type === 'toast') toastAmt = Number(manageContest.prize_1st_value || 0)
        if (r === 2) toastAmt = Number(manageContest.prize_2nd_toast || 0)
        if (r === 3) toastAmt = Number(manageContest.prize_3rd_toast || 0)
        if (toastAmt > 0) {
          await supabase.from('point_transactions').insert({
            user_id: authUid,
            amount: toastAmt,
            type: 'contest_prize',
            description: `${titleBase} ${r}등 상금(토스트)`,
          })
          const { data: curPts } = await supabase.from('users').select('points').eq('id', profileUserId).maybeSingle()
          const nextPts = Number(curPts?.points || 0) + toastAmt
          await supabase.from('users').update({ points: nextPts }).eq('id', profileUserId)
        }
        if (r === 1 && manageContest.prize_1st_type === 'cash' && Number(manageContest.prize_1st_value || 0) > 0) {
          await supabase.from('notifications').insert({
            user_id: authUid,
            type: 'contest',
            title: '🏆 컨테스트 수상',
            body: `${titleBase} 1등 현금 ${Number(manageContest.prize_1st_value).toLocaleString()}원 — 관리자 지급 안내`,
            icon: '🏆',
            is_read: false,
            created_at: new Date().toISOString(),
          })
        } else {
          await supabase.from('notifications').insert({
            user_id: authUid,
            type: 'contest',
            title: '🏆 컨테스트 수상',
            body: `${titleBase}에서 ${r}등으로 선정되었습니다.`,
            icon: '🏆',
            is_read: false,
            created_at: new Date().toISOString(),
          })
        }
      }
      const first = ranked.find((e) => Number(e.rank_place) === 1)
      if (manageContest.aur_exclusive && first?.media_url) {
        await supabase.from('myworld_site_config').upsert({
          id: 1,
          myworld_default_bg: String(first.media_url),
          updated_at: new Date().toISOString(),
        })
      }
      await supabase.from('contests').update({ awards_processed: true }).eq('id', manageId)
      showToast('수상 처리 완료')
      refreshAll()
      loadPanel(manageId)
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

  return (
    <div className="admin-contests-page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🏆 컨테스트 관리</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>MARKETING · 진행 현황 · 심사 · 수상</div>
        </div>
        <button type="button" className="btn btn-gd" onClick={() => setModalOpen(true)}>
          ＋ 컨테스트 생성
        </button>
      </div>

      {loadErr ? <div className="alert alert-warn">{loadErr}</div> : null}

      <div className="sg sg-4" style={{ marginBottom: 20 }}>
        {[
          { k: '진행 중', v: kpi.active, sub: '컨테스트', c: 'var(--green)' },
          { k: '총 참여 작품', v: kpi.entries, sub: 'contest_entries', c: 'var(--blue)' },
          { k: '총 투표 수', v: kpi.votes.toLocaleString(), sub: `누적 토스트 소각 ${kpi.toastTotal.toLocaleString()}T`, c: 'var(--purple)' },
          { k: '이달 토스트 소각', v: kpi.toastMonth.toLocaleString(), sub: 'Σ toast_spent (당월)', c: 'var(--gold)' },
        ].map((x) => (
          <div key={x.k} className="sc">
            <div className="lbl">{x.k}</div>
            <div className="val" style={{ color: x.c }}>
              {x.v}
            </div>
            <div className="sub dim">{x.sub}</div>
          </div>
        ))}
      </div>
      <div className="sc" style={{ marginBottom: 16 }}>
        <div className="lbl">전체 누적 토스트 소각 (투표)</div>
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
                      테마 {c.theme} · {new Date(c.start_at).toLocaleDateString('ko-KR')} ~ {new Date(c.end_at).toLocaleDateString('ko-KR')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="b b-pu">{dDayLabel(c, now)}</span>
                      <span className={phase === '진행중' ? 'b b-gr' : phase === '예정' ? 'b b-bl' : 'b b-gy'}>{phase}</span>
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
                  placeholder="N"
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
              <input type="number" min={0} style={inp} value={fP1Val} onChange={(e) => setFP1Val(Number(e.target.value))} placeholder="N" />
            </div>
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>2등 토스트</label>
            <input type="number" min={0} style={{ ...inp, marginBottom: 8 }} value={fP2} onChange={(e) => setFP2(Number(e.target.value))} />
            <label style={{ fontSize: 10, color: 'var(--text3)' }}>3등 토스트</label>
            <input type="number" min={0} style={{ ...inp, marginBottom: 10 }} value={fP3} onChange={(e) => setFP3(Number(e.target.value))} />
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
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{en.artist_name || '작가'}</div>
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

          <button type="button" className="btn btn-gd" style={{ width: '100%', marginBottom: 14 }} disabled={awarding} onClick={processAwards}>
            {awarding ? '처리 중…' : '수상 처리 (상금·알림·기본배경)'}
          </button>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="card-title" style={{ fontSize: 12 }}>
              투표 현황 (5초 갱신)
            </div>
            {rankSorted.slice(0, 8).map(({ e, agg }) => (
              <div key={e.id} className="bar-row">
                <div className="bar-label" style={{ width: 100, textAlign: 'left' }}>
                  {(e.artist_name || '').slice(0, 6)}
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(agg.votes / maxRankVotes) * 100}%`, background: 'linear-gradient(90deg,var(--purple),var(--gold))' }}
                  />
                </div>
                <div className="bar-val">{agg.votes}</div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>토스트 소각 막대 (투표 대비)</div>
            {rankSorted.slice(0, 8).map(({ e, agg }) => {
              const mt = Math.max(1, ...rankSorted.map((r) => r.agg.toast))
              return (
                <div key={`t-${e.id}`} className="bar-row">
                  <div className="bar-label" style={{ width: 100, textAlign: 'left' }}>
                    {(e.artist_name || '').slice(0, 6)}
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(agg.toast / mt) * 100}%`, background: 'var(--gold)' }} />
                  </div>
                  <div className="bar-val">{agg.toast}</div>
                </div>
              )
            })}
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
