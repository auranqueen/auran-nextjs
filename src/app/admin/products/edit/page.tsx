import { redirect } from 'next/navigation'

export default function ProductEditPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const id = typeof searchParams?.id === 'string' ? searchParams.id.trim() : ''
  if (id) {
    redirect(`/admin/products/edit-v2?id=${encodeURIComponent(id)}`)
  }
  redirect('/admin/products/edit-v2')
}
