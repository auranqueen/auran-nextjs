import AdminMarketingProductsClient from './AdminMarketingProductsClient'

// 배포/캐시 시 예전 "준비 중" 페이지가 나오지 않도록 항상 동적 렌더
export const dynamic = 'force-dynamic'

export default function AdminMarketingProductsPage() {
  return <AdminMarketingProductsClient />
}
