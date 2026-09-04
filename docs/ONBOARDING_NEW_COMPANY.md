# 신규 브랜드사(컴퍼니) 온보딩 체크리스트

새 브랜드사(예: 볼라욘)가 오렌 파트너십을 맺을 때, 반드시 이 순서대로 진행한다.

| 단계 | 누가 |
|------|------|
| 1. 회사 생성 | 오렌(SQL) |
| 2. 대표 가입+브랜드 신청 | 본사(볼라욘 대표) |
| 3. 승인 | 오렌(admin UI) |
| 4. company_id 연결 | 오렌(SQL, 핵심) |
| 5. CEO PIN 부트스트랩 | 본사(볼라욘 대표) |
| 6. PayApp 설정 | 오렌(admin UI) |
| (로고는 언제든) | 본사(브랜드허브 세금계산서 탭에서 셀프) |
| 7. 형제 브랜드 추가 | 본사(브랜드허브에서 셀프) |

"컴퍼니가 모든 걸 지배한다" 원칙 — company_id 하나로 로그인/권한/원장연결/정산/커뮤니티가 전부 자동 격리된다.

## 1. 회사(brand_companies) 생성 — SQL 수동

관리자 UI에 생성 기능이 없다. Supabase SQL Editor에서 직접 실행:

```sql
insert into brand_companies (name)
values ('볼라욘')
returning id;
```

반환된 `id`를 이후 단계에서 `<company_id>`로 사용한다.

(`payapp_active`, `auto_approve_owner_invite`는 기본값 false로 생성되며 나중에 UI에서 켤 수 있다.)

**볼라욘그룹 일괄 시드(시바산 패턴):** Auth·users·profiles·형제브랜드 3개·CEO PIN까지 한 번에 만들려면
`node scripts/seed-volayon-company.cjs` (company명 `볼라욘그룹`, slug `volayon`, PIN `volayonceo`/`1234`).

## 2. 대표(CEO) 계정 가입 + 허브 브랜드 신청 — UI (일반 절차)

1. 대표가 일반 회원가입(Auth 계정 생성)
2. 로그인 후 브랜드 신청(`applyBrand`, dashboard/brand 신청 화면)에서 브랜드명 등록
   - 이 시점에 rands row가 status: 'pending', user_id: <대표의 users.id>로 자동 생성됨
   - ccess_tier는 기본값 public, distribution_type은 기본값 
one으로 생성됨 — 지사계약(등급구매제)이 필요하면 나중에 	ier_contract로 변경

## 3. 관리자 승인 — UI

/admin/approvals (또는 /admin/brands)에서 신청 승인 → rands.status가 'active'로 변경됨.

## 4. 허브 브랜드에 company_id 연결 — SQL 수동 (핵심 단계, 절대 빠뜨리면 안 됨)

이 단계를 빠뜨리면 로그인은 되지만 컴퍼니 기준 기능(형제브랜드 확장, 담당자 권한, 원장 커뮤니티 통합 등)이 전혀 작동하지 않는다.

```sql
update brands
set company_id = '<1단계에서 받은 company_id>'
where id = '<2단계에서 생성된 허브 brands.id>';
```

## 5. CEO PIN 부트스트랩 — UI (자동)

대표가 `/brand/<slug>` 또는 `/login?role=brand`로 로그인 → 대시보드 진입 시 PIN 등록 화면(`BrandPinGate`)이 자동으로 뜬다.

"등록하고 시작하기"로 이름+PIN 입력하면 `brand_staff`에 `role: 'ceo'`로 자동 등록된다.

(4단계에서 company_id를 연결해두지 않으면 이 부트스트랩이 의미 있게 동작하지 않으니, 4단계를 반드시 먼저 끝낼 것.)

## 6. PayApp 결제연동 설정 — UI (오렌이 함)

`/admin/companies`에서 PayApp 연동 정보(활성여부, user_id, key, linkval)를 입력한다.

로고는 여기서 설정하지 않는다 — 로고는 본사(브랜드사)가 직접 브랜드허브의 "세금계산서" 탭에서 셀프로 업로드한다(회사 로고/서브브랜드 로고 둘 다).

## 7. 형제(서브) 브랜드 추가 — UI/헬퍼 (자동 상속)

이후 같은 회사에 브랜드를 추가할 때는 `createSecondBrand` 흐름을 사용한다. 허브의 `company_id`를 자동으로 상속받으므로 담당자·권한을 재등록할 필요가 없다. (허브에 company_id가 없으면 세컨드 브랜드 생성 자체가 거부된다 — 그래서 4단계가 선행되어야 한다.)

---

## 자주 하는 실수

- **4단계(company_id 연결)를 빼먹는 것** — 로그인은 되는데 형제브랜드 공유, 담당자 권한, 원장 커뮤니티 통합이 전혀 안 됨. 증상이 "왜 이 브랜드만 이상하게 동작하지"로 나타나므로 헷갈리기 쉽다.
- **서브브랜드를 2단계처럼 개별 신청 절차로 만드는 것** — 이러면 새 담당자 섬(권한 재등록 필요)이 생긴다. 반드시 7단계(createSecondBrand)로 만들 것.
