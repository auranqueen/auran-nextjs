'use client'

import { useEffect } from 'react'

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
const SHARE_IMAGE = 'https://auran.kr/oraen-prive-kakao.png'
const SHARE_LINK = 'https://auran.kr/membership/checkout'

export default function KakaoShareButton() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const init = () => {
      const K = (window as any).Kakao
      if (K && KAKAO_JS_KEY && !K.isInitialized?.()) K.init(KAKAO_JS_KEY)
    }
    if ((window as any).Kakao) { init(); return }
    const s = document.createElement('script')
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'
    s.async = true
    s.onload = init
    document.head.appendChild(s)
  }, [])

  const share = () => {
    const K = (window as any).Kakao
    if (!K || !K.isInitialized?.()) {
      alert('공유 준비 중이에요. 잠시 후 다시 눌러주세요.')
      return
    }
    K.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: 'ORÆN PRIVÉ',
        description: '두 달마다, 오랜이 직접 고른 리추얼이 도착해요',
        imageUrl: SHARE_IMAGE,
        link: { mobileWebUrl: SHARE_LINK, webUrl: SHARE_LINK },
      },
      buttons: [
        { title: '멤버십 보기', link: { mobileWebUrl: SHARE_LINK, webUrl: SHARE_LINK } },
      ],
    })
  }

  return (
    <button
      onClick={share}
      style={{
        width: '100%',
        marginTop: 10,
        background: '#fff',
        border: '0.5px solid rgba(201,169,110,0.6)',
        color: '#A07F4A',
        borderRadius: 9,
        padding: 12,
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      카톡으로 추천하기
    </button>
  )
}
