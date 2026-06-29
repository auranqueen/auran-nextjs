# AURAN 변경 이력 (CHANGELOG)
> 최신순 정렬. 작업 완료 시마다 업데이트할 것.

---

## 2026-06-28

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
