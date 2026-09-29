'use client'

import { useCallback, useEffect, useState } from 'react'
import { membersApi } from './useMembers'

export function useMemberDetail(memberId: string | null) {
  const [detailOrders, setDetailOrders] = useState<any[]>([])
  const [detailPoints, setDetailPoints] = useState<any[]>([])
  const [detailLogs, setDetailLogs] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    setDetailLoading(true)
    setDetailOrders([])
    setDetailPoints([])
    setDetailLogs([])
    void membersApi('detail', { memberId }).then(json => {
      if (cancelled) return
      setDetailOrders(json?.orders ?? [])
      setDetailPoints(json?.points ?? [])
      setDetailLogs(json?.logs ?? [])
      setDetailLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [memberId])

  const prependPoint = useCallback((row: any) => {
    setDetailPoints(prev => [row, ...prev])
  }, [])

  return { detailOrders, detailPoints, detailLogs, detailLoading, prependPoint }
}
