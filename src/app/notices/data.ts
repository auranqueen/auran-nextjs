export interface NoticeItem {
  id: string
  emoji: string
  title: string
  content: string
  date: string
  isPinned: boolean
  tags: string[]
}

export const NOTICES: NoticeItem[] = [
  {
    id: 'notice-001',
    emoji: '🔴',
    title: 'AURAN 12달 계절 테마 오픈',
    isPinned: true,
    date: '2026-03-17',
    tags: ['신기능', '업데이트'],
    content: `매달 자동으로 바뀌는 계절 배경과 애니메이션이 적용됩니다.

🌸 봄 (3~5월) — 벚꽃 꽃잎, 병아리, 하트
🌊 여름 (6~8월) — 바다, 태양, 비행기
🍁 가을 (9~11월) — 단풍, 달빛, 낙엽
❄️ 겨울 (12~2월) — 오로라, 눈, 크리스마스

설날·추석·빼빼로데이·크리스마스 등 한국 이슈도 반영됩니다.
하단 월 버튼으로 원하는 달 테마 직접 선택도 가능합니다.`,
  },
  {
    id: 'notice-002',
    emoji: '✦',
    title: '생일 D-7 특별 테마 + 선물 이벤트',
    isPinned: true,
    date: '2026-03-17',
    tags: ['이벤트', '생일'],
    content: `생일 7일 전부터 당일까지 AURAN이 특별한 테마로 변신합니다.

✨ 빛나는 당신의 생일을 진심으로 축하드립니다

🎁 생일 선물 지급 기준
• 모든 회원 — 등급별 생일 선물 기본 증정
• 생일月 제품 구매 시 — 본품 추가 선물 증정
• 생일 포인트 별도 적립

🎀 선물은 생일 전날 밤 본사에서 깜짝 발송합니다
마이월드 → 선물함에서 확인하세요`,
  },
]
