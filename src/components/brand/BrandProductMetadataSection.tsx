'use client'

import { useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'

type ProductOption = { id: string; name: string }

type Props = {
  keyIngredients: string
  setKeyIngredients: (value: string) => void
  ingredientText: string
  setIngredientText: (value: string) => void
  clinicalResult: string
  setClinicalResult: (value: string) => void
  certifications: string
  setCertifications: (value: string) => void
  ptInput: string
  setPtInput: (value: string) => void
  ptResults: ProductOption[]
  setPtResults: Dispatch<SetStateAction<ProductOption[]>>
  ptSelected: ProductOption[]
  setPtSelected: Dispatch<SetStateAction<ProductOption[]>>
  skinConcerns: string[]
  setSkinConcerns: Dispatch<SetStateAction<string[]>>
  stepTags: string[]
  setStepTags: Dispatch<SetStateAction<string[]>>
  skinTypes: string[]
  setSkinTypes: Dispatch<SetStateAction<string[]>>
  seasonTags: string[]
  setSeasonTags: Dispatch<SetStateAction<string[]>>
  ingredientTags: string
  setIngredientTags: (value: string) => void
  isActive: boolean
  setIsActive: (value: boolean) => void
  isExclusive: boolean
  setIsExclusive: (value: boolean) => void
  eventEmoji: string
  setEventEmoji: (value: string) => void
  eventTitle: string
  setEventTitle: (value: string) => void
  eventDesc: string
  setEventDesc: (value: string) => void
  eventStartsAt: string
  setEventStartsAt: (value: string) => void
  eventEndsAt: string
  setEventEndsAt: (value: string) => void
}

const S = {
  sec: { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as CSSProperties,
  secTitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  lbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' } as CSSProperties,
  inp: { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e8e4dc', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const } as CSSProperties,
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 } as CSSProperties,
  f: { marginBottom: 10 } as CSSProperties,
  tag: (on: boolean) => ({ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: on ? 'rgba(123,94,167,0.35)' : 'rgba(123,94,167,0.1)', border: `0.5px solid ${on ? 'rgba(123,94,167,0.6)' : 'rgba(123,94,167,0.25)'}`, color: '#c4a7e7', cursor: 'pointer', display: 'inline-block', margin: '3px 3px 0 0' }) as CSSProperties,
  tog: (on: boolean) => ({ width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: on ? 'rgba(123,94,167,0.6)' : 'rgba(255,255,255,0.1)' }) as CSSProperties,
}

const BASE_STEP_TAGS = ['클렌징', '토너', '앰플', '세럼', '크림', '선케어', '마스크팩', '아로마오일', '바디입욕제', '바디버블', '바디팩']

export default function BrandProductMetadataSection(props: Props) {
  const [ingredientAnalyzeLoading, setIngredientAnalyzeLoading] = useState(false)
  const ingredientPhotoRef = useRef<HTMLInputElement>(null)
  const toggleArr = (arr: string[], value: string, set: Dispatch<SetStateAction<string[]>>) => {
    set(arr.includes(value) ? arr.filter(item => item !== value) : [...arr, value])
  }

  const analyzeIngredients = async (file: File) => {
    setIngredientAnalyzeLoading(true)
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(file)
      })
      const response = await fetch('/api/analyze-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await response.json()
      if (data.ingredients) props.setIngredientText(data.ingredients)
    } catch {
      alert('분석 실패')
    } finally {
      setIngredientAnalyzeLoading(false)
    }
  }

  const tagGroups = [
    { label: '피부 고민', items: ['보습', '진정', '미백', '탄력', '모공', '각질', '트러블'], arr: props.skinConcerns, set: props.setSkinConcerns },
    { label: '피부 타입', items: ['건성', '지성', '복합성', '민감성', '중성', '여드름', '홍조', '특정'], arr: props.skinTypes, set: props.setSkinTypes },
    { label: '계절', items: ['전계절', '봄', '여름', '가을', '겨울', '시술후'], arr: props.seasonTags, set: props.setSeasonTags },
  ]
  const stepTags = [...BASE_STEP_TAGS, ...props.stepTags.filter(tag => !BASE_STEP_TAGS.includes(tag))]

  return (
    <>
      <div style={S.sec}>
        <div style={S.secTitle}>성분 정보</div>
        <div style={S.f}><span style={S.lbl}>KEY INGREDIENTS</span><textarea style={{ ...S.inp, height: 80, resize: 'vertical' }} value={props.keyIngredients} onChange={e => props.setKeyIngredients(e.target.value)} placeholder="주요 성분 설명" /></div>
        <div style={S.f}><span style={S.lbl}>전성분 텍스트</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' }} value={props.ingredientText} onChange={e => props.setIngredientText(e.target.value)} placeholder="Water, Glycerin..." /></div>
        <div style={S.f}>
          <span style={S.lbl}>전성분 사진 AI 분석</span>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: ingredientAnalyzeLoading ? '#c4a7e7' : 'rgba(255,255,255,0.25)' }} onClick={() => ingredientPhotoRef.current?.click()}>
            {ingredientAnalyzeLoading ? 'AI 분석 중...' : '+ 사진 업로드 → AI 자동 분석'}
            <input ref={ingredientPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) void analyzeIngredients(file) }} />
          </div>
        </div>
        <div style={S.f}><span style={S.lbl}>CLINICAL RESULT</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' }} value={props.clinicalResult} onChange={e => props.setClinicalResult(e.target.value)} placeholder="보습력 98% 향상..." /></div>
        <div><span style={S.lbl}>CERTIFICATIONS</span><input style={S.inp} value={props.certifications} onChange={e => props.setCertifications(e.target.value)} placeholder="ISO 9001, 피부과 테스트 완료" /></div>
      </div>

      <div style={S.sec}>
        <div style={S.secTitle}>함께 쓰기 좋은 제품</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input style={S.inp} value={props.ptInput} onChange={e => props.setPtInput(e.target.value)} placeholder="제품명 검색..." />
          {props.ptResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1714', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, zIndex: 10, marginTop: 4 }}>
              {props.ptResults.map(product => (
                <div key={product.id} onClick={() => {
                  if (props.ptSelected.length < 3 && !props.ptSelected.find(item => item.id === product.id)) props.setPtSelected(prev => [...prev, product])
                  props.setPtInput('')
                  props.setPtResults([])
                }} style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  {product.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {props.ptSelected.map(product => (
          <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{product.name}</span>
            <button type="button" onClick={() => props.setPtSelected(prev => prev.filter(item => item.id !== product.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>최대 3개</div>
      </div>

      <div style={S.sec}>
        <div style={S.secTitle}>태그</div>
        {tagGroups.map(({ label, items, arr, set }) => (
          <div key={label} style={S.f}>
            <span style={S.lbl}>{label}</span>
            <div>{items.map(tag => <span key={tag} style={S.tag(arr.includes(tag))} onClick={() => toggleArr(arr, tag, set)}>{tag}</span>)}</div>
          </div>
        ))}
        <div style={S.f}>
          <span style={S.lbl}>루틴 단계</span>
          <div>
            {stepTags.map(tag => <span key={tag} style={S.tag(props.stepTags.includes(tag))} onClick={() => toggleArr(props.stepTags, tag, props.setStepTags)}>{tag}</span>)}
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'inline-block', margin: '3px 3px 0 0' }}
              onClick={() => { const value = window.prompt('루틴 단계 추가:'); if (value?.trim()) props.setStepTags(prev => [...prev, value.trim()]) }}>+ 추가</span>
          </div>
        </div>
        <div><span style={S.lbl}>성분 태그 (콤마 구분)</span><input style={S.inp} value={props.ingredientTags} onChange={e => props.setIngredientTags(e.target.value)} placeholder="히알루론산, 나이아신아마이드" /></div>
      </div>

      <div style={S.sec}>
        <div style={S.secTitle}>판매 설정</div>
        {[
          { label: '판매 상태', value: props.isActive, set: props.setIsActive },
          { label: 'AURAN 독점', value: props.isExclusive, set: props.setIsExclusive },
        ].map(({ label, value, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
            <button type="button" style={S.tog(value)} onClick={() => set(!value)} aria-label={label} />
          </div>
        ))}
      </div>

      <div style={S.sec}>
        <div style={S.secTitle}>이벤트 배너</div>
        <div style={S.f}><span style={S.lbl}>이모지</span><input style={{ ...S.inp, width: 80 }} value={props.eventEmoji} onChange={e => props.setEventEmoji(e.target.value)} placeholder="🎁" /></div>
        <div style={S.f}><span style={S.lbl}>제목</span><input style={S.inp} value={props.eventTitle} onChange={e => props.setEventTitle(e.target.value)} placeholder="오픈 기념 특가" /></div>
        <div style={S.f}><span style={S.lbl}>설명</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' }} value={props.eventDesc} onChange={e => props.setEventDesc(e.target.value)} placeholder="이벤트 내용" /></div>
        <div style={S.row2}>
          <div><span style={S.lbl}>시작일</span><input style={S.inp} type="date" value={props.eventStartsAt} onChange={e => props.setEventStartsAt(e.target.value)} /></div>
          <div><span style={S.lbl}>종료일</span><input style={S.inp} type="date" value={props.eventEndsAt} onChange={e => props.setEventEndsAt(e.target.value)} /></div>
        </div>
      </div>
    </>
  )
}
