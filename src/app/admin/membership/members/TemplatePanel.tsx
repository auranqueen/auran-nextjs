'use client'

import React from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Tpl, ProductInfo } from './types'
import { C, SERIF, PHASES, MALE_PRESETS } from './types'
import type { useTemplates } from './useTemplates'

type TemplatePanelProps = ReturnType<typeof useTemplates> & {
  productMap: Record<string, ProductInfo>
  setProductMap: Dispatch<SetStateAction<Record<string, ProductInfo>>>
}

export function TemplatePanel({
  templates, editTpl, setEditTpl,
  tplSearch, setTplSearch,
  tplSearchResults, setTplSearchResults,
  savingTpl, tplMsg, setTplMsg,
  searchProducts, saveTpl, addTpl, deleteTpl,
  productMap, setProductMap,
}: TemplatePanelProps) {
  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted,
    background: active ? C.purple : '#fff', border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`,
    borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: C.ink }}>리추얼 템플릿 관리</div>
        <button onClick={addTpl} style={{ padding: '5px 12px', background: C.purple, border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
      </div>
      {tplMsg && <div style={{ fontSize: 12, color: tplMsg.includes('✓') ? C.green : '#A33', marginBottom: 8 }}>{tplMsg}</div>}

      {/* 템플릿 목록 */}
      {!editTpl && templates.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 13, color: C.plum }}>{t.theme_name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{t.target_phase || '전체 페이즈'} · 제품 {t.product_ids?.length || 0}개 · {t.is_active ? '활성' : '비활성'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setEditTpl({ ...t }); setTplMsg('') }}
              style={{ padding: '5px 10px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>편집</button>
            <button onClick={() => deleteTpl(t.id)}
              style={{ padding: '5px 10px', background: 'transparent', border: '0.5px solid rgba(163,51,51,0.3)', color: '#A33', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
          </div>
        </div>
      ))}

      {/* 템플릿 편집 */}
      {editTpl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={editTpl.theme_name} onChange={e => setEditTpl({ ...editTpl, theme_name: e.target.value })}
            placeholder="테마명" style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
          <div>
            {(editTpl.target_gender || 'all') !== 'male' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>호르몬 페이즈</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PHASES.map(p => <button key={p} onClick={() => setEditTpl({ ...editTpl, target_phase: editTpl.target_phase === p ? null : p })} style={pill(editTpl.target_phase === p)}>{p}</button>)}
                </div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>대상 성별</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'female', 'male'] as const).map(g => (
                  <button key={g} onClick={() => setEditTpl({ ...editTpl, target_gender: g, target_phase: g === 'male' ? null : editTpl.target_phase })}
                    style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid rgba(123,94,167,0.3)', background: (editTpl.target_gender || 'all') === g ? C.purple : 'transparent', color: (editTpl.target_gender || 'all') === g ? '#fff' : C.muted }}>
                    {g === 'all' ? '전체' : g === 'female' ? '여성' : '남성'}
                  </button>
                ))}
              </div>
            </div>
          {(editTpl.target_gender || 'all') === 'male' && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(123,94,167,0.05)', borderRadius: 8, border: `0.5px solid ${C.line}` }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 7 }}>남성 프리셋 불러오기</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(MALE_PRESETS).map(key => (
                  <button key={key} onClick={() => setEditTpl({ ...editTpl, ...MALE_PRESETS[key] })}
                    style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${C.line}`, background: 'transparent', color: C.ink, fontFamily: 'inherit' }}>
                    {key}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>제품 검색</div>
            <input value={tplSearch} onChange={e => { setTplSearch(e.target.value); void searchProducts(e.target.value) }}
              placeholder="제품명 검색" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            {tplSearchResults.length > 0 && (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4 }}>
                {tplSearchResults.map(p => (
                  <div key={p.id} onClick={() => { if (!editTpl.product_ids.includes(p.id)) { setEditTpl({ ...editTpl, product_ids: [...editTpl.product_ids, p.id] }); setProductMap(prev => ({ ...prev, [p.id]: { id: p.id, name: p.name, description: null, key_ingredients: null } })) } setTplSearch(''); setTplSearchResults([]) }}
                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#111', borderBottom: `0.5px solid ${C.line}`, background: '#fff' }}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>구성 제품 ({editTpl.product_ids.length}개)</div>
            {editTpl.product_ids.map(pid => (
              <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `0.5px solid ${C.line}` }}>
                <div>
                  <div style={{ fontSize: 12, color: C.plum }}>{productMap[pid]?.name || pid}</div>
                  {productMap[pid]?.key_ingredients && <div style={{ fontSize: 10, color: C.gold }}>성분: {productMap[pid].key_ingredients}</div>}
                </div>
                <button onClick={() => setEditTpl({ ...editTpl, product_ids: editTpl.product_ids.filter(id => id !== pid) })}
                  style={{ fontSize: 11, color: '#A33', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>사용법 안내</div>
            <textarea value={editTpl.usage_guide || ''} onChange={e => setEditTpl({ ...editTpl, usage_guide: e.target.value })} rows={3}
              placeholder="제품 사용법, 순서 등을 입력하세요"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>원장님 팁</div>
            <textarea value={editTpl.owner_tip || ''} onChange={e => setEditTpl({ ...editTpl, owner_tip: e.target.value })} rows={2}
              placeholder="원장님만의 특별한 팁을 입력하세요 💜"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
            <input type="checkbox" checked={editTpl.is_active} onChange={e => setEditTpl({ ...editTpl, is_active: e.target.checked })} style={{ accentColor: C.purple }}/>
            활성 템플릿
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveTpl} disabled={savingTpl}
              style={{ flex: 1, padding: 11, background: savingTpl ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {savingTpl ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setEditTpl(null); setTplMsg('') }}
              style={{ padding: '11px 16px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        </div>
      )}
    </div>
  )
}
