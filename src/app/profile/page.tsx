import { redirect } from 'next/navigation'

/** /profile → 마이페이지 별칭 */
export default function ProfileAliasPage() {
  redirect('/my')
}
