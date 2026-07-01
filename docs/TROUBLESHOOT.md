# AURAN 트러블슈팅 기록
> 발생한 오류와 해결법을 날짜순으로 기록. 같은 오류 반복 방지용.

---

## 2026-06-03

### PC 반응형 규칙
salons/[id]/page.tsx, checkout/booking/page.tsx 등 고객 대면 페이지는 최상위에
maxWidth:480 + margin:'0 auto' 컨테이너 필수 — 없으면 PC에서 그리드/fixed 요소가
브라우저 폭 그대로 늘어나 깨짐 (2026-06-03 실사용 중 발견).

### 예약 플로우
salons/[id]/page.tsx에서 회차 선택 → URL sessions 파라미터로 전달 →
checkout/booking/page.tsx가 그대로 받아씀. 회차 선택 UI 중복 금지.

---

## 2026-06-28

### 브랜드사 로그인 후 고객 홈으로 튕기는 문제

증상:
auran.kr/brand/civasan 로그인 성공 후
오렌 고객 홈(/)으로 redirect됨

원인 1 — middleware isBrand 체크:
/brand/[slug] 로그인 페이지도 isBrand에 포함되어
role 체크 → brand 아니면 / 로 튕김

해결 1:
middleware.ts에서 /brand/[slug] 패턴 제외
const isBrand = pathname.startsWith('/brand')
  && !pathname.startsWith('/brands')
  && !pathname.match(/^\/brand\/[^/]+$/)
  && !pathname.match(/^\/brand\/[^/]+\//)
const isLogiLogin = pathname.match(/^\/logi\/[^/]+$/) !== null

원인 2 — users.auth_id = null:
public.users 테이블에 auth_id가 null이라
middleware의 getDbRole()이 role을 못 찾아 customer로 처리

해결 2:
UPDATE public.users
SET auth_id = '[auth_uuid]'
WHERE email = 'civasan@auran.kr';

원인 3 — profiles.active_role = customer:
middleware가 active_role을 role보다 우선 참조
active_role이 customer면 brand role도 무시됨

해결 3:
UPDATE public.profiles
SET role = 'brand', active_role = 'brand'
WHERE auth_id = '[auth_uuid]';

브랜드사 계정 생성 시 필수 체크리스트:
1. auth.users 생성 (Supabase Auth → Add user)
2. public.users: auth_id + email + role=brand + status=active
3. public.profiles: auth_id + role=brand + active_role=brand
4. brands.user_id = auth.users.id 연결

---

### Supabase auth.create_user 함수 없음

증상:
SELECT auth.create_user(...) 실행 시
ERROR: 42883: function auth.create_user does not exist

원인:
Supabase는 auth.create_user() SQL 함수 미지원

해결:
Supabase 대시보드 → Authentication → Users → Add user
이메일/비밀번호 직접 입력 후 Create user

---

### brands.user_id FK 제약 위반

증상:
UPDATE brands SET user_id = '...' 실행 시
ERROR: 23503: insert or update on table "brands" violates foreign key constraint

원인:
brands.user_id가 auth.users가 아닌 public.users를 참조
public.users에 해당 계정이 없으면 FK 오류

해결:
INSERT INTO public.users (id, email)
VALUES ('[auth_uuid]', 'civasan@auran.kr')
ON CONFLICT (id) DO NOTHING;
→ 그 다음 brands.user_id UPDATE

---

### users.email NOT NULL 제약 위반

증상:
INSERT INTO public.users (auth_id, role, status) 실행 시
ERROR: 23502: null value in column "email" violates not-null constraint

원인:
public.users.email 컬럼 NOT NULL 제약

해결:
INSERT INTO public.users (auth_id, email, role, status)
VALUES ('[auth_uuid]', 'civasan@auran.kr', 'brand', 'active')

---

### users.email UNIQUE 위반

증상:
INSERT INTO public.users ... 실행 시
ERROR: 23505: duplicate key value violates unique constraint "users_email_key"

원인:
이미 같은 이메일로 users 레코드 존재

해결:
INSERT 대신 UPDATE 사용:
UPDATE public.users
SET role = 'brand', status = 'active', auth_id = '[auth_uuid]'
WHERE email = 'civasan@auran.kr';

---

## 2026-06-25

### Vercel 빌드 실패 — 모듈 없음

증상:
Vercel 배포 시 연속 Error:
Module not found: Can't resolve 'qrcode'
Module not found: Can't resolve '@zxing/library'
Module not found: Can't resolve '@tiptap/react'

원인:
로컬에서 npm install 후 package.json 커밋 안 함
Vercel은 npm ci로 깨끗하게 설치 → 모듈 없어서 실패

해결:
npm install qrcode @zxing/library @tiptap/react @tiptap/starter-kit
git add package.json package-lock.json
git commit -m "fix: 누락된 의존성 package.json 추가"
git push

예방:
npm install 후 반드시 package.json + package-lock.json 같이 커밋

---

### git pull 후 빌드 실패

증상:
git pull origin main 후 npm run build 실패
같은 모듈 없음 오류

원인:
다른 환경에서 패키지 추가됐는데
pull 후 npm install 안 함

해결:
git pull 후 항상 npm install 실행
→ 그 다음 npm run build

---

## 2026-06 이전

### Kakao OAuth PKCE 버그

증상:
카카오 로그인 후 콜백에서 세션 없음

원인:
클라이언트 사이드 code exchange 시도
PKCE는 서버 사이드에서 처리해야 함

해결:
createServerClient로 서버 사이드 code exchange
auth/callback/route.ts에서 처리

---

### PayApp target_id 타입 오류

증상:
결제 완료 후 주문 상태 미변경

원인:
payment_intents.target_id가 UUID 타입
compound pipe-delimited string 저장 불가

해결:
target_id 컬럼 타입 UUID → TEXT 변경
compound string 형식: "order_id|product_id|user_id"

---

### 이중 포인트 적립 버그

증상:
구매 완료 시 토스트가 2번 적립됨

원인:
결제 완료 콜백과 웹훅 두 곳에서 동시 적립

해결:
웹훅에서만 적립 (구매금액의 5%)
콜백에서 적립 로직 완전 제거

---

### middleware redirect 루프

증상:
특정 페이지 접속 시 무한 깜빡임

원인:
middleware → /dashboard/brand redirect
→ 다시 middleware 체크 → 루프

해결:
이미 target 경로에 있으면 redirect 안 함:
if (!pathname.startsWith(target)) redirect(target)
/dashboard/customer → / redirect 예외 처리

---

### Supabase 지연 ~200ms

증상:
DB 조회마다 200ms 이상 지연

원인:
Supabase 리전이 Sydney(ap-southeast-2)
한국에서 물리적으로 멀어서 지연 발생

해결:
Seoul 리전(ap-northeast-2)으로 프로젝트 이전
이전 후 지연 ~30ms로 개선

---

### 남성 호르몬 페이즈 콘텐츠 노출 버그 (박승수 버그)

증상:
남성 회원에게 여성 호르몬 주기 콘텐츠 노출

원인:
hormone_track 필터 없이 전체 콘텐츠 조회

해결:
male/male_menopause 트랙 전용 필터 추가
페이즈 콘텐츠 조회 시 hormone_track 조건 필수
