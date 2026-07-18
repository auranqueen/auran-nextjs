import { tryCreateAdminClient } from '@/lib/supabase/admin'
import ProductDetailActions from './ProductDetailActions'
import { notFound } from 'next/navigation'
export default async function ProductDetailPage({
  params,
}: { params: { id: string; productId: string } }) {
  const service = tryCreateAdminClient()
  if (!service) return notFound()
  const { data: product } = await service
    .from('brand_products')
    .select('id, brand_id, name, consumer_price, thumb_img, images, description, detail_content, customer_toast_rate, status')
    .eq('id', params.productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return notFound()
  const { data: salon } = await service
    .from('salons')
    .select('id, owner_id, name')
    .eq('id', params.id)
    .maybeSingle()
  if (!salon) return notFound()
  const { data: reviews } = await service
    .from('brand_product_reviews')
    .select('id, rating, content, images, created_at, author_id, users:author_id(name)')
    .eq('brand_product_id', product.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.consumer_price.toLocaleString()}원</p>
      <p>구매 시 {product.customer_toast_rate}% 토스트 적립</p>
      <ProductDetailActions
        product={{
          brand_product_id: product.id,
          brand_id: product.brand_id,
          salon_id: salon.id,
          salon_name: salon.name,
          name: product.name,
          price: product.consumer_price,
          thumb_img: product.thumb_img,
          customer_toast_rate: product.customer_toast_rate,
        }}
      />
      <section>
        <h2>리뷰 ({reviews?.length || 0}) · 평균 {avgRating.toFixed(1)}점</h2>
        {reviews?.map(r => (
          <div key={r.id}>
            <span>{'★'.repeat(r.rating)}</span>
            <span>{(r as any).users?.name || '고객'}</span>
            <p>{r.content}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
