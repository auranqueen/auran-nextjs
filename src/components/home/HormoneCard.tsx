'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import HormoneSheet from '@/components/home/HormoneSheet'
import { PHASE_LABELS, PHASE_DESC } from '@/lib/hormoneUtils'

type HormoneCardProps = {
  hormoneMainLine: string
  hormoneSubLine: string
  hormonePhaseTipDesc: string
  hormonePhaseTipOpen: boolean
  onTipToggle: () => void
  showEditChrome: boolean
  /** 원장 편집: 카드(메인) — 기존 hormone_main 시트 */
  onEditClick: () => void
  /** 원장 편집: 서브 줄 — 기존 hormone_sub 시트 (없으면 서브 줄 편집 비활성) */
  onEditSubClick?: () => void
  currentPhase: string
  cycleDay: number
  hormoneCycle?: any
  supabaseClient: SupabaseClient
  onOpenSkinDiary?: () => void
  onRefreshCycle?: () => void
}

const PHASE_ORDER = ['달빛기', '황금기', '만개기', '물들기']

export default function HormoneCard({
  hormoneMainLine,
  hormoneSubLine,
  hormonePhaseTipDesc,
  hormonePhaseTipOpen,
  onTipToggle,
  showEditChrome,
  onEditClick,
  onEditSubClick,
  currentPhase,
  cycleDay,
  hormoneCycle,
  supabaseClient,
  onOpenSkinDiary,
  onRefreshCycle,
}: HormoneCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const phaseIdx = PHASE_ORDER.indexOf(currentPhase)
  const showPhaseOrder = phaseIdx >= 0

  return (
    <>
      <div
        onClick={
          showEditChrome
            ? e => {
                e.stopPropagation()
                onEditClick()
              }
            : () => setSheetOpen(true)
        }
        style={{
          borderRadius: 16,
          padding: '16px 16px 14px',
          background: 'linear-gradient(145deg, #1a0f28 0%, #251538 45%, #1e1430 100%)',
          border: showEditChrome ? '1px dashed rgba(168, 130, 220, 0.55)' : '1px solid rgba(123, 94, 167, 0.35)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {showEditChrome ? (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>✏️</span>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              onClick={
                showEditChrome
                  ? e => {
                      e.stopPropagation()
                      onEditSubClick?.()
                    }
                  : undefined
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: 9,
                color: 'rgba(196, 170, 230, 0.75)',
                marginBottom: 8,
                letterSpacing: '0.02em',
              }}
            >
              <span>{({
                달빛기: '달빛기 (생리기)',
                황금기: '황금기 (여포기)',
                만개기: '만개기 (배란기)',
                물들기: '물들기 (황체기)',
                갱년기: '갱년기',
              } as Record<string, string>)[currentPhase] || PHASE_LABELS[currentPhase] || hormoneSubLine}</span>
              {hormonePhaseTipDesc ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onTipToggle()
                  }}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: 'rgba(123,94,167,0.3)',
                    border: '1px solid rgba(123,94,167,0.5)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 8,
                    cursor: 'pointer',
                    marginLeft: 4,
                    padding: 0,
                    lineHeight: 1,
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 400,
                  }}
                >
                  ?
                </button>
              ) : null}
            </div>
            <div style={{ fontSize: 13, fontWeight: 300, color: '#f3ecff', lineHeight: 1.55 }}>{hormoneMainLine}</div>
            {cycleDay > 0 && PHASE_DESC[currentPhase] ? (
              <div style={{ fontSize: 11, color: 'rgba(232,223,245,0.5)', marginTop: 6 }}>
                {PHASE_DESC[currentPhase]}
              </div>
            ) : null}
            {showPhaseOrder ? (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {PHASE_ORDER.map((p, i) => (
                    <div
                      key={p}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background: i < phaseIdx ? 'rgba(123,94,167,0.35)' : i === phaseIdx ? '#7B5EA7' : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  {PHASE_ORDER.map((p) => (
                    <span key={p} style={{ fontSize: 9, color: p === currentPhase ? '#9B7FCC' : 'rgba(255,255,255,0.22)' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setSheetOpen(true)
              }}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                marginTop: 8,
                border: 'none',
                borderTop: '0.5px solid rgba(255,255,255,0.06)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>페이즈 설명 + 추천 보기</span>
              <span style={{ fontSize: 14, color: '#9B7FCC' }}>{sheetOpen ? '∧' : '∨'}</span>
            </button>
          </div>
          {showPhaseOrder ? (
            <div style={{ fontSize: 11, color: 'rgba(123,94,167,0.7)', lineHeight: 1.2, textAlign: 'center', whiteSpace: 'pre-line', flexShrink: 0 }}>
              {currentPhase.split('').join('\n')}
            </div>
          ) : null}
        </div>
        {hormonePhaseTipDesc && hormonePhaseTipOpen ? (
          <div
            style={{
              fontSize: 10,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.55)',
              background: 'rgba(123,94,167,0.1)',
              border: '1px solid rgba(123,94,167,0.2)',
              borderRadius: 8,
              padding: '6px 10px',
              marginTop: 6,
              lineHeight: 1.6,
            }}
          >
            {hormonePhaseTipDesc}
          </div>
        ) : null}
      </div>

      <HormoneSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentPhase={currentPhase}
        cycleDay={cycleDay}
        hormoneCycle={hormoneCycle}
        showEditChrome={showEditChrome}
        supabaseClient={supabaseClient}
        onOpenSkinDiary={onOpenSkinDiary}
        onRefreshCycle={onRefreshCycle}
      />
    </>
  )
}
