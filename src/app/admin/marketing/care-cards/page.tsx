'use client'

import React from 'react'
import { useCareCards } from './useCareCards'
import { DraftForm } from './DraftForm'
import { parseCategoryMeta, TRACK_LABEL, ZONE_LABEL } from './types'

export default function AdminCareCardsPage() {
  const { rows, loading, expandedKey, draft, saving, pq, picks, productMeta, setDraft, setPq, save, remove, openRow, openNew, addProduct, removeProduct } = useCareCards()

  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.88)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>케어카드 관리</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>body_care_cards · track/피부 메타는 category_tags 접두사로 저장</div>
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{
            padding: '10px 16px',
            borderRadius: 9,
            border: '1px solid rgba(201,168,76,0.35)',
            background: 'rgba(201,168,76,0.12)',
            color: '#e8d4a0',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 새 카드 추가
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>불러오는 중…</div>
      ) : (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['제목', 'track', 'phase_tags', 'skin_type', 'skin_concern', 'category', '제품수', 'is_active'].map(
                  h => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        textAlign: 'left',
                        fontSize: 10,
                        color: 'var(--text3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {expandedKey === 'new' ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ padding: 18, background: 'rgba(0,0,0,0.2)' }}>
                      <DraftForm
                        draft={draft}
                        setDraft={setDraft}
                        pq={pq}
                        setPq={setPq}
                        picks={picks}
                        productMeta={productMeta}
                        onAddProduct={addProduct}
                        onRemoveProduct={removeProduct}
                        onSave={save}
                        onDelete={remove}
                        saving={saving}
                        isNew
                      />
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map(row => {
                const meta = parseCategoryMeta(row.category_tags)
                const phaseStr = (Array.isArray(row.phase_tags) ? row.phase_tags : []).join(', ') || '—'
                const isOpen = expandedKey === row.id
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => openRow(row)}
                      style={{
                        cursor: 'pointer',
                        background: isOpen ? 'rgba(201,168,76,0.06)' : 'transparent',
                      }}
                    >
                      <td style={cellStyle}>{row.title || '—'}</td>
                      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11 }}>{TRACK_LABEL[meta.track]}</td>
                      <td style={{ ...cellStyle, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{phaseStr}</td>
                      <td style={cellStyle}>{meta.skin}</td>
                      <td style={cellStyle}>{meta.concern}</td>
                      <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 11 }}>{ZONE_LABEL[meta.zone]}</td>
                      <td style={cellStyle}>{(row.product_ids || []).length}</td>
                      <td style={cellStyle}>{row.is_active ? '✓' : '—'}</td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ padding: 18, background: 'rgba(0,0,0,0.25)' }}>
                            <DraftForm
                              draft={draft}
                              setDraft={setDraft}
                              pq={pq}
                              setPq={setPq}
                              picks={picks}
                              productMeta={productMeta}
                              onAddProduct={addProduct}
                              onRemoveProduct={removeProduct}
                              onSave={save}
                              onDelete={remove}
                              saving={saving}
                              isNew={false}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && expandedKey !== 'new' ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>등록된 카드가 없습니다.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
