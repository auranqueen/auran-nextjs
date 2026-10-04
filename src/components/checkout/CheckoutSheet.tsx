'use client'

import SlideUpSheet from '@/components/ui/SlideUpSheet'
import CheckoutFlow from './CheckoutFlow'

export default function CheckoutSheet({ query, onClose }: { query: string | null; onClose: () => void }) {
  return (
    <SlideUpSheet open={!!query} onClose={onClose}>
      {query && <CheckoutFlow query={query} onClose={onClose} />}
    </SlideUpSheet>
  )
}
