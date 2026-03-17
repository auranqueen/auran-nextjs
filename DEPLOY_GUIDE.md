# AURAN Platform — 배포 & 개발 가이드
# Next.js 14 + Supabase + Vercel

========================================================
## 1단계 — Supabase 프로젝트 생성 (10분)
========================================================

1. https://supabase.com 접속 → 로그인 → New Project

   - Project name: auran-platform
   - Database password: 강력한 비밀번호 저장
   - Region: Northeast Asia (ap-northeast-1)

2. 프로젝트 생성 후 Settings > API 탭에서 복사:
   - Project URL     → NEXT_PUBLIC_SUPABASE_URL
   - anon public     → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role    → SUPABASE_SERVICE_KEY  (서버 전용, 공개 금지!)

3. Supabase 대시보드 > SQL Editor > New Query
   supabase/migrations/001_initial_schema.sql 전체 복사·붙여넣기 → Run

4. Authentication > Providers 설정:
   - Email: 활성화
   - Kakao: 카카오 개발자 콘솔에서 앱 등록 후 Key 입력
   - Naver: 네이버 개발자 센터 등록 후 Key 입력
   - Google: Google Cloud Console OAuth 등록

5. Authentication > URL Configuration:
   - Site URL: https://auran.kr  (또는 Vercel 프리뷰 URL)
   - Redirect URLs 추가: https://auran.kr/auth/callback

========================================================
## 2단계 — 로컬 개발 환경 설정 (5분)
========================================================

# 1. 이 폴더를 로컬에 받아서 압축 해제 후:
cd auran-nextjs

# 2. 의존성 설치
npm install

# 3. 환경변수 파일 생성
cp .env.example .env.local

# 4. .env.local 수정:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...   # 서버 API 전용
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 토스페이먼츠 (결제)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...

# 5. 개발 서버 실행
npm run dev
→ http://localhost:3000

========================================================
## 3단계 — Vercel 배포 (10분)
========================================================

방법 A — GitHub 연동 (권장):
  1. https://github.com 새 Repository 생성: auran-platform
  2. 로컬 폴더를 push:
     git init
     git add .
     git commit -m "init"
     git remote add origin https://github.com/YOUR_ID/auran-platform.git
     git push -u origin main

  3. https://vercel.com → Import Project → GitHub 연결
  4. Framework: Next.js (자동 감지)
  5. Environment Variables 추가:
     - NEXT_PUBLIC_SUPABASE_URL
     - NEXT_PUBLIC_SUPABASE_ANON_KEY
     - SUPABASE_SERVICE_KEY
     - NEXT_PUBLIC_TOSS_CLIENT_KEY
     - TOSS_SECRET_KEY
  6. Deploy → 프리뷰 URL 자동 생성
     예) https://auran-platform-abc123.vercel.app

방법 B — Vercel CLI:
  npm install -g vercel
  vercel
  vercel --prod

========================================================
## 4단계 — auran.kr 도메인 연결 (15분)
========================================================

1. Vercel 대시보드 → Project → Settings → Domains
2. auran.kr 입력 → Add

3. 도메인 등록업체 (가비아/후이즈) 접속:
   - DNS 관리 → A 레코드 추가:
     @ → 76.76.19.61  (Vercel IP)
   - CNAME 추가:
     www → cname.vercel-dns.com

4. Vercel에서 도메인 인증 완료 확인 (DNS 전파 최대 48시간)

5. Supabase > Authentication > URL Configuration 업데이트:
   - Site URL: https://auran.kr
   - Redirect: https://auran.kr/auth/callback, https://www.auran.kr/auth/callback

========================================================
## 5단계 — 카카오 소셜 로그인 설정
========================================================

1. https://developers.kakao.com → 내 애플리케이션 → 앱 추가
   - 앱 이름: AURAN

2. 플랫폼 → Web → 사이트 도메인:
   https://auran.kr
   https://YOUR-PROJECT.supabase.co

3. 카카오 로그인 → 활성화 → Redirect URI:
   https://YOUR-PROJECT.supabase.co/auth/v1/callback

4. Supabase > Auth > Providers > Kakao:
   - REST API 키 → Client ID
   - Client Secret은 선택 (보안 강화 시 설정)

5. .env.local 불필요 (Supabase가 처리)

========================================================
## 6단계 — 토스페이먼츠 결제 연동
========================================================

1. https://developers.tosspayments.com 회원가입
2. 테스트 → 클라이언트 키, 시크릿 키 복사
3. .env.local에 추가:
   NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
   TOSS_SECRET_KEY=test_sk_...
4. 실제 서비스 전환 시 라이브 키로 교체

결제 API 경로: src/app/api/payments/route.ts

========================================================
## 7단계 — 카카오 알림톡 (선택)
========================================================

# 알리고 API 사용 (소량 발송)
ALIGO_API_KEY=...
ALIGO_USER_ID=...
ALIGO_SENDER=...

# 또는 카카오 비즈메시지
KAKAO_BIZ_KEY=...

발송 API 경로: src/app/api/notifications/route.ts

========================================================
## 프로젝트 구조
========================================================

auran-nextjs/
├── src/
│   ├── app/
│   │   ├── (auth)/                 # 로그인/회원가입
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── admin/                  # PC 어드민 대시보드
│   │   │   ├── page.tsx            # 메인 대시보드
│   │   │   ├── customer/page.tsx   # 고객 관리
│   │   │   ├── partner/page.tsx    # 파트너 관리
│   │   │   ├── owner/page.tsx      # 원장님 관리
│   │   │   ├── brand/page.tsx      # 브랜드사 관리
│   │   │   ├── shipping/page.tsx   # 배송 관리
│   │   │   ├── orders/page.tsx     # 주문 내역
│   │   │   ├── settlement/page.tsx # 정산 관리 ★
│   │   │   ├── refund/page.tsx     # 환불 관리 ★
│   │   │   ├── coupon/page.tsx     # 쿠폰 관리 ★
│   │   │   ├── review/page.tsx     # 리뷰 관리 ★
│   │   │   ├── community/page.tsx  # 커뮤니티 관리 ★
│   │   │   ├── analytics/          # 분석 ★
│   │   │   │   ├── traffic/page.tsx
│   │   │   │   ├── members/page.tsx
│   │   │   │   ├── skin/page.tsx
│   │   │   │   ├── brand/page.tsx
│   │   │   │   └── marketing/page.tsx
│   │   │   ├── ranking/page.tsx    # 랭킹 ★
│   │   │   ├── notifications/page.tsx # 알림 발송 ★
│   │   │   ├── mapping/page.tsx
│   │   │   ├── charge/page.tsx
│   │   │   ├── invite/page.tsx
│   │   │   ├── logs/page.tsx
│   │   │   └── privacy/page.tsx
│   │   ├── api/                    # API Routes
│   │   │   ├── auth/               # 인증
│   │   │   ├── users/              # 회원 CRUD
│   │   │   ├── orders/             # 주문 처리
│   │   │   ├── payments/           # 토스페이먼츠
│   │   │   ├── shipping/           # 배송 처리
│   │   │   ├── settlement/         # 정산 처리
│   │   │   ├── refund/             # 환불 처리
│   │   │   ├── coupons/            # 쿠폰
│   │   │   ├── reviews/            # 리뷰
│   │   │   ├── notifications/      # 알림톡
│   │   │   ├── invite/             # 초대 링크
│   │   │   └── admin/              # 어드민 전용
│   │   ├── customer/               # 고객 앱
│   │   ├── partner/                # 파트너 앱
│   │   ├── owner/                  # 원장님 앱
│   │   ├── brand/                  # 브랜드사 앱
│   │   ├── join/[role]/page.tsx    # 초대 링크 가입
│   │   ├── auth/callback/route.ts  # 소셜 로그인 콜백
│   │   ├── layout.tsx
│   │   └── page.tsx                # 랜딩 / 역할 선택
│   ├── components/
│   │   ├── ui/                     # 공통 UI
│   │   ├── admin/                  # 어드민 전용
│   │   └── customer/               # 고객 전용
│   ├── lib/
│   │   ├── supabase.ts             # Supabase 클라이언트
│   │   ├── auth.ts                 # 인증 헬퍼
│   │   ├── api.ts                  # API 헬퍼
│   │   └── utils.ts                # 유틸
│   ├── hooks/                      # React Hooks
│   └── types/index.ts              # TypeScript 타입
├── supabase/
│   ├── migrations/                 # DB 마이그레이션
│   └── functions/                  # Edge Functions
├── public/
├── .env.example
├── .env.local                      # ← 직접 생성 (gitignore)
├── next.config.js
├── tailwind.config.js
└── package.json

========================================================
## 개발 우선순위
========================================================

Phase 1 (1주) — 핵심 인증 + 주문:
  ✅ 회원가입 / 로그인 (이메일 + 소셜)
  ✅ 역할별 대시보드 라우팅
  ✅ 초대 링크 실제 작동
  ✅ 주문 생성 + 배송 처리
  ✅ 포인트 자동 적립

Phase 2 (1주) — 관리 기능:
  ✅ 정산 관리
  ✅ 환불 관리
  ✅ 쿠폰 시스템
  ✅ 리뷰 관리
  ✅ 커뮤니티

Phase 3 (1주) — 분석 + 성장:
  ✅ 유입 분석
  ✅ 피부 분석 통계
  ✅ 랭킹 시스템
  ✅ 알림 발송
  ✅ 마케팅 대시보드

========================================================
## 초대 링크 실제 동작 방식
========================================================

1. 어드민에서 링크 생성:
   https://auran.kr/join/owner?ref=OWN-260315001

2. 원장님이 링크 클릭 →
   src/app/join/[role]/page.tsx 에서:
   - ref 코드 확인 → invite_links 테이블 조회
   - 회원가입 폼에 role 자동 설정
   - 가입 완료 시 invite_links.used_count +1

3. 가입 완료 → users 테이블에 role='owner' 저장
   → 자동으로 원장님 대시보드 진입

========================================================
## 자주 쓰는 Supabase 쿼리 예시
========================================================

# 전체 회원 조회 (어드민)
const { data } = await supabase
  .from('users')
  .select('*')
  .order('created_at', { ascending: false })

# 발송 대기 주문
const { data } = await supabase
  .from('orders')
  .select('*, order_items(*), customer:users!customer_id(*)')
  .in('status', ['주문확인', '발송준비'])
  .order('ordered_at')

# 배송 완료 처리 (포인트 자동 적립은 DB Trigger)
const { error } = await supabase
  .from('orders')
  .update({ status: '배송완료', delivered_at: new Date().toISOString() })
  .eq('id', orderId)

# 리뷰 승인
const { error } = await supabase
  .from('reviews')
  .update({ status: '게시', approved_at: new Date().toISOString() })
  .eq('id', reviewId)
