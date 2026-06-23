import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export async function uploadToStorage(file: File, path: string): Promise<string> {
  const supabase = createClient()
  file = await compressImage(file, 'product_detail')
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
  if (error) throw error
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
}

export async function uploadVideoToStorage(file: File, path: string): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
  if (error) throw error
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
}

export async function insertNewProduct(supabase: ReturnType<typeof createClient>, payload: {
  brand_id: string
  name: string
  retail_price: number
  is_flash_sale: boolean
}) {
  const { data, error } = await supabase.from('products').insert({
    ...payload,
    status: 'pending',
    stock: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select('id').single()
  if (error || !data?.id) throw new Error(error?.message || '생성 실패')
  return data.id as string
}

export async function updateProduct(supabase: ReturnType<typeof createClient>, id: string, payload: Record<string, unknown>) {
  const { error } = await supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}
