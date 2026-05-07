import ProductEditForm from './ProductEditForm'

export default function ProductEditPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  return <ProductEditForm id={searchParams.id} />
}
