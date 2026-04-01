'use client'

// Supabase Storage에서 charts 버킷 생성 필요
// Public: ON

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'

const ITEM_OPTIONS = ['수분집중케어', '진정케어', '리프팅', '클렌징케어', '색소케어', '모공케어', '안티에이징', '재생케어', '기타']

export default function OwnerChartsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [owner, setOwner] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [kpi, setKpi] = useState({ today: 0, month: 0, unsigned: 0, prescriptions: 0 })
  const [rows, setRows] = useState<any[]>([])
  const [openCustomerModal, setOpenCustomerModal] = useState(false)
  const [openChartModal, setOpenChartModal] = useState(false)
  const [q, setQ] = useState('')
  const [pickedCustomer, setPickedCustomer] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [treatmentItems, setTreatmentItems] = useState<string[]>([])
  const [etcItem, setEtcItem] = useState('')
  const [skinCondition, setSkinCondition] = useState('')
  const [managementTips, setManagementTips] = useState('')
  const [adminMemo, setAdminMemo] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [shareType, setShareType] = useState<'private' | 'friends' | 'public'>('private')
  const [beforeFiles, setBeforeFiles] = useState<File[]>([])
  const [afterFiles, setAfterFiles] = useState<File[]>([])
  const [beforePreview, setBeforePreview] = useState<string[]>([])
  const [afterPreview, setAfterPreview] = useState<string[]>([])
  const [aiProducts, setAiProducts] = useState<any[]>([])
  const [ownerProducts, setOwnerProducts] = useState<any[]>([])
  const [openProductModal, setOpenProductModal] = useState(false)
  const [productQ, setProductQ] = useState('')
  const [productRows, setProductRows] = useState<any[]>([])
  const [pickedReason, setPickedReason] = useState('')
  const [pickedProduct, setPickedProduct] = useState<any>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login?role=owner')
        return
      }
      const { data: me } = await supabase.from('users').select('id,auth_id').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) return
      setOwner(me)

      const [{ data: charts }, { data: prescriptions }, { data: salonCustomers }] = await Promise.all([
        supabase.from('treatment_charts').select('id,treatment_date,customer_signed_at,customer_id,treatment_items').eq('owner_id', me.id).order('treatment_date', { ascending: false }).limit(100),
        supabase.from('prescriptions').select('id').eq('owner_id', me.id).limit(200),
        supabase.from('users').select('id,auth_id,name,customer_grade').eq('role', 'customer').limit(200),
      ])
      const list = (charts as any[]) || []
      const now = new Date()
      const todayKey = now.toISOString().slice(0, 10)
      const monthKey = todayKey.slice(0, 7)
      setRows(list)
      setKpi({
        today: list.filter((x) => String(x.treatment_date || '').slice(0, 10) === todayKey).length,
        month: list.filter((x) => String(x.treatment_date || '').slice(0, 7) === monthKey).length,
        unsigned: list.filter((x) => !x.customer_signed_at).length,
        prescriptions: ((prescriptions as any[]) || []).length,
      })
      setCustomers((salonCustomers as any[]) || [])
    }
    void run()
  }, [router, supabase])

  const filteredCustomers = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return customers
    return customers.filter((c) => String(c.name || '').toLowerCase().includes(s))
  }, [customers, q])

  const onPick = (files: FileList | null, kind: 'before' | 'after') => {
    if (!files) return
    const arr = Array.from(files)
    if (kind === 'before') {
      setBeforeFiles((p) => [...p, ...arr].slice(0, 9))
      setBeforePreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
    } else {
      setAfterFiles((p) => [...p, ...arr].slice(0, 9))
      setAfterPreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
    }
  }

  const loadAiProducts = async (customerAuthId: string) => {
    const { data: p } = await supabase
      .from('profiles')
      .select('skin_type,skin_concerns,menstrual_cycle,body_status,allergy_ingredients')
      .eq('auth_id', customerAuthId)
      .maybeSingle()
    const st = String((p as any)?.skin_type || '').trim()
    let qy = supabase.from('products').select('id,name,thumb_img,retail_price,skin_types,status').eq('status', 'active').limit(3)
    if (st) qy = qy.contains('skin_types', [st])
    const { data: prods } = await qy
    setAiProducts((prods as any[]) || [])
  }

  const uploadBatch = async (files: File[], chartId: string, kind: 'before' | 'after') => {
    if (!owner?.id) return []
    const urls: string[] = []
    for (const f of files) {
      const path = `charts/${owner.id}/${chartId}/${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const { error } = await supabase.storage.from('charts').upload(path, f, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('charts').getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const submitChart = async () => {
    if (!owner?.id || !pickedCustomer?.auth_id) return
    const chartId = crypto.randomUUID()
    const beforeUrls = await uploadBatch(beforeFiles, chartId, 'before')
    const afterUrls = await uploadBatch(afterFiles, chartId, 'after')
    const items = treatmentItems.includes('기타') && etcItem.trim() ? [...treatmentItems.filter((x) => x !== '기타'), etcItem.trim()] : treatmentItems

    const { data: inserted } = await supabase
      .from('treatment_charts')
      .insert({
        id: chartId,
        owner_id: owner.id,
        customer_id: pickedCustomer.auth_id,
        treatment_date: new Date().toISOString(),
        treatment_items: items,
        skin_condition: skinCondition,
        before_photos: beforeUrls,
        after_photos: afterUrls,
        management_tips: managementTips,
        admin_memo: adminMemo,
        next_visit_date: nextVisitDate || null,
        share_type: shareType,
        status: 'completed',
      } as any)
      .select('id')
      .maybeSingle()
    if (!inserted?.id) return

    await supabase.from('prescriptions').insert({
      chart_id: inserted.id,
      owner_id: owner.id,
      customer_id: pickedCustomer.auth_id,
      ai_products: aiProducts,
      owner_products: ownerProducts,
      note: '',
    } as any)
    await supabase.from('profiles').update({ owner_chart_count: ((owner as any).owner_chart_count || 0) + 1 } as any).eq('id', owner.id)
    const { data: cu } = await supabase.from('users').select('id').eq('auth_id', pickedCustomer.auth_id).maybeSingle()
    if (cu?.id) {
      await supabase.from('notifications').insert({
        user_id: cu.id,
        type: 'promo',
        title: '관리 차트가 등록됐어요 💜',
        body: '원장님이 오늘 관리 기록을 작성했어요\n처방전도 확인해보세요 ✨',
        icon: '💜',
        is_read: false,
      } as any)
    }
    if (shareType === 'public') {
      await supabase.from('posts').insert({
        user_id: cu?.id || null,
        category: 'salon',
        title: '전문가 관리 받았어요 💜',
        content: managementTips,
        image_urls: [...beforeUrls, ...afterUrls],
        hashtags: ['전문가관리', '피부케어', '처방전'],
        is_expert_answered: true,
      } as any)
    }
    setToast('차트 작성 완료! 고객에게 알림 발송됐어요 💜')
    setOpenChartModal(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 420, margin: '0 auto', paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(13,11,9,0.95)', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18 }}>←</button>
        <div style={{ fontSize: 15 }}>원장님 차트 관리</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['오늘 차트', kpi.today],
            ['이번달 차트', kpi.month],
            ['미서명 차트', kpi.unsigned],
            ['처방전 발행', kpi.prescriptions],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l}</div>
              <div style={{ fontSize: 16, marginTop: 4 }}>{Number(v).toLocaleString()}건</div>
            </div>
          ))}
        </div>
        <button onClick={() => setOpenCustomerModal(true)} style={{ marginTop: 12, width: '100%', border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 12, padding: '11px 0', fontSize: 13 }}>
          + 새 차트 작성
        </button>

        <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>최근 차트</div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.slice(0, 10).map((r) => (
            <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11 }}>{String(r.treatment_date || '').slice(0, 10)} / {String((r.treatment_items || []).join(', '))}</div>
              <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                {r.customer_signed_at ? '서명완료' : '미서명'}
              </div>
              <button style={{ marginTop: 6, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '4px 8px', fontSize: 10 }}>
                수정
              </button>
            </div>
          ))}
        </div>
      </div>

      {openCustomerModal ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '92%', maxWidth: 360, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 14 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="고객 검색" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '9px 10px', fontSize: 12 }} />
            <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setPickedCustomer(c)
                    setOpenCustomerModal(false)
                    setOpenChartModal(true)
                    void loadAiProducts(c.auth_id)
                  }}
                  style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: 10, padding: '8px 10px', marginBottom: 6, fontSize: 12 }}
                >
                  {c.name || c.auth_id}
                </button>
              ))}
            </div>
            <button onClick={() => setOpenCustomerModal(false)} style={{ marginTop: 8, width: '100%', border: 'none', borderRadius: 10, padding: '8px 0', background: '#7B5EA7', color: '#fff' }}>닫기</button>
          </div>
        </div>
      ) : null}

      {openChartModal ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: BG, overflowY: 'auto' }}>
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 14 }}>차트 작성</div>
            <button onClick={() => setOpenChartModal(false)} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 20 }}>×</button>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 8 }}>관리 전 사진</div>
            <input type="file" accept="image/*" multiple onChange={(e) => onPick(e.target.files, 'before')} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
              {beforePreview.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />)}
            </div>

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>시술 항목</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ITEM_OPTIONS.map((it) => (
                <button key={it} type="button" onClick={() => setTreatmentItems((p) => (p.includes(it) ? p.filter((x) => x !== it) : [...p, it]))} style={{ fontSize: 11, border: treatmentItems.includes(it) ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 10px', color: '#fff', background: treatmentItems.includes(it) ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)' }}>
                  {it}
                </button>
              ))}
            </div>
            {treatmentItems.includes('기타') ? <input value={etcItem} onChange={(e) => setEtcItem(e.target.value)} placeholder="기타 직접 입력" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px', fontSize: 12 }} /> : null}

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>피부 상태</div>
            <textarea value={skinCondition} onChange={(e) => setSkinCondition(e.target.value)} rows={3} placeholder="오늘 고객 피부 상태를 기록해주세요" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px' }} />

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>관리 후 사진</div>
            <input type="file" accept="image/*" multiple onChange={(e) => onPick(e.target.files, 'after')} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
              {afterPreview.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />)}
            </div>

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>관리팁 / 전달사항</div>
            <textarea value={managementTips} onChange={(e) => setManagementTips(e.target.value)} rows={4} placeholder="고객에게 전달할 관리팁을 입력해주세요" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px' }} />

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>관리자 메모</div>
            <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} rows={3} placeholder="내부 메모 (고객 비공개)" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px' }} />

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>다음 방문 권장일</div>
            <input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px' }} />

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>AI 자동 추천</div>
            {aiProducts.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, marginBottom: 6 }}>
                <img src={p.thumb_img || ''} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#C9A96E' }}>{Number(p.retail_price || 0).toLocaleString()}원</div>
                </div>
                <span style={{ fontSize: 9, borderRadius: 10, padding: '2px 6px', background: 'rgba(123,94,167,0.2)', color: '#c4a7e7' }}>AI 추천</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontSize: 12 }}>원장님 직접 추천</div>
              <button onClick={async () => {
                setOpenProductModal(true)
                const { data } = await supabase.from('products').select('id,name,thumb_img,retail_price').eq('status', 'active').order('created_at', { ascending: false }).limit(80)
                setProductRows((data as any[]) || [])
              }} style={{ border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', borderRadius: 8, padding: '5px 8px', fontSize: 11 }}>
                + 제품 추가
              </button>
            </div>
            {ownerProducts.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, marginTop: 6 }}>
                <img src={p.thumb_img || ''} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#C9A96E' }}>{Number(p.retail_price || 0).toLocaleString()}원</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{p.reason}</div>
                </div>
                <span style={{ fontSize: 9, borderRadius: 10, padding: '2px 6px', background: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}>원장님 추천</span>
              </div>
            ))}

            <div style={{ fontSize: 12, margin: '12px 0 6px' }}>공개 설정</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                ['private', '🔒 비공개'],
                ['friends', '👯 일촌만 공개'],
                ['public', '🌍 전체 공개'],
              ].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setShareType(k as any)} style={{ flex: 1, border: shareType === k ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)', background: shareType === k ? 'rgba(123,94,167,0.18)' : 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 8, padding: '8px 6px', fontSize: 10 }}>
                  {l}
                </button>
              ))}
            </div>

            <button onClick={() => void submitChart()} style={{ marginTop: 14, width: '100%', border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 12, padding: '11px 0', fontSize: 13 }}>차트 완료</button>
            <button style={{ marginTop: 8, width: '100%', border: '1px solid rgba(123,94,167,0.35)', background: 'transparent', color: '#c4a7e7', borderRadius: 12, padding: '10px 0', fontSize: 12 }}>
              고객 서명 요청
            </button>
          </div>
        </div>
      ) : null}

      {openProductModal ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '92%', maxWidth: 360, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 14 }}>
            <input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="제품 검색" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '9px 10px', fontSize: 12 }} />
            <div style={{ marginTop: 8, maxHeight: 210, overflowY: 'auto' }}>
              {productRows.filter((p) => String(p.name || '').toLowerCase().includes(productQ.toLowerCase())).map((p) => (
                <button key={p.id} onClick={() => setPickedProduct(p)} style={{ width: '100%', textAlign: 'left', border: pickedProduct?.id === p.id ? '1px solid rgba(201,169,110,0.5)' : '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: 10, padding: '8px 10px', marginBottom: 6, fontSize: 12 }}>
                  {p.name}
                </button>
              ))}
            </div>
            <textarea value={pickedReason} onChange={(e) => setPickedReason(e.target.value)} rows={2} placeholder="추천 이유 입력 (필수)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px', fontSize: 12 }} />
            <button
              onClick={() => {
                if (!pickedProduct || !pickedReason.trim() || ownerProducts.length >= 3) return
                setOwnerProducts((p) => [...p, { ...pickedProduct, reason: pickedReason.trim() }])
                setPickedProduct(null)
                setPickedReason('')
                setOpenProductModal(false)
              }}
              style={{ marginTop: 8, width: '100%', border: 'none', borderRadius: 10, padding: '9px 0', background: '#7B5EA7', color: '#fff', fontSize: 12 }}
            >
              추가
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>{toast}</div> : null}
    </div>
  )
}
