# AURAN Database 문서
작성일: 2026-06
Supabase 프로젝트: auran-queen's Project (Seoul 리전, ap-northeast-2)

## 1. 핵심 테이블 목록

### 회원/인증
users — 회원 기본정보
  id UUID PK
  auth_id UUID (auth.users.id 연결, NOT NULL)
  email TEXT UNIQUE NOT NULL
  role TEXT (customer/owner/partner/brand/admin)
  status TEXT (active/pending/inactive)
  name TEXT
  phone TEXT
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

profiles — 회원 상세정보
  id UUID PK
  auth_id UUID UNIQUE
  role TEXT
  active_role TEXT (middleware 우선 참조)
  birth_date DATE
  gender TEXT
  skin_type TEXT
  hormone_track TEXT (general/menopause_peri/pregnant/postpartum/male/male_menopause)
  onboarding_done BOOLEAN DEFAULT false
  avatar_url TEXT
  trade_brands TEXT[]
  preferred_brands TEXT[]

### 제품
products — 제품 정보
  id UUID PK
  brand_id UUID → brands.id
  name TEXT NOT NULL
  status TEXT (active/inactive/deleted)
  price INTEGER
  thumb_img TEXT
  hormone_timing TEXT[] (호르몬 타이밍 태그)
  concern_tags TEXT[] (피부고민 태그)
  skin_tags TEXT[] (피부타입 태그)
  deleted_at TIMESTAMPTZ
  created_at TIMESTAMPTZ

### 브랜드사
brands — 브랜드사 정보
  id UUID PK
  name TEXT
  brand_name_kr TEXT
  slug TEXT UNIQUE (URL 경로, 예: civasan)
  login_role TEXT (ceo/director)
  user_id UUID → auth.users.id
  logo_url TEXT
  welcome_shown BOOLEAN DEFAULT false
  invoice_settings JSONB
  created_at TIMESTAMPTZ

brand_staff — 브랜드 직원
  id UUID PK
  brand_id UUID → brands.id
  name TEXT NOT NULL
  role TEXT (ceo/director/manager/staff/ops_manager/ops_staff)
  pin TEXT (4자리 또는 6자리 숫자)
  is_active BOOLEAN DEFAULT true
  system_access TEXT (brand/ops/both)
  created_at TIMESTAMPTZ

brand_staff_permissions — 직원별 모듈 권한
  id UUID PK
  brand_id UUID → brands.id
  staff_id UUID → brand_staff.id
  module TEXT (order_view/order_approve 등 20개)
  granted_by UUID → brand_staff.id
  created_at TIMESTAMPTZ
  UNIQUE(staff_id, module)

brand_access_logs — 접근 로그 (삭제/수정 불가)
  id UUID PK
  brand_id UUID → brands.id
  staff_id UUID → brand_staff.id
  staff_name TEXT
  action_type TEXT (login/view/edit/approve/export/pin_fail/pin_fail_locked/logout)
  module TEXT
  target_id TEXT
  target_desc TEXT
  ip_address TEXT
  user_agent TEXT
  created_at TIMESTAMPTZ
  트리거: prevent_access_log_modification() — BEFORE UPDATE/DELETE 차단

brand_pin_sessions — PIN 세션
  id UUID PK
  brand_id UUID → brands.id
  staff_id UUID → brand_staff.id
  session_token TEXT UNIQUE
  pin_fail_count INTEGER DEFAULT 0
  is_locked BOOLEAN DEFAULT false
  expires_at TIMESTAMPTZ (생성 후 30분)
  created_at TIMESTAMPTZ

### 재고/물류
brand_inventory — 제품별 재고
  id UUID PK
  brand_id UUID → brands.id
  product_id UUID → products.id
  product_name TEXT
  current_stock INTEGER DEFAULT 0
  safety_stock INTEGER DEFAULT 0
  created_at TIMESTAMPTZ

brand_inventory_lots — 로트별 재고
  id UUID PK
  brand_id UUID → brands.id
  inventory_id UUID → brand_inventory.id
  lot_number TEXT
  initial_qty INTEGER
  remaining_qty INTEGER
  expires_at TIMESTAMPTZ (유통기한)
  status TEXT (active/depleted/disposed)
  created_at TIMESTAMPTZ

brand_stock_logs — 재고 변동 로그
  id UUID PK
  brand_id UUID → brands.id
  inventory_id UUID → brand_inventory.id
  lot_id UUID → brand_inventory_lots.id
  change_type TEXT (in/out/adjust/emergency)
  qty INTEGER
  hq_status TEXT
  created_at TIMESTAMPTZ

brand_orders — 발주
  id UUID PK
  brand_id UUID → brands.id
  owner_id UUID → users.id
  status TEXT (pending/approved/shipped/delivered/cancelled)
  total_amount INTEGER
  tracking_number TEXT
  created_at TIMESTAMPTZ

brand_returns — 반품·교환
  id UUID PK
  brand_id UUID → brands.id
  order_id UUID → brand_orders.id
  rtn_code TEXT UNIQUE
  status TEXT (pending/approved/rejected/received)
  reason TEXT
  created_at TIMESTAMPTZ

brand_monthly_close — 월 마감
  id UUID PK
  brand_id UUID → brands.id
  close_month TEXT (예: 2026-06)
  status TEXT (open/closed)
  created_at TIMESTAMPTZ

### 결제/구매
purchases — 구매 내역
  id UUID PK
  user_id UUID → users.id
  product_id UUID → products.id
  amount INTEGER
  platform_fee NUMERIC (8.8%)
  partner_fee NUMERIC
  partner_fee_per_session NUMERIC
  toast_used NUMERIC
  payment_method TEXT
  status TEXT
  created_at TIMESTAMPTZ

payment_intents — 결제 의향
  id UUID PK
  target_id TEXT (compound pipe-delimited string)
  amount INTEGER
  status TEXT
  created_at TIMESTAMPTZ

### 토스트(T) 경제
toast_transactions — 토스트 내역
  id UUID PK
  user_id UUID → users.id
  amount NUMERIC (1T=1원)
  source_type TEXT (checkin/review/signup/purchase 등)
  created_at TIMESTAMPTZ

honey_logs — 꿀 리워드
  id UUID PK
  reviewer_id UUID → users.id
  new_customer_id UUID → users.id
  amount NUMERIC DEFAULT 1000
  created_at TIMESTAMPTZ

### 예약/살롱
bookings — 예약
  id UUID PK
  user_id UUID → users.id
  owner_id UUID → users.id
  service_id UUID
  status TEXT (pending/confirmed/cancelled/completed)
  booked_at TIMESTAMPTZ
  created_at TIMESTAMPTZ

### 외부 고객
external_customers — 오프라인 고객
  id UUID PK
  owner_id UUID → users.id
  name TEXT
  phone TEXT
  skin_type TEXT
  memo TEXT
  created_at TIMESTAMPTZ

external_care_cards_v2 — 외부 케어카드
  id UUID PK
  customer_id UUID → external_customers.id
  treatment TEXT
  memo TEXT
  created_at TIMESTAMPTZ

## 2. RPC 함수

increment_inventory_stock(inventory_id, qty)
  → brand_inventory.current_stock 증가
  → 중복 방지 처리

decrement_inventory_stock(inventory_id, qty)
  → brand_inventory.current_stock 감소
  → 재고 부족 시 에러

mask_phone(phone TEXT) → TEXT
  → 010-****-5678 형식 마스킹

mask_email(email TEXT) → TEXT
  → hon***@gmail.com 형식 마스킹

## 3. 주요 트리거

prevent_access_log_modification()
  → brand_access_logs UPDATE/DELETE 차단
  → 접근 로그 영구 보존

### 스토어 등급 자동 계산 (065_store_grade_system.sql)
- enum: store_grade_v2 = debut | essor | prestige | couronne | empire (구 store_grade → old_store_grade_unused 보존)
- users.store_grade 컬럼 타입 = store_grade_v2, default debut
- calculate_store_grade(p_salon_id UUID) → store_grade_v2 (SECURITY DEFINER)
  - salons: monthly_sales, review_count, avg_rating + users.total_orders (owner_id 조인)
  - 복합점수(0~100): 매출 35% + 평점 25% + 리뷰수 20% + 주문수 20%
  - 구간: 0~20 debut / 21~40 essor / 41~60 prestige / 61~80 couronne / 81~100 empire
- trg_auto_update_store_grade_salons: salons AFTER UPDATE OF review_count, avg_rating, monthly_sales → owner users.store_grade 갱신
- trg_auto_update_store_grade_orders: users AFTER UPDATE OF total_orders → 연결 salon 기준 재계산
- trg_guard_store_grade_manual_edit: users BEFORE UPDATE OF store_grade — API/클라이언트 수동 변경 차단 (자동 갱신은 app.store_grade_auto session flag)
- salons RLS: salons_select_all (SELECT true), salons_update_own (owner_id = current_user_id()), admin_all_salons (admin FOR ALL, 마이그레이션 075)

### 원장 입점 승인 (salons.status)
- UI: `/admin/owners` 입점 신청 대기 목록에서 승인/거절
- API: `POST /api/admin/owners/approve` — body `{ salon_id, action: 'approve' | 'reject' }`
  - approve: `users.status='active'`, `users.role='owner'` (salon.owner_id) 후 `salons.status='active'` (users → salons 순, 실패 시 `stage` 응답)
  - reject: `salons.status='rejected'` 만 변경 (users 미변경)
- service role client로 RLS 우회 처리
- `/api/admin/approvals` 는 **users 계정 승인**(partner/owner/brand `users.status`) 및 **brands 입점**만 처리 — salons 테이블은 더 이상 다루지 않음
- `/admin/owners` 클라이언트에서 salons/users 직접 UPDATE 하지 않음 (위 API 단일 경로)

### 원장 가입 v2 (owner-signup-v2)
- UI: `/signup/owner-v2` (약관 동의 내장, consent 페이지 생략)
- API: `POST /api/auth/owner-signup-v2` — service role, body `{ email, password, name, storeName, area, address, addressDetail, phone, ref?, brand_id? }`
- 처리 순서:
  1. `auth.admin.createUser` (email_confirm: true)
  2. `users` insert (role=owner, status=pending, referral_code, referred_by)
  3. `profiles` upsert (full_name, owner_store_name, has_offline_store) — **실패해도 롤백 없음**, `profile_warning` 응답
  4. `salons` insert (status=pending) — **실패 시 users row 삭제 + auth user 삭제**
  5. `brand_owner_links` insert (brand_id 선택 시, auto_approve_owner_invite 기준) — **실패해도 롤백 없음**, `brand_link_warning` 응답
- 성공 후 클라이언트에서 `signInWithPassword` → `/dashboard/owner` (pending이면 middleware → `/auth/pending-approval`)
- 진입 링크: `/join/owner?ref=`, 마이페이지 원장 추천 링크 → `/signup/owner-v2?ref=`
- **레거시 유지**: `/signup?role=owner`, `/login?role=owner` → consent → 기존 signup/page.tsx 원장 플로우는 **미삭제·미수정**

## 4. RLS 정책 원칙

모든 테이블 RLS 활성화
브랜드사 테이블: brands.user_id = auth.uid() 기준
일반 테이블: users.auth_id = auth.uid() 기준
SELECT 정책 누락 시 데이터 조회 전체 차단 → 반드시 확인

## 5. 주의사항

auth_id vs id:
users.auth_id = auth.users.id (Supabase Auth)
users.id = public.users 자체 PK (별도)
middleware는 auth_id 기준으로 role 조회
→ auth_id NULL이면 role 못 찾아서 customer로 처리됨

active_role 우선순위:
profiles.active_role이 있으면 middleware가 이걸 우선 사용
active_role = customer이면 brand role도 customer로 처리됨
→ 브랜드사 계정 생성 시 반드시 확인

브랜드사 계정 생성 체크리스트:
1. Supabase Auth → Add user (이메일/비밀번호)
2. public.users INSERT (auth_id, email, role=brand, status=active)
3. public.profiles INSERT (auth_id, role=brand, active_role=brand)
4. brands.user_id UPDATE (auth.users.id 연결)
5. brands.slug 설정

### 호르몬 페이즈 노출 규칙
- 페이즈(달빛기/황금기/만개기/물들기) 표시는 hormone_cycle.track === 'general'일 때만 허용
- 게이트 함수: src/lib/hormoneUtils.ts → canShowCyclePhase(track)
- profiles.cycle_type / profiles.hormone_cycle_applicable 컬럼은 미사용(전원 null, 죽은 컬럼) — 신규 로직에서 참조 금지
- 남성/여성갱년기(peri·post)/임신/산후/불규칙/무월경(의학적, track null 또는 미설정)은 페이즈 전면 숨김
- 적용 파일: salons/[id]/page.tsx, dashboard/owner/client-v2.tsx, charts-v2/ChartPopup.tsx, charts-v2/page.tsx, chat/[id]/page.tsx

### 스토어 꾸미기 (salons 컬럼: phase_greetings/phase_reco_enabled/banner_links/sns_links/main_cta/map_url)
- 영업시간은 SalonInfoForm의 open_hours 재사용
- 편집: /dashboard/owner/store-decoration (store/page.tsx 커머스 어드민과 별개)
- 고객 화면 컴포넌트: src/components/salon-store/* (500줄 초과로 분리생성)
- `salons.banner_url`(단수, 레거시)는 미사용 전환 — 고객 화면은 `banner_urls`(배열)·`banner_links`·`story_url` 사용. 배너는 헤더 바로 아래 풀폭 가로(21:9) 캐러셀, 프로필 정보 영역과 완전히 분리됨.

### 자격증·경력 전시 (salons.certificates)
- [{url, label}] 배열, owner-store 버킷 이미지
- 편집: SalonInfoForm.tsx / 전시: salons/[id]/page.tsx 샵정보 탭
- 파트너 자격증 검증 기능(미착수)과 별개 — 추후 파트너용으로 유사 구조 재사용 예정

### 브랜드 인증 등급 (brand_owner_grades) — 중요
- profiles.grade는 오렌 고객 멤버십 등급(PETAL/BLOOM) 전용, 브랜드 등급과 혼동 금지
- 브랜드별 원장 등급(취급점/전문점/프리미엄전문점/메디슈티컬)은 brand_owner_grades 사용
- 브랜드가 BrandTabOwners.tsx에서 등급 부여 → 고객 스토어 샵정보 탭에 자동 노출
- 아레테클럽(brand_arete_members)은 등급과 별개 배지로 병행 표시

### 브랜드 전문점 등급 구매 · 스폰서 커미션 (brand_tier_purchase) — 2026-07-11

PayApp `payment_intents.kind = 'brand_tier_purchase'` 로 원장이 tier_contract 브랜드의 전문점 등급 패키지를 구매하는 트랙 (오렌지사 신규매출 트랙B).

**관련 테이블 5개**

| 테이블 | 용도 |
|--------|------|
| `brand_tier_packages` | 브랜드별 등급(취급점~메디슈티컬) 패키지 가격·커미션율 정의. `distribution_type = 'tier_contract'` 브랜드만 |
| `brand_tier_orders` | 등급 구매 결제 원장. `owner_id` → **profiles.id**, `payment_intent_id`로 중복 처리 방지 |
| `brand_owner_grades` | 브랜드별 원장 등급·결제상태·`sponsor_owner_id`(최초 1회 고정). `owner_id` / `sponsor_owner_id` 모두 **profiles.id** |
| `sponsor_commission_ledger` | 스폰서 커미션 원장. `sponsor_owner_id`, `referred_owner_id` → **profiles.id** |
| `sponsor_eligibility` | 스폰서 자격·케어 활성 판정용 (후속 정산 연동 예정) |

**ID 체계 (절대규칙)**

- owner / sponsor / referred 참조는 전부 **profiles.id**. `users.id` 직접 FK 금지.
- `payment_intents.user_id`는 기존과 동일하게 **users.id** (PayApp create 흐름 호환).
- 스폰서 출처: `users.referred_by` (오렌 원장 유치 트랙). `brand_owner_links`와 별개.

**스폰서 커미션 원칙**

- **1단계(직근)만** 지급. upline 체인 없음.
- 스폰서는 동일 `brand_id`에서 `brand_owner_grades.payment_status = 'paid'` 인 경우만 자격.
- **커미션율 = 스폰서 본인 등급**의 `brand_tier_packages.commission_rate` (구매자가 산 패키지 rate 사용 금지).
- `commission_amount = net_amount × (스폰서등급 commission_rate / 100)`, `net_amount` = 결제액 − 8.8% 플랫폼 수수료.
- `sponsor_owner_id`는 `WHERE sponsor_owner_id IS NULL` 일 때만 1회 SET, 이후 변경 금지.

**앱 코드 위치**

- 결제 생성: `POST /api/payments/brand-tier/create` (서버가 DB `price`만 신뢰, sandbox 분기 없음)
- webhook 처리: `src/lib/webhookHandlers/brandTierPurchase.ts` (`handleBrandTierPurchase`)
- webhook route: `payapp/webhook/route.ts` 에 import + 4줄 분기만 (500줄 규칙 — 로직은 handlers로 분리)

**마이그레이션**: `079_sponsor_commission_system.sql` (078 `brands.distribution_type` 선행)

### 자격증 전시 2종 (완결)
1) 원장 직접 등록: salons.certificates (UNIT V/W)
2) 브랜드 인증: brand_owner_grades + brand_arete_members (UNIT X/Y)
샵정보 탭에 시각적으로 구분해서 나란히 노출

### ID 체계 경고 (중요)
profiles.id ≠ users.id — 서로 다른 테이블, auth_id로만 연결됨.
brand_owner_grades/brand_arete_members는 profiles.id 사용.
salons.owner_id는 users.id 사용.
두 시스템을 연결할 땐 반드시 auth_id를 경유해서 조회할 것
(users.id → users.auth_id → profiles.id 순서).

### 원장 프로필 사진
profiles.avatar_url 단일 소스. 편집: store-decoration/page.tsx.
노출: owner/[slug](로그인창), salons/[id](고객 스토어, auth_id 경유 조회).
세 화면 모두 같은 컬럼 참조하므로 한 곳에서 바꾸면 전체 반영됨.

### 결제 PIN 보안 (중요)
users.payment_pin_hash + pin_failed_count + pin_locked_until 만 사용.
users.payment_pin(단수, 평문) 존재하지 않는 죽은 참조였음 — 절대 재사용 금지.
PIN 검증은 반드시 PaymentAuthGuard 컴포넌트 + api/auth/pin/verify 경유.

### 잠금 정책 통일 (로그인 + 결제PIN)
5회→30초, 누적10회→5분, 누적15회→30분. users.login_failed_count/login_locked_until,
users.pin_failed_count/pin_locked_until 각각 별도 컬럼이지만 동일 규칙 적용.
PIN 숫자패드는 매번 랜덤 배열(set-pin, PinModal, PaymentAuthGuard 3곳).

### 예약 실시간 연동
- bookings 테이블, owner_id/customer_id 필터 postgres_changes
- 원장: useOwnerBookingRealtime 훅(BookingManagePage.tsx), 고객: MyBookingStatus.tsx 직접

### 예약 플로우 상태 복원
결제(/checkout/booking) 후 salons/[id]?booking_paid=true&purchase_id=... 복귀 시
purchases 테이블에서 시술명/가격/회차/salon_id를 재조회해 복원 (페이지 새로고침으로
React state 초기화되므로 필수).

### 예약 알림 2단계
1) 접수(pending, 고객이 bookings.insert): 고객+원장 notifications + salon 채널 접수메시지
2) 확정/완료/취소(원장이 status 변경): UNIT L의 useSalonBookingMessage

### 채팅 채널 역할 분리 (중요 — 절대 혼용 금지)
- channel_type='owner' + consultation_messages: 고객↔AURAN(오렌콘솔), 원장 무관
- channel_type='salon' + salon_messages + owner_id: 고객↔특정 원장님 전용
- RLS(chat_channel_access)로 user_id/owner_id 일치하는 본인만 접근 가능, 관리자만 전체 접근
- 예약 상태변경(확정/완료/취소) 메시지는 반드시 'salon' 타입 사용, useSalonBookingMessage 훅 참고
- 카카오 알림톡은 예약 관련 용도로 미사용 전환 (오렌상담톡으로 대체)

## users vs profiles 필드 정본 규칙 (2026-07-05 전수조사)

### 배경
users와 profiles 테이블에 같은 의미의 필드가 중복 존재. 신규 코드 작성 시 반드시 아래 표의 "정본" 테이블을 사용할 것.

### 정본표

| 필드(의미) | 정본 테이블.컬럼 | 비고 |
|---|---|---|
| 사람 이름 | profiles.full_name | users.name은 컬럼명이 다름, 혼동 주의 |
| 매장 이름 | profiles.owner_store_name | users.salon_name 있음, brand-orders에서 과거 존재하지 않는 users.store_name 조회 버그 있었음(수정완료) |
| 파트너 등급 | profiles.partner_grade | users.partner_grade는 미사용 죽은 컬럼 (enum, 값 다름 — 절대 참조 금지) |
| 아바타 | profiles.avatar_url | my/profile 저장 시 users.avatar_url에도 동기화됨 |
| 피부타입 | profiles.skin_type | users.skin_type은 레거시, analysis/page.tsx·admin coupons에서만 사용 중 (후속 정리 대상) |
| 전화번호 | ⚠️ 미확정 — 후속 작업 필요 | profiles(마이페이지 표시)와 users(알림톡/인증) 간 동기화 안 됨. api/auth/complete-phone은 users만, my/profile persist는 profiles만 갱신 |
| 이메일 | users.email | NOT NULL UNIQUE 제약, 가입 시 고정 |

### role vs active_role — 반드시 구분할 것

- **users.role**: 계정 최초 가입 시 정해지는 고정 신분(customer/partner/salon-owner/brand). 거의 변경되지 않음.
- **profiles.role**: users.role과 동기화되어야 하나 드리프트 가능성 있음.
- **profiles.active_role**: 로그인 후 홈 화면 우측 상단 "역할 스위처"로 사용자가 자유롭게 전환하는 현재 활성 화면 모드. profiles.roles(배열) 안에 있는 역할로만 전환 가능. 변경 API: POST /api/profile/active-role
- **미들웨어 판단 순서**: profiles.active_role → profiles.role → users.role (fallback)
- 예: 브랜드로 가입한 계정도 고객 화면 테스트를 위해 active_role을 'customer'로 전환해둘 수 있음 — 이건 버그가 아니라 정상 기능.

### owner_mode (참고, active_role과 무관)
- profiles.owner_mode: 원장의 운영 모드(auran 연동/독립 스토어 등), 구독 결제 웹훅에서만 갱신됨.
- active_role과 완전히 다른 개념이므로 혼동 금지.
- 값 정의가 코드 위치마다 약간 다르게 쓰이고 있음(auran/independent/integrated vs independent/both) — 후속 확인 필요 항목으로 별도 기록.

### 마이그레이션 드리프트 주의
- profiles 테이블은 마이그레이션 파일에 12개 컬럼만 기록되어 있으나, 실제 운영 DB에는 90개 이상의 컬럼이 존재함 (원격에서 직접 추가된 것으로 추정).
- 새 컬럼을 profiles에 추가할 때는 반드시 마이그레이션 파일로도 기록해서 이런 드리프트가 더 커지지 않도록 할 것.

## coupons 캠페인 증정품 필드 (066_coupon_campaign_gift.sql, 2026-07-07)

| 컬럼 | 타입/기본값 | 설명 |
|---|---|---|
| coupons.reward_type | text NOT NULL DEFAULT 'discount' (CHECK: discount / gift_product / gift_product_and_discount) | 쿠폰 보상 종류. discount=할인만, gift_product=제품증정만, gift_product_and_discount=증정+할인 |
| coupons.gift_product_id | uuid, REFERENCES public.products(id), nullable | 증정 대상 제품 (reward_type이 gift 계열일 때만 사용) |
| coupons.gift_product_qty | integer, nullable | 1인당 증정 수량 |
| coupons.campaign_quantity_limit | integer, nullable | 캠페인 전체 증정 한도 (타겟 리스트 인원수 기준, null이면 무제한) |
| coupons.campaign_quantity_issued | integer NOT NULL DEFAULT 0 | 캠페인 누적 지급 건수, limit 도달 시 추가 발급 차단 용도 |

- 전부 기본값/nullable이라 기존 쿠폰 발급/적용 플로우(computeDiscount.ts, checkout 단일선택 구조)에 영향 없음.
- 기존 RLS 정책(coupons_active_read, coupons_admin_all, coupons_readable_if_held)은 컬럼을 참조하지 않으므로 컬럼 추가로 깨지지 않음.

## scheduled_campaigns (067_scheduled_campaigns.sql, 2026-07-07)

예약형 마케팅 캠페인 코어 테이블. 지정 시각(scheduled_at) 도달 시 대상 고객에게 메시지+증정을 발송. 실시간 결제/재고 트리거 없이 Vercel Cron 스케줄러 방식(expire-coupons 패턴 재사용 예정).

| 컬럼 | 타입/기본값 | 설명 |
|---|---|---|
| id | uuid PK DEFAULT gen_random_uuid() | |
| sender_type | text NOT NULL DEFAULT 'owner' (CHECK: owner / brand) | 발신 주체. owner=원장→고객, brand=브랜드→원장(추후 확장). 필드 미리 넣어 테이블 재작업 없이 확장 가능 |
| sender_id | uuid NOT NULL | sender_type이 owner면 owner_id, brand면 brand_id |
| target_type | text NOT NULL (CHECK: manual_list / product_repurchase) | manual_list=체크박스로 고른 리스트, product_repurchase=제품+기간 필터 |
| target_customer_ids | uuid[] | manual_list일 때 대상 고객 id 배열 |
| target_customer_type | text NOT NULL DEFAULT 'external_customer' (CHECK: external_customer / auran_user) | target_customer_ids가 가리키는 대상 테이블 구분. external_customer=외부고객카드(SMS+오렌톡 분기 가능), auran_user=오렌 가입 내부고객(profiles/users, 오렌톡 salon_messages만 사용). 068에서 추가 |
| target_product_id | uuid REFERENCES products(id) | product_repurchase 대상 제품 |
| target_date_from / target_date_to | timestamptz | product_repurchase 기간 필터 |
| message | text NOT NULL | 발송 메시지 |
| sender_display_name | text | 카드 타이틀용 스토어명 스냅샷 (예: "OO원장님이 미쳤나봐요") |
| reward_type | text NOT NULL DEFAULT 'discount' (CHECK: discount / gift_product / gift_product_and_discount / none) | 보상 종류 |
| gift_product_id | uuid REFERENCES products(id) | 증정 제품 |
| gift_product_qty | integer | 1인당 증정 수량 |
| coupon_id | uuid REFERENCES coupons(id) | 연결 쿠폰 |
| scheduled_at | timestamptz NOT NULL | 예약 발송 시각 (cron이 도달 건 조회) |
| status | text NOT NULL DEFAULT 'pending' (CHECK: pending / sent / failed / cancelled) | pending=대기(취소가능), sent=발송완료(취소불가), failed, cancelled |
| created_by | uuid NOT NULL | 생성자 |
| sent_at | timestamptz | 실제 발송 완료 시각 |
| result_success_count / result_failed_count / result_no_channel_count | integer | 발송 결과 집계 (broadcast-to-buyers 응답 재사용) |
| created_at | timestamptz NOT NULL DEFAULT now() | |

- RLS: ENABLE 후 `scheduled_campaigns_admin_all`(FOR ALL) 정책 — super_admin(JWT app_metadata.role) 또는 users.role='admin'(auth_id=auth.uid())만 접근. 일반 유저 SELECT/INSERT 차단.
- FK: products/coupons 모두 PK가 uuid `id`라 참조 정상.

### categories 테이블 드리프트 참고
마이그레이션 파일에 정의 없음(대시보드 생성). 2026-07-07 스킨케어(level=2) 하위에 비비/쿠션(level=3) 데이터 직접 추가함. 카테고리 추가는 supabase/migrations가 아니라 대시보드에서 직접 INSERT로 이뤄지고 있으므로, 전체 categories 데이터는 대시보드 information_schema/직접 조회로만 확인 가능.

### products 테이블 RLS 정책 현황 (2026-07-07 점검)
마이그레이션에 기록된 정책:
- `public read products` (017) — SELECT, anon+authenticated, USING(true)
- `admin update products` (038) — UPDATE, authenticated, users.role='admin' OR profiles.role='admin'
- `admin delete products` (042) — DELETE, authenticated, admin 조건
- `admin can insert products` (069, 신규 2026-07-07) — INSERT, authenticated, 038과 동일한 admin 판별(WITH CHECK)

대시보드 직접 생성분(드리프트, 마이그레이션 미기록): `brand can insert own products`(브랜드 소속 제품만 INSERT 허용) 등 브랜드 계열 정책. 069 추가 전까지 admin 전용 INSERT 정책이 없어 /admin/products/edit-v2 신규 등록이 RLS 위반으로 실패했음. 전체 정책 목록은 대시보드 pg_policies로만 최종 확인 가능.

### 매거진 × 르노벨 제품 태그 → 상담톡 직결 (2026-07-07)
- `magazines.product_tags`: 제품 UUID 문자열 배열(JSONB). 어드민 `/admin/magazine`에서 `products.id` 최대 5개 태그.
- 고객 매거진 상세 `/magazine/[id]`: `product_tags`로 `products` 조회 후 추천 제품 카드 렌더. 글 본문·목록은 SEO 공개(noindex 없음).
- **일반 제품**: "구매하기" → `/products/{id}` 이동(기존과 동일).
- **르노벨 제품** (`products.brand_id = 90175aa9-70c8-4568-865a-195f11bd7859`): "구매하기" → 제품 상세 대신 동일 페이지에서 `ConsultChat` 오픈(제품 페이지·브랜드 상세 비노출 유지). 비로그인 시 `onLoginRequest` → `/login?role=customer`.
