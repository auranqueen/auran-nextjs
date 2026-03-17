'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      if (!data.user) {
        router.replace('/login')
        return
      }
      setEmail(data.user.email ?? null)
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: '18px 18px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, lineHeight: 1 }}>‹</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text3)', letterSpacing: '0.12em' }}>MY</div>
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>ACCOUNT</div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
          {loading ? '불러오는 중...' : (email || '사용자')}
        </div>
      </div>

      <button
        onClick={logout}
        style={{
          width: '100%',
          padding: '15px',
          background: 'rgba(217,79,79,0.10)',
          border: '1px solid rgba(217,79,79,0.30)',
          borderRadius: 12,
          color: '#e08080',
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        로그아웃
      </button>
    </div>
  )
}

