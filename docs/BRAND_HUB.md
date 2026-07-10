# AURAN Brand Hub 기능 문서
작성일: 2026-06

## 1. 개요

Brand Hub는 브랜드사(예: 시바산/CIVASAN)가 AURAN 플랫폼을 통해
발주/재고/마케팅/원장님 소통을 관리하는 전용 어드민 콘솔입니다.

접속 구조:
auran.kr/brand/[slug] → 로그인 → PIN 게이트 → Brand Hub 대시보드
auran.kr/logi/[slug] → 로그인 → PIN 게이트 → 물류 허브 대시보드

현재 파트너사: 시바산 (civasan) — auran.kr/brand/civasan

브랜드사 등록 방식:
AURAN이 직접 등록 (입점 신청 폼 없음)
→ docs/DEPLOY.md 섹션 5 참고
→ SQL 3줄 실행 후 접속 정보 전달

## 2. 로그인 구조

brands 테이블:
slug: civasan
login_role: ceo / director (대표/이사 구분)
user_id: Supabase auth.users.id 연결

로그인 흐름:
1. /brand/[slug] 접속
2. 아이디 입력 (예: civasan → civasan@auran.kr 자동 변환)
3. 비밀번호 입력
4. Supabase Auth signInWithPassword
5. brands.user_id 일치 확인
6. /dashboard/brand?login_role=[ceo/director] 이동
7. PIN 게이트 (BrandPinGate.tsx)
8. 담당자 선택 → PIN 입력 → 대시보드 진입

login_role별 차이:
ceo — 정산 탭 표시 + 통합 허브 전환 가능
director — 정산 탭 숨김 + 통합 허브 전환 가능

## 3. Brand Hub 탭 구성 (15탭)

홈 (home)
- 대시보드 KPI (연결 원장님 수, 제품 수, 활성 제품 수)
- 유통기한 소진 관리 배너 (D-330 이내 자동 표시)
- 소진 단계별 색상 구분
- "소진 마케팅 기획하러 가기" CTA

제품 관리 (products)
- 제품 목록 (active/inactive/deleted)
- 신제품 등록 (BrandProductFormV2 — Tiptap 에디터)
- 드래그앤드롭 이미지 관리
- 호르몬 타이밍/피부고민/피부타입 태그

원장님 관리 (owners)
- 거래 원장님 목록
- 등급별 필터
- 발주 현황 연동
- **제휴 원장 초대** (2026-07-10)
  - 초대 링크: `{origin}/signup/owner-v2?brand_id={brands.id}` 클립보드 복사
  - 신규 원장 자동승인 토글: `brands.auto_approve_owner_invite` (ON이면 가입 시 `brand_owner_links.status=active`)
  - 제휴 연결 목록: `brand_owner_links` 조회 (이름/이메일, status 뱃지)
  - status=pending → 브랜드가 수동 "승인" (`active` + `approved_at`)
  - 오렌 지사 원장 추천(`users.referred_by`)과 별개 트랙

발주 (orders)
- 원장님 발주 목록
- 승인/반려 처리
- 운송장 입력/발송 처리
- 재고 자동 차감 (decrement_inventory_stock RPC)

오렌톡 (orentalk)
- 원장님 전체/개별 메시지 발송
- 브랜드 공지 관리
- 자동 발송 이력

교육라이브 (live)
- 브랜드 교육 영상 관리
- 원장님 대상 라이브 예정

샘플 (sample)
- 등급별 샘플 목록
- 샘플 발송 현황

커뮤니티 (community)
- 브랜드 공지 게시판
- 원장님 소통 채널

외연확장 (expand)
- 신규 원장님 모집
- 브랜드 홍보 기능

데이터 (data)
- 발주 통계
- 제품별 판매 현황
- 원장님 등급별 분석

주문내역서 (invoice)
- 발주 기반 자동 생성
- A4 PDF 출력
- 브랜드별 설정 저장 (invoice_settings)

재고·물류 (inventory) — 7개 서브탭
- 재고현황: 제품별 잔여 수량 + 안전재고 알림
- 로트관리: 입고 등록, 유통기한, D-day 표시
- 스캔입출고: ZXing 카메라 바코드/QR 스캔 + FIFO
- QR발행: 표준 QR 생성 + 라벨 출력
- 월마감: 실물 대조 + PDF
- 물류직원: PIN 등록, 역할별 권한
- 비상출고: 플랜B 비상 출고 + 본사 실시간 알림

대조리포트 (report) — 5개 서브탭
- 실시간 대조
- 본사 기록
- 물류 기록
- 담당자별 통계 + 야간 출고 감지
- 불일치 감지 + 소명 요청

반품·교환 (returns)
- 반품 신청 목록
- RTN 코드 발급
- 코드 스캔 수령 + 재고 반영/폐기

마케팅기획 (marketing) — 소진 마케팅
임박 재고 4단계:
🚨 D-30 이내 — 비상 처리
🔴 D-30~90 — 긴급 처리
🟡 D-90~180 — 본격 프로모션
🟠 D-180~330 — 소진 기획 시작 (11개월)
🟢 D-330 초과 — 정상

6가지 이벤트 유형:
⚡ 번개 특가 — 24시간 한정 증정
⭐ 럭키 증정 — 추첨 서프라이즈
💜 웰컴 선물 — 30일 미발주 원장님
📝 피드백 리워드 — 후기 남기면 증정
🎁 샘플 배포 — 등급별 무료 발송
🎀 번들 구성 — 정상+임박 세트

이벤트 생성 시:
brand_messages INSERT + brand_posts 커뮤니티 공지 자동 등록
오렌톡 자동 발송

정산 (settlement) — CEO 전용
준비 중

## 4. 물류 허브 탭 구성 (6탭)

재고현황 — BrandInventoryStock
로트관리 — BrandInventoryLots
스캔입출고 — BrandInventoryScan
QR발행 — BrandInventoryQR
오늘출고 — BrandTabOrders
비상출고 — BrandInventoryEmergency

## 5. 통합 어드민 콘솔

CEO/이사 로그인 시 상단에 전환 버튼 표시:
🏢 Brand Hub | 🚛 물류 허브

Brand Hub 탭 클릭 → 기존 15탭
물류 허브 탭 클릭 → 물류 6탭 (같은 화면에서 전환)

물류팀장/물류직원은:
auran.kr/logi/[slug] 별도 접속
물류 기능만 사용 가능

## 6. 유통기한 소진 마케팅 자동화

brand_inventory_lots.expires_at 기준 매일 자동 체크
D-330 이하 로트 감지 시:
→ BrandTabHome 홈 배너 자동 표시
→ 마케팅기획 탭에서 단계별 구분 표시
→ "기분좋게 처리하기" 버튼으로 이벤트 생성

번들 구성 규칙:
정상 재고 위주 구성
D-90 이상 여유 있는 임박 로트는 선택적 포함 가능
D-30 미만 — 비추천 배지 표시

## 7. 관련 파일 경로

src/app/brand/[slug]/page.tsx — 브랜드사 로그인
src/app/logi/[slug]/page.tsx — 물류팀 로그인
src/app/dashboard/brand/page.tsx — Brand Hub 메인 (인증/라우팅)
src/app/dashboard/brand/components/BrandHubContent.tsx — 탭 네비 + 렌더링
src/app/dashboard/brand/components/BrandPinGate.tsx — PIN 게이트
src/app/dashboard/brand/components/BrandWatermark.tsx — 워터마크
src/app/dashboard/brand/tabs/ — 각 탭 컴포넌트 (30개+)
src/app/dashboard/logi/page.tsx — 물류 허브 메인

## 8. 주요 DB 테이블

brands — 브랜드사 정보 (slug, login_role, user_id, welcome_shown)
brand_staff — 직원 (role, pin, is_active, system_access)
brand_staff_permissions — 모듈별 권한
brand_access_logs — 접근 로그 (삭제 불가)
brand_pin_sessions — PIN 세션 (30분)
brand_inventory — 제품별 재고
brand_inventory_lots — 로트별 재고 (expires_at, remaining_qty, initial_qty)
brand_stock_logs — 재고 변동 로그
brand_orders — 발주
brand_messages — 오렌톡 메시지
brand_posts — 커뮤니티 공지
brand_returns — 반품 (RTN 코드)
brand_monthly_close — 월 마감
brand_samples — 샘플 목록
brand_inventory_check — 재고 실사
