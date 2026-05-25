'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ResultContent from './ResultContent'

function ResultPageLoader() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [prevAnalysis, setPrevAnalysis] = useState<Record<string, unknown> | null>(null)
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [grade, setGrade] = useState('PETAL')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const id = searchParams.get('id')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      const { data: prof } = await supabase.from('profiles').select('grade').eq('auth_id', user.id).maybeSingle()
      if (!cancelled) setGrade(String((prof as { grade?: string } | null)?.grade || 'PETAL'))

      const { data: settingsRows } = await supabase
        .from('admin_settings')
        .select('key, value')
        .eq('category', 'skin_analysis')
      const map: Record<string, string> = {}
      for (const row of settingsRows || []) {
        const key = String((row as { key?: string }).key || '')
        if (key === 'analysis_limit' || key.startsWith('phase_comment')) {
          map[key] = String((row as { value?: string }).value ?? '')
        }
      }
      if (!cancelled) setSettings(map)

      let row: Record<string, unknown> | null = null
      if (id) {
        const { data } = await supabase.from('skin_analyses').select('*').eq('id', id).single()
        row = (data as Record<string, unknown>) || null
      } else {
        const { data } = await supabase
          .from('skin_analyses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        row = (data as Record<string, unknown>) || null
      }
      if (!cancelled) setAnalysis(row)

      if (row?.id) {
        const { data: prevList } = await supabase
          .from('skin_analyses')
          .select('id, moisture_score, oil_score, sensitivity_score, elasticity_score, pigmentation_score, pore_score, skin_score, skin_age, created_at, hormone_status')
          .eq('user_id', user.id)
          .neq('id', String(row.id))
          .order('created_at', { ascending: false })
          .limit(3)
        if (!cancelled) {
          setHistory((prevList as Record<string, unknown>[]) || [])
          setPrevAnalysis((prevList as Record<string, unknown>[])?.[0] || null)
        }
      }

      const ids = (row?.recommended_products as string[] | undefined) || []
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, retail_price, thumb_img, storage_thumb_url, brands(name)')
          .in('id', ids)
        if (!cancelled) setProducts((prods as Record<string, unknown>[]) || [])
      }

      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams id only
  }, [searchParams])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0d0b09' }} />
  }

  if (!analysis) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0b09', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 400 }}>
        분석 결과를 불러오지 못했어요
      </div>
    )
  }

  return (
    <ResultContent
      analysis={analysis}
      prevAnalysis={prevAnalysis}
      history={history}
      grade={grade}
      settings={settings}
      products={products}
    />
  )
}

export default function SkinAnalysisResultPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0b09' }} />}>
      <ResultPageLoader />
    </Suspense>
  )
}
