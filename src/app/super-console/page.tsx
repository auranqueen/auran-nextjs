import { redirect } from 'next/navigation'

export default async function SuperConsoleEntry() {
  // 실제 보호/권한 판단은 middleware에서 처리.
  // 통과한 경우에만 어드민 콘솔로 이동.
  redirect('/admin')
}

