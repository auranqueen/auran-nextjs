'use client'

import React from 'react'
import { useEffect } from 'react'
import type { Membership, MemberShipment } from './types'

async function apiGet(path: string) {
  const res = await fetch(path)
  return res.json().catch(() => ({}))
}

export function useMembershipInit(
  initial: Membership[],
  setMemberShipments: React.Dispatch<React.SetStateAction<Record<string, MemberShipment[]>>>,
  setTomorrowNames: React.Dispatch<React.SetStateAction<string[]>>,
  setShowTomorrowPopup: React.Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    const run = async () => {
      const mIds = initial.map((m) => m.id)
      if (mIds.length) {
        const json = await apiGet(`/api/admin/membership/curate?type=shipments&ids=${mIds.join(',')}`)
        if (json.ok) {
          const grouped: Record<string, MemberShipment[]> = {}
          for (const row of (json.data as MemberShipment[]) || []) {
            const mid = row.user_membership_id
            if (!grouped[mid]) grouped[mid] = []
            grouped[mid].push(row)
          }
          setMemberShipments(grouped)
        }
      }
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().slice(0, 10)
      const json2 = await apiGet(`/api/admin/membership/curate?type=tomorrow&date=${tomorrowStr}`)
      if (json2.ok && json2.names?.length) {
        setTomorrowNames(json2.names)
        setShowTomorrowPopup(true)
      }
    }
    void run()
  }, [])
}
