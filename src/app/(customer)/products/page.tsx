import { Suspense } from 'react'
import ProductsListClient from './ProductsListClient'

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsListClient />
    </Suspense>
  )
}
