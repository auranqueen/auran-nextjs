import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from './client'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!product) return notFound()

  return <ProductDetailClient product={product} />
}
