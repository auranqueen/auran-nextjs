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
