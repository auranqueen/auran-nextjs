# AURAN 플랫폼 AI 컨텍스트
> 새 AI 또는 개발자가 이 파일을 먼저 읽으면 AURAN 프로젝트를 즉시 이해할 수 있습니다.
> 작성일: 2026-06

> **뱃지/스폰서 커미션 관련 작업 시 owner 참조는 반드시 profiles.id, users.id 금지. 커미션율은 스폰서 본인 등급 기준. webhook 로직은 src/lib/webhookHandlers/에 분리해서 추가할 것 (500줄 규칙).**

> **브랜드→원장 초대는 `brand_owner_links` 테이블로 관리, 오렌 지사 원장추천(`referred_by`)과 완전히 별개 트랙. 추천커미션 자격은 이 초대와 무관 (다음세션 전문점 그레이드 구매 로직에서 별도 설계)**

> **원장(owner) 승인은 `/admin/owners` 에서만 처리 (`/admin/approvals`는 owner 승인 버튼 숨김, 파트너/브랜드만 처리) — salons.status 동기화는 `/api/admin/owners/approve` 에서만 이루어짐**

> **원장 승인은 `/api/admin/owners/approve` 로 통합 (users.status+role, salons.status 원자적 처리 지향, 단 Supabase 트랜잭션 미지원으로 완전 원자성은 아님 — `stage` 필드로 실패 지점 응답)**

> **신규 원장 가입은 `/signup/owner-v2` + `/api/auth/owner-signup-v2` 로 진행 (join/마이페이지 링크만 전환, 기존 `/signup?role=owner` 및 login→consent 체인은 레거시로 유지, 미삭제)**

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

원장 전용 로그인은 /owner/[slug] (profiles.slug 기준). 가입 시 자동 생성됨. 공용 /login?role=owner는 폴백용으로만 유지.

파트너 전용 로그인은 /partner/[slug] (profiles.slug 기준, role='partner'). 가입 시 자동 생성됨. 자격증 검증은 별도 세션 예정(미착수).

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

페이즈 관련 신규 코드 작성 시 반드시 `canShowCyclePhase(hormone_cycle.track, profiles.gender)` 게이트를 거칠 것 — track+gender 이중 체크 (2026-06-03 강화). `profiles.cycle_type` 사용 금지.

---

## 6. 절대 규칙 (코드 작업 시 반드시 준수)

1. 현재 정상 동작하는 코드 한 줄도 교체 금지
2. 새 파일/함수/클래스 생성 금지 (분리 필요 시 별도 컴포넌트)
3. 기존 import 변경 금지
4. 요청한 부분만 최소한으로 수정
5. 수정 전 기존 코드 확인 필수
6. 규칙 어기면 전체 작업 중단 후 보고
7. useEffect/useCallback/useMemo deps에 supabase 절대 금지
8. 500줄 초과 파일(salons/[id]/page.tsx, page.tsx, BookingManagePage.tsx 등) 수정 시 반드시 컴포넌트/훅 분리 + import 1줄 삽입 방식만 사용

채팅 채널은 owner(AURAN 오렌콘솔)/salon(원장 전용)/platform 세 종류로 분리됨 — 원장 관련 자동 메시지는 반드시 salon 타입만 사용.

---

## 7. UI 규칙

- 제품 상세(/products/[id])는 하단 고객 네비 숨김 처리됨 (AppProviders hideCustomerNav)
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

- profiles.grade = 고객 멤버십 전용. 브랜드 등급 작업 시 반드시 brand_owner_grades 사용, profiles.grade 참조 금지.
- profiles와 users는 별개 테이블, id 직접 비교 금지 — auth_id로만 연결. 새 기능에서 원장을 식별할 때 어느 테이블 id를 쓰는지 항상 먼저 확인.
- 신규 기능에서 users/profiles 필드 사용 시 반드시 docs/DATABASE.md의 '필드 정본 규칙' 섹션을 먼저 확인할 것.
- 원장 slug는 가입완료 시점(signup/page.tsx)과 스토어저장 시점(store/page.tsx, UNIT O) 두 곳에서 생성 시도 — 이미 있으면 스킵.
- onboarding_done: true는 birth_date+gender 저장 완료 시점에만
- auth/callback/complete 등 경유 페이지에서 무조건 true upsert 금지
- PayApp target_id는 TEXT 타입 (compound pipe-delimited string)
- 재고 차감은 decrement_inventory_stock RPC 사용 (중복 차감 방지)
- brand_access_logs는 삭제/수정 불가 (트리거로 차단)
- middleware가 page보다 먼저 실행됨 (redirect 루프 주의)
- Supabase Seoul 리전: 지연 ~30ms (Sydney에서 이전 완료)

---

## 13. 베타 이후 주요 작업

- client.tsx 리팩토링 (1500줄+ 분리) — 원장 대시보드 빠른메뉴는 `src/components/OwnerQuickMenu.tsx`로 분리 완료
- 원장 콘솔 PC 사이드바 `src/components/OwnerSidebarShell.tsx` — `dashboard/owner/layout.tsx`에서 전 하위 적용, `/dashboard/owner/chat/*` 제외
- 원장 콘솔 반응형 네비 확정: PC=좌측 사이드바, 모바일=하단 `DashboardBottomNav` (OwnerSidebarShell에서 분기)
- `DashboardBottomNav`: `owner` role(`/dashboard/owner/*`) — OwnerSidebarShell·원장 콘솔·brand-* 5개 화면 모두 `owner` 사용; `salon` role은 코드베이스 실사용 없음(NAV 블록만 하위호환용 유지)
- brand-live/returns: `profiles` 테이블 조회 + `role=owner` 로그인·인라인 헤더로 community/samples 패턴 통일 완료 (기존 `users.trade_brands` 조회는 스키마 불일치 버그)
- 후속 확인: brand-orders의 `users.store_name` 조회는 마이그레이션 `users.salon_name`과 불일치 가능
- `/dashboard/salon` 레거시 폴더 삭제 완료; `owner/page.tsx` import는 `./client`로 정리
- 스토어 등급: salons(매출·리뷰·평점) + users.total_orders 변경 시 `calculate_store_grade` 양방향 트리거로 자동 재계산 (065 마이그레이션)
- 추천 시스템 전체 재설계
- AI 분석카드 고객 노출
- 피부주치의 월간리포트
- 라이브 기능 (Agora/Mux)
- Impact Vault 토스트 기부
- 이타카 아로마 실험실

---

## RLS 정책 원칙 (2026-07-03)

- 새 테이블 생성 시 RLS 활성화 + 정책 필수 (누락 시 전체 노출 위험)
- 소유자 스코핑은 owner_id/user_id/customer_id 등 실제 컬럼명 확인 후 정책 작성 (추정 금지)
- 서버-to-서버 webhook insert는 anon 대상 insert만 열고 select는 admin 전용으로 제한

## 미해결 이슈 (다음 세션 우선순위)

1. external_customers에 owner_id 컬럼 없음 — 코드는 있다고 가정하고 쿼리 중, 원장 대시보드 고객목록 실동작 확인 필요
2. treatment_charts 코드가 참조하는 external_customer_id 컬럼이 실제로는 없음 (실제 컬럼: customer_id) — insert 동작 여부 확인 필요
3. /my/charts 조회조건(customer_id+completed)이 charts-v2 저장방식(external_customer_id+active)과 불일치 — 원장이 입력한 차트가 고객 마이페이지에 노출 안 됨
4. external-cards-v2 insert 시 owner_id 미설정 — 원장 대시보드 데이터 분리 가능성
5. user_behavior_logs: insert는 action 컬럼, admin 통계 조회는 action_type으로 필터링 — 컬럼명 불일치로 구매통계 집계 누락 가능성
