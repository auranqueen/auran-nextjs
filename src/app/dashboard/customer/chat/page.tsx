'use client'

import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import DashboardHeader from '@/components/DashboardHeader'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

type FilterTab = 'all' | 'consult' | 'order' | 'auran'

type ChannelRow = {
  id: string
  user_id: string
  title?: string | null
  channel_type?: string | null
  system_kind?: string | null
  preview_text?: string | null
  last_message_at?: string | null
  unread_count?: number | null
  is_online?: boolean | null
}

const SYSTEM_ORDER = ['order_delivery', 'auran_corner', 'grade_toast'] as const

function sortChannels(rows: ChannelRow[]): ChannelRow[] {
  const official = rows.filter((r) => r.channel_type === 'official')
  const directors = rows
    .filter((r) => r.channel_type === 'director')
    .sort((a, b) => {
      const ta = new Date(a.last_message_at || 0).getTime()
      const tb = new Date(b.last_message_at || 0).getTime()
      return tb - ta
    })
  const systems = rows
    .filter((r) => r.channel_type === 'system')
    .sort((a, b) => {
      const ia = SYSTEM_ORDER.indexOf((a.system_kind || '') as (typeof SYSTEM_ORDER)[number])
      const ib = SYSTEM_ORDER.indexOf((b.system_kind || '') as (typeof SYSTEM_ORDER)[number])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  return [...official, ...directors, ...systems]
}

function systemLabel(kind: string | null | undefined): string {
  const m: Record<string, string> = {
    order_delivery: '주문배송',
    auran_corner: '오랜곳간',
    grade_toast: '등급토스트',
  }
  return m[kind || ''] || '알림'
}

function matchesFilter(row: ChannelRow, tab: FilterTab): boolean {
  if (tab === 'all') return true
  const ct = row.channel_type
  const sk = row.system_kind
  if (tab === 'consult') return ct === 'director'
  if (tab === 'order') return ct === 'system' && sk === 'order_delivery'
  if (tab === 'auran') {
    return ct === 'official' || (ct === 'system' && (sk === 'auran_corner' || sk === 'grade_toast'))
  }
  return true
}

export default function CustomerChatListPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

  const loadChannels = useCallback(async () => {
    if (!loading) setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let authUser = user
    if (!user) {
      await new Promise((r) => setTimeout(r, 600))
      const {
        data: { user: user2 },
      } = await supabase.auth.getUser()
      if (!user2) {
        setLoading(false)
        router.replace('/login?role=customer')
        return
      }
      authUser = user2
    }
    if (!authUser) return
    const { data: urow } = await supabase.from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
    if (!urow?.id) {
      setLoading(false)
      router.replace('/login?role=customer')
      return
    }
    const { data, error } = await supabase
      .from('chat_channels')
      .select('id,user_id,title,channel_type,system_kind,preview_text,last_message_at,unread_count,is_online')
      .eq('user_id', urow.id)
    if (error) {
      setChannels([])
      setLoading(false)
      return
    }
    setChannels(sortChannels((data || []) as ChannelRow[]))
    setLoading(false)
    if (typeParam) {
      const { data: ownerRow } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('user_id', urow.id)
        .eq('channel_type', 'owner')
        .maybeSingle()
      if (ownerRow?.id) {
        router.push(`/dashboard/customer/chat/${ownerRow.id}?type=${encodeURIComponent(typeParam)}`)
        return
      }
      const { data: inserted, error: insErr } = await supabase
        .from('chat_channels')
        .insert({
          user_id: urow.id,
          channel_type: 'owner',
          title: '원장님 상담',
          system_kind: null,
          preview_text: '',
          unread_count: 0,
          is_online: false,
        } as any)
        .select('id')
        .maybeSingle()
      if (!insErr && inserted?.id) {
        router.push(`/dashboard/customer/chat/${inserted.id}?type=${encodeURIComponent(typeParam)}`)
      }
    }
  }, [router])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  const visible = useMemo(() => {
    return channels.filter((c) => matchesFilter(c, filterTab))
  }, [channels, filterTab])

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'consult', label: '상담' },
    { id: 'order', label: '주문' },
    { id: 'auran', label: 'AURAN' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
      <DashboardHeader title="상담" right={<CustomerHeaderRight />} />

      <div style={{ padding: '10px 16px 12px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {tabs.map((t) => {
          const on = filterTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                borderRadius: 999,
                border: on ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.1)',
                background: on ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)',
                color: on ? '#e8dff5' : TEXT_MUTED,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: TEXT_MUTED, padding: '24px 0' }}>불러오는 중…</div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 13, color: TEXT_MUTED, padding: '24px 0' }}>채널이 없어요</div>
        ) : (
          visible.map((ch) => {
            const isOfficial = ch.channel_type === 'official'
            const isDirector = ch.channel_type === 'director'
            const isSystem = ch.channel_type === 'system'
            const subtitle = isSystem ? systemLabel(ch.system_kind) : isOfficial ? 'AURAN 공식' : '원장님'
            const unread = Math.max(0, Number(ch.unread_count || 0))
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => router.push(`/dashboard/customer/chat/${ch.id}`)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: isOfficial
                        ? `linear-gradient(135deg, ${PURPLE}, ${GOLD})`
                        : 'rgba(123,94,167,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    {isOfficial ? 'A' : isSystem ? '🔔' : '👩'}
                  </div>
                  {(isDirector || isOfficial) && ch.is_online ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#4cad7e',
                        border: `2px solid ${BG}`,
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.title || '채팅'}
                    </span>
                    <span style={{ fontSize: 11, color: GOLD, flexShrink: 0 }}>{subtitle}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ch.preview_text || '새로운 메시지가 없어요'}
                  </div>
                </div>
                {unread > 0 ? (
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      padding: '0 6px',
                      borderRadius: 999,
                      background: PURPLE,
                      color: '#fff',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {unread > 99 ? '99+' : unread}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>›</div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
