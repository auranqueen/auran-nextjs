# AURAN 변경 이력 (CHANGELOG)
> 최신순 정렬. 작업 완료 시마다 업데이트할 것.

---

## 2026-07-03

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
