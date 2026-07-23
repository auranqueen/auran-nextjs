'use client'

import { useCallback, useEffect, useState } from 'react'

/** brand_grade_point_rates → grade→rate 맵. 없으면 빈 객체. */
export function useBrandGradeRates(supabase: any, brandId: string | null | undefined) {
  const [rateMap, setRateMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!brandId) {
      setRateMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_grade_point_rates')
      .select('grade, rate')
      .eq('brand_id', brandId)
    if (error) {
      console.warn('[useBrandGradeRates]', error.message)
      setRateMap({})
    } else {
      const map: Record<string, number> = {}
      for (const row of (data || []) as { grade?: string; rate?: number }[]) {
        const g = String(row.grade || '').trim()
        const r = Number(row.rate)
        if (g && Number.isFinite(r)) map[g] = r
      }
      setRateMap(map)
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rateMap, loading, reload }
}
