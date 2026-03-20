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
  skin_quiz: {
    label: '스킨 퀴즈',
    keys: {
      reward_points: { label: '분석 완료 적립 포인트', unit: 'P', type: 'number', defaultValue: '500' },
      recommend_product_limit: { label: '추천 제품 개수', unit: 'EA', type: 'number', defaultValue: '5' },
      product_search_limit: { label: '상품 검색 제한', unit: 'EA', type: 'number', defaultValue: '200' },
      product_min_price: { label: '최소 표시 가격', unit: '원', type: 'number', defaultValue: '0' },
      quiz_deltas_json: { label: '퀴즈 가중치(dry/oily/...) 매핑', type: 'json', defaultValue: '{}' },
    },
  },
  myworld: {
    label: '마이월드',
    keys: {
      guestbook_max_chars: { label: '방명록 최대 글자수', unit: '자', type: 'number', defaultValue: '300' },
      journals_fetch_limit: { label: '스킨저널 로드 개수', unit: 'EA', type: 'number', defaultValue: '30' },
      guestbook_fetch_limit: { label: '방명록 로드 개수', unit: 'EA', type: 'number', defaultValue: '50' },
      orders_fetch_limit: { label: '주문 로드 개수', unit: 'EA', type: 'number', defaultValue: '30' },
      review_max_images: { label: '후기 업로드 최대 이미지', unit: '장', type: 'number', defaultValue: '5' },
      review_preview_max: { label: '후기 미리보기 이미지', unit: '장', type: 'number', defaultValue: '4' },
      review_star_min: { label: '별점 최소', unit: '', type: 'number', defaultValue: '1' },
      review_star_max: { label: '별점 최대', unit: '', type: 'number', defaultValue: '5' },
      journal_score_min: { label: '저널 점수 최소', unit: '', type: 'number', defaultValue: '1' },
      journal_score_max: { label: '저널 점수 최대', unit: '', type: 'number', defaultValue: '5' },
      journal_score_default: { label: '저널 점수 기본값', unit: '', type: 'number', defaultValue: '3' },
    },
  },
  journal_public: {
    label: '공개 저널',
    keys: {
      guestbook_fetch_limit: { label: '공개 저널 방명록 로드 개수', unit: 'EA', type: 'number', defaultValue: '20' },
      used_products_preview_max: { label: '사용 제품 표시 개수', unit: 'EA', type: 'number', defaultValue: '4' },
      guestbook_preview_max: { label: '방명록 미리보기 개수', unit: 'EA', type: 'number', defaultValue: '6' },
    },
  },
  star_system: {
    label: '스타 시스템',
    keys: {
      base_journal_points: { label: '저널 작성 포인트', unit: 'P', type: 'number', defaultValue: '50' },
      photo_journal_extra_points: { label: '사진 포함 저널 추가 포인트', unit: 'P', type: 'number', defaultValue: '100' },
      review_product_points: { label: '후기 작성 포인트(상품)', unit: 'P', type: 'number', defaultValue: '200' },
      like_points_per: { label: '공감(좋아요) 포인트/개', unit: 'P', type: 'number', defaultValue: '10' },
      follow_points_per: { label: '팔로워 생김 포인트/명', unit: 'P', type: 'number', defaultValue: '30' },
      like_notify_reach: { label: '공감 알림 도달(10개)', unit: 'EA', type: 'number', defaultValue: '10' },

      streak_notify_at: { label: '연속 저널 알림 도달(5일)', unit: '일', type: 'number', defaultValue: '5' },
      streak_7_days: { label: '연속 7일 조건(멤버십 보너스 지급 기준)', unit: '일', type: 'number', defaultValue: '7' },
      streak_7_bonus: { label: '연속 7일 보너스', unit: 'P', type: 'number', defaultValue: '300' },
      streak_30_days: { label: '연속 30일 조건(멤버십 보너스 지급 기준)', unit: '일', type: 'number', defaultValue: '30' },
      streak_30_bonus: { label: '연속 30일 보너스', unit: 'P', type: 'number', defaultValue: '1000' },

      lv2_journal_min: { label: 'Lv2 저널 최소', unit: 'EA', type: 'number', defaultValue: '5' },
      lv2_followers_min: { label: 'Lv2 팔로워 최소', unit: '명', type: 'number', defaultValue: '10' },

      lv3_journal_min: { label: 'Lv3 저널 최소', unit: 'EA', type: 'number', defaultValue: '20' },
      lv3_followers_min: { label: 'Lv3 팔로워 최소', unit: '명', type: 'number', defaultValue: '50' },
      lv3_purchase_review_min: { label: 'Lv3 구매 후기 최소', unit: '개', type: 'number', defaultValue: '3' },

      lv4_journal_min: { label: 'Lv4 저널 최소', unit: 'EA', type: 'number', defaultValue: '50' },
      lv4_followers_min: { label: 'Lv4 팔로워 최소', unit: '명', type: 'number', defaultValue: '200' },
      lv4_like_min: { label: 'Lv4 공감(좋아요) 최소', unit: '개', type: 'number', defaultValue: '500' },

      lv5_followers_min: { label: 'Lv5 팔로워 최소', unit: '명', type: 'number', defaultValue: '500' },
      lv5_like_min: { label: 'Lv5 공감(좋아요) 최소', unit: '개', type: 'number', defaultValue: '2000' },
      lv5_purchase_leads_min: { label: 'Lv5 구매 유도 최소', unit: '건', type: 'number', defaultValue: '50' },

      lv2_charge_bonus_pct: { label: 'Lv2 충전 추가 보너스', unit: '%', type: 'number', defaultValue: '3' },
      charge_base_points_pct: { label: '기본 충전 포인트 비율', unit: '%', type: 'number', defaultValue: '5' },
    },
  },
}

export default function AdminSettingsAdminSettingsPage() {
  const { settings, loading, saving, error, set, saveCategory } = useAdminSettings()
  const [active, setActive] = useState<string>('skin_quiz')

  const categories = useMemo(() => Object.keys(META), [])
  const activeMeta = META[active]

  const rows = activeMeta?.keys ? Object.entries(activeMeta.keys) : []

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>AURAN admin_settings</div>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => saveCategory(active)}
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

