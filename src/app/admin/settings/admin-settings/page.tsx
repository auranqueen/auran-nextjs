'use client'

import { useMemo, useState } from 'react'
import { useAdminSettings } from '@/hooks/useAdminSettings'

type ValueType = 'number' | 'text' | 'json'

type SettingMeta = {
  label: string
  unit?: string
  type: ValueType
  defaultValue: string
}

const META: Record<string, { label: string; keys: Record<string, SettingMeta> }> = {
  points_action: {
    label: '활동 포인트',
    keys: {
      journal_write: { label: '저널 작성 포인트', unit: 'P', type: 'number', defaultValue: '50' },
      journal_with_photo: { label: '사진포함 저널 포인트', unit: 'P', type: 'number', defaultValue: '100' },
      review_write: { label: '후기 작성 포인트', unit: 'P', type: 'number', defaultValue: '200' },
      receive_like: { label: '공감 받기 포인트', unit: 'P', type: 'number', defaultValue: '10' },
      get_follower: { label: '팔로워 생길 때 포인트', unit: 'P', type: 'number', defaultValue: '30' },
      share_purchase: { label: '내 링크로 구매 발생 포인트', unit: 'P', type: 'number', defaultValue: '500' },
      streak_7days: { label: '7일 연속 저널 보너스', unit: 'P', type: 'number', defaultValue: '300' },
      streak_30days: { label: '30일 연속 저널 보너스', unit: 'P', type: 'number', defaultValue: '1000' },
      ai_analysis_complete: { label: 'AI 피부분석 완료 포인트', unit: 'P', type: 'number', defaultValue: '500' },
      signup_welcome: { label: '회원가입 환영 포인트', unit: 'P', type: 'number', defaultValue: '500' },
    },
  },
  points_payment: {
    label: '결제 포인트',
    keys: {
      wallet_charge_rate: { label: '지갑 충전 적립률', unit: '%', type: 'number', defaultValue: '5' },
      purchase_reward_rate: { label: '구매 적립률', unit: '%', type: 'number', defaultValue: '3' },
      review_purchase_bonus: { label: '구매후기 추가 포인트', unit: 'P', type: 'number', defaultValue: '100' },
    },
  },
  star_level: {
    label: '스타 등급',
    keys: {
      lv2_journals: { label: '글로우 등급 저널 수', unit: '개', type: 'number', defaultValue: '5' },
      lv2_followers: { label: '글로우 등급 팔로워 수', unit: '명', type: 'number', defaultValue: '10' },
      lv3_journals: { label: '뷰티스타 저널 수', unit: '개', type: 'number', defaultValue: '20' },
      lv3_followers: { label: '뷰티스타 팔로워 수', unit: '명', type: 'number', defaultValue: '50' },
      lv3_reviews: { label: '뷰티스타 후기 수', unit: '개', type: 'number', defaultValue: '3' },
      lv4_journals: { label: '인플루언서 저널 수', unit: '개', type: 'number', defaultValue: '50' },
      lv4_followers: { label: '인플루언서 팔로워 수', unit: '명', type: 'number', defaultValue: '200' },
      lv4_likes: { label: '인플루언서 공감 수', unit: '개', type: 'number', defaultValue: '500' },
      lv5_followers: { label: 'AURAN퀸 팔로워 수', unit: '명', type: 'number', defaultValue: '500' },
      lv5_likes: { label: 'AURAN퀸 공감 수', unit: '개', type: 'number', defaultValue: '2000' },
      lv5_purchase_leads: { label: 'AURAN퀸 구매유도 수', unit: '건', type: 'number', defaultValue: '50' },
    },
  },
  star_benefit: {
    label: '혜택',
    keys: {
      lv2_charge_bonus: { label: '글로우 충전 보너스', unit: '%', type: 'number', defaultValue: '3' },
      lv4_revenue_share: { label: '인플루언서 수익쉐어', unit: '%', type: 'number', defaultValue: '10' },
      lv5_revenue_share: { label: 'AURAN퀸 수익쉐어', unit: '%', type: 'number', defaultValue: '20' },
    },
  },
  referral: {
    label: '추천인',
    keys: {
      referrer_reward: { label: '추천인 보상 포인트', unit: 'P', type: 'number', defaultValue: '3000' },
      referee_reward: { label: '피추천인 보상 포인트', unit: 'P', type: 'number', defaultValue: '1000' },
      owner_recruit_reward: { label: '원장님 추천 보상', unit: 'P', type: 'number', defaultValue: '10000' },
    },
  },
}

export default function AdminSettingsAdminSettingsPage() {
  const { settings, loading, saving, error, saved, set, saveCategory } = useAdminSettings()
  const [active, setActive] = useState<string>('points_action')

  const categories = useMemo(() => Object.keys(META), [])
  const activeMeta = META[active]

  const rows = activeMeta?.keys ? Object.entries(activeMeta.keys) : []

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>플랫폼 설정</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
          category별 key 값을 관리합니다. (테이블: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>admin_settings</span>)
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {categories.map(c => {
          const isActive = c === active
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              style={{
                flex: 1,
                padding: '10px 10px',
                borderRadius: 12,
                border: `1px solid ${isActive ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                background: isActive ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                color: isActive ? '#c9a84c' : 'rgba(255,255,255,0.75)',
                fontWeight: 900,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {META[c].label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
          {rows.map(([key, meta]) => {
            const current = settings[active]?.[key] ?? meta.defaultValue
            const unit = meta.unit ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{meta.unit}</span> : null

            return (
              <div key={key} style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{meta.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                      {key}
                    </div>
                  </div>
                  {unit}
                </div>

                {meta.type === 'number' ? (
                  <input
                    type="number"
                    value={Number(current)}
                    onChange={e => set(active, key, Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      padding: '10px 10px',
                      color: '#fff',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                ) : (
                  <textarea
                    value={current}
                    onChange={e => set(active, key, e.target.value)}
                    rows={meta.type === 'json' ? 4 : 2}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      padding: '10px 10px',
                      color: '#fff',
                      fontSize: 12,
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, background: 'rgba(217,79,79,0.10)', border: '1px solid rgba(217,79,79,0.25)', borderRadius: 12, padding: 12, color: '#e08080', fontSize: 13 }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ marginTop: 12, background: 'rgba(76,173,126,0.10)', border: '1px solid rgba(76,173,126,0.35)', borderRadius: 12, padding: 12, color: '#83d3a8', fontSize: 13 }}>
          설정이 저장됐어요 ✓
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            saveCategory(
              active,
              Object.fromEntries(
                Object.entries(activeMeta.keys).map(([k, m]) => [k, { label: m.label, unit: m.unit || '', value_type: m.type }])
              )
            )
          }
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: '#c9a84c',
            border: 'none',
            color: '#111',
            fontWeight: 900,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

