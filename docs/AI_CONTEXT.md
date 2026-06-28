# AURAN 플랫폼 AI 컨텍스트
> 새 AI 또는 개발자가 이 파일을 먼저 읽으면 AURAN 프로젝트를 즉시 이해할 수 있습니다.
> 작성일: 2026-06

---

## 1. 프로젝트 개요

AURAN(오렌)은 호르몬 주기 기반 피부 관리 O2O 플랫폼입니다.
운영사: 주식회사 티엔씨
대표: 윰탱 (에스테틱 20년 전문가 + 플랫폼 개발 기획 총괄)
어드민 이메일: queen8038@gmail.com

**핵심 개념**
- 고객의 호르몬 주기(6트랙)에 따라 피부 상태가 달라진다
- 주기에 맞는 제품 추천 + 시술 타이밍 안내
- 원장님(살롱) ↔ 고객 ↔ 브랜드사를 하나의 플랫폼으로 연결

---

## 2. 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 App Router |
| DB | Supabase (Seoul 리전, ap-northeast-2) |
| 배포 | Vercel (main 브랜치 자동 배포) |
| 인증 | Supabase Auth (Kakao OAuth + Google OAuth + 이메일) |
| 결제 | PayApp (merchant: duchess1) |
| AI | Claude Haiku (피부 분석, 제품 추천) |
| 알림 | 카카오 알림톡 |
| 모바일 앱 | React Native (Expo SDK 56, package: kr.auran.app) |
| GitHub | auranqueen/auran-nextjs (private) |
| Supabase 프로젝트 | auran-queen's Project |

---

## 3. 역할(Role) 구조

| Role | 설명 | 로그인 경로 | 대시보드 |
|------|------|------------|---------|
| customer | 일반 고객 | /login?role=customer | / (홈) |
| owner | 원장님 (살롱) | /login?role=owner | /dashboard/owner |
| partner | 파트너스 | /login?role=partner | /dashboard/partner |
| brand | 브랜드사 | /brand/[slug] | /dashboard/brand |
| admin | 관리자 | /login?role=admin | /admin |

**브랜드사 전용 로그인:**
- Brand Hub: auran.kr/brand/[slug] (예: auran.kr/brand/civasan)
- 물류 허브: auran.kr/logi/[slug] (예: auran.kr/logi/civasan)

---

## 4. DB 핵심 테이블

```
users          — 회원 기본정보 (auth_id, email, role, status)
profiles       — 회원 상세 (호르몬 트랙, 피부타입, active_role)
products       — 제품 (brand_id, hormone_timing, concern_tags)
brands         — 브랜드사 (slug, login_role, user_id)
brand_staff    — 브랜드 직원 (role, pin, system_access, is_active)
brand_staff_permissions — 직원별 모듈 권한
brand_access_logs       — 접근 로그 (삭제 불가 트리거)
brand_pin_sessions      — PIN 세션 (30분 유효)
brand_inventory         — 브랜드 재고
brand_inventory_lots    — 로트별 재고 (expires_at, remaining_qty)
brand_orders            — 발주
brand_messages          — 오렌톡 메시지
brand_posts             — 브랜드 커뮤니티 공지
brand_returns           — 반품·교환
brand_monthly_close     — 월 마감
bookings               — 예약
purchases              — 구매 (platform_fee 8.8%, partner_fee)
toast_transactions     — 토스트(T) 내역 (1T=1원, 활동으로만 획득)
honey_logs             — 꿀 리워드 (리뷰어 추천 성공 시 1,000T)
external_customers     — 외부 고객 (오프라인 고객 관리)
```

---

## 5. 호르몬 주기 6트랙

| 트랙 | 대상 |
|------|------|
| general | 일반 여성 |
| menopause_peri | 갱년기 전후 |
| pregnant | 임산부 |
| postpartum | 산후 |
| male | 남성 |
| male_menopause | 남성 갱년기 |

**페이즈 4단계:** 달빛기 → 황금기 → 만개기 → 물들기

---

## 6. 절대 규칙 (코드 작업 시 반드시 준수)

1. 현재 정상 동작하는 코드 한 줄도 교체 금지
2. 새 파일/함수/클래스 생성 금지 (분리 필요 시 별도 컴포넌트)
3. 기존 import 변경 금지
4. 요청한 부분만 최소한으로 수정
5. 수정 전 기존 코드 확인 필수
6. 규칙 어기면 전체 작업 중단 후 보고
7. useEffect/useCallback/useMemo deps에 supabase 절대 금지
8. 파일 500줄 초과 시 직접 수정 금지 → 신규 컴포넌트 분리 후 import 1줄+호출 1줄만

---

## 7. UI 규칙

- 굵은 글씨(bold/font-weight) 절대 금지 → 크기/색상으로만 강조
- select 박스 금지 → 버튼 그룹 또는 검색바+드롭다운으로 구현
- 팝업/모달: 닫기 버튼(×) + 배경 클릭 닫기 둘 다 필수
- prompt() 절대 금지 → 커스텀 모달로 구현
- 고객 페이지 포인트 컬러: #7B5EA7 (보라)
- 어드민/원장 포인트 컬러: #C9A96E (골드)
- 고객 다크 테마: #0D0B09
- useCallback deps 빈 배열 [] 금지 → 참조 state 반드시 포함

---

## 8. Brand Hub 보안 시스템

**3대 원칙:**
1. 볼 수 없으면 유출 불가 (최소 권한)
2. 봤으면 반드시 기록 (brand_access_logs 삭제 불가)
3. 캡처해도 증거 남음 (BrandWatermark 워터마크)

**직원 권한 계층:**
- 대표(CEO)     — PIN 6자리 — Brand Hub + 물류 허브 전체
- 이사(Director) — PIN 6자리 — Brand Hub + 물류 허브 (정산 제외)
- 과장(Manager)  — PIN 4자리 — Brand Hub 일부
- 담당자(Staff)  — PIN 4자리 — Brand Hub 기본
- 물류팀장       — PIN 4자리 — 물류 허브 전체
- 물류직원       — PIN 4자리 — 물류 허브 기본

---

## 9. 주요 경로 정리

```
/                          — 고객 홈
/login?role=[role]         — 역할별 로그인
/brand/[slug]              — 브랜드사 전용 로그인
/logi/[slug]               — 물류팀 전용 로그인
/dashboard/brand           — Brand Hub 대시보드
/dashboard/logi            — 물류 허브 대시보드
/dashboard/owner           — 원장님 대시보드
/dashboard/partner         — 파트너스 대시보드
/admin                     — 어드민
/auth/callback             — OAuth 콜백
/signup/onboarding         — 온보딩
```

---

## 10. 현재 파트너사

| 브랜드 | slug | 접속 URL |
|--------|------|---------|
| 시바산 (CIVASAN) | civasan | auran.kr/brand/civasan |

---

## 11. 토스트(T) 경제

- 1T = 1원
- 활동으로만 획득 (절대 구매 불가)
- 체크인, 리뷰, 추천 등으로 적립
- 결제 시 사용 가능

---

## 12. 중요 주의사항

- onboarding_done: true는 birth_date+gender 저장 완료 시점에만
- auth/callback/complete 등 경유 페이지에서 무조건 true upsert 금지
- PayApp target_id는 TEXT 타입 (compound pipe-delimited string)
- 재고 차감은 decrement_inventory_stock RPC 사용 (중복 차감 방지)
- brand_access_logs는 삭제/수정 불가 (트리거로 차단)
- middleware가 page보다 먼저 실행됨 (redirect 루프 주의)
- Supabase Seoul 리전: 지연 ~30ms (Sydney에서 이전 완료)

---

## 13. 베타 이후 주요 작업

- client.tsx 리팩토링 (1500줄+ 분리)
- 추천 시스템 전체 재설계
- AI 분석카드 고객 노출
- 피부주치의 월간리포트
- 라이브 기능 (Agora/Mux)
- Impact Vault 토스트 기부
- 이타카 아로마 실험실
