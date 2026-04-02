'use client'

import { usePathname } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { CartProvider } from '@/context/CartContext'
import { AuthSessionProvider } from './AuthSessionProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
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
