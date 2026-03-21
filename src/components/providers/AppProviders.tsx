'use client'

import { CartProvider } from '@/context/CartContext'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}
