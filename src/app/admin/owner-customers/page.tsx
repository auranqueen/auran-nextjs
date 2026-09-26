'use client'
import { useEffect, useState } from 'react'

export default function AdminOwnerCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/admin/owner-customers-data', { method: 'POST' })
      .then(r => r.json())
      .then(json => setCustomers(json.customers || []))
  }, [])

  return (
    <div style={{ padding: 24, background: '#0d0b12', minHeight: '100vh' }}>
      <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 3, fontFamily: 'monospace', marginBottom: 16 }}>고객 피부 현황</div>
      {customers.map(c => (
        <div key={c.id} style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#fff' }}>{c.name || c.email?.split('@')[0]}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{c.email}</div>
          </div>
          <div style={{ fontSize: 10, color: '#C9A96E' }}>{c.customer_grade || 'AUBE'}</div>
        </div>
      ))}
    </div>
  )
}
