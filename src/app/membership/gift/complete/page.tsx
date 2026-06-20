'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShareBottomSheet from '@/components/ShareBottomSheet'
const GIFT_COPY = [
  '한 번 써보면 돌아갈 수 없어요 💜',
  '별빛 아래, 피부가 깨어나는 시간',
  '당신 피부의 두 번째 봄',
  '나만 알던 비밀을 당신에게 드려요',
  '당신이 잠든 사이, 피부가 일해요',
  '피부가 먼저 반응할 거예요',
  '오늘부터 당신의 피부가 달라져요',
  '세상에서 가장 예쁜 선물을 받았어요',
]
const C = { purple: '#7B5EA7', gold: '#C9A96E', cream: '#FAF6F0', plum: '#2A2433', muted: '#8A7E92' }
export default function GiftCompletePage() {
  const sp = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const giftId = sp.get('gift_id')
  const [claimToken, setClaimToken] = useState<string | null>(null)
  const [copy, setCopy] = useState('')
  const [senderName, setSenderName] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!giftId) { router.replace('/'); return }
    const load = async () => {
      const { data } = await supabase
        .from('membership_gifts')
        .select('claim_token, sender_name, gift_copy')
        .eq('id', giftId)
        .maybeSingle()
      if (!data) { router.replace('/'); return }
      const picked = (data as any).gift_copy || GIFT_COPY[Math.floor(Math.random() * GIFT_COPY.length)]
      if (!(data as any).gift_copy) {
        await supabase.from('membership_gifts').update({ gift_copy: picked }).eq('id', giftId)
      }
      setClaimToken((data as any).claim_token)
      setCopy(picked)
      setSenderName((data as any).sender_name || '')
      setLoading(false)
    }
    load()
  }, [giftId])
  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: 'sans-serif' }}>
      잠깐만요...
    </div>
  )
  const claimLink = `https://auran.kr/membership/claim/${claimToken}`
  return (
    <div style={{ background: C.cream, minHeight: '100vh', fontFamily: 'sans-serif', color: C.plum }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 20px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
        <div style={{ fontSize: 22, color: C.purple, marginBottom: 8 }}>선물 결제 완료!</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
          받는 분께 카카오톡으로<br/>선물 카드를 보내주세요 💜
        </div>
        <div style={{ background: '#1A0E30', borderRadius: 16, padding: '24px 20px', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.gold, letterSpacing: 3, marginBottom: 12 }}>ORÆN PRIVÉ</div>
          <div style={{ fontSize: 16, color: '#F0E8FF', lineHeight: 1.6, marginBottom: 8 }}>{copy}</div>
          <div style={{ fontSize: 11, color: '#9B7EC8' }}>
            {senderName ? `${senderName}님이 선물했어요` : '오렌 멤버십 선물'}
          </div>
        </div>
        <button
          onClick={() => setShareOpen(true)}
          style={{ width: '100%', padding: 14, background: C.purple, border: 'none', color: '#fff', borderRadius: 10, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}
        >
          💬 카카오톡으로 선물 보내기
        </button>
        <button
          onClick={() => { navigator.clipboard?.writeText(claimLink); alert('링크가 복사됐어요 💜') }}
          style={{ width: '100%', padding: 12, background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 10, fontSize: 13, cursor: 'pointer', marginBottom: 24 }}
        >
          🔗 링크 복사
        </button>
        <button
          onClick={() => router.push('/')}
          style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          홈으로 가기
        </button>
      </div>
      <ShareBottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        cardDomId="gift-card-preview"
        payload={{
          link: claimLink,
          title: copy,
          description: `${senderName ? senderName + '님이 ' : ''}ORÆN PRIVÉ 멤버십을 선물했어요`,
          imageUrl: 'https://auran.kr/oraen-prive-kakao.png',
          buttonTitle: '선물 받기 💜',
        }}
      />
    </div>
  )
}
