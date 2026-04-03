'use client'

import { useEffect, useMemo, useState } from 'react'

/*
 * Supabase SQL — 대시보드에서 직접 실행 (앱이 자동 실행하지 않음)
 *
 * CREATE TABLE IF NOT EXISTS admin_options (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   type text NOT NULL,
 *   label text NOT NULL,
 *   sort_order int DEFAULT 0,
 *   is_active boolean DEFAULT true,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * INSERT INTO admin_options (type, label, sort_order) VALUES
 * ('skin_stage','크림',1),('skin_stage','세럼',2),('skin_stage','토너',3),
 * ('skin_stage','에센스',4),('skin_stage','앰플',5),('skin_stage','선크림',6),
 * ('skin_stage','눈가/아이크림',7),('skin_stage','마스크',8),
 * ('skin_type','건성',1),('skin_type','지성',2),('skin_type','복합성',3),
 * ('skin_type','민감성',4),('skin_type','중성',5),('skin_type','모든피부',6),
 * ('skin_concern','수분부족',1),('skin_concern','트러블',2),
 * ('skin_concern','미백/톤업',3),('skin_concern','안티에이징',4),
 * ('skin_concern','모공',5),('skin_concern','각질',6),
 * ('skin_concern','민감',7),('skin_concern','탄력저하',8),
 * ('use_timing','아침/저녁',1),('use_timing','아침',2),('use_timing','저녁',3),
 * ('origin','프랑스',1),('origin','한국',2),('origin','독일',3),
 * ('origin','이탈리아',4),('origin','스위스',5),('origin','미국',6),('origin','일본',7),
 * ('cert_type','해당없음',1),('cert_type','수분기능성',2),
 * ('cert_type','미백기능성',3),('cert_type','자외선차단',4),('cert_type','주름개선',5),
 * ('product_status','진열',1),('product_status','품절',2),
 * ('product_status','단종',3),('product_status','중지',4);
 *
 * ALTER TABLE admin_options ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "public_read" ON admin_options FOR SELECT USING (is_active = true);
 * CREATE POLICY "admin_all" ON admin_options FOR ALL USING (true);
 */

const EMPTY = {
  skinStage: [] as string[],
  skinType: [] as string[],
  skinConcern: [] as string[],
  useTiming: [] as string[],
  origin: [] as string[],
  certType: [] as string[],
  productStatus: [] as string[],
}

const TYPE_TO_KEY: Record<string, keyof typeof EMPTY> = {
  skin_stage: 'skinStage',
  skin_type: 'skinType',
  skin_concern: 'skinConcern',
  use_timing: 'useTiming',
  origin: 'origin',
  cert_type: 'certType',
  product_status: 'productStatus',
}

export function useAdminOptions(supabase: any) {
  const [groups, setGroups] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('admin_options')
        .select('type,label,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (error) {
        console.error('[useAdminOptions]', error)
        setGroups({ ...EMPTY })
        setLoading(false)
        return
      }
      const next = { ...EMPTY }
      for (const row of data || []) {
        const t = String((row as { type?: string }).type || '')
        const label = String((row as { label?: string }).label || '').trim()
        const key = TYPE_TO_KEY[t]
        if (key && label) next[key].push(label)
      }
      setGroups(next)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return useMemo(
    () => ({
      skinStage: groups.skinStage,
      skinType: groups.skinType,
      skinConcern: groups.skinConcern,
      useTiming: groups.useTiming,
      origin: groups.origin,
      certType: groups.certType,
      productStatus: groups.productStatus,
      loading,
    }),
    [groups, loading]
  )
}
