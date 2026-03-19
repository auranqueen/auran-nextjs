# 환경 변수 등록 가이드

## Supabase 서비스 롤 키 (SUPABASE_SERVICE_ROLE_KEY)

PIN 저장, 관리자 승인, 역할 조회 등에서 RLS를 우회하려면 **서비스 롤 키**가 필요합니다.

### 1. Supabase에서 키 복사

1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. **Settings** → **API**
4. **Project API keys** 에서 **`service_role`** (Secret) 항목의 **Reveal** 클릭 후 복사

⚠️ 이 키는 절대 클라이언트/프론트에 노출하면 안 됩니다. 서버·API 라우트에서만 사용하세요.

---

### 2. 로컬 (.env.local)

프로젝트 루트에 `.env.local` 파일을 만들고:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   # 방금 복사한 service_role 값
```

---

### 3. Vercel에 등록

1. [Vercel Dashboard](https://vercel.com) → 해당 프로젝트 선택
2. **Settings** → **Environment Variables**
3. **Add New** 클릭
4. 아래처럼 입력:

| Name | Value | Environment |
|------|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase에서 복사한 service_role 키) | Production, Preview 체크 |

5. **Save** 후, 변경 사항 반영을 위해 **Deployments**에서 최신 배포를 **Redeploy** 하거나 새 커밋 푸시

---

### 4. 이 키를 쓰는 기능

- 결제 PIN 설정/저장 (`/api/auth/pin/set`)
- 관리자 승인·역할 조회 (`/api/admin/approvals`, `/api/auth/role-status` 등)
- 슈퍼 콘솔 인증

키가 없으면 위 기능은 RLS 정책에 막혀 동작하지 않을 수 있습니다.

---

## PayApp 결제 — 테스트/샌드박스 (실결제 방지)

개발·테스트 시 **실제 카드 결제가 발생하지 않도록** 다음 중 하나를 사용하세요.

### 방법 1: 샌드박스 모드 (권장)

환경 변수에 **아래 하나만** 넣으면 됩니다.

- **`PAYAPP_SANDBOX=true`** 또는 **`PAYAPP_TEST_MODE=true`**

**동작**

- 결제 요청 시 **페이앱 서버를 호출하지 않음**
- `pay_url`로 **우리 return URL**이 내려가서, "충전하기" 클릭 시 **바로 지갑 복귀 화면**으로 이동
- 실결제·실카드 입력 없이 **UI/플로우만** 테스트 가능  
- `PAYAPP_USER_ID`, `PAYAPP_LINKKEY`, `PAYAPP_LINKVAL`, `PAYAPP_FEEDBACK_URL` 등은 **설정하지 않아도 됨**

**로컬**

`.env.local` 예시:

```env
PAYAPP_SANDBOX=true
```

**Vercel (Preview 등)**

- Environment Variables에 `PAYAPP_SANDBOX` = `true` 추가
- **Production**에는 넣지 말고, 실결제용 PayApp 키만 설정

### 방법 2: 페이앱 테스트 연동값 사용

페이앱에서 **테스트용 연동 KEY/VALUE(테스트 ID)** 를 준다면:

- **`PAYAPP_LINKVAL`** (및 필요 시 `PAYAPP_USER_ID`, `PAYAPP_LINKKEY`)를 **테스트용 값**으로 설정
- 실결제용 연동값과 구분해서, 개발/스테이징 환경에만 적용

이 경우에는 **`PAYAPP_SANDBOX` / `PAYAPP_TEST_MODE`를 쓰지 않고**, 테스트 연동값만으로 결제창까지 열어서 테스트할 수 있습니다. (실결제 여부는 페이앱 테스트 정책에 따름)

### 실결제용 설정 (운영)

- `PAYAPP_SANDBOX` / `PAYAPP_TEST_MODE` 를 **설정하지 않거나** `false`
- `PAYAPP_USER_ID`, `PAYAPP_SHOPNAME`, `PAYAPP_LINKKEY`, `PAYAPP_LINKVAL`, `PAYAPP_FEEDBACK_URL` (필요 시 `PAYAPP_RETURN_URL`) 모두 **실결제용 값**으로 설정
