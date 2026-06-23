import ProductEditFormV2 from './ProductEditFormV2'

export default function ProductEditV2Page({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  return <ProductEditFormV2 id={searchParams.id} />
}
