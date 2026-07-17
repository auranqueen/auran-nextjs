import { BrandCartProvider } from '@/context/BrandCartContext'
export default function SalonsLayout({ children }: { children: React.ReactNode }) {
  return <BrandCartProvider>{children}</BrandCartProvider>
}
