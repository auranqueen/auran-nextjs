'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { CartProvider } from '@/context/CartContext'
import { createClient } from '@/lib/supabase/client'
import { logUserBehavior, pathnameToPageViewKey } from '@/lib/skinAnalytics'
import { AuthSessionProvider } from './AuthSessionProvider'
import VoiceBoxButton from '@/components/VoiceBoxButton'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const lastPageLog = useRef<string>('')

  useEffect(() => {
    const page = pathnameToPageViewKey(pathname)
    if (!page) return
    const key = `${page}:${pathname}`
    if (lastPageLog.current === key) return
    lastPageLog.current = key
    const sb = createClient()
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user || cancelled) return
      await logUserBehavior(sb, user.id, 'page_view', null, { page })
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const hideCustomerNav =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/super-console') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/dashboard/partner') ||
    pathname.startsWith('/dashboard/owner') ||
    pathname.startsWith('/dashboard/brand') ||
    pathname.startsWith('/dashboard/salon') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/owner/') ||
    pathname.startsWith('/brand')
  const hideVoiceBox =
    hideCustomerNav ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/dashboard/customer/chat')
  const showCustomerNav = !hideCustomerNav
  const navPad = 'calc(76px + env(safe-area-inset-bottom, 0px))'

  return (
    <div onContextMenu={e => e.preventDefault()}>
      <AuthSessionProvider>
        <CartProvider>
          <div style={showCustomerNav ? { paddingBottom: navPad } : undefined}>{children}</div>
          {showCustomerNav ? <DashboardBottomNav role="customer" /> : null}
          {/* ===== [고객의 목소리 함] 플로팅 버튼 — customer role일 때만 표시 ===== */}
          {!hideVoiceBox ? <VoiceBoxButton /> : null}
        </CartProvider>
      </AuthSessionProvider>
    </div>
  )
}
