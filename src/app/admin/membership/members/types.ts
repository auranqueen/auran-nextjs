import React from 'react'

export const C = {
  purple: '#7B5EA7', purpleSoft: '#F1ECF8', goldDark: '#A07F4A', goldSoft: '#F6EFE3',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5',
  line: 'rgba(123,94,167,0.15)', green: '#5B8A6B', greenSoft: '#EAF3EC', gold: '#C9A96E',
}
export const SERIF = "'Cormorant Garamond', Georgia, serif"
export const PHASES = ['달빛기', '황금기', '만개기', '물들기']
export const MALE_PRESETS: Record<string, { theme_name: string; usage_guide: string; owner_tip: string }> = {
  '면도진정': { theme_name: '면도 후 진정 케어', usage_guide: '클렌징(저자극 폼) → 진정 토너(화장솜 습포 1분) → 세라마이드 세럼 → 무향 수분크림\n면도는 샤워 후 모공 열린 상태에서, 결 방향으로. 역방향 면도는 매일 미세 상처를 만들어요.', owner_tip: '면도날 교체 주기 5회 넘기면 피부가 먼저 알아요. 붉음·따가움·트러블 반복된다면 날이 문제예요. 애프터쉐이브 알코올 타입은 장벽을 매일 무너뜨려요. 세라마이드 계열로 바꾸세요.' },
  '피지모공': { theme_name: '피지 조절 · 모공 케어', usage_guide: '이중세안(오일 → 폼) → BHA 토너(주 3회) → 나이아신아마이드 세럼 → 젤크림\nT존 피지는 닦지 말고 흡수시켜요. 과세안은 오히려 피지 과분비를 부릅니다.', owner_tip: '남성 피지 분비량은 여성의 2배예요. 모공이 넓어 보이는 건 피지+각질 콤보 때문이고 BHA가 그 안을 청소해줘요. 체취도 피지 산화와 연결돼 있어요. 피지 관리가 냄새 관리예요.' },
  '체취pH': { theme_name: 'pH 밸런싱 · 체취 케어', usage_guide: '약산성 클렌저(pH 5.5) → 유산균 토너 → 프로바이오틱스 세럼 → 무향 로션\n샤워 후 물기 완전히 제거 후 즉시 적용. 목·귀 뒤·쇄골 라인까지 토너 꼼꼼히.', owner_tip: '체취의 주범은 땀 자체가 아니에요. 피부 상재균이 땀·피지를 분해할 때 냄새가 나요. 약산성 환경을 유지하면 유해균이 줄어들고 체취가 자연스럽게 개선돼요. 향수로 덮는 것보다 피부 자체를 바꾸는 게 진짜 해결책이에요.' },
  '탄력리프팅': { theme_name: '콜라겐 리프팅 케어', usage_guide: '효소 클렌저(주 2회) → 레티놀 세럼(저녁 전용) → 펩타이드 크림 → SPF50 자외선차단(아침 필수)\n레티놀은 처음엔 주 2회, 2주 후 격일, 한 달 후 매일. 서두르면 뒤집어져요.', owner_tip: '콜라겐은 25세부터 줄고 50대엔 30대의 절반이에요. 남성은 피부가 두꺼워 뒤늦게 시작해도 회복이 빨라요. 레티놀+자외선차단 이 2가지만으로 1년 후 피부가 확실히 바뀝니다.' },
  '미백색소': { theme_name: '브라이트닝 · 잡티 케어', usage_guide: '저자극 클렌저 → 비타민C 세럼(아침) → 알부틴·나이아신아마이드 세럼 → 수분크림 → SPF50+(매일)\n비타민C는 공기 노출 시 산화되니 사용 후 즉시 마개. 냉장 보관 권장.', owner_tip: '50대 남성 색소침착의 70%는 자외선 누적이에요. 지금 보이는 잡티는 20-30대에 쌓인 결과예요. 선크림이 제일 비싼 미백 제품이에요. 비타민C + 나이아신아마이드 콤보로 3개월이면 달라져요.' },
}

export type Membership = {
  id: string; user_id: string; status: string; shipments_total: number; shipments_remaining: number
  next_shipment_date: string | null; scheduled_at?: string | null; started_at?: string | null; source_type?: string | null
  users: { name: string } | null; membership_plans: { name: string } | null
}
export type MemberShipment = {
  id: string; user_membership_id: string; cycle_no: number
  status: string; shipped_at: string | null; scheduled_at: string | null
}
export type Tpl = {
  id: string; theme_name: string; target_phase: string | null
  product_ids: string[]; usage_guide: string | null; owner_tip: string | null
  is_active: boolean; display_order: number; target_gender?: string | null
}
export type Plan = { id: string; name: string; price: number }
export type ShipmentHistoryRow = {
  id: string; cycle_no?: number | null; status: string; shipped_at: string | null; delivery_type: string | null
  courier: string | null; tracking_no: string | null
  users: { name: string } | null; bundle_templates: { theme_name: string } | null
}
export type ProductInfo = { id: string; name: string; description: string | null; key_ingredients: string | null }
export type Scored = { id: string; name: string; retail_price: number | null; _score: number; _reasons: string[] }

export const histTh: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#8A7E92', padding: '10px 12px', borderBottom: `1px solid rgba(123,94,167,0.2)`, fontWeight: 500 }
export const histTd: React.CSSProperties = { fontSize: 13, color: '#2A2433', padding: '12px', borderBottom: `1px solid rgba(123,94,167,0.15)`, verticalAlign: 'middle' }
