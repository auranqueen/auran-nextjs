# AURAN 변경 이력 (CHANGELOG)
> 최신순 정렬. 작업 완료 시마다 업데이트할 것.

---

## 2026-07-22

- **feat: 재고발주 월정산 자동화(25일 취합/미납시 발주차단) 구축**
  - `src/lib/billing/aggregateBrandBilling.ts` 신규: 월 구간 + `cancelled` 제외 합산, `brand_billing_invoices` upsert, `calcPouchTier` 반영
  - `/api/cron/aggregate-brand-billing` 신규: 매월 25일(`0 3 25 * *`) 자동실행, 이번달 발주 있는 원장 전체 청구서 자동생성
  - `/api/brand-orders/create` 신규: 서버단 발주 생성 + 미납(`status=unpaid`, `total_amount>0`, 납기 경과) 시 403 차단, 결제 완료되면 다음 발주 시도부터 실시간으로 자동 해제
  - `src/app/dashboard/owner/brand-orders/page.tsx`: `submitOrder`의 직접 insert를 신규 API 호출로 교체 (앵커 1곳만 최소 수정)
  - `vercel.json` cron 등록 추가

- **feat: 샘플발송 원장선택 + 오렌톡 타겟팅 시스템 구축, 가짜 발송버튼 수정**
  - migration `119_brand_sample_sends_message_targeting.sql`: `brand_sample_sends.owner_id`, `brand_messages.target_owner_id` 추가 (수동 반영 완료 · 문서화)
  - `client-v2.tsx`: `brand_messages` 조회에 `target_owner_id` 필터 추가 (`myProfileId` 기준, `null`이면 전체공개 기존 동작 유지)
  - `BrandTabSample.tsx`: 발송 버튼이 대상 원장 미지정으로 빈 행만 만들던 버그 수정. 등급필터 + 원장 체크리스트(트랙A/B 뱃지) + 메시지 직접작성 UI 신규. `sendSample`을 선택된 원장별 개별 insert로 재설계
  - `BrandTabLive.tsx`: `showToast`만 하던 가짜 발송을 실제 `brand_messages` insert로 교체
  - `BrandTabOwners.tsx`: 800줄 규칙 초과로 `OwnerOrenTalkButton.tsx` 신규 분리, 최소 교체 적용

- **fix: 브랜드 홈 매출 KPI 수정 + 30일 추이 그래프 추가 + 최근주문 product_name 핫픽스** (`BrandTabHome.tsx`)
  - 이달 판매액 KPI: `orders` 테이블(브랜드 필터 없던 버그) → `brand_orders`(재고발주) 기준으로 교체. `status='cancelled'` 제외 `total_amount` 합산
  - 최근 30일 매출 추이 그래프 신규: `created_at` 기준 생성분(+) − `updated_at` 기준 취소분(`status='cancelled'`) 일별 집계, recharts `Line`(골드 `#C9A96E`)
  - 매출액 카드 클릭 시 인라인 아코디언(이번달 발주 리스트: 날짜·원장명·금액·상태, 취소는 `-`금액+회색 뱃지, 「접기」토글)
  - **살롱스토어(`brand_product_orders`)는 브랜드사 매출 KPI/추이에서 의도적으로 제외** (재고발주만 집계)
  - **핫픽스:** 「최근 주문」블록이 존재하지 않는 `brand_orders.product_name` 컬럼을 select해 400 에러 발생 + 홈 데이터 로딩 전체가 막히던 문제 → `items[].name` 기준 표시로 교정 (복수 품목은 `외 N건`)

## 2026-07-21 (8) 레거시 dead path 제거
- src/app/api/payment/callback/route.ts 삭제
- 사유: benefit_settings + award_points 5% 이중적립 위험 로직 포함,
  코드베이스 내 참조 0건 확인(2회 검증) — 실제 결제는
  /api/payments/payapp/webhook 경로 사용 중

## 2026-07-21 (7) 회원 이름 누락 근본 차단
- auth/done upsert가 name 없이 계정을 만들 수 있던 경로 차단
  (기존 유저면 skip, 신규면 메타데이터/이메일 기반 이름 폴백 채워서 insert)
- 이메일 가입 폼: 공백만 있는 이름 제출 거부
- 마이페이지 프로필 수정: 빈 이름으로 덮어쓰기 차단
- 어드민 toast-history: "이름없음" → "⚠ 이름누락(오류)"로 문구 강화
- ⚠️ known issue: 기존에 이미 name=''로 저장된 유저는 자동 복구 안 됨,
  SQL 백필 별도 필요 (청담앨리스 등 1건 확인, 나머지는 테스트/브랜드 계정)

## 2026-07-21 (6) toast-history 이름없음 유저 표시 개선
- 회원명이 빈 유저는 UUID 앞 8자리 노출 대신 "이름없음" 표시
- <td title={user_id}>로 hover 시 전체 UUID 확인 가능

## 2026-07-21 (5) toast-history FK 에러 수정 + 트랙 표시
- 핫픽스: users(name) → users!toast_transactions_user_id_fkey(name) (admin_id FK 추가로 인한 embed 모호성 에러 해결)
- 신규: 목록에 회원 트랙(A/B) 컬럼 추가 (users.origin_track 조인)
- 디버그용 임시 에러노출 코드 원복 완료

## 2026-07-21 (3) 오렌콘솔 토스트 강제지급/차감
- 신규 API: POST /api/admin/toast/grant (toast_transactions 장부, admin_id/note 기록, 지급·차감 모두 지원)
- /admin/members 회원상세에 「토스트 지급/차감」버튼 + 인라인 폼 추가 (기존 「포인트 지급」모달/point_history 장부는 완전 별개로 유지)
- ⚠️ known issue: members/page.tsx 876줄로 규칙9(500줄) 초과 심화

## 2026-07-21 (2) 오렌콘솔 토스트 회수/조정 기능
- migration 118: toast_transactions.note, admin_id 컬럼 + reference_id 인덱스 추가
- /admin/toast-history: earn+active 상태 토스트에 "회수" 버튼 추가, 인라인 사유입력 → 신규 adjust row(마이너스 금액) 생성 방식으로 이력 보존 (DELETE 방식 폐기)
- 신규 API: POST /api/admin/toast/adjust
- ⚠️ known issue: toast-history/page.tsx 563줄로 규칙9(500줄) 초과, 컴포넌트 분리 필요 (미착수)

## 2026-07-21

## 출석토스트 이중지급 수정
- checkin/route.ts: existCheckin 방식 → upsert(onConflict) 방식으로 변경 (레이스 컨디션 제거)
- toast_transactions.reference_id 필드 활용 시작 (${userId}:${date})
- CheckinTracker.tsx 신규 컴포넌트 분리 (page.tsx L956-972, L4583-4602 로직 이관), in-flight 락 추가
- migration 117: daily_checkin (user_id, checked_at) UNIQUE 제약 추가
- 기존 중복지급 8건 회수 완료 (9fa4eb0b 300T, a6af3814 500T)

## 2026-07-20

- feat: 트랙A 리뷰 작성기한 신설 — 배송완료(delivered_at) 기준 21일 초과 시 리뷰 작성 차단
- fix: 구매적립토스트 지급 시점을 결제완료→구매확정으로 이동 (트랙A: brandProductOrder.ts/auto-confirm-cron/review-create, 트랙B: confirmOrder.ts/payapp-webhook) — 취소·반품·교환 전 부정 적립 방지, customer_toast_paid/purchase_toast_paid 플래그로 재지급 방지
- **fix: 리뷰 작성 자격체크(brand-product-reviews/create) — 결제완료 상태에서도 리뷰 작성 가능하던 버그 수정, 배송완료 상태에서만 리뷰 작성 가능하도록 제한**

## 2026-07-19

- **제품목록 페이지에 배너+큐레이션 노출 섹션 추가**: `src/app/salons/[id]/products/page.tsx` — 검색바 아래, 정렬바 위에 원장 배너와 추천 제품(가로 스크롤) 섹션 추가. `GET /api/salons/[id]/curation`에서 `banner`/`products` 조회(`useEffect` dep `[params.id]`). 배너는 `isPc`로 PC(`image_url_pc`)/모바일(`image_url_mobile`) 이미지 분기, `link_url` 있으면 `<a>` 래핑. 배너 없으면 배너 섹션 숨김, 추천 제품 0개면 추천 섹션 숨김. `GOLD` 상수(기존 선언, 6행) 라벨에 사용. 기존 검색/정렬/그리드 로직 무변경. 트랙A 전용.
- **원장 사이드바에 "브랜드 스토어 꾸미기" 메뉴 추가**: `src/components/OwnerSidebarShell.tsx` — `MENU_ITEMS`에 `{ label: '브랜드 스토어 꾸미기', href: '/dashboard/owner/brand-store-decoration' }` 추가, `menuItems` useMemo 필터 조건에 해당 href 포함시켜 `ready && isTrackA`(트랙A 원장)에게만 노출. 기존 `brand-orders`/`brand-retail-orders`와 동일한 격리 조건. 나머지 로직 무변경.
- **원장 브랜드스토어꾸미기 화면 신규**: `src/app/dashboard/owner/brand-store-decoration/page.tsx` — 트랙A 전용 원장 관리 화면. 기존 트랙B `store-decoration`(살롱 배너/스토리/인사말/SNS)과 **경로 충돌 방지 위해 별도 라우트**로 분리. 기능: 배너 업로드(PC/모바일, `product-images` 버킷 재사용 후 `/api/brand-product-orders/banner` upsert), 추천 제품 토글(최대 8개, `/api/brand-product-orders/curation-toggle`), 스토어알림받기 구독자 수 표시 + `/api/brand-product-orders/notify-customers` 수동 발송(쿨다운 안내 처리). `supabaseRef`로 클라이언트 고정, `load` useCallback 의존성 `[]` 유지(supabase 미포함). 기존 파일 무변경.
- **고객알림 발송 대상을 "스토어알림받기 설정 고객"으로 변경**: `POST /api/brand-product-orders/notify-customers` — 기존 "이 살롱 구매이력 전체(`brand_product_orders`)"에서 "구독자(`brand_product_salon_subscribers`)"로 대상 소스 교체. 명시적으로 알림받기를 설정한 고객에게만 발송되어 마케팅 수신동의 문제를 근본 해결. 알림 본문도 안내 문구로 변경. 24시간 쿨다운·insert 로직은 무변경.
- **살롱 구독(알림받기) 토글/조회 API 신설**: `POST/GET /api/salons/[id]/subscribe` — 로그인 고객이 특정 살롱의 소식 알림을 구독/해지. POST는 `subscribed:true`면 `brand_product_salon_subscribers`에 upsert(`onConflict: salon_id,customer_id`), `false`면 delete. GET은 현재 구독 여부를 `subscribed`로 반환하되, 비로그인·서비스 불가·유저 미조회 시 에러 대신 `{ ok:true, subscribed:false }` 안전 반환(공개 화면 렌더 안전). 트랙A 전용, 트랙B 정책 미참조.
- **고객알림 API에 24시간 쿨다운 추가**: `POST /api/brand-product-orders/notify-customers` — 대상 계산 후 발송 직전, 같은 살롱의 `link_url=/salons/{id}/products` + `type:'promo'` 알림이 최근 24시간 내 존재하면 `cooldown_active`(HTTP 429)로 차단. 동일 살롱 프로모 알림의 24시간 내 중복 발송을 방지(원장 반복 클릭 남용 방어). 나머지 로직 무변경.
- **원장 고객알림 발송 API 신설**: `POST /api/brand-product-orders/notify-customers` — 로그인 원장이 능동적으로 트리거(버튼 클릭)해야만 실행되는 수동 발송. 자동 발송 아님. 본인 살롱(`salons.owner_id`) 검증 후, 해당 살롱에서 `brand_product_orders` 구매이력이 있는 고객(status가 `결제대기`/`취소` 제외) `customer_id`를 중복 제거해 `notifications`에 `type:'promo'` 알림 일괄 insert(`link_url=/salons/{id}/products`). 대상 0명이면 `notified:0`. 트랙A 전용, 트랙B 정책 미참조.
- **원장 배너 업로드/숨김 API 신설**: `POST/DELETE /api/brand-product-orders/banner` — 로그인 원장이 자기 살롱 스토어 대표 배너를 등록/숨김. POST는 본인 살롱(`salons.owner_id`) 검증 후 `brand_product_salon_banner`에 `is_active=true` upsert(`onConflict: salon_id`, 살롱당 1개). 모바일/PC 이미지 중 하나만 올리면 나머지 사이즈를 같은 이미지로 자동 복제, 둘 다 없으면 `image_required`. DELETE는 실제 삭제 대신 `is_active=false`로 숨김 처리. 트랙A 전용, 트랙B 정책 미참조.
- **원장 큐레이션 토글 API 신설**: `POST /api/brand-product-orders/curation-toggle` — 로그인 원장이 자기 살롱의 추천 제품 노출을 on/off. 검증 체인: 본인 살롱(`salons.owner_id`) 확인 → 제품 존재 확인 → `brand_owner_links`(status=active)로 트랙A 브랜드-원장 연결 검증. 노출 ON 시 `brand_product_salon_display`에 `is_featured=true` upsert(`onConflict: salon_id,brand_product_id`, `display_order`는 기존 featured 개수), 최대 8개 제한(초과 시 `curation_limit_reached`). OFF 시 `is_featured=false` 업데이트. 트랙A 전용, 트랙B 정책 미참조.
- **큐레이션 API에 `customer_toast_rate` 필드 추가**: `GET /api/salons/[id]/curation`의 `brand_products` select에 `customer_toast_rate` 추가 — 큐레이션 제품 카드에서 토스트 적립률 표시용. 나머지 로직 무변경.
- **살롱 배너+큐레이션 공개조회 API 신설** (`GET /api/salons/[id]/curation`): 살롱 스토어 노출용 공개 조회 라우트. `brand_product_salon_banner`(활성 배너 `image_url_mobile/image_url_pc/link_url`, `is_active` + `salon_id`로 `maybeSingle`)와 `brand_product_salon_display`(원장 큐레이션 `is_featured` 제품, `display_order` asc)를 조회한 뒤, 큐레이션 순서대로 `brand_products`(active) 정보를 매핑해 `{ ok, banner, products }` 반환. 큐레이션 순서 보존을 위해 `productIds.map(...find)` 방식 사용(IN 조회 결과 순서 무시). `tryCreateAdminClient`로 RLS 우회(공개 노출 데이터), 인증 불필요. 트랙A 전용 테이블만 사용 — 격리 유지. 전제: `brand_product_salon_banner`·`brand_product_salon_display` 테이블 DB 선행 필요.
- **내 주문 허브에 브랜드제품(트랙A) 탭 추가**: `/my/orders`에 `'브랜드 제품'` 탭 신설. 전용 조회 API(`GET /api/brand-product-orders/my-orders` — `brand_product_orders` + `brand_product_order_items` 조인, `결제대기/취소` 제외, 최근 50건)와 전용 카드 컴포넌트(`BrandProductOrderCard`, 상태 뱃지/배송조회/구매확정 UI)로 구현. 오렌몰 `PaymentCompleteCard`·`orders` 로직과 **완전 분리**(별도 상태 `brandOrders/loadingBrand/confirmingId/brandLoaded`, 탭 최초 진입 1회만 fetch, 기존 filtered.map 블록은 조건 분기로 감싸기만 하고 내용 미변경). 구매확정은 `POST /api/brand-product-orders/[id]/confirm` 호출 후 해당 주문 status만 `'구매확정'`으로 낙관적 갱신.
- **원장 소매주문 관리 화면 신규 (`/dashboard/owner/brand-retail-orders`) + 목록 API (`GET /api/brand-product-orders/my-salon-orders`)**: 트랙A 원장이 자기 살롱의 소매주문(`brand_product_orders`)을 관리하는 대시보드 화면. (1) **목록 API**: 로그인 → `users`(auth_id) → `salons.owner_id`로 **자기 살롱 서버검증**(RLS 우회 admin client) → `결제대기/취소` 제외 상태의 주문 최근 50건 + 주문상품(`brand_product_order_items`) 조인 반환. (2) **관리 화면**: 발송대기/배송중/정산액(배송완료+구매확정 `owner_amount` 합) 요약 카드, 주문카드별 상태배지. `결제완료`→택배사 select+송장 input+발송처리(update-status API '배송중'), `배송중`→배송조회 링크(`getTrackingUrl` 메커니즘 재사용, my/orders와 동일 택배사 URL 패턴)+배송완료 처리, `배송완료/구매확정`→정산액 표시. (3) **사이드바**: `OwnerSidebarShell`에 '제품 주문' 메뉴 추가, 기존 '발주'와 함께 `ready && isTrackA` 조건으로 트랙A 원장에게만 노출. 빌드 통과·타입에러 없음. 전제: `brand_product_orders`에 `recipient_name/recipient_phone/owner_amount/order_no` 등 컬럼 존재 필요. 트랙A 전용 테이블만 사용 — 격리 유지. (주: 제공 코드의 배송조회 `<a>` 여는 태그 누락 오타 1건을 빌드 통과 위해 보정.)
- **트랙A 자동구매확정 크론 신설 (`GET /api/cron/auto-confirm-brand-product-orders`)**: `auto_confirm_at`이 현재시각보다 과거인 `배송완료` 상태의 `brand_product_orders`를 `구매확정`+`confirmed_at`(현재시각)으로 일괄 전환. 기존 자동취소 크론(`expire-brand-product-orders`)과 완전히 동일한 인증(`CRON_SECRET` Bearer/`?secret=`)·구조(`force-dynamic`) 패턴 복제. `vercel.json` crons에 매일 새벽 2시(`0 2 * * *`) 스케줄 추가 — 자동취소(새벽 1시)와 시간 미겹침. 처리 건수(`confirmed`) 반환. 빌드 통과·타입에러 없음. 전제: `brand_product_orders`에 `auto_confirm_at/confirmed_at` 컬럼 존재 필요.
- **트랙A 리뷰 작성 시 주문 자동 구매확정 전환 (`POST /api/brand-product-reviews/create`)**: 리뷰 insert 성공 직후, 해당 주문(`brand_product_orders`)의 `status='구매확정'` + `confirmed_at` 자동 기록. 리뷰 작성=구매확정 간주(네이버 스마트스토어 패턴 참고). 별도 구매확정 버튼 없이도 리뷰를 쓰면 확정되며, 기존 리뷰통계 집계(`increment_brand_product_review_stats`)·리뷰 토스트 적립 로직은 그대로 유지. 빌드 통과·타입에러 없음. 전제: `brand_product_orders.confirmed_at` 컬럼 존재 필요.
- **트랙A 고객 구매확정 API 신설 (`POST /api/brand-product-orders/[id]/confirm`)**: 고객이 배송완료된 소매주문을 직접 구매확정하는 서버 라우트 신규. (1) **인증·권한**: `createClient().auth.getUser` → `users`(auth_id) → 대상 주문 조회 → `order.customer_id === me.id` **본인 주문 검증**(아니면 404 order_not_found). (2) **상태 전이**: 이전 상태가 `배송완료`일 때만 허용(아니면 400 invalid_status_transition), `status='구매확정'`+`confirmed_at` 기록. (3) update 실패 시 `{ ok: false, error: 'update_failed' }` (500) 응답. 빌드 통과·타입에러 없음, 라우트 정상 생성. 전제: `brand_product_orders`에 `confirmed_at` 컬럼 존재해야 함. 트랙A 전용 테이블만 사용 — 격리 유지.
- **트랙A 원장 주문 상태변경 API update 에러처리 보강 (`POST /api/brand-product-orders/[id]/update-status`)**: 배송중/배송완료 두 `brand_product_orders` update 호출의 반환 `error`를 체크하도록 수정. 실패 시 무조건 `{ ok: true }`를 반환하던 문제를 고쳐, update 실패(컬럼 누락·RLS 등) 시 `{ ok: false, error: 'update_failed' }` (500) 응답. 빌드 통과·타입에러 없음.
- **트랙A 원장 주문 상태변경 API 신설 (`POST /api/brand-product-orders/[id]/update-status`)**: 원장이 자기 살롱의 소매주문(`brand_product_orders`) 상태를 변경하는 서버 라우트 신규. (1) **인증·권한**: `createClient().auth.getUser` → `users`(auth_id) → 대상 주문 조회 → `salons.owner_id === me.id` **자기 살롱 소유 검증**(아니면 403 forbidden) + `users.origin_track === 'A'` **트랙A 검증**(아니면 403 not_track_a). (2) **배송중 처리**: `target_status='배송중'`일 때 `courier`+`tracking_no` 필수(없으면 400 tracking_info_required), 이전 상태가 `결제완료`일 때만 허용(아니면 400 invalid_status_transition), `status='배송중'`+송장+`shipped_at` 기록. (3) **배송완료 처리**: 이전 상태 `배송중`에서만 허용, `status='배송완료'`+`delivered_at`+`auto_confirm_at`(배송완료+14일, `TRACK_A_AUTO_CONFIRM_DAYS=14` 하드코딩) 기록. 오렌몰 자동확정(admin_settings order.auto_confirm_days)과 별개의 A 전용 상수 사용. 빌드 통과·타입에러 없음, 라우트 정상 생성. 전제: `brand_product_orders`에 `courier/tracking_no/shipped_at/delivered_at/auto_confirm_at` 컬럼 존재해야 함. 화면(원장 관리 UI) 연결은 아직 없음. 트랙A 전용 테이블만 사용 — 격리 유지.
- **제품 상세페이지에 리뷰 작성 진입점 + 리뷰 이미지/영상 표시 연결**: (1) `page.tsx` 전체 교체 — 서버 컴포넌트에서 리뷰 작성 **자격 계산** 추가: 로그인(`createClient().auth.getUser`) → `users` 매핑 → `brand_product_orders`(status in 결제완료/배송완료) → `brand_product_order_items`(해당 brand_product) → `brand_product_reviews`(미작성 order 필터)로 `eligibleOrderId` 산출. `createClient`(server) import 추가(규칙3 한정 예외). (2) 신규 `ReviewSection.tsx`(client) — `eligibleOrderId`가 있을 때만 "리뷰 작성하기" 버튼 노출, 클릭 시 `ReviewWriteForm` 토글, 작성완료 시 숨김(`done`). 서버→클라 경계 문제(함수 prop 전달 불가)를 이 래퍼로 해소. (3) 리뷰 목록 select에 `video_url` 추가, 리뷰 카드에 이미지 썸네일(64px)·영상(`<video controls>`) 렌더 추가. (4) 컨테이너 `maxWidth: 480` 중앙정렬 추가. 빌드 통과·타입에러 없음, 라우트 1.17kB→2.84kB. 전제: `brand_product_reviews.video_url`/`status` 컬럼 및 관련 테이블이 DB에 존재해야 함. 트랙A 전용 테이블/API만 사용 — 격리 유지.
- **트랙A 리뷰 작성 폼 신규 (`ReviewWriteForm.tsx`)**: `src/app/salons/[id]/products/[productId]/ReviewWriteForm.tsx` 신규 클라이언트 컴포넌트 생성(규칙2 한정 예외). 구성: 별점(1~5), 텍스트(10자 이상 검증), 사진 최대 3장, 영상 1개. 미디어는 오렌몰과 동일한 **`product-images` 버킷 브라우저 직접 업로드 메커니즘**(`@/lib/supabase/client`의 `storage.upload`+`getPublicUrl`) 재사용하되, 경로는 트랙A 전용으로 분리(`reviews/brand/{brandProductId}/...`, 영상은 `reviews/brand/videos/{brandProductId}/...`). 제출은 트랙A 전용 API(`POST /api/brand-product-reviews/create`)만 호출 — `order_id/brand_product_id/rating/content/images/video_url` 전송. 업로드/등록 단계별 상태(`uploading`/`submitting`) 및 에러 표시, `review_already_exists`는 "이미 리뷰를 작성했어요"로 매핑. 성공 시 `router.refresh()` + `onDone()` 콜백. Props: `orderId/brandProductId/onDone`. **아직 어느 화면에도 연결되지 않은 독립 컴포넌트**(진입점 미연결). 빌드 통과·타입에러 없음. 트랙B(reviews/오렌몰) 미접촉, 격리 유지.
- **트랙A 리뷰 작성 API에 `video_url` 필드 추가**: `POST /api/brand-product-reviews/create`에서 요청 body 구조분해에 `video_url` 추가하고, `brand_product_reviews` insert에 `video_url: video_url || null` 추가. `brand_product_reviews.video_url` 컬럼과 연동(영상 리뷰 저장용). 기존 `rating/content/images` 처리·토스트 적립·리뷰통계 RPC 등 나머지 로직은 불변. 빌드 통과·타입에러 없음. 전제: `brand_product_reviews.video_url` 컬럼이 실제 DB에 존재해야 insert 성공(미존재 시 insert 실패→409 review_already_exists로 반환됨). 트랙A 전용 테이블만 사용 — 트랙B(reviews) 미접촉, 격리 유지.
- **제품 상세페이지 다크테마 스타일 적용 + 이미지 갤러리/설명 렌더링 + 평균별점 집계 통일**: `/salons/[id]/products/[productId]` 두 파일 전체 교체. (1) 스타일: 무스타일 기본 마크업을 다크테마 색상토큰(`BG #0D0B09`, `CARD`, `BORDER`, `GOLD`, `PURPLE`, `PURPLE_LIGHT`, `TEXT_SUB`)으로 통일 — 상단 뒤로가기+살롱명 헤더, 메인 이미지(aspect 1:1), 가격/토스트 적립 배지, 리뷰 요약, 액션버튼(장바구니/바로구매) 영역, 리뷰 리스트 구성. (2) 이미지 갤러리: `product.images` 우선, 없으면 `thumb_img` 폴백으로 `galleryImages` 구성, 2장 이상이면 썸네일 스트립 렌더. (3) 설명 렌더: `description`(텍스트)·`detail_content`(HTML, `dangerouslySetInnerHTML`) 조건부 렌더 — 기존엔 select만 하고 화면 미사용이던 필드 실제 표시. (4) 평균별점: `select`에 `review_count, rating_sum` 추가, `avgRating`을 화면표시 20개 리뷰 평균이 아니라 목록페이지와 동일한 누적집계(`rating_sum / review_count`) 기준으로 통일. `ProductDetailActions.tsx`는 버튼에 다크테마 인라인 스타일만 추가(로직/props 불변). 빌드 통과·타입에러 없음. 전제: `brand_products.review_count`/`rating_sum` 컬럼이 실제 DB에 존재해야 함(마이그레이션 반영 필요).
- **미사용 `useMemo` import 정리**: `/salons/[id]/products` 필터 UI 제거로 `catTree` useMemo가 사라지며 미사용이 된 `react`의 `useMemo`를 import 문에서 제거(`useState, useEffect, useCallback, useRef`는 유지). 규칙3(import 변경 금지)의 예외로 이 정리만 수행. 빌드 통과·타입에러 없음, 동작 변화 없음.
- **살롱 제품목록 필터 UI(브랜드/단계별/고민별) 제거 — API/URL 배관 보존**: `/salons/[id]/products`에서 필터를 화면에서 고르는 UI만 삭제 — 3개 진입버튼(브랜드/단계별/고민별) 렌더 블록, 3개 필터 패널(`openFilter === 'brand'/'step'/'concern'`), `openFilter`·`catPicked` 상태, `catTree` useMemo, leaf→경로복원 useEffect, `toggleConcern`·`chipStyle` 헬퍼, `CONCERN_OPTIONS` 상수, `CategoryNode` 타입 제거(`categoriesFlat` 상태 타입은 `any[]`로 대체, `setCategoriesFlat`는 `fetchProducts`에서 계속 호출되어 상태 유지). **보존(배관)**: `brandId`/`leafCategoryId`/`concerns` 상태 및 세터, `fetchProducts`의 쿼리파라미터 전송(`brand_id`/`category_id`/`concerns`), `syncUrl` URL 반영, 재조회 트리거 useEffect(`[brandId, leafCategoryId, concerns, sort]`) — URL에 `?brand_id=`/`?category_id=`/`?concerns=`로 진입하면 여전히 필터링(딥링크 유지). 화면은 검색+정렬만으로 운영. 활성 제품이 적은 현재 규모엔 3단 필터가 불필요한 복잡도라는 판단이며, 실제 카테고리 데이터가 쌓이면 재설계 예정. 빌드 결과 이 라우트 3.25kB→2.52kB로 감소, 타입에러 없음. 부수: `react`의 `useMemo` import가 미사용이 됨(임의 삭제하지 않고 보존, 별도 정리 대상).
- **카테고리 자손 탐색 BFS 순환참조 방어 (visited Set)**: `GET /api/salons/[id]/brand-products`의 하위카테고리 포함 필터 BFS에 `visited = new Set<string>([categoryId])` 추가. 자식 필터 조건에 `&& !visited.has(c.id)`로 이미 방문한 노드 재수집 차단, 수집한 `childIds`는 `visited.add`로 마킹. `categories` 테이블의 `parent_id` 순환(자기참조·상호참조 등 DDL 드리프트/데이터 무결성 훼손 시)으로 `while` 무한루프에 빠지던 리스크를 방어 — 정상 트리 동작·결과는 기존과 동일, 방어 로직만 추가. 새 함수 없이 인라인 유지.
- **카테고리 필터 동적깊이 + 하위카테고리 포함 검색**: (1) 목록페이지(`/salons/[id]/products`) 단계별 카테고리 필터의 하드코딩 `[0, 1, 2]`(최대 3단)를 `Array.from({ length: catPicked.length + 1 }, (_, i) => i)`로 교체 — 선택 단계 수 +1만큼 동적 렌더, 트리 실제 깊이만큼 무제한 하위 단계 노출(자식 없으면 `options.length === 0`으로 자동 미표시). `catTree` useMemo·leaf→경로 복원 로직은 이미 깊이 무관이라 그대로 사용. (2) API(`GET /api/salons/[id]/brand-products`) 카테고리 필터를 `.eq('category_id', categoryId)` 정확일치 → `.in('category_id', descendantIds)` 하위 포함으로 변경. `categoryRows` 조회 블록을 제품 쿼리 앞으로 위치 이동(내용 동일)해 필터 시점에 사용 가능하게 함. 자손 산출은 새 함수 없이 인라인 BFS(`frontier`/`descendantIds` while 순회, 이미 로드된 전체 categories 배열의 `parent_id` 체인 추적)로 처리 — 상위 카테고리 선택 시 그 하위 모든 카테고리 제품이 함께 노출. DB 추가작업(재귀 CTE/RPC) 없이 애플리케이션 레벨 순회로 구현.
- **살롱홈 "브랜드 제품" 탭 클릭 시 전체 목록페이지로 즉시 이동**: `/salons/[id]` 탭바 `onClick`을 `key === 'products' ? router.push(\`/salons/${id}/products\`) : setTab(key)`로 변경 — '브랜드 제품' 탭은 탭 내부 미리보기(`SalonBrandProductsPanel`)를 여는 대신 전체목록 라우트로 바로 이동, 나머지 탭은 기존 `setTab` 동작 유지. 기존 `useRouter`/`router`(L15 import·L181 선언) 재사용이라 import·시그니처 무변경. `showProductsTab`은 리뷰탭과 동일하게 항상 노출 유지(초기값 `true`). 이 변경으로 `tab === 'products'` 분기(미리보기 렌더)와 lazy fetch `useEffect`(`?limit=4`)·`SalonBrandProductsPanel`·"전체보기" 버튼은 더 이상 실행되지 않는 죽은코드로 남으나, 안전을 위해 삭제하지 않고 보존(제품 0개 살롱도 탭이 계속 노출되며 클릭 시 빈 목록페이지로 이동하는 동작 변화 있음).
- **살롱 제품목록 페이지 PC 반응형 레이아웃 (5열)**: `/salons/[id]/products`에 화면너비 감지 상태 `isPc` 추가(`useState(false)`), 별도 `useEffect`에서 `window.innerWidth >= 768` 기준으로 `resize` 리스너 등록/해제(의존성 배열 `[]`, supabase 무관). 최상위·`locked` 컨테이너 `maxWidth`를 `isPc ? 1100 : 480`으로, 제품 그리드 `gridTemplateColumns`를 `isPc ? 'repeat(5, 1fr)' : 'repeat(2, 1fr)'`로 분기 — PC(≥768px)는 1100px 폭·5열, 모바일은 기존 480px·2열 유지. 초기값 `isPc=false`(SSR/최초 렌더는 모바일 레이아웃)로 하이드레이션 안전. 값 분기만 추가, import/기존 로직 무변경.
- **살롱 브랜드제품 미리보기 개수 제한 + 목록페이지 반응형/너비 통일**: (1) 살롱 홈(`/salons/[id]`) '브랜드 제품' 탭의 미리보기 fetch URL에 `?limit=4` 추가 — 미리보기는 최대 4개만 노출하고 나머지는 "전체보기"로 유도(응답 파싱은 `products`만 읽어 `total`/`categories` 무시하므로 로직 무변경, 탭 노출 판단 `list.length === 0`도 그대로). (2) 전체목록 페이지(`/salons/[id]/products`) 최상위 컨테이너와 `locked` 반환 컨테이너에 `maxWidth: 480, margin: '0 auto'` 추가 — PC에서 살롱 홈(`maxWidth:480`)과 동일 폭·중앙정렬로 통일. (3) 제품 그리드 `gridTemplateColumns`를 고정 2열(`1fr 1fr`)→`repeat(auto-fill, minmax(150px, 1fr))` 반응형으로 변경(넓은 화면에서 열 수 자동 증가). 스타일 값만 변경, import/시그니처/상태 로직 무변경.
- **살롱 브랜드제품 미리보기 패널에 "전체보기" 버튼 추가** (`SalonBrandProductsPanel.tsx`): 살롱 홈(`/salons/[id]`) '브랜드 제품' 탭의 미리보기 목록 하단에 전체목록 라우트(`/salons/[id]/products`)로 이동하는 버튼 추가. `map` 렌더 직후·닫는 `<div>` 앞에 `<button onClick={() => router.push(\`/salons/${salonId}/products\`)}>` 삽입 — 기존 `useRouter`·`salonId` prop 재사용이라 import/시그니처 무변경. `products.length === 0` early return(L26~32) 하위라 제품이 1개 이상일 때만 노출. 스타일은 전체목록 페이지 '더보기' 버튼과 동일 톤(보더 `rgba(255,255,255,0.08)`, 텍스트 `#7B5EA7`).
- **살롱 스토어 제품 목록 페이지 신규 구현** (`/salons/[id]/products`): `GET /api/salons/[id]/brand-products` 확장 API를 소비하는 고객용 목록 화면 신규 생성(client component, 하드코딩 다크 팔레트 `BG=#0D0B09`). 상단 제품명 검색(300ms 디바운스, 2자 이상만 서버 질의), 3단 필터 토글 — 브랜드(응답 첫 페이지에서 유니크 추출)·단계별 카테고리(응답 `categories` 플랫→`parent_id` 트리화, level 0~2 순차 선택)·고민별(`CONCERN_OPTIONS` 다중선택, `concerns` 콤마전달), 정렬 5종(`popular`/`newest`/`review`/`price_asc`/`price_desc`), `LIMIT=20` 더보기 페이지네이션(`offset` 누적 append). `useRef` 요청 id(`requestRef`)로 레이스 방지, `router.replace`로 필터/검색 상태 URL 동기화(기본값 `popular`/빈값은 쿼리 생략), `navigator.share`→클립보드 폴백 공유 버튼, `locked` 응답 시 잠금 안내. `category_id` 딥링크 진입 시 `categoriesFlat`로 상위 경로 역추적해 `catPicked` 복원. 기존 살롱 홈(`/salons/[id]`) 탭 내 `SalonBrandProductsPanel`과 별개의 독립 전체목록 라우트 — 코드/타입 변경 없이 파일 1개 추가. `brand_products.category_id/skin_concern/sales_count/review_count/rating_sum`·`categories` 테이블은 DB 선행 필요(API 의존).
- **살롱 제품목록 API 정렬 개선 (리뷰통계 반영·인기순 기본값·리뷰많은순 추가)**: `GET /api/salons/[id]/brand-products` select에 `review_count, rating_sum` 추가. 정렬 분기에 `sort === 'review'` → `.order('review_count', desc)`(리뷰많은순) 추가. **기본 정렬을 이름순→인기순으로 변경** — 미지정/미매칭 시 `.order('sales_count', desc)`로 fallback(기존 `else` 이름순 제거). 참고: `sort` 파라미터 기본값이 `'name'`이지만 명시적 name 분기를 두지 않아 최종 else(인기순)로 귀결되므로, 파라미터 없이 호출 시 인기순 정렬. `brand_products.review_count`·`rating_sum` 컬럼은 DB 선행 필요.
- **트랙A 리뷰 작성 시 제품 리뷰통계 집계 RPC 호출 추가 (정렬용)**: `POST /api/brand-product-reviews/create`가 리뷰 insert 성공 직후(`if (error || !review)` 가드 통과 지점) `increment_brand_product_review_stats(pid, r)` RPC 호출 — `brand_product_id`로 해당 제품의 `review_count`/`rating_sum` 집계를 누적(평점순·리뷰많은순 정렬 재료). 기존 토스트 적립(`review_toast_rate`·`review_toast_paid`)·`increment_points` 흐름은 무변경. RPC `increment_brand_product_review_stats`와 대상 집계 컬럼(`review_count`/`rating_sum`)은 DB 선행 필요(미생성 시 RPC 실패, 리뷰 저장 자체는 진행됨). A 전용 `brand_product_reviews`만 소스로 사용 — 오렌몰 `reviews`/집계 미접촉.
- **살롱 브랜드제품 목록 API 확장 (검색·필터·정렬·페이지네이션 + 카테고리 트리)**: `GET /api/salons/[id]/brand-products`에 쿼리파라미터 지원 추가 — `q`(제품명 `ilike`, 2자 이상), `brand_id`(단일 브랜드), `category_id`(`brand_products.category_id` eq), `concerns`(콤마분리 → `skin_concern` `overlaps` OR 매칭), `sort`(`name`/`price_asc`/`price_desc`/`newest`(`created_at`)/`popular`(`sales_count`)), `offset`·`limit`(기본 20, 최대 50, `.range()`). select에 `category_id, skin_concern, sales_count` 추가 + `{ count: 'exact' }`로 전체건수 집계. 응답에 `total`(필터반영 총건수)·`categories`(`categories` 테이블 `id/name/parent_id/level/sort_order`, `sort_order` asc) 추가. showcase 게이팅(만료 시 early return)은 select보다 앞이라 순서 무변경. 응답 타입은 `total`/`categories` 확장 필드 때문에 `satisfies SalonBrandProductsResponse` 제거(빌드 통과 확인). `brand_products.category_id`·`skin_concern`·`sales_count` 컬럼 및 `categories` 테이블은 DB 선행 필요.
- **트랙A `brand_products.sales_count` 증감 로직 추가 (웹훅 유지관리)**: `handleBrandProductOrderComplete`가 주문 결제완료(`status='결제완료'`) 직후 `brand_product_order_items`(`order_id` 기준)를 조회해 항목별 `increment_brand_product_sales(pid, qty)` RPC 호출로 판매량 증분. `handleBrandProductOrderCancel`은 취소 대상 주문을 먼저 조회해 **직전 상태가 `결제완료`였던 주문만** `decrement_brand_product_sales(pid, qty)`로 감소(진짜 환불), `결제대기` 주문은 애초 미카운트라 미변경. 오렌몰 `products.sales_count`(스키마 기본값만 존재, 웹훅·구매확정 어디서도 자동 갱신 안 됨)와 달리 트랙A는 실제 결제/환불 웹훅에서 값을 유지관리함. RPC `increment_brand_product_sales`·`decrement_brand_product_sales`와 `brand_products.sales_count` 컬럼은 DB 선행 필요(미생성 시 RPC 실패). A 전용 주문 테이블(`brand_product_orders`/`brand_product_order_items`)만 소스로 사용 — B 커미션·집계 체계 미혼입.
- **체크아웃 화면금액-실결제금액 불일치 해소** (트랙A): 체크아웃이 클라이언트 `subtotal`(가격×수량)만 표시해 서버가 주소 기반으로 붙이는 배송비(기본 3,000·5만원 이상 무료·제주/울릉 할증)가 화면에 반영되지 않던 문제 수정. `/api/brand-product-orders/create`에 `dry_run` 분기 추가 — 검증·금액계산까지 수행 후 insert 직전 early return으로 `subtotal/shipping_fee/final_amount`만 반환(부수효과 없음, `dry_run` 시 `checkout_batch_id` 요구 제외). 체크아웃은 배송지 확정 시 `salon_id__brand_id` 그룹별로 `dry_run` 견적을 호출·합산해 정확한 결제예정액을 표시(배송비·무료임계치가 주문 단위라 그룹별 계산 필수). `useRef` 요청 id로 최신 견적만 반영(레이스 방지), 견적 미확정/실패 시 결제 버튼 비활성화해 화면금액=청구액 보장. 실제 청구액은 기존대로 실주문 생성 `final_amount` 합계 사용(동일 서버 로직이라 견적과 일치).
- **트랙A 결제대기 주문 자동취소 크론잡** (`/api/cron/expire-brand-product-orders`): 생성 후 3시간(`CUTOFF_HOURS`) 지난 `brand_product_orders.status='결제대기'` 건을 `'취소'`로 일괄 업데이트. `expire-coupons`와 동일한 `CRON_SECRET` Bearer/`?secret=` 인증·`force-dynamic` 패턴 재사용. 쿼리는 `brand_product_orders`만 대상(트랙B `orders` 미접촉, A/B 격리 유지)이며, `.eq('status','결제대기')` 필터가 멱등성 가드 역할. `vercel.json` crons에 `"0 1 * * *"`(매일 새벽 1시, Hobby 플랜 일 1회) 추가. 결제 미완/이탈/부분생성 실패로 남은 고아 주문을 정리 — 즉시 롤백 대신 배치잡 단일 경로로 커버.
- **트랙A 카트/체크아웃 페이지 구현** (`/salons/cart`, `/salons/checkout`): 카트는 `salon_id`별 그룹핑·개별/살롱단위 체크박스 선택, `sessionStorage(auran_brand_checkout_selection)`로 선택 전달. 체크아웃은 `shipping_addresses`(기본배송지 우선) 조회, 선택 상품을 `salon_id__brand_id`로 묶어 `/api/brand-product-orders/create`를 그룹별 호출(공통 `checkout_batch_id`), 합계로 PayApp `kind: brand_product_order`·`target_id=batch` 결제 생성 후 카트 비움. `BrandCartItem`/`ProductDetailActions`/상세 page에 `salon_name` 전달 추가(카트 살롱명 표시용).

## 2026-07-17

- **BrandCartProvider를 `/salons/[id]/layout.tsx`에서 `/salons/layout.tsx`로 이동**: 여러 살롱 넘나드는 카트 상태 유지 위함, `/salons/cart`·`/salons/checkout` 등 살롱 특정 안 된 라우트 지원 목적. `[id]/page`·`loading`·products 하위는 미변경.
- **원장홈+어드민에 트랙A 브랜드제품 정산액/수수료 표시 추가**: 원장 `OwnerHomeV3`에 `OwnerBrandProductRevenueRow`(`owner_amount` 이번달/전월), 어드민 매출현황에 `AdminBrandProductFeeCard`(`platform_fee` 이번달). 기존 `monthTotal`/`productShare` 계산에는 미포함 — 매출3종 혼동방지 원칙 준수.
- **트랙A 카트 다중살롱 지원을 위한 checkout_batch_id 도입**: 결제1회+내부 다중주문 처리, 금액합계 위변조 검증+관리자알림, 개별주문 try/catch로 부분실패 격리. `brand-product-orders/create`에 `checkout_batch_id` 필수·저장, 웹훅은 `target_id`=batch로 다건 조회·합계 검증 후 순회 결제완료/취소.
- **트랙A 살롱 브랜드제품 상세·리뷰·카트 연결**: 살롱 제품 카드 클릭 → `/salons/[id]/products/[productId]` 상세. `BrandCartContext`(`auran_brand_cart` localStorage, `brand_product_id` 키) + `salons/[id]/layout` Provider. 상세 하단 「장바구니/바로구매」는 각각 `/cart`·`/checkout`로 push(페이지는 후속). `POST /api/brand-product-reviews/create` — `brand_product_reviews` insert, 주문당 1회 `review_toast_rate` 토스트(`source_type: brand_product_review`). 몰 `CartContext`/`reviews`/`products` 미사용(A/B 격리).
- **트랙A 웹훅 핸들러 분리 리팩토링**: `payapp/webhook`의 `brand_product_order` 결제완료·취소 본문을 `src/lib/webhookHandlers/brandProductOrder.ts`(`handleBrandProductOrderComplete` / `handleBrandProductOrderCancel`)로 이동. `handleBrandTierPurchase`와 동일 시그니처·service client 전달 패턴. 로직 변경 없음(500줄 규칙 준수용 분리).
- **트랙A 브랜드제품 결제완료 웹훅 분기 추가** (`payapp/webhook`): `kind === 'brand_product_order'` — 결제완료 시 `brand_product_orders` 상태·`payment_id`·`ordered_at` 갱신, `customer_toast_amount`로 구매적립토스트 즉시지급(`source_type: brand_product_order`), 앱 알림. 취소 분기에서 상태 `취소` 롤백. select부터 service client(RLS 우회). `purchase_reward_rate`/스폰서 등 트랙B 정책과 완전분리.
- **새 API: 트랙A 실물 제품 장바구니 주문 생성** (`POST /api/brand-product-orders/create`): `origin_track='A'` 살롱 검증, `brand_owner_links(active)` 연결 확인, `brand_products` 서버 가격·`customer_toast_rate` 재계산, 배송비 트랙A 전용 하드코딩(5만원 이상 무료·제주/울릉 할증), `platform_fee` 8.8%·`owner_amount`·리뷰토스트율 5%·구매적립토스트 합계를 `brand_product_orders`/`brand_product_order_items`에 저장. service role은 `tryCreateAdminClient`.

## 2026-07-16

- **샘플·반품 pending 안내 문구**: active 연결 없고 pending만 있을 때 `getOwnerPendingOnlyBrandNames`로 브랜드명 조회 후 「{브랜드} 브랜드와 연결 승인 대기 중이에요. 조금만 기달려주세요」 표시. 반품 신청 버튼은 pending 시 숨김.
- **원장 콘텐츠 권한 세분화 (`includePending`)**: `getOwnerLinkedBrandIds`에 `{ includePending }` 옵션. 라이브·커뮤니티는 pending 포함(보기만), 샘플·반품·홈/client 피드는 active만. 셀프등급·brand-orders 미변경.
- **원장 측 거래 브랜드도 `brand_owner_links(active)` 통일**: 공통 헬퍼 `getOwnerLinkedBrandIds`(auth → users.id → links). `owner/page`·`client`·`client-v2`·`brand-live`·`brand-community`·`brand-samples`·`brand-returns`에서 `trade_brands`/`preferred_brands` 제거. 셀프등급 블록은 `owner_id=users.id` 명시(`ownerUserId`) + trade_brands fallback 삭제. `brand-orders`는 기존 links 사용으로 미변경.
- **원장 연결 기준 `trade_brands` → `brand_owner_links(active)` (브랜드 측)**: `BrandTabOwners` 원장님현황 — `.not(trade_brands)`·브랜드명 문자열 매칭 제거, `links.owner_id(=users.id)` → `users.auth_id` → `profiles` 경로(bulk-import와 동일). `BrandTabData` 「연결 원장님 수」는 `BrandTabHome`과 같이 links count. 정산탭 표시명에 `profiles.owner_store_name` fallback 추가(`salon_name` → `owner_store_name` → `owner_name` → `full_name`).
- **CEO 정산탭 표시명 매장명 우선**: `BrandTabSettlement` 제목 `salon_name` → `owner_name` → `profiles.full_name` → `원장님`. 제목이 매장명일 때 부제는 `owner_name`(담당자)로 바꿔 중복 제거.
- **CEO 정산 탭 신규 (`BrandTabSettlement`)**: 브랜드 허브 `settlement` 플레이스홀더 → 실제 화면. `brand_billing_invoices` 기준 월 선택·상단 합계·전월 대비 증감률·미결제/완료 토글·원장별 청구 리스트. 펼침 상세는 `brand_orders` — 연결키 `brand_id` + `profile_id`(= `owner_id`) + `created_at` 월범위(`monthBillingRange`). 원장명 `brand_orders.owner_name` → `profiles.full_name` → `원장님`. `expandOrderItemsToLines` 재사용. CEO 전용(`isCEO`), `currentBrandId` 전달.
- **브랜드 대시보드 currentBrandId 통합**: `brandId`/`activeBrandId` 이원 state → `currentBrandId` 단일화. `mergeMyBrands`로 소유(`brands.user_id`) + 멤버(`brand_members`) 목록 합집합(중복 제거). `switchBrand` 공용 핸들러 — page 상단 드롭다운 + `BrandHubContent` 사이드바 버튼 그룹 전환 UI. 허브 전 탭·폼·Pin 게이트에 동일 ID 전달. `selectedBrandId`/`BrandTabHome.activeBrandId` 제거. 제품관리 탭 자동 필터·Welcome `brandRow` 동기화는 미포함.
- **시바산(Track A) 셀프 등급구매 전면 정비**: (1) Track B `brand-tier/create`에 `origin_track === 'B'` 게이트 추가. (2) Track A `civasan/create`·`webhook`에 `computeTierUpgradeCharge` 차액결제 — intent/PayApp 금액은 차액, `brand_owner_grades.purchase_amount`는 목표 등급 정가. (3) 원장 UI `OwnerBrandSelfTierSection`에 「차액 N원」 표시. (4) 브랜드 허브 「등급 패키지 관리」탭 + `POST /api/brand/tier-packages/save`(assertBrandAccess, service role) — `tier_name`·`price`만, `commission_rate` 미노출. Track B 차액·커미션 ledger·`BrandTabOwners` 수동등급은 미변경. RLS 마이그레이션 없음.

## 2026-07-15

- **브랜드 허브 조회 오류·미존재 분리**: `/brand/[slug]`의 `brands` 조회에서 Supabase 오류를 별도 `loadError` 상태로 처리하고 콘솔에 slug·오류 정보를 기록. 실제 조회 결과가 없을 때만 기존 미존재 화면을 표시하며, 일시적 오류 화면에는 상태를 초기화하고 쿼리를 다시 실행하는 재시도 버튼 추가.
- **브랜드 상품 소비자가 저장·살롱 노출 연결 (097, 미실행)**: `brand_products.consumer_price INTEGER NOT NULL DEFAULT 0 CHECK (consumer_price >= 0)` migration 추가. `BrandProductFormV2`에서 소비자가를 입력·수정·미리보기하고 save API가 pending은 0 허용, active는 양수만 저장하도록 검증. 살롱 전용 brand-products API가 실제 소비자가를 반환해 `SalonBrandProductCard`의 기존 가격 UI에 연결. 일반몰 쿠폰 가격(`products.retail_price/sale_price`)과 원장 발주 공급가(`brand_products.supply_price`) 흐름은 미변경.
- **BrandProductFormV2 500줄 규칙 대응**: 기본정보·가격, 미디어·상세설명, 성분·태그·판매설정을 각각 `BrandProductPriceSection`, `BrandProductMediaSection`, `BrandProductMetadataSection`으로 분리하고 로컬 스타일·섹션 전용 업로드/분석 핸들러를 이동. 부모 파일은 PowerShell `Measure-Object -Line` 기준 493줄.

## 2026-07-14

- **레이어1+2 통합 90일 무료체험 앱 적용**: `storeTrial.ts` — `resolveTrialStart`(`store_trial_started_at` ?? `created_at`)·`getOwnerLayerPeriod`. 훅·사이드바는 store 레이어 D-day. brand-products는 트랙A 하드코딩 잠금 제거 → 쇼케이스 trial/active만 unlock (`lock_reason: showcase_subscription`). **095·096 SQL 미실행 시 컬럼 없으면 select 실패 가능**
- **레이어1+2 통합 90일 무료체험 DB 준비 (095·096, 미실행)**: `users.store_trial_started_at` TIMESTAMPTZ NULL — NULL이면 앱에서 `created_at` fallback. `track_a_showcase_annual` `trial_days` 0→90 (나머지 3플랜 이미 90). **앱 판정 로직·스킨파우더룸 재부여 UPDATE는 다음 단계**
- **미사용 독립몰(`/dashboard/owner/store`) 제거**: 원장 직접판매 독립몰 페이지·쿠폰상품타겟 필드 삭제. `SalonInfoForm`(살롱명·메뉴·자격증)은 `store-decoration` 「살롱 정보」탭으로 이전. 사이드바「스토어」·독립몰 CTA·admin「스토어 관리」제거, 하단탭은「꾸미기」로 교체. **매출 리포트** 메뉴는 전용 페이지 없음 → 임시로 `/dashboard/owner` 홈 KPI로 연결(`TODO` 주석). `owner_coupons`/`owner_settlements`·채팅·수수료·DB 테이블은 미변경
- **원장 스토어 이용기간 D-day 통합**: `getOwnerStorePeriod` + `useOwnerStorePeriod` — trial(90일/`created_at`)·active(`expires_at` 또는 `started_at+365`)·expired. PC 사이드바 「구독 관리」옆 배지, 구독 페이지 `SubscriptionPeriodBanner`(문장형). 500줄 룰 — `SubscriptionPayModal`·`SubscriptionPlanCards` 분리, `subscription/page.tsx` 슬림화
- **구독 페이지 UI 정리 + track 결제 시 owner_mode 보존**: 운영모드 탭 제거, 레거시 mode 필터는 `profiles.owner_mode` 기준. 미구독 시 `users.created_at`+`isInStoreTrialPeriod`로 `90일 무료체험 중 (D-N)` 표시(종료 시 숨김). PayApp webhook — `track_a_`/`track_b_` slug면 `owner_mode` UPDATE 스킵, `owner_subscription_plan`만 갱신
- **구독 페이지 트랙별 플랜 필터 + 연납 표시**: `subscription/page.tsx` — `users.origin_track` 조회 후 `track_a_*`/`track_b_*` slug만 해당 트랙 원장에게 노출(기존 AURAN BASIC 등은 mode 필터만). `billing_period === 'annual'`이면 가격 표기 `/년`, 아니면 `/월`

## 2026-07-13

- **원장 적립금(T) CSV 대량 업로드**: `parseCsv.ts` 공통 유틸, `POST /api/brand/owner-points/bulk-import`(brand 인증 + `tryCreateAdminClient` service role), `BrandTabOwners` 업로드 패널 — 매장명 정규화 매칭(company·active link·트랙A), 성공/실패/충돌 미리보기, `manual_init` ledger + balance 갱신(idempotency_key)
- **094 마이그레이션 실제 컬럼(price) 정합 + 결제 연동**: `subscription_plans` INSERT를 `price`·`plan`(=slug)·`mode`(NULL) 기준으로 수정. `admin_settings` `category=subscription`에 `price_track_*_annual` 4키 시드. `subscription/page.tsx` `priceFor()` — admin_settings 우선, 없으면 DB `price` fallback. `admin/subscriptions` 플랜 목록 `p.price` 표시. **094 SQL 미실행**
- **원장 스토어 이용료 2단 레이어 구독플랜(094)**: `subscription_plans`에 `billing_period`·`layer`(store/showcase)·`trial_days` + 연간 플랜 4종 — `track_a/b_store_annual`(스토어유지비), `track_a/b_showcase_annual`(제품노출+SNS+라이브). PayApp webhook 연간 slug는 `expires_at` +1년. `storeTrial.ts` 90일 체험 판정 유틸. **094 SQL 미실행**
- **원장 스토어 브랜드 제품 탭 트랙A 잠금**: `GET /api/salons/[id]/brand-products`가 `users.origin_track` 조회 — 트랙A면 `locked: true`·`lock_reason: track_a_subscription`·`products: []` 즉시 반환(1단계 하드코딩). 트랙B는 기존 link→`brand_products` 체인 + `locked: false`. 살롱 페이지 `SalonBrandProductsLocked` 패널(CTA 없음), `locked` 시 탭 유지·잠금 UI
- **원장 스토어 브랜드 제품 진열**: `/salons/[id]`에 「브랜드 제품」탭 추가 — `GET /api/salons/[id]/brand-products`(service role)가 `salons.owner_id` → `brand_owner_links`(active) → `brand_products`(active)만 조회. 살롱 전용 `SalonBrandProductCard`·`SalonBrandProductsPanel`, `supply_price` 미노출. 오렌몰 `products` 테이블·홈·검색과 완전 분리
- **적립금 CSV UI 위치 전환**: `BrandTabOwners` — `manual_init` ledger 1건 이상이면 상단 CSV 카드 숨김, 탭 하단 「초기 적립금 CSV 재업로드」 링크로 접기(클릭 시 펼침)
- **발주화면 브랜드명·그리드 UX**: `brand-orders/page.tsx` 필터 pill 표시명 간소화(`시바산그룹`→`시바산`, DB 미변경), 제품 수 보라색 강조(`전체 N` 형식). 제품 그리드 반응형 — PC(≥768px) 5열, 모바일 3열, 좁은 화면(<400px) 2열
- **원장 발주화면 브랜드 필터·검색**: `brand-orders/page.tsx`에 `brand_owner_links` 기준 브랜드 pill(전체 + 연결 브랜드별, 제품 수 표시)과 제품명 검색바 추가 — 클라이언트 필터(브랜드 AND 검색어 부분일치), 등급 pill은 선택 브랜드 등급 반영
- **세컨브랜드 자동연결 + 브랜드 대시보드 UX**: `connectTrackAOwnersToSecondBrand`가 `trade_brands`만 갱신하던 문제 수정 — 트랙A eligible 원장에 `brand_owner_links`(세컨 `brand_id`, `users.id`, active) upsert 추가(ON CONFLICT 무시). 기존 씨아클라르제 백필 SQL `scripts/backfill_civaclare_second_brand_links.sql`(수동 1회). 브랜드 주문탭(`BrandHubContent`)을 상단 선택 브랜드(`activeBrandId`) 기준 조회로 연동. 제품 탭 기본 상태 `pending` → `active`
- **발주화면 등급·적립 계산 수정**: `brand-orders/page.tsx` 등급 소스를 `profiles.grade`(고객 멤버십) → `brand_owner_grades`(브랜드별 원장 등급, `owner_id=profiles.id`)로 전환. `gradeByBrandId`·`linkedBrandIds` state, 브랜드별 `supply_promos.condition` 필터. `brandOrderPromos.calcPointsEarned` 추가 — 적립 T = `floor(발주합계 × 등급적립율% / 100)` (기존 수량×% 버그 수정). 발주 확인 팝업에 적립 예정 T 표시
- **원장 적립금(T) CSV 매장명 자동매칭**: bulk-import API가 `profiles.owner_store_name` 정규화 키로 트랙A·active link 원장 매칭. 성공/실패/충돌(동명 매장) 3분류 + dry-run 미리보기 테이블(`BrandTabOwners`)
- **원장 적립금(T) CSV 대량업로드**: `parseCsv.ts` 공통 파서, `POST /api/brand/owner-points/bulk-import`(brand/admin 인증, service role로 ledger+balance 갱신). **093 마이그레이션·company_id 백필 선행 필요**
- **원장 적립금(T) 스키마 093**: `brand_companies`(회사 단위) + `brands.company_id` FK, `brand_owner_point_ledger`(append-only 이력: manual_init/order_earned/used/carried_forward/adjustment), `brand_owner_point_balance`(company_id+owner_id 잔액 요약). RLS 092 패턴 — owner/brand SELECT only, INSERT/UPDATE는 service role API 전용. 백필 스크립트 `scripts/backfill_093_civasan_company.sql`(시바산+씨아클라르제). **마이그레이션 파일만, 미실행**. 세컨브랜드 `company_id` 연동은 후속
- **발주 수량 5단위 + 보너스 표시 + 썸네일 정사각형**: 원장 발주 담기·증감을 5개 단위(`QTY_STEP`)로 통일(카드·확인 팝업, 최소 0 유지). 원장 주문 탭·브랜드 수주 목록(`BrandTabOrders`)에 items 저장 `bonus > 0`이면 `(+N 증정)` 표시(Invoice와 동일 정보). `BrandOrderProductCard` 썸네일 `aspect-ratio: 1/1` 정사각형 고정
- **brand-orders `store_name` 400 버그 (심각)**: 원장 발주 화면 `users` select에 존재하지 않는 `store_name` 컬럼 요청 → PostgREST 400 → `userRow` null → `origin_track` 미조회·기본값 `'B'` → **트랙A 원장 전원** 발주 진입 차단. `salon_name`으로 교체, 상호명 fallback은 `profiles.owner_store_name` → `users.salon_name`
- **브랜드-원장 연결 판단 1단계 (092)**: `trade_brands`/`preferred_brands` 문자열 매칭 → `brand_owner_links`(ID 기반) 전환. 원장 발주(`brand-orders/page.tsx`)는 active link의 `brand_id`로 제품·프로모 조회, 홈 KPI(`BrandTabHome`) 「활성 원장님」은 link COUNT. `resolveOwnerIds.ts` 추가(auth_id → users.id + profiles.id). `092_brand_owner_links_rls.sql` — owner SELECT / brand·member SELECT·UPDATE / admin ALL (마이그레이션 파일만, 미실행). 백필 전 link 없는 레거시 원장은 발주·카운트 0 가능

## 2026-07-12

- **제품명 검색바 + brand_products RLS 역할별 분리 (091)**: `BrandTabProducts`에 제품명 부분검색(대소문자 무시, 브랜드·상태 필터 AND). `brand_products_select_active` 삭제 후 `select_active_brand`(brand·본인 active만) / `select_active_owner`(owner·트랙A·active 전체) 2정책 분리. admin은 기존 `admin_all` 유지. 마이그레이션 파일만 추가(미실행)
- **브랜드 제품목록 통합조회 + 필터 pill**: `brand_products`를 소유·멤버 브랜드 ID IN 한 번에 조회. 제품 탭에 전체/브랜드별 필터(판매중 누적 표시), 상태 탭 count는 필터 적용 후 계산. 상단 드롭다운은 등록 기본 브랜드만, 저장 후 전체 재조회
- **제품등록 폼 브랜드 선택**: `BrandProductFormV2`에 `myBrands` select 추가(신규 등록만). 저장 시 선택 `brand_id` 반영, `onSaved(savedBrandId)`로 목록 재조회 + `activeBrandId`/`brandName` 컨텍스트 자동 동기화
- **브랜드 제품등록 폼 팝업화**: `BrandProductFormV2`를 고정 오버레이(`position:fixed`, dim)로 감싸 뒷배경 가림, 폼 `maxHeight:90vh` 스크롤. `onClose`/`onSaved` 콜백 분리. 제품 탭 「+ 새 제품 등록」 옆 **현재 브랜드** 라벨 강조
- **트랙B 원장 브랜드 발주 진입점 숨김**: `useIsTrackA` 훅(`users.origin_track`)으로 PC 사이드바 「발주」, 원장 홈 v1 거래 브랜드 제품 섹션, v2 빠른메뉴·더보기·브랜드사 설정 배너를 트랙A만 조건부 렌더. URL 직접 접근 방어는 `brand-orders/page.tsx` 기존 게이트 유지
- **brands.name_en (090)**: `brands.name_en TEXT` nullable 컬럼 추가(마이그레이션 파일). 세컨브랜드 추가 모달 영문명 저장용
- **세컨브랜드 추가 모달 UX**: placeholder를 시바산/CIVASAN/대한민국 예시로 변경 (`dashboard/brand/page.tsx`)
- **브랜드 재고발주 제품 물리 분리 (088) + 세컨브랜드·RLS (089)**: 오렌 쇼핑몰 `products`와 브랜드 발주 전용 `brand_products` 테이블·RLS 분리(088, 마이그레이션 파일). `brandOrigin.ts`/`brandProductTypes.ts`, `POST /api/brand/brand-products/save`(원산지·`brand_id` 서버 검증), `BrandProductFormV2` API 저장·공급가, 원장 발주·브랜드 대시보드·`BrandTabHome` 조회를 `brand_products`로 전환. CIVASAN mall `products` 정리 스크립트(`scripts/delete_civasan_products_from_products.sql`)는 수동 실행 전용
- **세컨브랜드 자동노출 + 보안 (089)**: `brand_products_select_active` RLS를 `users.role IN ('owner','brand','admin')`만 허용(고객 SELECT 차단). 원장 발주(`/dashboard/owner/brand-orders`) `users.origin_track === 'A'` 게이트. 브랜드 대시보드 세컨브랜드 즉시 생성(`status: active`, `users.id` 기준), `POST /api/brand/second-brand/connect-owners`로 허브 브랜드 `brand_owner_links` active + 트랙A 원장 `profiles.trade_brands` 자동 append. `brand-products/save`는 body `brand_id` + `brand_members` 소속 검증
- 브랜드 재고발주 2단계 (087): `brand_billing_invoices` 파우치 컬럼(`pouch_tier`/`pouch_sent_qty`/`pouch_sent_note`), `brandBilling.ts`(월 합계→파우치 tier·청구서 라인), 원장 발주 프로모 버튼 선택(`BrandOrderProductCard`, `buildOrderLineItem` 4번째 인자), 월청구서 화면(`/dashboard/owner/brand-orders/invoice`), 청구서 sync API(`POST /api/owner/brand-billing-invoice/sync`), 시바산 월청구서 셀프결제(`kind:invoice`, `civasan/invoice/create`, webhook invoice 분기)
- 브랜드 재고발주 1단계 (085): `brand_orders.total_amount`, `supply_promos` 시바산 시드·DB 프로모 조회, `products.supply_price` 단가·발주 불가 가드, `brand_billing_invoices`·`brand_payment_intents.kind`(tier/invoice)
- 트랙A 셀프결제 데모모드 UX: `OwnerBrandSelfTierSection` 가짜 결제창 모달(등급·금액·카드번호 장식, 체험 완료 화면), 시바산 전용 섹션 제목·부제
- 트랙A 브랜드 자체 등급 셀프결제 (084): `brand_payment_intents` 테이블, 시바산 전용 `brand-self/civasan` API·웹훅, `OwnerBrandSelfTierSection`, 데모모드(`payapp_active=false`)
- `users.origin_track` (083): 트랙A/B 가입경로 고정 — 브랜드 직거래(A) 원장 뱃지구매·원장 초대 차단, immutable DB 트리거
- OwnerBadgeTierSection: 보유 등급 커미션율(`ownedCommissionRate`) 데이터 전달 및 추천 커미션 안내 배너 동적 문구 추가

## 2026-07-11

- 브랜드 등급 시스템 탄력화: 081(자유 tier_name/grade CHECK 제거), 082(brand_owner_grades.tier_package_id FK), price 기반 업그레이드 판단, 스폰서 커미션율 tier_package_id 직조회
- OwnerBadgeTierSection UI: 업그레이드 가능 패키지만 표시, 커미션율·안내 배너(A안), 최고 등급 🏆 문구
- 브랜드 전문점 등급(뱃지) PayApp 구매 플로우 구현: `brand_tier_purchase` kind, `/api/payments/brand-tier/create`, webhook 핸들러 `src/lib/webhookHandlers/brandTierPurchase.ts` 분리, 원장 홈 `OwnerBadgeTierSection` UI
- BrandPinGate: 스태프 PIN 키패드 고정배열 → 랜덤 셔플 적용 (담당자 선택 시 재섞기, PinModal 패턴 참고)

## 2026-07-10

- 브랜드 대시보드에 원장 초대링크 생성/자동승인 토글/brand_owner_links 연결목록·승인 기능 추가
- admin/brands 목록에서 카드 펼치지 않아도 승인/거절 버튼 바로 노출
- admin/approvals에서 owner 승인 버튼 제거 및 owners 탭 안내로 교체 (salons 미동기화 이중경로 문제 근본 차단)
- owner-signup-v2: profiles.active_role 누락으로 가입 후 고객홈 오라우팅 버그 수정
- 원장 가입 v2 신설 (`/signup/owner-v2`, `POST /api/auth/owner-signup-v2`) — salons row 미생성 버그 근본 해결, service role로 users→profiles→salons 일괄 처리
- brand_owner_links 테이블 및 brands.auto_approve_owner_invite 컬럼 추가 (마이그레이션 076, 077)
- join/마이페이지 원장 초대링크 v2로 전환 (login→consent→signup 레거시 경로는 유지)
- 원장 승인 API 통합 (`POST /api/admin/owners/approve`) — salons.status 미동기화 버그 수정, `/admin/owners`가 service role API 경유로 users+salons 일괄 처리
- brands RLS 활성화 (마이그레이션 074)
- salons admin UPDATE RLS 정책 추가 (마이그레이션 075, `admin_all_salons`)
- 브랜드 데이터 정리(중복 통합/pending 라벨 정정)

## 2026-07-09

- 2026-07-09: 카카오/구글 가입 플로우 전면 재설계 - OAuth 시점을 온보딩 완료 후 1회로 통일(consent→onboarding→OAuth 1회→auth/done에서 DB일괄저장→홈). 기존 구조는 OAuth 재호출로 세션이 깨져 /와 /login을 반복하는 근본 버그가 있었음
- 2026-07-09: 온보딩(생년월일/성별) 완료 시 이미 로그인된 세션인데 OAuth를 재호출해서 로그아웃되던 버그 수정 - 세션 있으면 OAuth 생략하고 바로 데이터 저장
- 2026-07-09: 카카오 로그인 후 홈 진입 시 미들웨어 쿠키 타이밍 문제로 /login 튕기던 근본 원인 해결 - auth/done을 풀페이지 이동으로 변경, AuthSessionProvider SIGNED_OUT 시 세션 재확인 로직 추가
- 2026-07-09: 마이페이지에 추천링크 카드 추가 - 친구초대(customer)/원장초대(owner) 링크를 카카오/SMS 등으로 공유 가능, 기존 ShareBottomSheet 재사용
- 2026-07-09: 카카오/구글 OAuth 로그인 중 SIGNED_OUT 이벤트로 인해 /login으로 되튕기던 버그 수정 - AuthSessionProvider 예외 경로에 /auth/done, /auth/callback, /auth/exchange 추가
- 2026-07-09: 가입 시 추천인 코드(referral_code) 조회를 서버 API(resolve-referrer)로 이전 - 기존 클라이언트 직접조회는 RLS(본인row만 조회가능)에 막혀 항상 실패하던 버그였음, 서버 API는 id만 안전하게 반환
- 2026-07-09: 원장/파트너/브랜드 로그아웃 시 고객 홈으로 잘못 이동하던 문제 정리 - pending-approval을 SIGNED_OUT 예외에 추가, 로그아웃 목적지를 role별 로그인 화면으로 통일, "홈으로" 버튼을 유머러스한 문구로 변경
- 2026-07-09: 원장 홈 "내 스토어 보기" 링크가 존재하지 않는 /store/{slug} 경로로 연결되던 버그 수정 - 실제 고객 스토어 경로인 /salons/{salonId}로 교체
- 2026-07-09: salons 테이블 INSERT RLS 정책 추가 (마이그레이션 073) - 원장 가입 시 salons 자동생성이 RLS에 막혀 실패하던 문제 발견 및 수정
- 2026-07-09: confirmOrder.ts 추천보상 로직 변경 - 하드코딩 5000T 신규지급 대신, 가입 시 잠겨있던 1000T를 첫구매확정 시 잠금해제(status active + users.points 반영)하는 방식으로 교체
- 2026-07-09: handle_referral_rewards 트리거 재설계 (마이그레이션 072) - 추천인이 customer일 때만 1000T 잠긴 상태로 지급, 피추천인 즉시보상/원장모집보상 로직 제거
- 2026-07-09: toast_transactions에 status 컬럼 추가 (마이그레이션 071) - 추천보상 잠금/해제 구조 준비용
- 2026-07-09: 오렌콘솔 승인요청 화면 - 승인완료 탭이 브랜드 입점건만 보여주던 버그 수정(원장/파트너/브랜드사 계정 승인건도 표시), role 표시 하드코드 제거, 역할별(원장/파트너/브랜드) 필터 탭 추가
- 2026-07-09: 원장 가입 상호명·슬러그 입력칸 예시 문구를 "La Poudre d'Or" / "lapoudredor"로 변경
- 2026-07-09: 승인대기 페이지 문구 줄바꿈 정리
- 2026-07-09: 미들웨어 보안 수정 - /dashboard/owner가 승인대기(pending) 체크를 우회하던 허점 수정. 승인 전 원장은 이제 정상적으로 승인대기 화면으로 이동. 승인대기 안내문구 개선
- 2026-07-09: 원장 가입완료 후 로그인 시 고객홈으로 잘못 이동하던 버그 수정 - login 자동리다이렉트에 URL role 반영, signup step3에서 owner는 대시보드로 직행, localStorage position 안전망 추가
- 2026-07-09: 원장 가입에 스토어 영문 주소(슬러그) 입력칸 추가(한글 상호명 랜덤슬러그 문제 해결), 가입완료 화면 role별 인사문구/안내문구 분기(owner=상호명+응원문구, brand=브랜드명, 호르몬안내는 customer 전용으로 제한)
- 2026-07-09: 주소검색 적용된 모든 화면(외부고객카드, 배송지, 스토어정보, 원장가입)에 상세주소 입력칸 점검 및 추가
- 2026-07-09: 원장 가입 업종 선택지 "자유기재" → "기타"로 문구 변경
- 2026-07-09: 원장 가입 흐름 순서 변경 - 매장유무 분기를 약관동의 직후(정보입력 이전)로 이동
- 2026-07-09: 원장 가입 흐름에 매장유무 분기 단계 추가 (업종/주소검색), profiles.has_offline_store·store_type 저장 및 salons row 자동생성, 상호명 안내문구 추가. 매장분기 UI는 OwnerStoreStep.tsx로 분리(500줄 룰)
- 2026-07-09: profiles 테이블에 has_offline_store, store_type 컬럼 추가 (마이그레이션 070) - 원장 가입 시 오프라인 매장 유무·업종 저장용

## 2026-07-08

- 2026-07-08: 외부고객카드, 주소관리, 스토어정보 페이지의 주소 수기입력을 다음 우편번호 검색으로 변경
- 2026-07-08: 원장 홈에 스토어 프로필 카드 추가 - 클릭 시 실제 고객용 스토어 화면 새 탭으로 확인 가능
- 2026-07-08: 원장 홈 v3에 월별 매출추이 그래프(recharts), 인기 시술/제품 TOP3 추가, 카운트업 애니메이션·호버효과·등급뱃지 글로우 등 시각효과 업그레이드
- 2026-07-08: 가입 웰컴포인트(10,000P) 문구·지급을 고객(customer) 전용으로 제한 — 원장/파트너/브랜드 로그인·가입 화면에 고객용 문구 노출되던 버그 수정
- 2026-07-08: 원장 스토어 접근 게이트 수정 — integrated 모드 인식 안 되던 버그 수정, 가입 후 3개월 무료 체험 기간 추가
- 2026-07-08: 원장 홈 기본 경로(/dashboard/owner)를 v3(OwnerHomeV3)로 교체, 기존 화면은 ?v=1로 보존
- 2026-07-08: 원장 홈 v3 신규 생성 (/dashboard/owner?v=3) — 등급뱃지, 이번달매출(관리권/제품 분리), 상담톡 펼침, 모집원장 리스트(커미션은 정산로직 미구현으로 준비중 표시), 브랜드 소식 카드
- 2026-07-08: 원장 콘솔 사이드바에 누락된 메뉴 추가 (오렌상담톡, 발주/소식/샘플/라이브/반품 브랜드 연동 5개)
- 2026-07-08: 원장 홈(client.tsx) PC에서 480px로 좁게 나오던 문제 수정 — maxWidth 720으로 확대
- 2026-07-08: 원장 가입 폼에 상호명(매장명) 입력 필드 추가, owner_store_name 컬럼에 저장 및 slug 생성 기준으로 사용
- 2026-07-08: 원장/파트너/브랜드 가입 시 고객용 생년월일·성별 온보딩 폼 건너뛰고 바로 가입 폼으로 이동하도록 수정 (consent/page.tsx L88)
- 2026-07-08: 원장/파트너/브랜드 슬러그 로그인 페이지에서 로그인 실패(signOut 발생) 시 고객 로그인 화면(/login)으로 강제이동하던 버그 수정 — AuthSessionProvider SIGNED_OUT 예외 경로에 /owner/, /partner/, /brand/ 추가

## 2026-07-07

- 2026-07-07: 비로그인 사용자도 홈(/) 접근 가능하게 변경 (SEO 오픈), 로그인 사용자 역할별 리다이렉트는 기존 그대로 유지
- 2026-07-07: 매거진 에디터를 textarea에서 TipTap(ProductDetailEditor) 기반으로 교체, 영상 드래그드롭 및 자동저장 추가
- 2026-07-07: 매거진 르노벨 제품 태그 시 제품페이지 대신 상담톡(ConsultChat) 직결 - 글은 SEO 공개 유지, 제품/브랜드 상세만 비노출
- 2026-07-07: login_logs 미기록 버그 수정 - 전체 로그인 경로(7곳+OAuth)에 로깅 추가
- 2026-07-07: admin-settings에 원장/파트너스/브랜드사 데모 계정 바로가기 섹션 추가 (기능 작업 후 즉시 확인용)
- 2026-07-07: AdminChrome.tsx(실사용 전역 헤더)에 AURAN 로고 게스트 미리보기 링크 추가 - 이전 client.tsx 수정은 미사용 파일이라 무효했음, 정정
- 2026-07-07: 오렌콘솔 AURAN 로고 클릭 시 고객 홈 미리보기 새 탭 오픈 (?preview=guest, admin 세션 영향 없음)
- 2026-07-07: products 테이블에 admin INSERT 정책 추가 (신규 제품 등록 RLS 오류 수정)
- 2026-07-07: 카테고리 데이터 추가 - 스킨케어 하위에 비비/쿠션 신설 (categories 테이블, 대시보드 직접 INSERT, level=3, parent_id=c2000000-0000-4000-8000-000000000001, sort_order 10/11)
- 2026-07-07: 외부고객카드 구매제품 검색에 제품 등록 바로가기 링크 추가
- 2026-07-07: admin/revenue 고객분석 TOP20에 캠페인 체크박스 추가 (오렌 내부고객 대상)
- 2026-07-07: scheduled_campaigns에 target_customer_type 추가 (외부고객/오렌내부고객 구분)
- 2026-07-07: scheduled_campaigns 테이블 신설 (예약형 캠페인 발송 시스템 코어)
- 2026-07-07: 원장 콘솔 모바일 하단탭 - 매출 제거, 시술차트 추가 (현장 전후사진 업로드 접근성 개선)
- 2026-07-07: coupons 테이블에 캠페인 증정품 필드 추가 (066_coupon_campaign_gift.sql)
- 2026-07-07: 대표님이 미쳤나봐요 모드 - 구매자 선택 즉석발송 기능 추가 (findSalonChannel 공용화 포함)

## 2026-07-06

- 2026-07-06: SMS 발송을 뿌리오(미사용)에서 아이코드(icode)로 전환, find-id/find-password 인증문자 발송 실패 시 정직하게 에러 응답하도록 수정
- 2026-07-06: 외부고객카드v2 통계 탭에 매출추이(월별)/구매자랭킹TOP10/제품매출랭킹TOP10/재구매율/채널별매출 추가
- 2026-07-06: 로그인 페이지 세션체크 중 폼 깜빡임(flash) 방지 - 달 테마 로딩화면(@/app/loading) 적용
- 2026-07-06: 원장/파트너스/브랜드사 가입·로그인 시 소셜(카카오/구글) 버튼 제거, 아이디 방식만 노출 (고객은 기존과 동일)
- 2026-07-06: CHANGELOG 형식 정리 + 외부고객카드v2 dead code(history탭/markJoined/filteredCards 등) 제거 및 printCard 분리 (907줄→685줄)
- 2026-07-06: 외부고객카드v2 신규고객 입력 시 이름→전화→주소→제품검색 Enter 자동 포커스이동 + 기존고객 자동완성 시 제품검색으로 즉시 이동 기능 추가

## 2026-07-05

- brand-live/returns profiles 테이블 조회로 수정(기존 users 조회는 존재하지 않는 컬럼이라 브랜드 목록이 항상 비어 보이는 버그였음), 로그인/헤더 owner 패턴 통일
- brand-* 5개 파일 하단탭 role owner로 전환, /dashboard/salon 삭제에 따른 링크 정상화 완료
- /dashboard/salon 레거시 폴더 삭제, owner/page.tsx import 경로 정리
- DashboardBottomNav owner role 신설, OwnerSidebarShell 및 owner 콘솔 경로 정상화, 중복 탭바 제거(subscription/store)
- OwnerSidebarShell에 모바일 하단탭바 복원 (PC=사이드바/모바일=탭바 반응형 완성)
- client.tsx 하단 탭바(DashboardBottomNav) 제거, OwnerSidebarShell로 대체
- 원장 콘솔 PC 반응형 사이드바(OwnerSidebarShell) 신설, layout.tsx 적용
- client.tsx 스토어 등급 5단계 UI 매핑 완료 + 다음 등급 안내 표시
- 스토어 등급 5단계 자동계산(매출+평점+리뷰+주문수 복합점수) + 양방향 트리거 + salons RLS 활성화
- client.tsx 빠른메뉴 OwnerQuickMenu 컴포넌트 분리 (500줄 룰 대응)

## 2026-07-03

- 원장 로그인(/owner/[slug]) 리다이렉트: ?v=2(구 라이트버전) → 기본경로(신규 다크버전)로 수정
- 원장 로그인 페이지(/owner/[slug]): profiles 직접조회 → owner_public_profile 뷰로 변경 (RLS 강화로 비로그인 조회 막혀있던 버그 수정)
- RLS 보안 전수 감사 및 긴급 조치
- external_customers: admin_all(true) 정책 → authenticated로 제한
- RLS 미활성화 테이블 60+ 전체 활성화 + 정책 부여
  - 민감 테이블: profiles, orders, bookings, payment_intents, shipping_addresses, refunds, settlements, notifications, products, skin_analyses, login_logs, point_history
  - 설정성 테이블: benefit_settings, grade_settings, coupons, charge_plans 등 (조회 공개/쓰기 admin)
  - 콘텐츠 테이블: notices, banners, categories, time_sales, group_buys 등 (조회 공개/쓰기 admin)
  - 관리자 전용/로그성 테이블: admin_broadcasts, app_config, mapping_rules, traffic_logs, visitor_logs, referral_logs 등
- purchase_events: 레포 코드 미사용 확인, admin 전용으로 정책 교체
- 실결제 테스트 완료 (payapp webhook 정상 동작 확인)

## 2026-07-02

- product detail: AURAN 워드마크 클릭 시 홈 이동 대신 이전 페이지로 이동(router.back)
- product detail: 하단 3버튼 폰트 통일(지금구매 크기 축소) + 버튼바 슬림화
- product detail: 탑바 위치 조정(살짝 하단 이동), 공유버튼 좌측 이동 + 원형 테두리 추가
- product detail: 하단 네비 숨김 처리, 3버튼바 bottom 위치 재조정
- product detail: 수량행 가격 표시 잘림 방지 (flexShrink/nowrap 추가)
- product detail: 하단 3버튼바 슬림화 + 하단 여백 확보, 텍스트 위계 조정, 상담버튼 축소
- product detail: 제품명/가격 폰트 위계 조정, 상담버튼 축소, 하단 paddingBottom 재조정
- 제품상세: 공유 배너 제거 → 탑바 공유 버튼 팝업으로 통합
- 제품상세: 공유 팝업 X 닫기버튼 추가
- 제품상세: 파트너 role이면 커미션 금액 표시
- 제품상세: 파트너 추천링크 partner_referral_code 사용
- 홈 그리드: 상담톡 제거 (스텁 페이지 → 홈 튕김)
- 홈 그리드: 리뷰·커뮤니티 라벨 fontSize 10→9
- 고아 컴포넌트 12개 + lib 1개 삭제 (dead code 정리)
- my/track: step 구조 제거 → 한 페이지 스크롤
- my/track: 진행바·step state·goNext·validateStep1 제거
- SkinDiarySheet·SkinDiaryJournal·CalendarSection 완전 삭제
- HormoneCard·HormoneSheet dead prop onOpenSkinDiary 제거
- page.tsx showSkinDiary state·import·렌더 제거
- HormoneCalendarRecord: 모달 → 바텀시트 교체 + X 닫기버튼
- HormoneCalendarRecord: 피부일지(수면·UV·스트레스·피부상태) 통합
- saveRecord: daily_skin_log 동시 저장
- my/track: 칩 즉시저장 값 지연 버그 수정 (override 인자)
- my/track: 진행바 클릭으로 step1↔step2 이동
- my/track: 칩 선택·textarea 즉시저장 적용
- my/track: 저장하기 버튼·하단 fixed bar 제거
- my/track: 저장 후 /my 이동 제거 → 토스트 표시
- my/track: step 이동 시 필수 검증 제거
- my/track: 하단 버튼 safe-area-inset-bottom 적용 (짤림 해결)
- 홈: 잠금카드 → 미니 배너로 교체 (생리 사이클 미등록 시)
- 배너: 클릭 시 호르몬 카드 스크롤, X 누르면 오늘 하루 숨김
- male 트랙 / hormoneCycle 있으면 배너 비표시
- 홈 잠금카드: CTA 버튼 제거 (문구만 유지) / 날씨카드 「오늘 기록하기」 버튼 제거
- 홈 잠금카드: 「마법캘린더 입력하기」→「피부 일지 기록하기」라벨 수정
- SkinDiarySheet: 미사용 CalendarSection·SkinDiaryJournal import 제거
- profile 편집: profiles 빈값 시 users.name/phone fallback 적용 (가입값 자동입력)
- 홈 TODAY'S SKIN 카드: 피부타입 텍스트 클릭 시 /my/track 이동
- profile: persist() 후 페이지 이동 제거 → 현재 페이지 유지 + 저장완료 표시
- profile: 피부타입·알림·닉네임 등 항목별 즉시저장 (onBlur/onChange)
- auth/set-pin: 하단 버튼 safe-area-inset-bottom 적용
- AuthSessionProvider: SIGNED_OUT redirect에 /signup 경로 예외 + 300ms 딜레이
- signup: 가입 완료 후 router.push → router.replace 변경
- signup: 환영 포인트 8,888P → 10,000P (코드 폴백 5곳 + DB admin_settings)
- signup: 아이디→@auran.kr 변환으로 Supabase signUp 이메일 검증 오류 수정
- signup/consent/onboarding/login: safe-area-inset 적용 (노치/홈바 겹침 해결)
- layout.tsx viewport: viewportFit cover 추가

### BrandTabHome 마케팅·이벤트 — 예정 라이브 카드 추가
- dashboard/brand/tabs/BrandTabHome.tsx — closedEvents에 live 카드 추가, 전부 닫힘 시 다시 보기(3개 기준)

### 회원가입 아이디 문구·필드 통일 (UNIT PP)
- signup/consent/page.tsx: `이메일로 시작하기` → `아이디로 시작하기`
- signup/page.tsx: 가입 폼 라벨 `이메일 *` → `아이디 *`, input type `email`→`text`, placeholder `아이디`

### 회원가입 환영문구·약관 텍스트 모바일 폰트 조정 (UNIT NN/OO)
- signup/consent/page.tsx: 환영 문구 fontSize 20→16, `whiteSpace: 'nowrap'` 추가
- signup/consent/page.tsx: 약관 체크박스 라벨 fontSize 13→11

### 로그인 아이디 문구 통일 + 가입 동의 환영문구 크기 조정 (UNIT JJ/KK)
- login/page.tsx: 두 번째 로그인 블록의 라벨 `이메일`→`아이디`, placeholder `example@email.com`→`아이디`, 입력 타입 `email`→`text`
- signup/consent/page.tsx: 환영 문구(`오렌에 오신 걸 환영해요 💜`) fontSize 22→20으로 축소

## 2026-06-03

### 보안 강화 — 로그인·결제PIN 단계식 잠금 + PIN UX (UNIT FF–II)
- login/page.tsx: login_failed_count/login_locked_until 3단계 잠금 (5→30초, 10→5분, 15→30분)
- pin/verify: pin_failed_count 동일 규칙, PaymentAuthGuard 경유 유지
- set-pin·PinModal·PaymentAuthGuard: 숫자패드 랜덤 배열, PIN 기억 안내 문구

### 보안 감사 — checkout PIN 검증 통일 (UNIT DD)
- checkout/page.tsx: users.payment_pin(죽은 컬럼) 직접 비교 제거 → PaymentAuthGuard + api/auth/pin/verify
- UNIT EE(로그인 계정 잠금): users.login_failed_count/login_locked_until 컬럼 없음 — SQL 추가 후 재작업 필요

### 원장 가입완료 slug 자동생성·전용주소 안내 (UNIT CC)
- signup/page.tsx: owner 가입 시 profiles.slug 생성(UNIT O 동일 규칙) + 완료 화면 전용 로그인 주소·복사

### 원장 프로필 사진 편집·고객 스토어 노출 (UNIT AA/BB)
- store-decoration: profiles.avatar_url 업로드·저장 (owner-store 버킷)
- salons/[id]: 살롱명 옆 원형 프로필 사진 (auth_id 경유 조회)

### 브랜드인증 조회 ID 불일치 수정 (UNIT Z)
- salons/[id]: salons.owner_id(users.id) → auth_id → profiles.id 경유 후 brand_owner_grades/brand_arete_members 조회 (UNIT Y 버그 수정)

### 브랜드 등급 분리 + 고객 스토어 브랜드 인증 (UNIT X/Y)
- BrandTabOwners: profiles.grade → brand_owner_grades 조회·upsert 전환
- salons/[id] 샵정보 탭: brand_owner_grades + brand_arete_members 브랜드 인증 섹션 노출

### 원장 자격증·경력 전시 (UNIT V/W)
- SalonInfoForm: certificates 업로드·라벨 편집 (owner-store 버킷)
- salons/[id] 샵 정보 탭: 자격증 가로 스크롤 + 확대 모달

### 파트너 전용 로그인 + slug 자동생성 (UNIT R/S/T/U)
- `/partner/[slug]` 전용 로그인 페이지 (owner 패턴 재사용)
- dashboard/partner 첫 진입 시 profiles.slug 자동 생성
- login?role=partner 전용 주소 안내 배너

### 원장 slug 자동생성 + 전용 로그인 주소 (UNIT O/P/Q)
- store/page: owner_store_name 저장 시 slug 자동 생성(중복 시 숫자 suffix)
- store-decoration: 내 전용 로그인 주소 노출
- login?role=owner: 전용 주소 안내 배너

### 결제복귀 상태복원 + 예약접수 알림 (UNIT M/N)
- salons/[id]: booking_paid 복귀 시 purchases 조회로 시술명·가격·회차·salon_id 복원 (₩0 버그)
- bookings.insert 성공 시 고객·원장 notifications + useSalonBookingMessage 접수 메시지

### 예약 상태알림 오렌상담톡 전환 (UNIT L)
- `useSalonBookingMessage` 훅 — channel_type='salon' + salon_messages
- BookingManagePage: confirmed/완료/취소 시 오렌상담톡, 카카오 알림톡 예약용도 제거

### 배너 영역 풀폭 가로 캐러셀 재구성 (UNIT K)
- `banner_urls`/`banner_links`/`story_url` 실제 연결, 헤더 아래 21:9 풀폭 캐러셀
- 프로필 grid 좌측 정사각형 배너 칸 제거, `EmptyBannerHook` 가로형 후킹 카드

### PC 반응형 + 배너 비율 + 회차 선택 중복 제거
- **UNIT G:** salons/[id], checkout/booking 최상위 maxWidth:480 컨테이너, 결제 버튼 z-index
- **UNIT H:** 배너 16:9·grid 160px 고정, EmptyBannerHook 첫방문 후킹 카드
- **UNIT I:** checkout sessions URL 파라미터 수신, salons에서 선택 시 회차 UI 숨김
- **UNIT J:** docs/TROUBLESHOOT.md PC 반응형·예약 플로우 규칙 추가

### 스토어 꾸미기 + 예약 실시간 + 고객홈 즐겨찾는 원장
- **UNIT B:** `/dashboard/owner/store-decoration` — 배너·스토리·페이즈 인사·main_cta·지도/SNS 편집 (salons 컬럼)
- **UNIT C:** `src/components/salon-store/*` 4종 — salons/[id] import+호출만 삽입
- **UNIT D:** `FavoriteSalonsSection` — chat/bookings 기반 즐겨찾는 원장 카드, page.tsx 삽입
- **UNIT E:** `useOwnerBookingRealtime` 훅 + MyBookingStatus UPDATE 구독
- **UNIT F:** docs/DATABASE.md, AI_CONTEXT.md, CHANGELOG.md 갱신

### 긴급수정: 페이즈 게이트 gender 이중 체크
- 실데이터에서 남성 고객(`gender=male`)인데 `hormone_cycle.track=general` 케이스 발견 → `canShowCyclePhase`에 gender 체크 추가, 5개 호출부 전수 반영

### 호르몬 페이즈 노출 게이트 전수 적용
- **원인:** `profiles.cycle_type` / `hormone_cycle_applicable` 죽은 컬럼(전원 null)으로 게이트 미작동 → 남성·갱년기·임신 등에도 4페이즈 노출
- **UNIT A:** `hormoneUtils.ts` — `canShowCyclePhase(track)` 추가 (`track === 'general'`만 true)
- **UNIT B:** `salons/[id]/page.tsx` — general만 페이즈 UI, 그 외 피부 고민 칩 대체
- **UNIT C:** `client-v2.tsx`, `charts-v2/ChartPopup.tsx`, `charts-v2/page.tsx` — getPhase 호출부 게이트
- **UNIT D:** `dashboard/owner/chat/[id]/page.tsx` — 페이즈 매핑 게이트
- **UNIT E:** `docs/DATABASE.md`, `docs/AI_CONTEXT.md` 규칙 문서화

---

## 2026-06-28

### slug 로그인 — 아이디/비밀번호 찾기 연동
- owner/[slug]/page.tsx, brand/[slug]/page.tsx — FindAccountModal 인라인 연동, 이메일 문의 문구를 찾기 링크로 교체

### FindAccountModal — 인라인 컴포넌트로 전환
- FindAccountModal.tsx — 전체 화면 모달 제거, 로그인 폼 내 인라인 패널 UI로 재작성

### 로그인 — 아이디/비밀번호 찾기 모달 연동
- login/page.tsx — FindAccountModal 연동, 링크 문구 변경 및 SMS 인증 찾기 플로우 진입

### 아이디·비밀번호 찾기 모달
- FindAccountModal.tsx — SMS 인증 기반 아이디 찾기·비밀번호 재설정 UI (find-id/find-password API 연동)

### 아이디·비밀번호 찾기 API
- api/auth/find-id — 휴대폰 SMS 인증 후 아이디 조회 (send/verify)
- api/auth/find-password — 아이디+휴대폰 인증 후 비밀번호 재설정 (send/verify/reset)
- auth_verification_codes 테이블 + sendPpurioSms 연동

### 뿌리오 일반 SMS 발송 함수 추가
- sendAlimtalk.ts — `sendPpurioSms` 추가 (sms/lms 자유 텍스트, 인증번호 등 템플릿 없이 발송)

### 원장님 대시보드 client-v2 — 헤더 프로필 원형
- client-v2.tsx — ownerAvatar·ownerSlug 연동 프로필 원형, slug 있을 때 `/owner/{slug}` 이동

### 원장님 대시보드 client-v2 — slug·아바타 state
- client-v2.tsx — profiles 조회로 ownerSlug·ownerAvatar state 추가 (slug 로그인·헤더 연동 준비)

### 원장님 slug 로그인 — 리다이렉트 경로 수정
- owner/[slug]/page.tsx — 로그인·세션 자동 이동 경로 `/dashboard/owner/client-v2` → `/dashboard/owner?v=2` (실제 client-v2 진입 쿼리와 일치)

### 원장님 slug 전용 로그인 페이지
- owner/[slug]/page.tsx — profiles.slug 기반 원장님 전용 콘솔 로그인 (브랜드 허브 패턴)

### 문의 이메일 주소 변경
- account-delete/page.tsx, logi/[slug]/page.tsx, brand/[slug]/page.tsx — queen8038 → queen8039@gmail.com

### 어드민 API — 이메일 하드코드 admin 우회 제거
- api/admin/customer-grade, coupons, coupons/issue, coupon-campaigns — `admin@auran.kr` 이메일 폴백 인증 삭제, role 기반 검증만 유지

### 마이페이지 — 담당 원장님 이름 동적 표시
- my/page.tsx — external_customers·profiles 연동으로 담당 원장명 조회, 하드코딩 「맑원장」 문구를 케어플랜 안내로 교체

### 브랜드 허브 — 탭별 도움말 모달
- dashboard/brand/components/BrandHubContent.tsx — 브랜드·물류 헤더 도움말 버튼, 탭별 flow/warn/tip/info 안내 모달

### 브랜드 허브 — 메인 탭 헤더(← 홈)
- dashboard/brand/components/BrandHubContent.tsx — home 제외 브랜드 탭·물류 서브탭 상단 sticky 헤더, ← 홈/재고현황 복귀

### 브랜드 홈 마케팅 카드 — 하드코딩 기간·수치 제거
- dashboard/brand/tabs/BrandTabHome.tsx — 프로모션·번들 이벤트 카드의 임시 기간/참여 수 문구 삭제

### 브랜드 홈 마케팅 카드 — 닫기·다시보기
- dashboard/brand/tabs/BrandTabHome.tsx — 프로모션·번들 이벤트 카드 × 닫기, 전체 닫힘 시 「다시 보기」

### 브랜드 원장님 관리 — 등급·아레테·수기 등록
- dashboard/brand/tabs/BrandTabOwners.tsx — 등급 변경·아레테 ON/OFF(brand_arete_members·brand_points 연동), 수기 원장님 등록 폼, 초대 링크 분리

### 원장님 브랜드 라이브·반품 페이지 추가
- dashboard/owner/client-v2.tsx — 빠른 메뉴에 브랜드 라이브·반품 신청 링크 추가
- dashboard/owner/brand-live/page.tsx — 거래 브랜드 라이브 일정 조회·참여/다시보기
- dashboard/owner/brand-returns/page.tsx — 반품 신청 폼·내역 조회

### 브랜드 홈 TOP 제품 카드 제거
- dashboard/brand/tabs/BrandTabHome.tsx — 「이번달 TOP 제품」 카드 섹션 삭제 (3단/2단 대시보드로 대체)

### 브랜드 홈 대시보드 확장
- dashboard/brand/tabs/BrandTabHome.tsx — KPI 5개(이달 판매액·처리대기·임박재고 등), 오렌상담톡/최근주문/재고 3단·마케팅/샘플 2단 섹션 추가, Supabase fetch 연동

### 브랜드 홈 탭 카드·버튼 다크 톤 정리
- dashboard/brand/tabs/BrandTabHome.tsx — CARD 배경 `#1a1520` → 중립 `rgba(255,255,255,0.03)`, 알림·소진 마케팅 버튼 보라 배경 완화, 판매중 배지 초록 톤 조정

### 브랜드 허브 좌측 사이드바 레이아웃
- dashboard/brand/components/BrandHubContent.tsx — 상단 탭 네비 → 좌측 사이드바(섹션별 메뉴·Tabler 아이콘) + 우측 메인 콘텐츠 flex 레이아웃
- CEO/이사 브랜드·물류팀 모드 전환을 사이드바 상단으로 이동, 물류팀 메뉴도 사이드바 통합

### 마이페이지 서브화면 DashboardHeader 뒤로가기
- notifications/page.tsx, rituals/page.tsx, coupons/MyCouponsClient.tsx — `DashboardHeader`에 `onBack={() => router.back()}` 추가
- rituals/[id]/page.tsx — 리추얼 상세 `DashboardHeader`에 `onBack` 명시 추가
- DashboardHeader.tsx — `onBack` optional prop 지원

### TopBar AURAN 로고 홈 링크
- home/TopBar.tsx — AURAN 로고 클릭 시 `router.push('/')` 홈 이동

### 원장 상담톡 쿠폰 서브폼 닫기 버튼
- owner/chat/[id]/page.tsx — `showCouponForm` 패널 우상단 × 버튼 추가 (`setShowCouponForm(false)`)

### 원장 상담톡 패널 닫기 버튼 추가
- owner/chat/[id]/page.tsx — toolPanel·피부기록(showSkinLog)·커스텀 카드폼에 × 닫기 버튼 추가

### 원장 상담톡 카드함 패널 닫기 버튼
- owner/chat/[id]/page.tsx — 카드함 패널 우상단 × 버튼 추가 (`setShowCardLib(false)`)

### 원장 상담톡 PC 입력창 sticky 전환
- owner/chat/[id]/page.tsx — PC에서 입력창 `position: fixed` → `sticky`, 중앙 컬럼 하단 고정·불투명 배경(`#0D0B09`)으로 좌우 세로선 겹침 제거

### 원장 상담톡 우측 패널 세로줄 제거
- owner/chat/[id]/page.tsx — PC 우측 패널 `borderLeft` 제거, `borderTop: none` 명시

### 원장 상담톡 우측 패널 높이 조정
- owner/chat/[id]/page.tsx — PC 우측 패널 maxHeight `100dvh` → `calc(100dvh - 120px)` (입력바 영역 제외)

### 개인정보처리방침 — 관리자 열람 조항 추가
- privacy/page.tsx — 서비스 운영·분쟁 해결 목적 내부 관리자 상담/거래 이력 열람 조항 (§5 정보주체의 권리)

### 원장 상담톡 보더 다크 통일
- owner/chat/[id]/page.tsx — `#ede9f7` 6곳 전부 `rgba(255,255,255,0.08)` (입력바·사이드바·날짜 구분선 등)

### 원장 상담톡 입력바·뒤로가기 다크 맞춤
- owner/chat/[id]/page.tsx — 하단 입력바 `#ffffff` → 반투명 다크, 뒤로가기 버튼 `#f9f8fc` → `rgba(255,255,255,0.08)`

### 원장 상담톡 말풍선 가독성 수정
- owner/chat/[id]/page.tsx — BG 다크 복원 (#0D0B09), 피부기록·카드 내부 밝은 배경+흰 텍스트 대비 수정

### 입점 신청 폼 제거 (AURAN 직접 등록 전환)
- BrandApplyForm.tsx 삭제 — 5단계 입점 신청·pending 대기 UI 제거
- dashboard/brand/page.tsx — applyStNorm/needsApply/isPending 제거, isApproved 단순화

### BrandApplyForm 분리
- BrandApplyForm.tsx 신규 — 입점 신청 5단계 폼 + pending 대기 UI 추출
- dashboard/brand/page.tsx 슬림화 (~656줄 감소, 500줄 규칙 복구)
- apply 관련 state·uploadAsset·applySubmit 등 page.tsx에서 제거

### BrandWelcomePopup 분리
- BrandWelcomePopup.tsx 신규 — 승인 후 웰컴 팝업 JSX 추출
- dashboard/brand/page.tsx 슬림화 (~106줄 감소)

### 브랜드 웰컴 팝업 멘트 변경
- dashboard/brand/page.tsx — 제목/감사 문구에 displayName 동적 표시
- "AURAN 파트너가 되셨어요!" → "{displayName} Brand Hub 콘솔입니다"
- "AURAN과 함께해 주셔서 감사해요" → "AURAN과 함께하는 {displayName}를 환영합니다"

### 브랜드 로그인 아이디 기억하기
- brand/[slug]/page.tsx — localStorage 저장/불러오기
- slug별 키: auran_brand_userid_{slug}, auran_brand_remember_{slug}
- "아이디 기억하기" 체크박스 UI 추가

### BrandWatermark 포렌식 워터마크 변경
- BrandWatermark.tsx — 20개 타일 → 중앙 1개
- 육안 불가 (opacity 0.015), 캡처 후 밝기 올리면 식별 가능

### Brand Hub 문서화 (docs/)
- docs/AI_CONTEXT.md 생성 — 프로젝트 전체 컨텍스트
- docs/SECURITY.md 생성 — 보안 시스템
- docs/BRAND_HUB.md 생성 — Brand Hub 기능
- docs/DATABASE.md 생성 — DB 테이블/RPC/RLS

### 유통기한 소진 마케팅 4단계 확장
- BrandInventoryMarketing.tsx — D-330(11개월)부터 자동 감지
- 단계: 🚨D-30 / 🔴D-90 / 🟡D-180 / 🟠D-330 / 🟢정상
- BrandTabHome.tsx 홈 배너 330일로 확장
- CTA "소진 마케팅 기획하러 가기"로 변경

### Brand Hub 파일 분리 (500줄 규칙 적용)
- dashboard/brand/page.tsx 1394줄 → 슬림화
- BrandHubContent.tsx 신규 — 탭 네비+렌더링 분리
- 통합 어드민 콘솔 추가 (CEO/이사 전용)
- 🏢 Brand Hub ↔ 🚛 물류 허브 탭 전환

### 시바산 계정 설정 완료
- civasan@auran.kr Supabase Auth 계정 생성
- brands.user_id 연결
- users.auth_id, role=brand, status=active 설정
- profiles.role=brand, active_role=brand 설정
- login_role=ceo 설정
- auran.kr/brand/civasan 접속 테스트 완료
- 테스트 직원 등록 (윰탱 이사, PIN: 123456)

### middleware 수정
- /brand/[slug] 로그인 페이지 인증 체크 제외
- /logi/[slug] 로그인 페이지 인증 체크 제외
- 브랜드 로그인 후 홈 튕김 버그 수정

### 물류 허브 구축
- src/app/logi/[slug]/page.tsx — 물류팀 전용 로그인
- src/app/dashboard/logi/page.tsx — 물류 허브 대시보드
- BrandPinGate.tsx ops_manager/ops_staff 역할 추가
- 접속: auran.kr/logi/civasan

---

## 2026-06-27

### 직원 권한 위임 시스템
- BrandInventoryStaff.tsx 개편 — ceo/director/manager/staff/ops_manager/ops_staff
- BrandStaffPermissions.tsx 신규 — 모듈별 권한 설정 팝업
- GRANT_ROLES 계층: 대표→이사→과장→담당자, 물류팀장→물류직원
- brand_staff_permissions 테이블 신규

### PIN 게이트 + 워터마크 보안
- BrandPinGate.tsx 신규 — 담당자 선택 + PIN 패드
- BrandWatermark.tsx 신규 — AURAN CONFIDENTIAL 워터마크
- brand_access_logs 삭제 불가 트리거
- brand_pin_sessions 테이블 신규
- PIN 3회 오류 시 잠금 + 대표 알림

### login_role 대표/이사 권한 분리
- brands.login_role 컬럼 추가 (ceo/director)
- dashboard/brand/page.tsx — isCEO 분기
- 정산 탭 CEO만 표시
- BrandTabInventory loginRole prop 전달

### 브랜드사 전용 로그인
- src/app/brand/[slug]/page.tsx 신규
- 아이디+비밀번호만 (소셜 로그인 없음)
- brands.user_id 불일치 시 접근 거부
- brands.slug 컬럼 추가 + UNIQUE 제약
- 시바산 slug=civasan 설정

### 유통기한 마케팅 기획 탭
- BrandInventoryMarketing.tsx 신규
- 기분좋게 처리하기 팝업 3단계
- 임박/정상/번들 구분
- BrandTabInventory 마케팅기획 서브탭 추가

---

## 2026-06-26

### 보안 DB 구축
- brand_access_logs 테이블 신규
- brand_pin_sessions 테이블 신규
- brand_staff_permissions 테이블 신규
- prevent_access_log_modification 트리거
- mask_phone / mask_email 함수

### 브랜드사 중복 정리
- 시바산프리미엄 → 시바산(CIVASAN) 통합
- 빈 시바산 레코드 삭제
- 제품 46개 시바산(CIVASAN)으로 통합

---

## 2026-06-25 이전

### 반품·교환 시스템
- BrandReturnsList.tsx — 승인/반려 + RTN 코드 발급
- BrandReturnsReceive.tsx — 코드 스캔 수령 + 재고 반영/폐기

### 대조 리포트 5탭
- BrandReportCompare / HQ / Logistics / Staff / Mismatch

### 재고·물류 7서브탭
- BrandInventoryStock / Lots / Scan / QR / Close / Staff / Emergency

### qrcode + @zxing 의존성 추가
- package.json 커밋 누락으로 Vercel 빌드 실패
- e82e7fc 커밋으로 의존성 추가 → 전체 해결

### Supabase Seoul 리전 이전
- Sydney(ap-southeast-2) → Seoul(ap-northeast-2)
- 지연 ~200ms → ~30ms 개선

### 파트너십 제안서 v5 완성
- AURAN_Partnership_Proposal_v5.docx
- 시바산 지분 취득 (협상 예정)
- 영업이익 40% 공유 (기준 50억 초과분)
- 월 이용료: 파일럿 무료 → 500/700/1200만원
