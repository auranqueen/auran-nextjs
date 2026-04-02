'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { CartProvider } from '@/context/CartContext'
import { createClient } from '@/lib/supabase/client'
import { logUserBehavior, pathnameToPageViewKey } from '@/lib/skinAnalytics'
import { AuthSessionProvider } from './AuthSessionProvider'

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
    pathname.startsWith('/owner/')
  const showCustomerNav = !hideCustomerNav
  const navPad = 'calc(76px + env(safe-area-inset-bottom, 0px))'

  return (
    <AuthSessionProvider>
      <CartProvider>
        <div style={showCustomerNav ? { paddingBottom: navPad } : undefined}>{children}</div>
        {showCustomerNav ? <DashboardBottomNav role="customer" /> : null}
      </CartProvider>
    </AuthSessionProvider>
  )
}
