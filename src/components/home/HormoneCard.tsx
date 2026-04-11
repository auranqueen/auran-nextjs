'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import HormoneSheet from '@/components/home/HormoneSheet'

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
  supabaseClient: SupabaseClient
}

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
  supabaseClient,
}: HormoneCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

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
          <span>{hormoneSubLine}</span>
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
        showEditChrome={showEditChrome}
        supabaseClient={supabaseClient}
      />
    </>
  )
}
