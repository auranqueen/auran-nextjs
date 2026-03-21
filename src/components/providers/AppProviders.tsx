'use client'

import { CartProvider } from '@/context/CartContext'
import { AuthSessionProvider } from './AuthSessionProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <CartProvider>{children}</CartProvider>
    </AuthSessionProvider>
  )
}
