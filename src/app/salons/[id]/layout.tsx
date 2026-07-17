import { BrandCartProvider } from '@/context/BrandCartContext'
export default function SalonLayout({ children }: { children: React.ReactNode }) {
  return <BrandCartProvider>{children}</BrandCartProvider>
}
