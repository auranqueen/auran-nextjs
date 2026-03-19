// Force this route to be dynamic so cached/static build doesn't serve old "준비 중" UI
export const dynamic = 'force-dynamic'

export default function AdminMarketingProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
