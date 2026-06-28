# AURAN 보안 시스템
> Brand Hub / 물류 허브 개인정보 보호 및 접근 제어 설계
> 작성일: 2026-06

---

## 1. 3대 원청봉쇄 원칙

| 원칙 | 내용 | 구현 |
|------|------|------|
| ① 볼 수 없으면 유출 불가 | 최소 권한 — 업무 필요 데이터만 접근 | 역할별 모듈 권한, PIN 인증 |
| ② 봤으면 반드시 기록 | 모든 열람 시 자동 로그 저장 | brand_access_logs (삭제 불가) |
| ③ 캡처해도 증거 남음 | 담당자명·시각 워터마크 자동 삽입 | BrandWatermark.tsx |

---

## 2. 접속 흐름

**브랜드사:**

```
auran.kr/brand/[slug]
→ 아이디+비밀번호 로그인 (이메일@auran.kr 자동 변환)
→ PIN 게이트 (BrandPinGate.tsx)
→ 담당자 선택 → PIN 입력
→ brand_pin_sessions 생성 (30분 유효)
→ brand_access_logs INSERT (login 기록)
→ Brand Hub 대시보드
→ BrandWatermark 오버레이 (전체 화면)
```

**물류팀:**

```
auran.kr/logi/[slug]
→ 아이디+비밀번호 로그인
→ PIN 게이트 (ops_manager/ops_staff/ceo/director만 허용)
→ 물류 허브 대시보드
→ BrandWatermark 오버레이
```

---

## 3. 직원 권한 계층

| 직책 | PIN | 시스템 접근 | 위임 가능 대상 |
|------|-----|------------|--------------|
| 대표 (ceo) | 6자리 | Brand Hub 전체 + 물류 허브 + 정산 | 이사/과장/담당자/물류팀 전체 |
| 이사 (director) | 6자리 | Brand Hub (정산 제외) + 물류 허브 | 과장/담당자/물류팀 |
| 과장 (manager) | 4자리 | Brand Hub 일부 | 담당자 |
| 담당자 (staff) | 4자리 | Brand Hub 기본 | 없음 |
| 물류팀장 (ops_manager) | 4자리 | 물류 허브 전체 | 물류직원 |
| 물류직원 (ops_staff) | 4자리 | 물류 허브 기본 | 없음 |

---

## 4. PIN 보안 규칙

- 3회 오류 시 자동 잠금 (is_locked = true)
- 잠금 시 brand_access_logs에 pin_fail_locked 기록
- 잠금 시 brand_messages로 대표에게 자동 알림
- 세션 유효시간: 30분 (brand_pin_sessions.expires_at)
- 30분 비활동 시 PIN 재입력 필요
- 대표: PIN 6자리 / 이하 직책: PIN 4자리

---

## 5. 권한 모듈 목록

| 모듈 코드 | 기능 |
|----------|------|
| order_view | 발주 목록 조회 |
| order_approve | 발주 승인/반려 |
| order_ship | 운송장 입력/발송 처리 |
| inventory_view | 재고 현황 조회 |
| inventory_edit | 입출고 처리 |
| inventory_lot | 로트 관리 |
| inventory_close | 월 마감 확정 |
| inventory_emergency | 비상 출고 |
| marketing_create | 이벤트 생성/오렌톡 발송 |
| marketing_bundle | 번들 패키지 구성 |
| report_view | 대조 리포트 열람 |
| report_staff | 담당자별 통계 |
| report_mismatch | 불일치 감지 |
| returns_view | 반품 목록 조회 |
| returns_approve | 반품 승인/반려 |
| returns_receive | 수령 처리 |
| staff_manage | 직원 등록/삭제 |
| staff_grant | 권한 부여 |
| sample_manage | 샘플 등록/발송 |
| community_post | 커뮤니티 공지 작성 |

**대표 전용 (위임 불가):**
- 정산/계약/수수료 열람
- 브랜드 계정 설정 변경

---

## 6. DB 테이블

### brand_access_logs

```sql
id UUID PRIMARY KEY
brand_id UUID → brands.id
staff_id UUID → brand_staff.id
staff_name TEXT
action_type TEXT -- login/view/edit/approve/export/pin_fail/pin_fail_locked/logout
module TEXT
target_id TEXT
target_desc TEXT
ip_address TEXT
user_agent TEXT
created_at TIMESTAMPTZ

-- 삭제/수정 불가 트리거:
prevent_access_log_modification() → BEFORE UPDATE/DELETE
```

### brand_pin_sessions

```sql
id UUID PRIMARY KEY
brand_id UUID → brands.id
staff_id UUID → brand_staff.id
session_token TEXT UNIQUE
pin_fail_count INTEGER DEFAULT 0
is_locked BOOLEAN DEFAULT false
expires_at TIMESTAMPTZ -- 생성 후 30분
created_at TIMESTAMPTZ
```

### brand_staff_permissions

```sql
id UUID PRIMARY KEY
brand_id UUID → brands.id
staff_id UUID → brand_staff.id
module TEXT -- 위 모듈 코드
granted_by UUID → brand_staff.id
created_at TIMESTAMPTZ
UNIQUE(staff_id, module)
```

---

## 7. 워터마크 (BrandWatermark.tsx)

- 위치: `src/app/dashboard/brand/components/BrandWatermark.tsx`
- 표시: `position:fixed, inset:0, zIndex:9999, pointerEvents:none`
- 내용: `"{담당자명} {직책} · {날짜 시각} · AURAN CONFIDENTIAL"`
- 타일: 20개 대각선(-25도) 반복
- 투명도: `rgba(255,255,255,0.045)`
- 효과: 화면 캡처 시 담당자 정보 노출 → 유출 억제

---

## 8. 관련 파일 경로

```
src/app/brand/[slug]/page.tsx          — 브랜드사 전용 로그인
src/app/logi/[slug]/page.tsx           — 물류팀 전용 로그인
src/app/dashboard/brand/page.tsx       — Brand Hub 메인
src/app/dashboard/logi/page.tsx        — 물류 허브 메인

src/app/dashboard/brand/components/
  BrandPinGate.tsx                     — PIN 게이트
  BrandWatermark.tsx                   — 워터마크
  BrandHubContent.tsx                  — 통합 허브 콘텐츠

src/app/dashboard/brand/tabs/
  BrandInventoryStaff.tsx              — 직원 관리
  BrandStaffPermissions.tsx            — 권한 설정 팝업
```
