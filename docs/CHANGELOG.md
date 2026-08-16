# AURAN 변경 이력 (CHANGELOG)
> 최신순 정렬. 작업 완료 시마다 업데이트할 것.

---


## 2026-08-16
### feat: 원장 발주내역 명세화면 전면개편
- 원장 발주내역탭을 명세형태로 전면 개편(OwnerOrderStatement.tsx 신규). 주문별 품목+발주합계+아레테/REWARD 사용액+실결제금액+적립예정 상세표시, 파우치 상태(트랙A brand_billing_invoices+트랙B hq_pouch_records 병합, 승인전/준비중/도착 3단계 원장친화 문구), 아레테/REWARD 잔여포인트 요약. "발송완료" 대신 "배송완료"로 수신자 관점 용어 통일. 공용UI상수는 brandOrdersUi.ts로 분리(순환import 방지). 탭카운트/명세 둘다 20건 통일, 반품·교환 버튼 콜백prop으로 복원

### feat: 등급파우치 트랙B(오렌몰) 통합
- 등급파우치 시스템에 트랙B(오렌몰) 통합 완료. 신규테이블 hq_pouch_records(company_id+owner_id+billing_month 유니크, 트랙A의 brand_billing_invoices 파우치컬럼과 동일구조지만 완전분리)로 트랙 격리 유지. BrandTabPouch.tsx에 aggregateTrackB() 추가 — hq_stock_orders를 당월(1일~말일) 결제완료/배송완료/구매확정 상태로 집계해 등급판정(트랙A와 동일 200/300/500만원 기준, calcPouchTier 공유). 승인대상 리스트/발송처리(BrandPouchFulfillmentList) 둘다 트랙A/B를 뱃지로 구분해 통합표시, 승인·발송 액션은 track별로 올바른 테이블에 분기 처리. pouch_tier_kits(파우치 구성)는 트랙 무관 공용 재사용. 마이그레이션 161.

## 2026-08-15
### feat: 물류허브에 등급파우치 발송처리 연동
- 물류허브 「발송 처리」에 등급파우치 섹션 추가(BrandPouchFulfillmentList.tsx 신규, BrandInventoryFulfillment.tsx에 통합). 승인된(pouch_status='approved') 청구서를 발송대기 목록으로 표시, 택배사/운송장번호 입력 후 발송완료시: 1)pouch_kit_snapshot의 각 제품 재고차감(decrement_inventory_stock RPC+brand_stock_logs, ref_type:'pouch') 2)brand_billing_invoices pouch_status='shipped'+추적정보 업데이트(중복발송 방지 가드) 3)원장 개인알림(brand_messages, target_owner_id). 마이그레이션 160(pouch_tracking_no/pouch_courier/pouch_shipped_at). 이걸로 등급파우치 트랙A 전체 파이프라인(구성설정→승인→발송) 완료

### feat: 등급파우치 서브탭 신규(구성설정+승인)
- 판매관리에 「등급파우치」 서브탭 신규 추가(BrandTabPouch.tsx). 본사가 등급구간(200/300/500)별 파우치 구성(제품+수량)을 사전 설정(pouch_tier_kits 신규테이블), 결제완료+파우치등급 확정된 청구서를 승인대상 리스트로 표시, 승인시 그 시점 구성을 pouch_kit_snapshot(jsonb)에 스냅샷 고정+pouch_status='approved'로 전환(brand_billing_invoices 컬럼 추가, 159번 마이그레이션). 중복승인 방지 가드 포함. 실제 발송(송장입력+재고차감+알림)은 물류허브 연동으로 다음 단계 진행 예정

### fix: REWARD결제분도 적립제외+아레테미사용시 적립0버그 수정
- 적립금(points_earned) 계산원칙 수정: 아레테뿐 아니라 REWARD로 결제한 부분도 적립기준에서 제외(실결제금액만 적립). apply-reward-points API 확장(earned_by_order 필드 신규수신, points_earned도 업데이트). 이벤트패키지 순서재설계 — apply-event-points가 이제 아레테 사용여부와 무관하게 항상 호출되도록 수정(기존엔 아레테를 안 쓰면 적립 계산 자체가 실행 안 되어 적립이 영구히 0으로 남는 버그였음). 일반카탈로그도 REWARD 사용시 실결제액 기준으로 points_earned 재계산 추가

### feat: 샘플파우치 구매액 파우치등급 산정에서 제외
- 파우치등급(calcPouchTier) 산정에 샘플파우치 구매액 제외 연동 완료. invoice/page.tsx+aggregateBrandBilling.ts 2곳에서 brand_products.is_sample_pouch=true 제품ID를 조회한 뒤, 주문 items에서 해당 라인금액(samplePouchAmount)을 pouchBasisAmount에서만 차감(청구액은 정상 그대로 유지). 이걸로 샘플파우치 증정시스템 1단계(제품등록+파우치등급 제외) 완료 — 남은 것은 청구서 안내표시 고도화와 일괄발송 처리(백로그)

### feat: 제품등록에 is_sample_pouch 체크박스 추가
- brand_products에 is_sample_pouch 컬럼 신설. 제품등록폼(BrandProductFormV2+BrandProductPriceSection)에 "샘플파우치" 체크박스 추가, buildSaveBody+save API row객체 전체 경로 반영(state→UI→payload→API→DB). edit모드 복원도 포함. 이 플래그로 나중에 월말 파우치등급 산정시 샘플파우치 구매액을 제외하는 연동에 사용 예정

### feat: 이벤트패키지 등급적립 추가(아레테결제분 제외)
- 이벤트패키지 주문에 등급별 적립(points_earned) 신규 추가, 단 아레테포인트로 결제한 금액은 적립기준에서 제외(실결제액 기준). apply-event-points API 확장(earned_by_order 필드로 points_used와 함께 points_earned도 같은 요청에서 업데이트). EventPackageSection에 회사별 등급(brand_owner_grades)+적립율(brand_grade_point_rates) 자체조회 추가, 등급정보 없는 회사는 적립 스킵. REWARD(apply-reward-points) 로직은 무수정

### feat: brand_grade_point_rates 컴퍼니화(brand_id→company_id) + 설정화면 재연결
- brand_grade_point_rates(등급별 발주 적립율)를 brand_id 기준에서 company_id 기준으로 전환("컴퍼니가 모든 걸 지배한다" 원칙 적용). DB: company_id 컬럼 추가+백필+중복정리+UNIQUE(company_id,grade)+RLS 5개 재작성. 코드: useBrandGradeRates 훅 시그니처 변경, BrandOrdersPromoSettings.tsx(고아컴포넌트였던 것을 재활용, 적립율 부분만 company_id화, 프로모션supply_promos는 brand_id 유지)를 BrandTabOrders.tsx에 재연결, 원장 발주화면(brand-orders/page.tsx) 미리보기+실제 적립계산(submitOrder) 전부 companyId 기준으로 전환

## 2026-08-14
### fix: 파우치등급 계산공식 3곳 통일(ARETE만 제외)
- 파우치등급(calcPouchTier) 계산공식을 화면(invoice/page.tsx)·SYNC_API(brand-billing-invoice/sync)·월말정산크론(aggregateBrandBilling.ts) 3곳 모두 통일: 기준액 = 발주총액 − 아레테사용액만(REWARD는 제외 안 함, 청구액 계산에만 반영). SYNC_API는 pouch_basis_amount 필드를 새로 받고 하위호환 폴백(없으면 total_amount 사용) 처리

### feat: 이벤트패키지에 REWARD 포인트 체크박스 추가
- EventPackageSection.tsx에 REWARD(일반적립금) 체크박스 병렬추가: rewardBalances state+useEffect(track='REWARD' 조회), finalAmount는 아레테 먼저 차감후 REWARD 순차차감(afterArete→rewardApplied), 팝업 UI는 아레테 체크박스 바로아래 REWARD 체크박스 배치(사용가능잔액 있을때만 노출). 주문성공후 apply-reward-points 추가 호출로 points_used_reward 기록. ARETE 관련 코드(조회/체크박스/apply-event-points)는 완전 무수정

### feat: 일반카탈로그 발주에 REWARD 포인트 사용 체크박스 추가
- 일반카탈로그 발주(brand-orders/page.tsx)에 REWARD(일반적립금) 체크박스 추가: brandCompanyMap을 state로 유지, 카트에 담긴 브랜드의 company_id별로 brand_points(track='REWARD') 잔액 조회, 팝업에 회사단위 사용가능 잔액 있을때만 체크박스 노출+최종결제금액 표시반영(popupFinalAfterReward). 서버전송 total_amount는 변경없음(amount_mismatch 방지, 표시/기록에만 REWARD 반영). 주문성공후 order_ids를 cartItems 인덱스로 매핑해 회사별 라인비율로 분배, apply-reward-points API로 points_used_reward 기록. ARETE(apply-event-points)는 완전 별개 경로로 무수정

### feat: REWARD 포인트 사용/정산 로직 추가(points_used_reward 분리)
- REWARD(일반적립금) 사용/정산 로직 추가: brand_orders/brand_billing_invoices에 points_used_reward 컬럼 신설(ARETE전용 points_used와 완전분리), apply-reward-points 신규API(apply-event-points와 동일골격, points_used_reward에 기록), aggregateBrandBilling.ts에 REWARD 델타차감 병렬블록 추가(track='REWARD' 잔액차감, 기존 ARETE track='ARETE' 차감로직 무수정). 청구액계산은 ARETE+REWARD 사용액 둘다 차감(rawTotal-points_used-points_used_reward)

### feat: 웹훅에 일반적립금(REWARD) 포인트 적립 로직 추가
- 웹훅(civasan/webhook/route.ts) kind==='invoice' 분기에 REWARD 포인트 적립 로직 추가: 월청구서 결제완료(unpaid→paid) 시 invoice.points_total만큼 brand_points(track='REWARD') 잔액 가산(select→있으면update/없으면insert). status='unpaid' 조건+update().select().maybeSingle() 조합으로 재호출시 자동 중복적립 방지. brand_points_track_check 제약에 'REWARD' 추가(DB마이그레이션 병행)

### feat: 원장 발주화면에 아레테 회원카드 신설(결제+제품꾸러미+포인트)
- 원장 발주화면(brand-orders)에 아레테 회원카드 신규추가(AreteMembershipCard.tsx): 100만원 정액결제(포인트차감불가, /api/payments/brand-self/civasan/arete/create 연동), 이번달 받을 제품꾸러미 표시(brand_arete_monthly_bundles, 정보성 — 별도 주문 불필요), 아레테 포인트 누적잔액(brand_points track='ARETE'). EventPackageSection 바로 아래 삽입. 8/13 승인된 목업v2 그대로 구현 완료. 비활성 회원/당월데이터 없으면 카드 자동숨김

### fix: 반품 승인/반려/수령 알림 개인지정 전환
- BrandReturnsList(승인/반려)·BrandReturnsReceive(수령) target_type:'all'→'selected'+target_owner_id 전환, order_id→brand_orders.profile_id 조회(폴백 requested_by)
- insertBrandOrder 발주접수 알림도 개인지정(target_owner_id)+본인 수신용 문구로 수정

### fix: 발송완료 알림 개인지정 전환(target_owner_id), 전체발송 버그 수정
- BrandBatchFulfillmentList 발송완료 알림 target_type:'all'→'selected'+target_owner_id 전환(brand_order_batches.profile_id 활용), profile_id 없는 구배치는 all 폴백

### feat: 매월3일 아레테청구서 자동생성+포인트재지급(크론+결제라우트+웹훅)
- 매월 3일 아레테클럽 청구서 자동생성 + 포인트 재지급 신규구축: brand_arete_invoices 테이블 신설(100만원 정액, 회사+원장+월 단위 UNIQUE), 크론(/api/cron/generate-arete-invoices, 매월3일 KST0시1분)이 활성 아레테회원 전원에게 청구서 생성+ARETE 포인트 50만점 누적지급(재실행 안전, 중복생성 방지). 100만원 전용 결제라우트(civasan/arete/create, 포인트차감 불가) + 웹훅 arete분기 신설. brand_payment_intents.kind에 'arete' 추가, invoice_id FK타입 불일치 문제 발견하여 별도 컬럼 arete_invoice_id 신설로 해결

## 2026-08-13
### refactor: 아레테포인트 track값 'B'→'ARETE' 이름변경(혼동방지)
- 아레테 포인트 라벨 명확화: brand_points.track의 'B' 값이 실제 플랫폼 트랙B(스폰서 커미션)와 이름이 같아 혼동을 유발해온 문제를 근본수정. CHECK제약에 'ARETE' 추가허용 후 기존 'B'행을 'ARETE'로 마이그레이션, 관련 코드 4곳(toggleArete/BrandTabArete/EventPackageSection/aggregateBrandBilling) 전부 'ARETE'로 통일

### feat: 월말정산 아레테 포인트 실차감(중복차감 방지 델타처리)
- aggregateBrandBilling.ts에 아레테 포인트 실차감 로직 추가: 월청구액 계산을 sum(total_amount)-sum(points_used)로 변경, brand_billing_invoices에 points_used 누적저장, brand_points 잔액은 이전값 대비 증가분(델타)만 차감하여 크론 재실행시 중복차감 방지. 이벤트패키지 구매→월말정산 차감까지 전 구간 연결 완료

### feat: 이벤트패키지 실제주문연동(브랜드그룹핑+할인재계산+points_used기록)
- 이벤트패키지(EventPackageSection) 실제 주문 연동 완료: brand_products select에 brand_id 추가, 제품을 브랜드별로 그룹핑해 기존 검증된 brand-order-batches/create API(submitOrderBatch)로 실제 발주 생성. 클라이언트에서도 resolveHqCampaignEffects로 HQ할인을 동일하게 재계산해 total_amount를 서버 재검증값과 정확히 일치시킴(할인형 이벤트 주문거부 방지). 신규 소형API(/api/brand-orders/apply-event-points)로 주문 성공 후 아레테 포인트 사용액(points_used)만 별도기록(total_amount는 원본 유지, 실제 잔액차감은 월말정산 단계에서 처리 예정)

### feat: 발주화면 이벤트패키지 섹션 신설(EventPackageSection)
- 원장 발주화면(brand-orders)에 "이번달 이벤트 패키지" 섹션 신규추가(EventPackageSection.tsx): HQ강제이벤트를 개별상품 나열이 아닌 하나의 패키지 상품처럼 표시(대표이미지+제목+합계금액), 3열그리드+더보기, 클릭시 상세시트(마케팅이미지+설명+포함구성 품목리스트+아레테포인트 선택결제). hqForcedCampaigns select/타입에 title/description/image_url/badge_text 추가(발주페이지+공용lib타입 양쪽). 등급뱃지 바로 아래 삽입, 일반카탈로그와 구분선으로 분리. 실제 발주insert/재고차감/포인트차감 연동은 다음 단계(현재는 UI+toast placeholder)

### feat: HQ이벤트 목록조회에 description/image_url 추가
- BrandHqCampaignSection.tsx 목록조회 select에 description/image_url 추가(Campaign 타입도 반영) — 원장쪽 이벤트 패키지 카드 표시를 위한 선행작업

### feat: 아레테클럽 전용탭 신설(번들구성/가이드업로드/회원포인트/해지)
- 아레테클럽 전용탭 신설(BrandTabArete.tsx, 사이드바 "제품·파트너" 그룹): 회원수 KPI, 이번달 번들 구성(제품검색+수량설정+저장, brand_arete_monthly_bundles), 프로그램 가이드 이미지 업로드(brand_arete_guide_images), 회원별 포인트 잔액 목록, 즉시 해지 버튼. 신규 마이그레이션 레포기록

## 2026-08-12
### refactor: 등급·이벤트 관리 탭 재구성(서브탭3개분리+라벨변경)
- 등급 패키지 관리 탭 재구성: SUBTABS를 3개로 분리(등급·가격/이벤트/발송오더), 기존에 등급·가격 서브탭 안에 섞여있던 BrandHqCampaignSection(HQ강제이벤트)을 "이벤트" 서브탭으로 분리 이동. 사이드바 라벨도 "등급 패키지 관리" → "등급·이벤트 관리"로 변경(실제 내용과 이름 불일치 해소)

### feat: 아레테클럽 company_id 전면전환(포인트/멤버십/대상필터/뱃지)
- 아레테클럽 관련 데이터를 브랜드단위→컴퍼니단위로 전면 전환: brand_points/brand_arete_members에 company_id 컬럼 추가+백필+유니크제약(151번 마이그레이션 레포기록). toggleArete(BrandTabOwners), 아레테 대상필터(BrandTabLive/BrandTabSample), 살롱페이지 뱃지표시(salons/[id]) 전부 company_id 기준으로 전환 — 형제브랜드 전체에 아레테 멤버십/포인트/뱃지가 일관되게 적용됨

### fix: 미납청구 발주차단을 company_id 기준으로 수정(brand_id 미스매치 버그)
- insertBrandOrder.ts의 미납청구 발주차단 로직 버그수정: 청구서(brand_billing_invoices)는 company_id 기준으로 저장되는데 차단조회는 brand_id 기준이라 매칭 실패로 차단이 안 걸릴 수 있던 문제 — brands.company_id 조회 후 company_id 기준으로 필터하도록 수정

### fix: BrandInventoryMarketing 무한로딩 근본수정(companyBrandIds 전환)
- BrandInventoryMarketing 무한로딩 근본수정: "전체" 브랜드 선택시(effectiveBrandId=null) 조회가 조용히 멈춰 로딩스피너에 갇히던 문제를 companyBrandIds 기준 .in() 조회로 전환하여 해결. 발송(brand_messages/brand_posts insert)은 기존처럼 허브 brandId 단일귀속 유지(전체선택시 발송버튼 비활성 — 의도된 동작)

### fix: 홈 대시보드 카드 목적지 버그 2건(번들구성/프로모션이벤트)
- BrandTabHome 대시보드 카드 목적지 버그 수정 2건: (1) "아레테클럽 번들 구성하기"가 재고물류 기본서브탭(재고현황)에만 가던 것을 마케팅자료→번들구성까지 자동이동(initialSub 'marketing:bundle' 배선, BrandTabInventory/BrandInventoryMarketing/BrandHubContent 수정) (2) "이달 프로모션 이벤트"가 이벤트·라이브 탭으로 잘못 가던 것을 등급패키지관리(HQ캠페인 실제화면)로 수정

### fix: is_gift cutoff 안내문구 실제 코드 반영(이전 누락분 정정)
- 일일마감 화면에 IS_GIFT_CUTOFF('2026-08-11') 안내문구 실제 코드 반영 완료 — 조회기간 시작일이 그 이전이면 "판매/증정 구분 안 됨" 안내가 재고부족 상세 블록 위에 표시됨(이전 커밋 메시지에만 언급되고 실제 코드엔 누락됐던 것을 재작업하여 정정)

### feat: 일일마감 확인 실저장(brand_daily_close) + is_gift cutoff 안내문구
- 일일마감 화면 리스크 2건 해결: (1) brand_daily_close 테이블 신규(150번 마이그레이션) — "오늘 마감 확인" 버튼이 alert만 띄우던 것을 확인자이름 입력+실제 DB저장으로 변경, 이미 확인된 날짜는 확인자·시각 표시로 전환 (2) 조회기간이 2026-08-11 이전을 포함하면 "판매/증정 구분 안 됨" 안내문구 조건부 표시(IS_GIFT_CUTOFF 상수) — 신규 온보딩 회사는 해당 없음

### feat: 일일마감/재고현황 화면 신설
- 신규 BrandInventoryDailyClose.tsx — 재고물류 탭에 "일일마감" 서브탭 추가. 일/월/년 기간전환, 트랙(전체/A/B) 필터, 제품별 판매·증정·잔여재고·기간대비 표시(많이남은순/적게남은순 정렬), 행 클릭시 원장별 기간누적 내역 펼침(트랙A는 brand_orders, 트랙B는 hq_stock_order_lines→hq_stock_orders 경로로 원장 조인), 재고부족 카드 클릭시 부족제품 세부목록, 인쇄 지원. "전체" 브랜드 선택시 멈추던 버그 수정(부모 companyBrandIds prop 직접사용)

## 2026-08-11
### feat: 재고출고 로그 판매/증정 분리기록(is_gift) + 중복방지 로직 수정
- brand_stock_logs에 is_gift(boolean) 컬럼 추가. 재고출고 로그를 판매분/증정분 2줄로 분리기록하도록 트랙A(BrandBatchFulfillmentList)/트랙B(BrandInventoryFulfillment) 수정 — RPC 차감은 기존처럼 qty+bonus 합계 1회, 로그만 판매분(is_gift:false)/증정분(is_gift:true) 체이닝. alreadyLogged 중복방지 체크를 .maybeSingle()에서 .limit(1)로 변경(2행 로그 대응)

### fix: middleware.ts /dashboard/logi 강제라우팅 예외처리 (물류대시보드 접근 버그 근본수정)
- 물류대시보드(/dashboard/logi) 접근 버그 근본원인 수정: middleware.ts의 role기반 대시보드 강제라우팅이 /dashboard/logi에 대한 예외가 없어 brand/admin role 전부 /dashboard/brand 또는 홈으로 강제 리다이렉트되던 문제. /dashboard/logi를 role 강제라우팅에서 예외처리(target 계산 직후, admin 홈 리다이렉트보다 먼저)하여 페이지 자체 인증로직(계정소유권/컴퍼니멤버십+PIN게이트)에 맡기도록 수정

### feat: 물류허브 접근을 사이드바로 이동 + 권한체계(logi_hub_access) 신설
- 물류허브 접근 UX 개편: BrandTabInventory의 "물류허브 열기" 버튼을 사이드바(브랜드명 옆)로 이동. 신규 권한모듈 logi_hub_access 추가, 노출조건은 isCEO(URL기반) || staffRole==='ceo'(PIN인증대표) || permissions.includes('logi_hub_access')(권한부여직원) || userRole==='admin'(플랫폼관리자). userRole prop을 page.tsx→BrandHubContent로 신규배선

### fix: monthly_skin_reports 키 컬럼 auth_id → user_id 정렬
- 크론 upsert(expire-coupons runMonthlySkinReportJob)와 마이페이지 조회를 DB 컬럼명 user_id에 맞게 변경(auth_id → user_id, onConflict 포함)

### feat: 물류role PIN인증시 물류허브 자동리다이렉트
- BrandPinGate에서 물류role(ops_manager/ops_staff) PIN인증 성공시 수동 안내화면 대신 router.replace(logiHref)로 물류허브(/dashboard/logi)에 자동 진입하도록 변경. opsBlocked UI는 전환 중 화면으로 유지

### fix: 재고매칭 실패시 무음스킵 대신 경고로그 기록(트랙A/B)
- BrandBatchFulfillmentList(A)/BrandInventoryFulfillment(B)의 재고차감 로직에서, product_id-재고 매칭 실패시 조용히 스킵되던 것을 brand_stock_logs(type:'adjust')에 경고 로그 남기도록 수정. 매칭실패 상황을 추적 가능하게 함

### docs: 신규 브랜드사(컴퍼니) 온보딩 체크리스트 추가 — 9단계(문서화) 완료
- docs/ONBOARDING_NEW_COMPANY.md 신설 — 신규 컴퍼니 온보딩 SQL+UI 혼합 체크리스트(회사생성→허브브랜드신청/승인→company_id연결→CEO PIN부트스트랩→로고/PayApp→형제브랜드), 컴퍼니기준 근본수정 프로젝트 9단계(문서화) 완료로 전체 프로젝트 마무리

### feat: 원장님현황(Owners) 컴퍼니통합 완성 - OwnersBrandWrapper 제거
- OwnersBrandWrapper.tsx 제거: BrandHubContent에서 BrandTabOwners를 허브 brandId로 직접 렌더링하도록 변경(TabBrandSelector 간접경유 제거). 다른 탭들과 렌더 패턴 통일. orphan 파일 삭제

### feat: Expand 컴퍼니 통합 + 메뉴숨김
- BrandTabExpand에서 TabBrandSelector 제거, 허브 brandId로 브랜드명 표시(데이터는 그대로 플레이스홀더). "입점 확장" 메뉴항목을 네비게이션에서 임시숨김(주석처리, 실제 기능 고도화/삭제 여부는 추후 결정)

### feat: Invoice 셀렉터 제거(허브 brandId 사용)
- BrandTabInvoice에서 TabBrandSelector 제거, 허브 brandId를 직접 사용하도록 변경. 데이터구조(브랜드별 invoice_settings/로고, 회사 로고)는 미변경

### feat: Returns 컴퍼니 통합(TabBrandSelector 제거)
- Returns(반품) 컴퍼니 통합: BrandTabReturns에서 TabBrandSelector 제거, resolveCompanyBrandIds로 companyBrandIds 생성해 List/Receive에 전달. 목록/수령대기 조회를 companyBrandIds 전체(.in)로 확장, 승인/수령 처리는 hub brandId 유지

## 2026-08-10
### feat: Owners 컴퍼니 통합(링크/현황/등급) + 149 마이그레이션 레포기록
- BrandTabOwners 컴퍼니 통합 — 링크목록/원장현황 조회를 companyBrandIds 전체로 확장(owner dedupe 포함), 수기등급을 company_id+origin_track='A'+payment_status='paid'로 통합해 결제등급과 동일한 자리에 저장(onConflict company_id,owner_id,origin_track), 149번 백필로 구버전 수기행 이관

### feat: 트랙B 원장도 브랜드 커뮤니티 열람 가능(getOwnerLinkedBrandIds 확장)
- getOwnerLinkedBrandIds에 트랙B 경로 추가: brand_owner_grades(origin_track='B', payment_status='paid')로 company_id 확인 후 그 회사 brands.id 전체를 A links와 합집합 반환. 커뮤니티/홈피드 등 이 헬퍼 호출처 전체가 별도수정 없이 트랙B 원장도 형제브랜드 콘텐츠를 볼 수 있게 됨

### feat: Sample 컴퍼니 통합(TabBrandSelector 제거)
- BrandTabSample 컴퍼니 통합: TabBrandSelector 제거, 샘플목록·발송이력 조회를 companyBrandIds 전체(.in)로 확장, 등록/발송대상선정/발송은 허브 brandId 유지. BrandTabSales에도 brandId prop 배선

### feat: Community 컴퍼니 통합(TabBrandSelector 제거)
- BrandTabCommunity 컴퍼니 통합: TabBrandSelector 제거, 게시글 조회를 resolveCompanyBrandIds 기반 companyBrandIds 전체로 확장(.in), 작성은 허브 brandId로 귀속

## 2026-08-09
### feat: 정산배치 이력(번호/기간/세부보기/출력) 전체 구현
- hq_settlement_batches(142) + settle_monthly_sponsor_commission RPC(143) 추가: 월정산 실행시 정산번호(batch_seq)+기간 스냅샷 생성, ledger.batch_id로 연결, 원자적 트랜잭션 처리
- 스폰서 커미션 섹션에 "최근 정산이력" 목록 추가: 회차별 클릭시 세부내역(profiles.full_name 조인) 펼침, 로딩/빈결과 상태 분리
- 세부보기에 CSV 다운로드 + 인쇄 기능 추가(실명 반영)

### feat: 스폰서커미션 월정산 배치 + 미리보기/확인창
- hq_commission_ledger 월정산 배치(settleMonthlyBatch) 추가: 전월 1일~말일 pending→paid 일괄처리, 기존 원장별 개별 정산과 별개 버튼으로 분리
- 실행 전 대상 건수/합계 미리보기 + window.confirm 확인창 추가, 0건이면 확인창 없이 안내만
- 재클릭시 이미 paid인 건은 자동으로 제외됨(중복지급 방지)

### feat: 회차별 정산 인프라 + 관리권 피커 + 리뷰게이트 전체 구현
- 139: purchase_session_usages 테이블 신설(회차소진 이력+회차별 정산), RLS(customer/owner/admin 분리)
- BookingManagePage: booking.purchase_id 우선매칭 도입(완료/취소/honey 3곳), 회차별 이력 insert + 마지막회차 잔액 몰아주기
- salons/[id]: 예약모달에 보유 관리권 피커 추가(step1), 선택시 결제(step2) 생략하고 step3 이동, 시술 재선택시 purchaseId 초기화
- 140: reviews.booking_id/owner_reply/replied_at 추가, insert게이트(본인의 완료된 booking만), owner_reply 전용 UPDATE 트리거
- 141: reviews.service_tags 추가(현재 미사용 — helpful_concerns로 대체 확정)
- 신규 페이지 /dashboard/owner/reviews: 관리권 리뷰(목록+답글)/제품 리뷰(목록) 탭, 적립토스트 표시, 퀵메뉴 연결
- ServiceReviewForm: booking_id 쿼리파라미터+insert 반영
- my/reviews: 완료예약(리뷰미작성) 목록 추가, "관리 후기 작성하기" 실제 작성진입으로 교체, 탭전환시 재조회

## 2026-08-08
### feat: /admin/track-b-system 스폰서 정산에 건별(ledger_id) 체크박스 선택 지급 추가 — 문제있는 건은 체크 해제하고 나머지만 부분지급 가능. 상세 미펼침 시 기존처럼 스폰서 전체 pending 일괄 처리 유지

### feat: profiles.owner_bank_name/owner_bank_account/owner_bank_holder 컬럼 추가, store-decoration "꾸미기" 탭에 정산 송금계좌 등록 CARD 신설(트랙A/B 공용, handleSave와 독립적인 별도 저장)

### fix: hq_stock_orders 결제취소 시 관련 hq_commission_ledger(pending 상태)도 함께 취소 처리(handleHqStockOrderCancel)

### feat: /admin/settlement 제목을 "오렌몰 정산 일괄 처리"로 변경(track-b-system과 명확히 구분). /admin/track-b-system 스폰서 커미션 목록에 상세보기 드릴다운 추가 — 구매자별 제품/수량/적용요율 확인 가능

### feat: 트랙B 발송화면(BrandInventoryFulfillment)을 hq_stock_order_lines 기반 체크박스 발송으로 재작성 — 트랙A와 동일 패턴. 부분발송 시 부모 status를 '배송중'으로 정확히 반영. hq_stock_order_lines RLS를 company_id 기준으로 단순화(형제브랜드 라인 누락 문제 해결)

### feat: 트랙B(hq-stock-orders) 다중브랜드 지원 완성 — 단일브랜드 제한 삭제, company_id+lines 구조로 제출, create API 재작성(등급필터 서버재검증 포함), hq_stock_order_lines 자식테이블 도입, PayApp 웹훅이 부모+자식 상태 동기화

### feat: 트랙B 재구매 다중브랜드 지원을 위한 스키마 추가 — hq_stock_orders.company_id 컬럼, hq_stock_order_lines 자식테이블(브랜드별 items/송장 개별관리) 신설. RLS 적용

## 2026-08-07
### feat: brand-order-batches/create API 서버재검증에 원장 등급 조회+캠페인 등급필터 추가 — API 직접호출로 등급 우회하는 것도 서버단에서 차단

### feat: hq_forced_campaigns에 target_grades(등급 타겟팅) 추가 — 관리화면에서 전체/등급선택 가능, 트랙A/B 원장화면 조회쿼리에서 본인 등급 필터 적용(다른 등급 이벤트 절대 노출 안 됨)

### feat: 트랙B(hq-stock-orders)에도 HQ증정라인을 items에 반영 — 트랙A와 동일 원칙 적용, 단일브랜드 발주라 브랜드 분배 없이 giftLines 전체 병합

### feat: HQ 강제이벤트 증정라인을 brand_orders.items에 실제 반영 — 증정품 SKU를 products.brand_id 우선, 없으면 캠페인 target_product_ids와 카트 교집합으로 브랜드에 배정. total_qty에 증정수량 포함

### feat: brand-order-batches/create API에 서버 재검증 추가 — 전체 카트(모든 브랜드) 기준 HQ캠페인 할인 재계산해서 클라이언트 total_amount와 대조, 10원 초과 불일치시 amount_mismatch로 거부. 트랙A/B 둘 다 서버 재검증 완료

## 2026-08-06
### feat: 살롱스토어 원장 발송화면(brand-retail-orders)을 checkout_batch_id 기준 배치카드로 재설계 — 브랜드사→원장 발송과 동일한 체크박스 개별/일괄지정 방식 적용(배송 3구간 중 ②구간)

### feat: 물류 발송처리에 브랜드주문 단위 개별/일괄 배송장 지정 기능 추가 — 이미 발송된 건은 발송완료 표시로 고정, 체크박스 미선택시 잔여 미발송분 전체 일괄발송, 선택시 선택건만 발송. 기본 통합발송 원칙 유지하면서 부분발송/잔여처리 대응

### feat: hq-stock-orders/create API에 서버 재검증 추가 — 클라이언트가 보낸 할인금액을 서버가 활성 캠페인 재조회+재계산해서 대조, 10원 초과 불일치시 거부(amount_mismatch)

### feat: 트랙B(hq-stock-orders)에도 HQ캠페인 할인/증정 화면표시 + 실제 결제금액(final_amount) 반영 — 트랙A와 동일 수준으로 맞춤(브랜드사 이벤트는 A/B 공용 원칙)

### fix: HQ캠페인 할인 계산을 브랜드별 분리계산에서 전체카트 기준 1회계산+브랜드별 비례배분으로 전환 — 브랜드 경계를 넘는 캠페인(예: 시바산그룹+씨아클라르제 제품 합산조건)이 정확히 인식되도록 수정

## 2026-08-04
### feat: resolveHqCampaignEffects 전면 재작성(tier별 할인/확정가/증정 자유조합, campaign_type 분기 제거). 트랙A(brand-orders) 팝업에 캠페인 할인/증정 표시 연결. 트랙B(hq-stock-orders)에도 동일 패턴으로 HQ캠페인 로드+계산 연결 (A/B 공용 메커니즘 재사용)

### fix: 구간 체크박스 라벨·강조문구 입력칸 색상을 보라색(#7B5EA7)으로 변경 — 다크배경 대비 문제 해결

### fix: 이전 커밋에서 rebase 중 유실됐던 제품검색바(브랜드칩→검색입력) 변경 재적용

### feat: 본사강제이벤트 관리화면 대개편 — 구간(tier)별 할인/확정가/증정 자유조합 가능, 증정품 복수 가능, 구간별 강조문구, 이미지업로드(세로권장), 상세설명 추가. 제품검색바로 브랜드칩 대체

## 2026-08-03
### fix: 13개 테이블 RLS 정책 buggy user_id=auth.uid() 단독비교 수정(컴퍼니기준 근본수정 6단계) — current_user_id() 폴백 추가로 형제브랜드/팀원 접근 정상화

### fix: tier-kit-items/tier-orders/tier-promo-rules/tier-packages/tier-catalog-toggle 8개 API의 assertCompanyAccess에서 형제브랜드 다중소속 시 .maybeSingle() 다중행 에러로 forbidden 오탐 발생하던 버그 일괄 수정(.limit(1)+length체크로 전환) — hq-campaigns와 동일 패턴

### fix: hq-campaigns save/delete의 assertCompanyAccess에서 brand_members 조회가 형제브랜드 여러개일 때 .maybeSingle() 에러로 forbidden_company 오탐 발생하던 버그 수정(.limit(1)+length체크로 전환)

### feat: 오렌 어드민(role=admin) Brand Hub 진입 예외 — dashboard/brand/page.tsx 역할게이트에 admin 허용, PIN게이트를 admin이면 건너뛰게 처리 (마스터 접근 시도 중 중단됐으나 코드는 유지, 나중에 middleware까지 고치면 재개 가능)

### fix: 사이드바/헤더홈 클릭 시 이전 판매관리 서브탭(mainSub) 잔존 문제 수정 — 클릭 시 초기화하도록 처리

### feat: 관리자계정·판매관리 탭 신설 및 사이드바 재편
- feat: "관리자계정" 탭 신설(BrandTabAdminAccount.tsx) — 서브탭 3개(컴퍼니정보/관리자관리/판매정책 준수현황), 관리자관리에 기존 담당자관리(BrandInventoryStaff) 편입, 정산·운영 섹션에 배치
- feat: "판매관리" 탭 신설(BrandTabSales.tsx) — 서브탭 3개(발주관리/반품관리/샘플발송), 기존 발주/반품/샘플 개별항목 통합, 실시간 섹션에 배치
- fix: BrandTabHome.tsx의 onTabChange('orders'/'sample') 호출 3곳을 'sales'로 수정(판매관리 통합에 따른 끊어진 링크 수정)
- refactor: BrandHubContent.tsx SB_SECTIONS 재편 — 실시간(orders/sample 제거, sales 추가), 정산·운영(returns 제거, staff는 관리자계정으로 라벨변경)

### chore: BrandPinGate.tsx 미사용 형제브랜드 조회 데드코드 제거(company_id 직접매칭 전환 후 불필요해진 코드)
- `loadStaff`에서 brands/siblingBrands/`staffBrandIds` 우회 조회 블록 삭제 — `.eq('company_id', companyIdProp)`만 사용

### fix: dashboard/logi/page.tsx의 companyId 하드코딩(null) 제거, brands.company_id 실제 연결 (컴퍼니 지배원칙 근본수정 - 5단계 완료)
- 물류 허브 `loadBrand`에 `company_id` select + state → `BrandPinGate` 전달
- Brand Hub `page.tsx`/`BrandPinGate`: PIN 목록·권한·CEO 부트스트랩을 `company_id` 기준으로 전환

### feat: 담당자관리를 정산·운영 섹션으로 이동, BrandInventoryStaff/BrandStaffPermissions를 company_id 기준으로 전환 (컴퍼니 지배원칙 근본수정 2차 - 5단계)
- 사이드바 정산·운영에 `staff` 메인탭 추가, 재고·물류 하위탭에서 담당자 관리 제거
- `BrandHubContent`: `brandId`→`companyId` 조회 후 담당자 화면에 전달
- `BrandInventoryStaff` / `BrandStaffPermissions`: 조회·저장을 `company_id` 기준으로 전환

### feat: brand_staff/brand_staff_permissions company_id 컬럼 추가+백필, assertStaffPermission을 컴퍼니 기준으로 전환, hq-campaigns save/delete API에 담당자 권한검증 연결 (컴퍼니 지배원칙 근본수정 1차)
- `assertStaffPermission.ts` 신규: staff/권한을 `company_id`로 판정(CEO는 모듈 없이 통과)
- HQ 캠페인 save/delete: `staff_id` + `marketing_create` 권한 검사
- 프론트: `pinAuth.id` → staffId를 save/delete body까지 전달
- 전제: DB에 `brand_staff`/`brand_staff_permissions.company_id` 컬럼+백필이 이미 적용되어 있어야 함(이 커밋에는 마이그레이션 파일 없음)

## 2026-08-02
### fix: brand/[slug] 로그인 소유권 체크에 brand_members 팀원 예외 추가
- `brand/[slug]/page.tsx`: 소유자가 아니어도 `brand_members` 소속이거나 `users.role === 'admin'`이면 통과

### fix: brand/[slug] 로그인 소유권 체크에 admin 예외 추가(오렌 어드민 마스터 접근 3곳 중 마지막 지점)
- `brand/[slug]/page.tsx`: `data.user.id !== brand.user_id`여도 `users.role === 'admin'`이면 통과

### 임시 디버깅용 — HQ캠페인 로드 확인 console.log
- debug: `brand-orders/page.tsx`에 `[HQ캠페인 확인용]` 임시 console.log 추가 (확인 후 제거 예정)

## 2026-08-01
### HQ 강제이벤트 재구매 반영 진행 + brand_staff 최초등록 순환 수정
- feat: hq_forced_campaigns/hq_forced_campaign_tiers RLS 활성화 + company/owner select 정책 추가
- feat: hqForcedCampaignPromos.ts 신규 헬퍼(resolveHqCampaignEffects) 추가
- feat: 트랙A 재구매화면(brand-orders)에 HQ강제이벤트 로드 연결(useState/import/load() 조회)
- fix: BrandPinGate.tsx 담당자 0명(최초로그인) 시 순환구조 버그 — CEO 최초등록 폼 추가
- chore: BrandTabInventory.tsx 탭 라벨 "물류직원" → "담당자 관리"

## 2026-07-29
### 본사 강제이벤트 — 수량구간별 다단계 할인 지원(시바산 실제 마케팅 사례 기준)
- hq_forced_campaign_tiers 테이블 신규(campaign_id, min_qty, discount_pct, discount_amount) — 캠페인 하나에 "5개→35%할인, 10개→40%할인" 같은 여러 단계 등록 가능
- hq-campaigns/save/route.ts: tiers 배열 파싱+저장(delete 후 재삽입 방식)
- BrandHqCampaignSection.tsx: 수량별할인 유형 선택시 다단계 입력폼(단계 추가/삭제) 제공. 대상제품 여러개 선택시 "교차주문"(합산수량으로 단계판정) 안내 문구 추가
- 여전히 미착수: 원장 재구매 화면 자동반영, 배치승인API 가격재검증, 트랙B 승인단계 신설

## 2026-07-29
### 본사 강제이벤트 관리화면 신규 (1/2, 관리단계)
- hq-campaigns/save·delete API 신규(브랜드사 전용, company_id 기준, owner_id=null로 명시 저장 — 원장이 만드는 라이브프로모션과 같은 테이블 공유하되 owner_id로 완전 분리)
- BrandHqCampaignSection.tsx 신규: 등급 패키지관리 탭 [등급·가격] 서브탭 최상단에 배치(등급카드와 별개, 컴퍼니 전체 브랜드 대상). 오렌어드민 쿠폰기능(coupon_type='special_event')과는 별개의 브랜드 전용 시스템
- 다음 단계: 원장 재구매 화면(brand-orders/page.tsx, hq-stock-orders/page.tsx)에 이 이벤트 자동반영 + 트랙B 승인단계 신설

## 2026-07-29
### 재고물류 탭 전체통합뷰 — 누락분 커밋(2026-07-28 작업 마무리)
- BrandTabInventory.tsx: "전체" 브랜드+저재고배지 로딩, 서브탭 아이콘/라벨 정리, 전체선택시 액션형 서브탭(스캔/QR/로트관리 등)은 effectiveBrandId=null로 안전처리, 물류허브 열기는 특정브랜드 선택 필요하도록 안내, BrandInventoryStock에 companyBrandIds 전달 — 어제(7/28) 완성해놓고 실수로 커밋 안 됐던 파일, 오늘 발견해서 뒤늦게 반영

## 2026-07-29
### 라이브 프로모션 — 회원적용여부 원장토글 완성(3/3, 결제API)
- brand-product-orders/create/route.ts: apply_to_members 플래그를 gift/discount/bundle 전부에 통일 적용(isGiftTarget→giftCampaignFor로 캠페인 객체 자체 반환하도록 개선) — 화면과 결제 API가 이제 완전히 같은 기준으로 판정
- 라이브 프로모션 회원적용토글 3단계(저장→상품페이지 표시→결제API 재검증) 전부 완료

## 2026-07-29
### 라이브 프로모션 — 회원적용여부 원장토글(2/3, 상품페이지 표시단계)
- salons/[id]/products/[productId]/page.tsx: apply_to_members 플래그 기반 effectiveCampaign 계산 — 회원인데 apply_to_members가 false면 배지/할인가/장바구니 캠페인 전부 미적용, true면 회원에게도 전부 적용. 다음 단계: 결제API(create/route.ts)도 이 플래그 기준으로 재검증하도록 연결

## 2026-07-29
### 라이브 프로모션 — 회원적용 여부 원장 토글로 전환(1/3, 저장단계)
- hq_forced_campaigns에 apply_to_members 컬럼 추가, 저장API+원장 생성폼에 "회원(관리고객)에게도 적용" 토글 추가 — 기존엔 "할인만 회원제외, N+M/증정은 무조건 회원포함"으로 플랫폼이 하드코딩했던 걸, 원장이 캠페인별로 직접 정하는 방식으로 전환 시작
- 다음 단계: 상품페이지 표시+결제API 판정 로직을 이 플래그 기반으로 연결

## 2026-07-29
### 살롱스토어 배송처리 API — 트랙A 전용 제한 제거 (트랙B 완전정상화)
- brand-product-orders/[id]/update-status/route.ts: origin_track!=='A'면 무조건 403 거부하던 하드코딩 제거 — 트랙B 원장도 이제 자기 살롱 주문의 배송처리(배송중/배송완료) 가능해짐
- 상수명 TRACK_A_AUTO_CONFIRM_DAYS → SALON_AUTO_CONFIRM_DAYS로 정리(정책 자체는 A/B 동일, 이름만 정정)
- 이걸로 살롱스토어 결제(create) + 배송처리(update-status) 양쪽 다 트랙 무관하게 정상 작동 — 소유자 검증(salon.owner_id)은 그대로라 각자 자기 살롱 주문만 처리 가능

## 2026-07-29
### 살롱스토어 결제API — 트랙A 전용 제한 제거(A/B 공용 원칙 적용)
- brand-product-orders/create/route.ts: origin_track!=='A'면 무조건 403 거부하던 하드코딩 제거 — 트랙B 원장 스토어 고객도 결제 가능해짐(오늘 확정한 "살롱스토어는 A/B 공용" 원칙에 맞게 수정)
- 배송비 상수명 TRACK_A_* → SALON_*로 정리(정책 자체는 원래부터 A/B 동일해야 하는 게 맞아서 이름만 정정, 동작 변경 없음)
- 발견된 후속 이슈: update-status API(주문상태변경, 배송처리 등)도 동일하게 트랙A 전용 제한이 걸려있어 트랙B는 주문은 받아도 배송처리를 못 하는 상태 — 다음 커밋에서 수정 예정

## 2026-07-29
### 살롱스토어 — 원장 라이브 프로모션 실제 노출+결제 반영 (근본수정 포함)
- salons/[id]/products/[productId]/page.tsx: 원장의 활성 캠페인(hq_forced_campaigns) 조회해서 배지 표시, 할인가 반영, 증정품 정보(이름/썸네일) 함께 조회
- ProductDetailActions.tsx: 캠페인 유형별 장바구니 담기 로직(N+M 단가재계산, 증정품 별도 무료라인 추가)
- 🚨 근본수정: brand-product-orders/create/route.ts가 클라이언트가 보낸 가격을 무시하고 DB consumer_price로 재계산하던 구조라, 회원가(member_price)든 캠페인할인이든 실제 결제 시점엔 반영이 안 될 뻔했던 문제 발견+수정 — 이제 서버가 직접 회원여부(살롱별 주문이력)+활성캠페인을 재검증해서 가격 계산. N+M은 "완성된 세트만큼만" 무료수량 인정(장바구니 수량 조작 방어), 증정품은 대상제품 실구매(수량 1개 이상) 확인 후 최대 1개까지만 무료(수량 조작/단독주문 악용 방지). 캠페인 효과(할인/N+M/증정)는 일반가(비회원) 대상에만 적용, 회원가는 제외(어제 확정한 쿠폰 원칙과 동일 — 시바산 승인 전까지)

## 2026-07-29
### 라이브 프로모션 저장API 소유권 검증 추가
- owner/live-promotions/save/route.ts: id가 넘어온 경우(수정 시도) 기존 캠페인의 owner_id가 요청자 본인과 일치하는지 먼저 확인, 불일치시 403 반환 — 화면에는 수정기능이 아직 없어 실사용 경로는 없었지만, API 직접호출 시 타인 캠페인을 덮어쓸 수 있던 구멍을 사전에 차단

## 2026-07-29
### 원장 라이브 프로모션 — 브랜드 라이브 화면에 통합
- brand-live/page.tsx: 원장이 자기 스토어 제품에 이벤트(N+M증정/다른제품증정/%할인) 걸 수 있는 섹션 신규 추가 — 별도 페이지/퀵메뉴 만들지 않고 기존 "브랜드 라이브"(라이브방송 목록) 화면 안에 통합(관련 화면에 끼워넣기 원칙 적용)
- API 2개(owner/live-promotions/save, delete) 재사용, hq_forced_campaigns 테이블(owner_id로 본사강제/원장자율 구분)에 원장 본인 소유(owner_id=본인) 캠페인 CRUD
- 남은 것: 살롱스토어 제품페이지에 실제 배지/할인 노출 로직은 아직 미착수

## 2026-07-29
### 재입고 알림 — 안전재고 시스템 확장
- notifyRestockIfNeeded.ts 신규(공용 헬퍼): 증가 전 재고가 0 이하였을 때만 브랜드사 명의로 원장 전체에게 "🎉 재입고 완료" 알림(brand_messages 재사용, 안전재고 미달 알림과 동일 패턴)
- 재고 증가 3경로(BrandInventoryLots 롯트입고, BrandInventoryScan 스캔입고, BrandReturnsReceive 반품재입고) 전부 연결. Lots/Returns는 기존에 없던 "증가 전 재고" 조회를 새로 추가해서 정확한 감지 확보

## 2026-07-28
### 서브브랜드 소유권 정합성 — 컴퍼니 실제소유자로 통일
- 시바산그룹/씨아클라르제/보케르케어 3개 브랜드 소유권을 개인계정에서 시바산 전용 계정(civasangroup@auran.kr)으로 이전. 팀원(brand_members) 접근권한은 그대로 유지(brand_inventory_members RLS 정책 추가, 시바산그룹 brand_members 누락분 등록)
- createSecondBrand.ts: 새 서브브랜드 생성시 소유자를 "그때 로그인한 사람"이 아니라 "허브 브랜드의 실제 소유자"로 자동 상속하도록 수정 — 앞으로 누가 로그인해서 서브브랜드를 추가하든 항상 컴퍼니 실소유자로 통일됨(오늘 발견된 소유권 꼬임 재발 방지)

## 2026-07-28
### 재고물류 탭 — "전체" 통합뷰 완성 (재고표시 프로젝트 완료)
- BrandInventoryStock.tsx: brandId==='all'일 때 companyBrandIds 전체 조회+브랜드별 뱃지(BrandNameBadge) 표시. 제품 추가는 특정 브랜드 선택시에만 가능하도록 제한
- BrandTabInventory.tsx: 컴퍼니 전체 브랜드의 저재고 개수 집계→TabBrandSelector에 배지로 전달, "전체"가 기본 선택값. 액션형 서브탭(스캔/QR/로트관리 등)은 여전히 특정 브랜드 필요
- 오늘 시작한 재고표시+품절차단 프로젝트 전체 완료: 등급구매(A/B공용)+재구매(A/B)+재고물류 브랜드탭 "전체" 통합뷰까지 마무리

## 2026-07-28
### TabBrandSelector 공용컴포넌트 — 저재고배지+전체보기 옵션 추가
- TabBrandSelector.tsx: lowStockCounts(브랜드별 저재고 개수 배지)/showAllOption("전체" pill) 선택적 prop 추가 — 안 넘기면 기존 12개 호출부 전부 그대로 동작. 이제부터 재고물류/월별리포트/원장님현황 3곳에 순차 연결 예정

## 2026-07-28

### 재구매(트랙B) 재고표시 연동 완료 — 재고표시+품절차단 전체 완료
- hq-stock-orders/page.tsx: brand_inventory 배치조회+stockMap 추가, BrandOrderProductCard에 stock prop 전달
- 재고표시+품절차단 기능 완료: 등급구매(초도, A/B 공용 tier-cart)+재구매(A: brand-orders, B: hq-stock-orders) 전 구간 적용 완료. 새 컬럼/상태값 없이 brand_inventory 실시간 조회로 전부 처리, 재입고시 자동 원상복구

### 재구매(트랙A) 재고표시 연동 완료
- brand-orders/page.tsx: brand_inventory 배치조회+stockMap state 추가, BrandOrderProductCard에 stock prop 전달 — 트랙A 재구매 화면에서 재고표시+품절차단 실제 작동

### 재구매 제품카드 — 재고표시+품절차단 (A/B 공용)
- BrandOrderProductCard.tsx: stock prop 추가 — 재고 있으면 "재고 N개" 표시, 0이면 어둡게+"품절, 조금만 기다려주세요"+담기버튼 비활성화. 이 컴포넌트는 brand-orders(A)/hq-stock-orders(B) 양쪽에서 공유하므로 한 번 수정으로 트랙 양쪽 다 적용됨(아직 부모화면에서 stock 값을 실제로 넘겨주는 연동은 다음 단계)

### 등급구매 장바구니 — 실시간 재고표시+품절차단
- tier-cart/page.tsx: brand_inventory.available_stock 배치조회(IN절 1회, 개별조회 없음)로 재고 실시간 표시("재고 N개") + 재고 0 이하면 어둡게+"품절, 조금만 기다려주세요"+수량조절 비활성화. 새 컬럼/상태값 없이 기존 재고테이블 그대로 재사용. 재고관리 안 하는 제품(매칭행 없음)은 항상 구매가능 취급

### 등급 카탈로그 자유선택 정책 — is_tier_catalog 완전 제거
- tier-cart/page.tsx(원장 등급구매 장바구니 UI): is_tier_catalog 필터 제거 — 컴퍼니 소속 브랜드의 활성 제품 전체가 자유선택 가능
- 결제API(A/B)+원장UI 전 구간 status='active'+컴퍼니브랜드 기준으로 통일 완료. "포함하기 토글" 정책 마이그레이션 종료

### 등급구매 결제 API — is_tier_catalog 검증 제거(자유선택 정책)
- tier-cart-create/route.ts(A), cart-create/route.ts(B) 둘 다 is_tier_catalog 체크 제거 — 컴퍼니 소속 브랜드의 활성(status='active') 제품이면 등급구매 결제에 모두 포함 가능
- 남은 게이트: 원장 UI(tier-cart/page.tsx)의 is_tier_catalog 필터는 아직 남아있음 — 다음 커밋에서 제거 예정

### 등급 패키지관리 탭 — 카탈로그 서브탭 제거
- BrandTabTierPackages.tsx: [카탈로그] 서브탭 제거, [등급·가격]/[발송오더] 2탭으로 축소 — 제품등록=자동으로 재구매/등급구매 양쪽 다 노출되는 정책으로 바뀌면서 별도 설정화면 자체가 불필요해짐
- BrandTierCatalogSection.tsx는 더 이상 이 탭에서 사용 안 함(파일 자체는 정리 대상으로 남김)

### 등급 패키지관리 탭 — 서브탭 3분할
- BrandTabTierPackages.tsx: [등급·가격]/[카탈로그]/[발송오더] 서브탭으로 분리(로직 변경 없음, JSX 재구성만) — 카탈로그 제품 늘어나거나 발송오더 쌓여도 등급·가격 화면 스크롤 안 길어짐
- load useCallback 의존성에서 supabase 제거(오렌 절대규칙 재적용)

### 살롱스토어 — 관리고객 자동판정 + 회원가 노출, 리뷰 교차오염 수정
- brand_products.member_price 컬럼 신규 추가(살롱스토어 회원가)
- salons/[id]/products/[productId]/page.tsx: "이 살롱에서 결제완료/배송완료 이력이 있으면 회원"으로 자동판정(신규 테이블·토글 없이 brand_product_orders.salon_id 기준), 회원이면 member_price·아니면 consumer_price를 화면표시+장바구니+구매 전 구간에 일관되게 반영(displayPrice)
- 부수효과로 리뷰작성 자격 체크 버그 수정: 기존엔 salon_id 필터가 없어서 다른 살롱에서 산 사람도 리뷰 작성 가능했던 교차오염 문제 해결 — 이제 "이 살롱에서 산 경우"만 인정

### 브랜드허브 헤더 — 컴퍼니명 동적 표시로 전환
- page.tsx: switchBrand + load() 초기화 로직 모두, 헤더에 표시되는 이름을 브랜드 자체 이름에서 소속 컴퍼니 이름으로 조회해서 덮어쓰도록 수정 — 새 서브브랜드(보케르 등) 로그인해도 "시바산그룹"으로 일관되게 표시됨(볼라욘 등 다른 회사 붙여도 자동으로 그 회사명 표시되는 구조)

### 브랜드허브 PIN게이트 — 컴퍼니 단위로 전환
- BrandPinGate.tsx: 담당자 조회를 brand_id 단일값→소속 컴퍼니 전체 브랜드 목록 기준으로 전환. 새 서브브랜드 추가시 담당자가 0명이라 아무도 로그인 못 하던 잠금 문제 해결 — 같은 컴퍼니(예: 시바산그룹)에 등록된 담당자면 어느 서브브랜드(보케르 등)든 PIN으로 로그인 가능
- 남은 리스크(추후 확인): brand_staff_permissions/brand_pin_sessions는 여전히 brand_id 단위라 형제 브랜드에서 권한이 비어있을 수 있음 — 로그인 자체는 되니 급한 건 아님

### 트랙A 재구매 프로모션 — 기존 supply_promos에서 brand_tier_promo_rules로 전환
- brand-orders/page.tsx: 프로모션 데이터소스를 supply_promos(제품별, 등급명 문자열매칭)에서 brand_tier_promo_rules(브랜드별, 원장이 실제 보유한 tier_package_id 기준)로 전환. 기존 promosForBrandGrade 호출부 5곳은 안 건드리고, condition 필드에 실제 등급명을 채워서 기존 로직 그대로 재사용(최소범위 원칙)
- 이제 트랙A/B가 동일한 brand_tier_promo_rules를 공유 — 브랜드사가 등급패키지관리 탭에서 규칙 하나 등록하면 A/B 양쪽 재구매에 자동 반영됨
- BrandTabOrders.tsx: 발주관리 탭의 옛 프로모션 설정화면(BrandOrdersPromoSettings) 제거, 안내문구로 대체(등급패키지관리 탭으로 안내) — 이제 저장해도 반영 안 되는 죽은 화면이라 혼선 방지
- 남은 정리: BrandOrdersPromoSettings.tsx/supply_promos 관련 코드 자체 삭제는 추후(현재는 미사용 확정만)

### Supabase 클라이언트 싱글턴 전환 — 근본원인 수정
- src/lib/supabase/client.ts: createClient()가 모듈 레벨 캐시로 동일 인스턴스를 반환하도록 전환 — 기존엔 호출마다 새 인스턴스 생성되어, useEffect/useCallback 의존성 배열에 supabase가 들어간 코드베이스 전역 23곳이 잠재적으로 매 렌더마다 재실행될 위험이 있었음(오렌 작업 절대규칙 "supabase useEffect 의존성금지" 위반이 반복 발생했던 근본원인)
- 서버 전용 client(server.ts/admin.ts)는 요청 단위 생성이 맞아서 미변경, 브라우저 client.ts만 싱글턴화

### 등급 패키지관리 탭 — 무한 재조회 버그 수정
- BrandHubContent.tsx: brandOpts를 useMemo로 메모이제이션(매 렌더마다 새 배열 생성되던 것 수정)
- BrandTabTierPackages.tsx, BrandTierCatalogSection.tsx: useEffect/useCallback 의존성 배열에서 supabase 제거(오렌 작업 절대규칙 위반이었음 — createClient()가 매 렌더 새 인스턴스라 의존성에 넣으면 무한 재실행 유발)
- 증상: 새 브랜드 추가 모달에 타이핑할 때마다 등급패키지관리 탭이 brand_companies/brands/brand_products를 계속 재조회하던 문제 수정

### 트랙B 재구매 화면 — 프로모션 규칙 신규연동
- hq-stock-orders/page.tsx: brand_tier_promo_rules(A와 공유하는 등급×브랜드 보너스규칙)를 트랙B 재구매 화면에 신규 연동 — 원장 보유등급(company_id+origin_track='B') 조회→해당 등급의 브랜드별 규칙 매칭→buildOrderLineItem으로 보너스 자동계산. 기존엔 이 화면에 프로모션 로직 자체가 없었음(빈 배열 하드코딩)
- 발주 확정 시점(원장이 담아서 제출하는 순간)에 보너스가 확정되어 발주서에 포함 — 물류는 확정된 수량 그대로 발송(판단 없음) 원칙 적용

### 재고발주(재구매) 화면 — 등급조회 버그 수정
- brand-orders/page.tsx: 원장 보유등급 조회를 brand_id 기준→company_id+origin_track='A' 기준으로 수정 — 어제 등급구매를 company_id 단위로 전환하면서 이 화면이 여전히 brand_id로 등급을 찾다가 매번 못 찾아 기본값 "취급점"으로 떨어지던 버그(실제 프리미엄전문점 등 등급구매한 원장도 취급점 적립율/프로모션만 적용되던 심각한 문제) 수정

### 등급 패키지관리 탭 — 프로모션 규칙 UI 연결
- BrandTabTierPackages.tsx: BrandTierPromoRulesSection을 등급카드 펼침 안(가격저장~고정구성품 사이)에 연결(어제 API/컴포넌트는 커밋됐으나 이 연결 파일이 누락돼있던 것 마저 반영)

### 등급별 재구매 프로모션 규칙 — 브랜드단위로 재설계
- brand_tier_promo_rules: product_id→brand_id로 스키마 전환(제품 100개 단위가 아니라 브랜드 7개 단위로 단순화)
- tier-promo-rules/save·delete API, BrandTierPromoRulesSection.tsx 전부 brand_id 기준으로 재작성
- 정책 확정: 이 규칙은 등급구매(초도)가 아니라 재구매(재고발주) 발송처리시 원장 보유등급 기준으로 자동적용되는 것 — 다음 단계에서 BrandBatchFulfillmentList 발송처리에 연동 예정

### 등급별 프로모션 규칙 API
- tier-promo-rules/save/route.ts, delete/route.ts 신규 — brand_tier_promo_rules CRUD(등급×제품별 "N개 이상 주문시 +M개 보너스" 규칙), assertCompanyAccess 재사용

### 등급구매 재고차감 연동 (1/4)
- BrandTierOrderFulfillmentList.tsx: 발송완료 처리시 brand_tier_order_items 기준으로 brand_inventory 차감(product_id 우선매칭, 없으면 product_name 폴백), brand_stock_logs에 brand_id 포함해서 기록(ref_type='tier_order')
- 재고발주(BrandBatchFulfillmentList)와 동일 패턴 재사용 — 등급구매 카탈로그 발송도 재고발주처럼 발송완료 버튼 클릭 시점에만 재고 확정 차감

### 반품수령 화면 — 원장 신청사유/사진 연동
- BrandReturnsReceive.tsx 전체교체: 원장이 신청한 사유(reason_code)를 REASON_CONDITION_MAP으로 물류 수령상태에 자동매핑(불량·파손/배송중파손→파손·불량, 유통기한임박→유통기한 문제, 그외→정상), 물류담당자가 확인 후 필요시 변경 가능
- 원장이 첨부한 사진/상세사유(reason_detail, photos)를 수령화면에 표시, 대기목록에 사진개수 뱃지

### 반품·교환 신청시 사진첨부 기능
- brand-orders/page.tsx: 원장 반품/교환 신청 모달에 사진 업로드(최대 5장, brand-assets 스토리지) 추가, brand_returns.photos 컬럼에 저장(기존엔 빈 배열 하드코딩)

### 반품처리 재고오염 버그 수정
- BrandReturnsReceive.tsx 전체교체: 조건이 "정상"일 때만 "재고 반영" 선택 가능하도록 제한(파손·불량/유통기한문제/기타 선택시 재고반영 옵션 자체를 숨겨서 불량품이 정상재고로 섞여들어가는 사고 원천차단)
- 폐기 처리시 사유메모 필수 입력 + brand_stock_logs에 type='out', ref_type='dispose'로 반드시 기록 남기도록 수정(기존엔 폐기해도 로그가 전혀 안 남던 상태)

## 2026-07-27

### 등급 선택시 안내 모달 추가
- OwnerBrandSelfTierSection.tsx 전체교체: 등급 버튼 클릭시 바로 이동하지 않고 "자세히" 모달로 필요 결제금액+고정구성품(brand_tier_kit_items) 목록 먼저 안내, 확인 후 "담으러 가기"로 장바구니 이동

### 배송이력 화면 — 트랙B(hq_stock_orders) 통합 + 진입링크
- delivery-history/page.tsx: hq_stock_orders(트랙B 본사재고발주)를 세 번째 소스로 추가(이미 courier/tracking_no 컬럼 존재+물류처리+웹훅 자동추적 다 되어있던 상태 확인, 신규 SQL 불필요했음) — 재고발주 뱃지 하나로 트랙A/B 통합표시
- hq-stock-orders/page.tsx(트랙B), brand-orders/page.tsx(트랙A) 헤더에 "배송이력 보기" 링크 추가 — 배송이력 화면 진입경로 확보

### 원장 배송이력 화면 신규
- delivery-history/page.tsx 신규: 재고발주(brand_order_batches)+등급구매(brand_tier_orders) 통합 조회, 출처뱃지(재고발주/등급혜택) 구분, 운송장 표시, 전체/재고발주/등급혜택 필터

### 트랙A 원장홈 — "내가 모집한 원장님" 트랙B 전용으로 게이트
- OwnerHomeV3.tsx: 모집원장 카드를 profile.origin_track==='B'일 때만 렌더(A는 원장모집 개념 자체가 없어서 완전 무관 — 착각 방지)
- page.tsx: recruitedOwners 조회도 트랙B일 때만 실행(A는 쿼리 자체 스킵)

### 트랙B 등급 장바구니 결제 API
- cart-create/route.ts 신규(brand-tier 하위): 카탈로그(brand_products.is_tier_catalog, A와 공유) 검증+합계계산, 결제intent의 target_id에 검증된 라인아이템 포함해서 저장, 결제는 오렌 공용 PayApp env 그대로 사용
- brandTierPurchase.ts: TierTarget에 items 필드 추가, 웹훅에서 결제완료시 brand_tier_order_items도 함께 insert

### 트랙B 뱃지구매 컴퍼니전환 완료 (3/3)
- brandTierPurchase.ts 전체교체: target payload company_id 기준 파싱, brand_owner_grades upsert를 company_id+origin_track='B'+brand_id(하위호환용 anchor brand 이중기록)로 전환, 스폰서 조회도 company_id+origin_track='B' 기준
- 결제(오렌 공용 PayApp env)와 커미션율(brand_tier_packages.commission_rate, 오렌 전용 보호) 로직은 그대로 유지 — 건드리지 않음
- 트랙B 뱃지구매 컴퍼니전환 전체 완료: 원장화면(tierBadgeBrands)→결제요청(create route)→웹훅(brandTierPurchase.ts) 전 구간 company_id 기준 전환. 오늘 반영한 시바산 실제 등급금액(전문점1500만/프리미엄전문점3000만/메디슈티컬5000만)이 트랙B에도 자동 반영됨

### 트랙B 뱃지구매 컴퍼니전환 2/3
- brand-tier/create/route.ts 전체교체: brand_id+distribution_type join 방식→company_id 기준(tier_contract 자격은 해당 컴퍼니 소속 브랜드 중 하나라도 tier_contract면 인정), 자격증명/보유등급 조회 origin_track='B'로 스코프. 결제(오렌 공용 PayApp env)는 그대로 유지
- targetPayload를 brand_id→company_id로 변경(다음 단계에서 brandTierPurchase.ts 웹훅도 맞춰야 함, 아직 안 맞춰짐)

### 트랙B 뱃지구매 컴퍼니전환 1/3
- owner/page.tsx: tierBadgeBrands 조립 로직을 brand_id+distribution_type 필터에서 company_id 기준으로 전환(distribution_type='tier_contract' 브랜드의 소속 컴퍼니 찾아서 그 컴퍼니의 brand_tier_packages/brand_owner_grades(origin_track='B') 조회)

### brand_owner_grades A/B 트랙 분리 안전장치
- origin_track 컬럼 추가(company_id+owner_id+origin_track 유니크로 변경) — 같은 컴퍼니에서 A등급/B뱃지를 한 원장이 동시에 가질 수 있도록 공존 보장(향후 A원장이 B뱃지도 구매하는 시나리오 대비)
- tier-cart-create/route.ts, webhook/route.ts: brand_owner_grades upsert에 origin_track:'A' 반영
- civasan/create/route.ts는 카트방식 전환 후 미사용 상태로 확인(정리 대상, 이번엔 미수정)

### 물류허브 — 등급구매 발송처리 연동
- tier-orders/ship/route.ts 신규 — 승인된 등급주문에 운송장 등록(tracking_carrier/tracking_number/shipped_at)
- BrandTierOrderFulfillmentList.tsx 신규 — 재고발주(BrandBatchFulfillmentList)와 별도 컴포넌트로 분리, 스마트택배 자동웹훅(subscribeDelivery) 재사용
- BrandInventoryFulfillment.tsx: companyId state 추가(resolveCompanyBrands에서 함께 resolve), "등급혜택 · 발송대기" 섹션으로 통합 노출(트랙A 배치 섹션과 트랙B 사이)

### 발송오더 승인 화면
- tier-orders/approve/route.ts 신규 — 승인시 approved_at/approved_by 기록
- BrandTierOrderApprovalSection.tsx 신규 — 결제완료(status='paid') 등급구매 주문 목록, 원장명/트랙A·B뱃지/담은금액/품목수 표시, 승인대기·물류전달됨 구분, 등급 패키지관리 탭에 통합

### 등급 장바구니 결제 API + 웹훅 전환
- tier-cart-create/route.ts 신규: 장바구니 항목 검증(카탈로그귀속+활성상태+컴퍼니소속 확인), 합계가 등급 최소금액 이상인지 체크, brand_tier_orders+brand_tier_order_items 생성 후 컴퍼니 PayApp 결제요청
- webhook/route.ts 전체교체: 등급구매(tier) 검증방식을 정가-차액계산에서 brand_tier_orders 조회 방식으로 전환, 결제완료시 주문 status='paid' + 등급 활성화
- tier-cart/page.tsx: 체크아웃 필드명 catalog_product_id→product_id로 API와 통일

### 원장 등급 장바구니 화면 신규
- OwnerBrandSelfTierSection.tsx 대폭 단순화(421→134줄): 즉시결제/데모모달 로직 제거, "담으러 가기" 버튼으로 장바구니 페이지 이동만 담당
- tier-cart/page.tsx 신규(229줄): 카탈로그(검색+브랜드필터+체크+수량+실시간합계)+고정구성품(자동표시) 조회, 최소금액 미달시 결제버튼 비활성화

### 등급 카탈로그 설계 수정 — 제품 이중등록 방지
- ⚠️ 구조 재검토: brand_tier_catalog_items(신규 입력 테이블) 방식은 제품 이중등록 문제로 폐기, brand_products.is_tier_catalog 토글 방식으로 전환
- brand_products에 is_tier_catalog 컬럼 추가, 기존 tier-catalog-items API 2개 삭제, tier-catalog-toggle API 신규
- BrandTierCatalogSection.tsx 전체교체: 신규입력 폼 → 기존 등록제품 목록에서 토글 켜고끄기 방식으로 변경(검색+브랜드필터 유지)

### 등급 카탈로그 관리 화면
- BrandTierCatalogSection.tsx 신규: 등급 패키지관리 탭 안에서 제품/기기 카탈로그 등록(썸네일업로드+브랜드선택+종류+샵가+설명), 목록조회/수정/삭제
- BrandTabTierPackages.tsx에 통합(같은 탭 안에서 가격관리+구성품관리+카탈로그관리 다 됨)

### 등급 카탈로그(제품/기기) 관리 API
- tier-catalog-items/save/route.ts, tier-catalog-items/delete/route.ts 신규 — brand_tier_catalog_items CRUD, 서브브랜드 귀속(brand_id) 검증 포함

### 등급 패키지관리 탭 UX 정리
- BrandTabTierPackages.tsx: 브랜드선택(TabBrandSelector) 제거 — 컴퍼니 전체 설정화면이라 브랜드별 선택 UI가 혼란을 줬음, myBrands[0] 기준으로 컴퍼니 자동resolve로 전환

### 등급 패키지관리 탭 — 고정구성품 관리 UI 통합
- BrandTabTierPackages.tsx 전체교체(250→468줄): 등급 카드 펼침형으로 전환, 가격표시 "N원 이상"으로 문구변경, 고정구성품(부자재/인증패/진열장) 추가/수정/삭제 인라인 편집 UI 추가

### 등급 고정구성품(부자재/인증패/진열장) 관리 API
- tier-kit-items/save/route.ts, tier-kit-items/delete/route.ts 신규 — brand_tier_kit_items CRUD, 컴퍼니 소속확인(assertCompanyAccess) 재사용
- 신규 파일 UTF-16 인코딩 문제 발견/수정(UTF-8로 정규화)

### 등급구매(브랜드사컴퍼니 전용) 컴퍼니 전환 완료 (4/4)
- tier-packages/save/route.ts: brand_id 기준 접근권한 체크(brand_members/brands.user_id)를 컴퍼니 소속 브랜드 전체로 확장(assertCompanyAccess), company_id 기준 업데이트로 전환
- BrandTabTierPackages.tsx: 브랜드 선택은 유지하되 내부적으로 company_id resolve해서 회사 전체 등급 패키지(취급점/전문점/프리미엄전문점/메디슈티컬) 공통 관리
- 등급구매 컴퍼니전환 전체 완료: 화면(원장구매·브랜드사관리)→결제요청→웹훅검증→저장API까지 전 구간 브랜드단위→컴퍼니단위 전환

### 등급구매(브랜드사컴퍼니 전용) 컴퍼니 전환 1~3단계
- brand_tier_packages/brand_owner_grades에 company_id 컬럼 추가, 각각 UNIQUE(company_id,tier_name)/UNIQUE(company_id,owner_id) 제약 추가 (오렌지사 전용 등급뱃지 시스템의 기존 brand_id 기준 행과는 완전히 별개로 공존)
- 시바산 등급 4종 실제금액 반영: 취급점100만/전문점1500만/프리미엄전문점3000만/메디슈티컬5000만
- owner/page.tsx: BRAND_SELF_API를 브랜드슬러그 기준→컴퍼니ID 기준(BRAND_SELF_API_BY_COMPANY)으로 전환, selfTierBrands를 컴퍼니 단위로 조회
- civasan/create/route.ts, civasan/webhook/route.ts: 등급구매(tier) 로직 전체 company_id 기준으로 전환(청구서 결제와 동일한 방식)

### 세금계산서 탭 로고관리 + 사업자정보 확장
- brand_companies UPDATE RLS 정책 추가(brand_companies_owner_update, 소속 브랜드 소유자가 자기 회사 로고 수정 가능하도록) — Supabase에서 직접 실행 완료
- staffRole(PIN 직원role) 배선: page.tsx → BrandHubContent → BrandTabInvoice, ceo/director/manager만 로고관리 섹션 노출
- BrandTabInvoice.tsx: 서브브랜드 로고(brands.logo_url) + 회사전체 로고(brand_companies.logo_url) 업로드 UI 추가, invoice_settings에 상호(corp_name)/사업자등록번호(biz_no)/대표자명(ceo_name) 필드 추가

### 오렌어드민 "제휴 브랜드사 관리" 화면 신규
- src/app/admin/companies/page.tsx 신규 생성: brand_companies 목록(로고, PayApp 연동상태, 소속 브랜드 수) + 상세 모달(회사명/로고업로드/PayApp 3키 입력)
- AdminChrome.tsx 사이드바에 "제휴 브랜드사" 메뉴 추가(브랜드사 메뉴 바로 아래)

## 2026-07-26

### 정산/결제 원장통합 재설계 (묶음4/4, 완료)
- migration 131 생성(기록용, Supabase에서 이미 직접 실행됨): brand_billing_invoices/brand_payment_intents company_id 통합, brand_companies PayApp+로고 컬럼, 컴퍼니 기준 RLS SELECT 정책 2개 추가
- 정산통합 재설계 전체 완료: 청구서 계산(크론)→결제요청→웹훅검증→원장화면→브랜드사 정산탭까지 전 구간 브랜드 단위에서 컴퍼니 단위로 전환

### 정산/결제 원장통합 재설계 (묶음3/4)
- sync/route.ts: brand_id 파라미터 → company_id로 변경, onConflict를 company_id,owner_id,billing_month로 수정
- owner/brand-orders/invoice/page.tsx: CIVASAN_BRAND_ID는 진입점으로만 유지, 그 소속 company_id를 찾아 회사 전체 브랜드의 발주를 합산해서 보여주도록 변경
- BrandTabSettlement.tsx: 브랜드 선택은 기존 UI 유지, 선택된 브랜드의 company_id를 resolve해서 그 회사 전체 브랜드 기준으로 청구서/발주 조회하도록 변경 (⚠️ RLS 미수정 상태라 브랜드사 쪽 화면엔 아직 청구서 안 보일 수 있음 — 묶음4에서 해결 예정, 알려진 상태)

### 정산/결제 원장통합 재설계 (묶음2/4)
- invoice/create/route.ts: CIVASAN_BRAND_ID 하드코딩 제거, brand_billing_invoices.company_id 기준으로 brand_companies에서 PayApp 자격증명 조회하도록 전환
- webhook/route.ts: intent를 먼저 조회 후 kind별로 검증분기 — invoice(청구서결제)는 company_id 기준 brand_companies 자격증명, tier(등급구매)는 기존 CIVASAN 브랜드 자격증명 그대로 유지(범위밖, 변경없음)

### 정산/결제 원장통합 재설계 (묶음1/4)
- aggregateBrandBilling.ts: brandId 파라미터 → companyId로 변경, 컴퍼니 소속 전체 브랜드 orders 합산 방식으로 재작성
- cron/aggregate-brand-billing/route.ts: CIVASAN_BRAND_ID 하드코딩 제거, brand_companies 전체 순회 방식으로 변경

- **feat: 브랜드허브 company전체 통합 완료 + 월별리포트 뱃지 + 물류허브 링크**
  - `BrandTabHome.tsx`: 이달 판매액·처리대기·임박재고·활성원장·등록제품·최근주문·30일 선그래프를 company 소속 브랜드 합산으로 통일; 이달 판매액에 `N월 1일~M일` 기간 라벨; 처리대기 KPI에 트랙A(`pending`/`approved`)+트랙B(`결제완료`) 합산 및 `PendingOrdersDetail` 인라인 펼침; 선그래프는 `HomeSalesTrendChart`로 분리
  - `resolveCompanyBrandIds.ts` 신규: hub brand → company 소속 brand id 목록 공용 조회
  - `BrandTabReport` + 자식 5개: `.in('brand_id', companyBrandIds)` + `BrandNameBadge` (리스트/집계 행)
  - `BrandTabInventory.tsx`: 「🚚 물류허브 열기」→ `/dashboard/logi?slug=` 새 탭(단방향, logi PIN 유지); `BrandHubContent`에서 slug 전달
  - `resolveOwnerSalonNames.ts` 신규: profile→users→salons 이름 해석 공용화 (`MonthlyOrderAccordion`/`ShopOrderRanking`/`BrandShippedOrderReport` 재사용)
  - `BrandShippedOrderReport.tsx`: 트랙B(`hq_stock_orders` 배송완료/구매확정, `updated_at` 기준) 합산·CSV 트랙 컬럼 추가 (정산 탭 company화는 청구 금액 정합성 미확보로 보류)

- **feat: 발송완료 리포트 신규 - 기간/샵검색+미리보기+CSV**
  - `BrandShippedOrderReport.tsx` 신규: 발주관리에 "발송완료 리포트" 접이식 추가 — 기간검색(오늘/이번달/지난달/직접선택)+샵/원장 검색, 물류에서 실제 발송처리된(배송중/배송완료) 배치만 조회, 리스트+명세서 미리보기(iframe)+CSV출력, 대표 보고용

- **refactor: 명세서인쇄 물류전용으로 정리 + 원장님용 서명란 추가**
  - `BrandOrderBatchApproval.tsx`: "명세서 인쇄" 버튼 제거 (물류 발송처리 시점에서만 인쇄하는 게 맞음, 승인화면엔 불필요)
  - `/print/order-batch/[batchId]`: 원장님용(하단)에 "수령확인 서명" 란 추가 (기존 회사보관용 "출고담당자 서명"에 이어 양쪽 다 서명란 확보)

- **fix: hq_stock_orders 400에러 수정 + brand_orders RLS 확장 + 샵 발주랭킹 신규**
  - `BrandOrdersSummary.tsx`, `BrandInventoryFulfillment.tsx`: hq_stock_orders select에서 존재하지 않는 owner_name/salon_name 컬럼 제거(400에러 수정), profile_id 체인으로 대체
  - brand_orders RLS "brand can select own orders"에 brand_members 조건 추가 — 소유자 뿐 아니라 멀티브랜드 멤버도 형제 브랜드 배치 데이터 조회 가능하도록 수정
  - `MonthlyOrderAccordion.tsx`: batch_id 기준으로 여러 브랜드 섞인 발주를 한 줄로 그룹핑(브랜드뱃지 나열+금액합산+상품요약)
  - `ShopOrderRanking.tsx` 신규: 홈 대시보드에 이달 샵(원장)별 발주 랭킹 — 트랙A배치+트랙A레거시+트랙B 합산, 상위10 가로막대그래프+전체 스크롤리스트
## 2026-07-25

- **refactor: 세금계산서 탭 printInvoice 제거 및 A4명세서로 일원화**
  - `BrandTabInvoice.tsx`: printInvoice(구 주문내역서 출력) 및 "발주 선택" 탭 제거, invoice_settings(사업자정보) 설정 화면만 유지 — 팝빌 연동 전까지 대기 상태
  - `BrandOrderBatchApproval.tsx`: 배치카드에 "명세서 인쇄" 버튼 추가(승인 전/후 공통), `/print/order-batch/{batch.id}`로 연결
- **chore: 미사용 BrandTabData.tsx 삭제**
  - `BrandTabData.tsx` 삭제 (참조없음 확인, 기능은 이미 `BrandOrdersSummary`로 흡수됨)
- **fix: 물류발송 배치단위 재구성(샵기준 단일운송장) + 일일마감 company단위 확장**
  - `BrandBatchFulfillmentList.tsx` 신규: 물류 발송처리를 브랜드별이 아닌 주문번호(batch, 샵/원장 기준)로 재구성 — 운송장 1회 입력시 해당 batch의 모든 brand_orders(여러브랜드 라인) 일괄 shipping 처리, 재고는 브랜드별 개별차감, 웹훅구독 1회 (택배비 중복발생/배송분리 사고 방지)
  - `BrandInventoryFulfillment.tsx`: company 소속 전체 브랜드 범위로 배치리스트 연결, 트랙B(hq_stock_orders)는 기존 개별처리 유지
  - delivery-status 웹훅: 동일 운송장의 shipping 주문 전부 done 처리 + 관련 배치 배송완료 처리
  - `brand_logistics_daily_closings`에 company_id 컬럼 추가(migration 129), UNIQUE를 company_id+closing_date로 변경 — 일일마감/본사대조확인을 회사 전체 기준으로 확장
  - `BrandTabOrders.tsx`: 발주승인(BrandOrderBatchApproval)을 브랜드선택 게이트에서 제외, 페이지 진입시 항상 펼쳐진 상태로 표시(직원 즉시처리용), 프로모션설정만 브랜드선택 필요
- **feat: A4 발주명세서 인쇄 페이지 구축 + 물류 발송처리 연결**
  - `/dashboard/brand/print/order-batch/[batchId]` 신규: 건별 A4 발주명세서 인쇄 페이지, 절취선으로 회사보관용(상단)/원장님용(하단) 분리, 프로모션+증정품목명 표시, 출고담당자 수기서명란 포함, `@page A4` 인쇄 CSS
  - `BrandInventoryFulfillment.tsx`: `batch_id` 있는 발송건에 「명세서 인쇄」버튼 연결(새창으로 인쇄페이지 오픈)

- **feat: A4발주명세서 인쇄 + 물류 일일마감/본사대조확인 시스템**
  - A4 발주명세서 인쇄(`/dashboard/brand/print/order-batch/[batchId]`): 회사보관용/원장님용 절취선 분리, 물류 발송처리 화면에서 출력
  - `brand_logistics_daily_closings` 신규(migration `128_brand_logistics_daily_closings.sql`, RLS): 물류 「오늘 마감」버튼(`BrandLogisticsDailyClose.tsx`)으로 당일 발송건 스냅샷 제출(브랜드당 하루 1회, `submitted_by` 기록)
  - `BrandLogisticsClosingReview.tsx` 신규: 본사가 마감내역 조회+확인완료 처리, 승인후 3일 초과 미마감 발주 자동경고 (`BrandTabOrders` 발주관리에 접이식 섹션 연결)

- **feat: 주문서 묶음 시스템 구축 - 배치승인+물류전달체크리스트**
  - `brand_order_batches` / `brand_order_batch_checklist_items` 신규 테이블(RLS 포함, migration `127_brand_order_batches.sql`) — 원장이 여러 브랜드 상품을 섞어 담아도 하나의 주문번호(`order_no`)로 묶임
  - `insertBrandOrder.ts` 공용화, `/api/brand-order-batches/create` 신규 — 브랜드별 `brand_orders`를 `batch_id`로 묶어 일괄 생성 (`ORD-YYYYMMDD-XXXX`)
  - 원장 발주화면: 브랜드별 개별 「발주하기」 → 「전체 발주하기」(장바구니 전체 묶음제출, `submitOrderBatch`)로 통합
  - `BrandOrderBatchApproval.tsx` 신규: 주문번호 기준 배치카드(브랜드별 라인아이템+프로모션뱃지+증정품목명, 기간검색, 상태탭), 「발주승인→물류전달」 시 물류전달사항을 체크리스트로 자동생성 + `brand_orders` 일괄승인
  - `BrandInventoryFulfillment.tsx`: 배치 체크리스트 표시+체크토글 추가(트랙A만, 트랙B는 batch 미해당)

---

## 2026-07-24

- **fix: 물류허브 접근권한 정리 - ops직원 브랜드허브 진입차단 + 발송처리 이전**
  - `BrandHubContent.tsx`의 내부 "물류팀" 토글모드(`systemMode`/`LOGI_TABS`) 완전 제거 — 브랜드허브와 물류허브(`/dashboard/logi`) 이원화 문제 해소
  - `BrandPinGate.tsx`에 `hub` prop(`'brand'|'logi'`) 추가 — 일반 브랜드허브(`hub="brand"`)에서 `ops_manager`/`ops_staff` PIN 인증 시 차단하고 물류허브 이동 안내(`brands.slug` 포함 링크)로 전환. `/dashboard/logi`(`hub="logi"`)는 기존대로 통과
  - `/dashboard/logi`(`OPS_TABS`)에 "발송 처리"(`BrandInventoryFulfillment`) 추가, 기본 탭으로 설정
  - `BrandTabInventory.tsx`의 중복 "발송 처리" 서브탭 제거
  - 남은 정리 대상: `/dashboard/logi`의 "오늘출고"(`BrandTabOrders` 재사용) 탭, 발송처리와 역할 중복 여부 재검토 필요

- **feat: 발주-물류 역할분리 + 트랙A/B 발송통합 + 스마트택배 자동웹훅 연동**
  - 역할 분리: 발주관리(승인까지만)와 재고·물류(실제 발송처리)를 명확히 분리 — `BrandTabOrders`에서 운송장/발송 로직 제거, `BrandInventoryFulfillment.tsx` 신규로 이관
  - 재고·물류 "발송 처리" 서브탭 신규: 트랙A(`brand_orders`)+트랙B(`hq_stock_orders`) 발주 통합 처리, 운송장번호+택배사 입력, 재고차감(`decrement_inventory_stock`) 동일 적용
  - deliveryapi.co.kr 스마트택배 API 연동: 발송처리 시 자동 웹훅 구독(`subscribeTracking`), 배송완료 감지 시 자동으로 상태 갱신(A: `shipping`→`done`, B: `배송완료`→`구매확정`) — `/api/webhooks/delivery-status` 신규
  - 브랜드선택 localStorage 키 통일(발주관리·재고물류 간 `brand-tab-selection`)
  - 오렌어드민 AB정산시스템의 HQ재고발주 배송완료/구매확정은 상태변경 액션 유지(스폰서 커미션 정산 기준 자료로 사용, 실제 처리 주체는 아님 — 처리는 브랜드사+물류)

- **refactor: 발주관리 브랜드선택 완전통일**
  - `BrandTabOrders.tsx`: `selectedBrandId` 단일 state로 통일(`TabBrandSelector` 제거, Summary 드롭다운 하나로 통합), 전체선택시 하위 발주처리/프로모션은 "특정 브랜드를 선택하세요" 안내로 전환
  - `BrandOrdersSummary.tsx` 전면 재설계: company 전체/브랜드 드롭다운, 기간 프리셋(이번달·지난달·26~25·직접선택), `brand_orders`(A)+`hq_stock_orders`(B) 합산 KPI, 이번달발주·기간합계매출 인라인 상세+CSV
  - `BrandOrdersPromoSettings.tsx`: 프로모션 목록/작성폼을 접이식(`+ 새 프로모션 추가`로만 펼침)

- **refactor: 피부데이터 메뉴 정리, 발주관리로 통합 + 브랜드선택 동기화**
  - "피부 데이터" 메뉴 제거 — 이름과 실제 기능(발주/제품 KPI)이 불일치했던 문제, `BrandTabData`의 KPI/최근발주를 `BrandOrdersSummary.tsx`로 분리해 "발주 관리"(구 "주문·정산") 상단에 흡수
  - "주문·정산" → "발주 관리"로 명칭 변경 (실제 정산 기능은 별도 CEO전용 "정산" 메뉴에 있어 명칭 혼동 방지)
  - 탭별로 따로였던 브랜드선택 localStorage 키(`data-brand`/`orders-brand`)를 `brand-tab-selection`으로 통일 — 발주가 한쪽 탭에만 보이던 불일치 원인 해소
  - `BrandTabData.tsx`는 파일만 유지, 참조 제거(dead code)

---

## 2026-07-23

- **docs: brand_grade_point_rates RLS 정책 마이그레이션 126으로 고정**
  - `brand_grade_point_rates` RLS 정책 5개를 migration `126_brand_grade_point_rates_rls_fix.sql`로 레포에 고정 (기존 123번 문서화에도 불구하고 실제 DB엔 정책이 누락돼있던 재발 방지)

- **fix: brand_grade_point_rates RLS 정책 누락 수정 + 디버그로그 제거**
  - `brand_grade_point_rates` RLS 정책이 실제로 반영 안 돼있던 버그 발견/수정 — RLS는 켜져있는데 정책이 하나도 없어서 전체 차단 상태였음(SQL Editor 관리자 권한으로만 보였음), SELECT/INSERT/UPDATE/DELETE/ALL 5개 정책 재실행으로 해결
  - `BrandOrdersPromoSettings.tsx` 디버그 로그 제거

- **docs: supply_promos 쓰기 RLS 마이그레이션 문서화**
  - `supply_promos` 쓰기 RLS(INSERT/UPDATE/DELETE, 소유자/멤버 전용) migration `125_supply_promos_write_rls.sql`로 문서화 (DB 이미 반영)

- **feat: 브랜드별 적립율/프로모션 설정화면 구축 + 실계산 연결**
  - `brand_grade_point_rates` 신규 테이블(브랜드별 등급 적립율, RLS: 소유자/멤버만 쓰기 가능), 시바산 시드값(메디슈티컬5/프리미엄전문점3/전문점2/취급점2) — migration `124_brand_grade_point_rates_table.sql`(기록용)
  - `supply_promos` RLS에 INSERT/UPDATE/DELETE 정책 추가(기존 SELECT만 있던 문제 수정)
  - `useBrandGradeRates.ts` 신규 훅, `brandOrderPromos.ts`의 `gradePointRate`/`calcPointsEarned`를 `rateMap` 파라미터 받도록 확장(기존 `GRADE_POINT_RATES`는 폴백으로 유지)
  - `brand-orders/page.tsx`: 헤더/팝업 각각 브랜드별 실제 적립율 DB조회 연결(4개 호출지점)
  - `BrandOrdersPromoSettings.tsx` 신규: 적립율 인라인편집 + 프로모션 추가/수정/비활성화/삭제(2단계 확인) UI, `BrandTabOrders.tsx` 하드코딩 표 완전 제거

- **fix: 오렌몰-브랜드제품 트랙격리 사고 수정 - 레거시 등록경로 제거**
  - 트랙격리 사고 발견: 레거시 브랜드 제품등록 경로(`/dashboard/brand/products/new` → `/api/brand/products/create`)가 `brand_products`가 아닌 `products`(오렌몰)에 저장하던 구조적 결함 발견 및 수정
  - 레거시 페이지/API 파일 완전삭제, `client.tsx` 잔여 링크 제거(`/dashboard/brand`로 교체)
  - `BrandTabData.tsx`, `BrandInventoryStock.tsx`가 `products`를 잘못 참조하던 부분 `brand_products`로 수정(`brand_id` 필터 포함)
  - 오염된 제품 3건 `products`에서 완전삭제(연결된 종료된 `group_buys` 레코드 포함)

- **refactor: 브랜드 전환 드롭다운 제거, 홈 그룹뷰 고정 + 탭별 개별 브랜드선택 도입**
  - `TabBrandSelector.tsx` 신규: 탭 내부 브랜드 선택 pill UI, `localStorage`로 탭별 선택 기억
  - `BrandHubContent.tsx` 상단 「브랜드 전환」 드롭다운 완전 제거 — 홈/제품관리는 기존 방식(그룹뷰/자체필터) 유지, 나머지 13개 탭(Sample/TierPackages/Orders/OrenTalk/Live/Community/Expand/Data/Invoice/Inventory/Report/Returns/Settlement)은 각자 내부 브랜드선택으로 전환
  - BrandTabProducts 신규등록 폼: 브랜드 선택을 `TabBrandSelector`로 교체 (`BrandProductPriceSection`, storageKey `product-form-brand`)
  - `OwnersBrandWrapper.tsx` 신규: 800줄 규칙 초과인 `BrandTabOwners.tsx` 본문 미수정, 래퍼로 브랜드선택 주입 (`owners-brand`)
  - `page.tsx`: 상단 드롭다운 삭제, `currentBrandId`는 PIN/Home/제품폼 초기값용으로 유지(`myBrands[0]` 기본값)
  - `dashboard/logi/page.tsx` Orders props를 `myBrands` 방식으로 수정(빌드 깨짐 수정)

- **fix: 그룹매출 그래프 툴팁 글씨색 다크테마 대응**
  - `GroupRevenueChart.tsx` BarChart/PieChart 툴팁이 다크배경에서 검정글씨로 안 보이던 문제 수정, `contentStyle`/`itemStyle`/`labelStyle`로 흰색 적용

- **style: 그룹매출 그래프 막대+도넛 조합으로 개선**
  - `GroupRevenueChart.tsx`: 멀티라인 → 스택 BarChart + 이달매출비중 도넛 PieChart 조합으로 변경, 제목 옆 「전체 N개 브랜드」 뱃지 추가, 아래 트랙A/B 단일브랜드 선그래프와 시각적으로 구분되도록 개선

- **feat: 그룹합산 대시보드 구축 + 서브브랜드 company_id 자동상속**
  - `src/lib/brand/createSecondBrand.ts` 신규: 서브브랜드 추가 시 허브의 `company_id` 자동 상속, 허브에 `company_id` 없으면 명확한 에러로 차단(자동생성 안 함)
  - `page.tsx` 브랜드추가 insert 로직을 `createSecondBrand()`로 교체
  - `GroupRevenueChart.tsx` 신규: `company_id` 기준 서브브랜드 전체 최근 30일 매출 그래프(트랙A 재고발주 생성-취소 + 트랙B HQ결제완료~구매확정 합산), 브랜드별 색상 범례토글, 이달매출 리스트+세부내역 아코디언(`MonthlyOrderAccordion` 재사용), 매출0 브랜드 하단 흐리게 표시
  - `BrandTabHome.tsx`: KPI카드와 기존 트랙A/B 단일브랜드 그래프 사이에 그룹차트 삽입 (449→468줄)

## 2026-07-22

- **feat: 브랜드홈 아코디언 샵명/원장실명 표시 + 컴포넌트 분리**
  - 신규 `MonthlyOrderAccordion.tsx`: `BrandTabHome.tsx` 아코디언 로직 분리(576→449줄, 500줄 규칙 준수)
  - 트랙A(`brand_orders`): select에 `salon_name` 추가
  - 트랙B(`hq_stock_orders`): 존재하지 않는 `owner_name` 컬럼 select 제거, `profile_id` → `profiles.auth_id` → `users` → `salons` 체인 조회로 교체 (관리자 AB정산시스템과 동일 패턴)
  - UI: 샵명(위)/원장실명(아래) 2줄 구조로 통일 (관리자콘솔과 표시 방식 일치)

- **feat: AB 정산 시스템 통합 콘솔 구축 + HQ발주 원장/샵명 표시 핫픽스**
  - `/admin/track-b-system` 명칭을 **「AB 정산 시스템」**으로 변경(사이드바 `AdminChrome` + 페이지 타이틀). 기존 트랙B 콘솔(KPI·추이·스폰서 커미션·HQ 발주내역)은 그대로 유지
  - **트랙A 정산 섹션 신규**: `brand_product_orders`의 `platform_fee` / `owner_amount`(생성 시 이미 계산됨) 활용, `settlement_status` 기준 정산대기·완료 KPI + 원장별 정산대기 리스트 + 일괄 정산확정 버튼(실송금 없음, 확정처리만). 골드 색상으로 트랙B(보라) 섹션과 시각 구분
  - **핫픽스**: `hq_stock_orders`에 존재하지 않는 `owner_name` / `salon_name` 컬럼을 직접 select하던 400 에러 수정 → `profile_id` → `profiles.auth_id` → `users`(auth_id 매칭) → `salons.owner_id` 체인 조회로 교정. UI는 샵명(위) / 원장 실명(아래) 2줄 구조
  - 트랙A(`salonNameById` / `ownerNameBySalon`) 로직은 미변경 — 트랙A/B 완전 격리 유지

- **feat: 트랙B 시스템 구축 완료 — 재고발주 / 오렌어드민 콘솔 / 스폰서 커미션(요율 트랙A 분리)**
  - `hq_stock_orders` / `hq_commission_ledger` / `hq_commission_rates` 신규 테이블 3개, RLS 포함 (migration `120`·`121`·`122`)
  - 트랙B 원장 재고발주 화면 + API + PayApp 연동 (`kind:'hq_stock_order'`)
  - 오렌어드민 `/admin/track-b-system` 신규: KPI, 30일 매출추이, 스폰서 커미션 테이블(정산처리 버튼 · 실송금 없음/확정처리만), 발주내역 리스트
  - 스폰서 커미션 계산: 뱃지구매·HQ재고발주 모두 매 결제마다 발생(1회성 아님), 8.8% 순액×등급별 요율(`Math.floor`, 기존 `brandTierPurchase.ts` 공식 재사용)
  - 커미션 요율을 `brand_tier_packages`(브랜드 소관, 뱃지가격용)에서 완전 분리해 `hq_commission_rates`(오렌 소관 신규) 전용 참조로 교체 — 트랙A/B 정책 격리 원칙 준수
  - 원장 퀵메뉴 「재고 발주」 링크 추가 (`origin_track==='B'`)

- **feat: 트랙B 본사재고발주 신규 구축 + 브랜드홈 매출그래프 트랙B 반영**
  - `hq_stock_orders` 신규 테이블(migration `120` RLS): 트랙B 원장→오렌 본사 재고발주 전용, `brand_orders`와 완전 분리
  - `/dashboard/owner/hq-stock-orders` 신규 발주화면 (`origin_track='B'` 가드, brand-orders UI/계산 패턴 재사용)
  - `/api/hq-stock-orders/create` 신규
  - PayApp `kind:'hq_stock_order'` 분기 추가 (`payapp/create`, `payapp/webhook`) — 결제완료/취소 처리
  - `BrandTabHome.tsx`: 이달 판매액 KPI에 트랙B 합산 추가, 30일 그래프 트랙A(골드)/트랙B(보라) 이중 시리즈, 아코디언에 A/B 뱃지 표시
  - `client-v2.tsx` 원장 퀵메뉴: 트랙B 전용 「재고 발주」 링크 추가, `origin_track==='B'` 명시조건으로 null/미설정 원장 노출 방지

- **fix: 크론 UTC/KST 시간대 오류 수정 + 재고발주 청구주기 26일~25일 통일**
  - `vercel.json`: `expire-coupons` / `expire-brand-product-orders` / `auto-confirm-brand-product-orders` 3개 크론이 UTC 그대로 설정돼 실제로는 KST 대낮(오전 10~11시)에 실행되던 시간대 버그 수정 → 의도대로 KST 새벽 실행되게 UTC 환산 반영
  - `aggregate-brand-billing` 취합 주기를 달력월에서 「전월26일~당월26일」 반개구간으로 변경(`billingCycleRange` 신규), 크론 실행시각 KST 26일 새벽 4시로 조정(누락 방지)
  - `invoice/page.tsx`도 동일 `billingCycleRange`로 통일해 화면 표시금액과 실제 청구금액 정합성 확보, 청구기간 라벨을 「N월26일~M월25일」 형태로 표시

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
