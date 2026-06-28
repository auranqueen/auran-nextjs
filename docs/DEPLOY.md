# AURAN 배포 및 운영 가이드
작성일: 2026-06

## 1. 인프라 구성

호스팅: Vercel (main 브랜치 자동 배포)
DB: Supabase (Seoul 리전, ap-northeast-2)
GitHub: auranqueen/auran-nextjs (private)
도메인: auran.kr
어드민 이메일: queen8038@gmail.com

## 2. 배포 흐름

git push origin main
→ Vercel 자동 감지
→ npm ci (패키지 클린 설치)
→ npm run build
→ 빌드 성공 시 자동 배포
→ auran.kr 즉시 반영

주의:
npm install 후 반드시 package.json + package-lock.json 커밋
커밋 안 하면 Vercel에서 모듈 없음 오류 발생

## 3. 커서(Cursor) 작업 규칙

작업 전 반드시:
1. git pull origin main (최신 코드 동기화)
2. npm install (새 패키지 설치)
3. 파일 줄 수 확인: Get-Content [파일] | Measure-Object -Line
   → 500줄 이상이면 컴포넌트 분리 먼저

작업 후 반드시:
1. npm run build (로컬 빌드 확인)
2. git add / commit / push
3. Vercel 배포 결과 확인

## 4. 환경변수 (.env.local)

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_KAKAO_CLIENT_ID
NEXT_PUBLIC_SHOW_DEMO
ANTHROPIC_API_KEY (Claude AI)

주의: .env.local은 절대 GitHub 커밋 금지
GitHub에 노출된 적 없음 확인됨 (2026-04-02)

## 5. Supabase 관리

대시보드: supabase.com
프로젝트: auran-queen's Project
리전: Seoul (ap-northeast-2)
지연: ~30ms

주요 작업:
신규 테이블 → SQL Editor에서 CREATE TABLE
RLS 정책 → Authentication → Policies
Auth 계정 → Authentication → Users → Add user
함수/트리거 → SQL Editor

브랜드사 신규 계정 생성 순서:
1. Authentication → Users → Add user
   이메일: [slug]@auran.kr / 비밀번호 설정
2. SQL Editor:
   UPDATE public.users
   SET auth_id='[uuid]', role='brand', status='active'
   WHERE email='[slug]@auran.kr';

   INSERT INTO public.profiles (auth_id, role, active_role)
   VALUES ('[uuid]', 'brand', 'brand')
   ON CONFLICT (auth_id) DO UPDATE
   SET role='brand', active_role='brand';

   UPDATE public.brands
   SET user_id='[uuid]', login_role='director'
   WHERE slug='[slug]';
3. auran.kr/brand/[slug] 접속 테스트

## 6. 접속 주소 전체

고객 홈: auran.kr
고객 로그인: auran.kr/login?role=customer
원장님 로그인: auran.kr/login?role=owner
파트너스 로그인: auran.kr/login?role=partner
어드민: auran.kr/admin

브랜드사 (예: 시바산):
Brand Hub 로그인: auran.kr/brand/civasan
물류 허브 로그인: auran.kr/logi/civasan
Brand Hub 대시보드: auran.kr/dashboard/brand
물류 허브 대시보드: auran.kr/dashboard/logi

## 7. 모바일 앱

패키지: kr.auran.app
프레임워크: React Native (Expo SDK 56)
배포: Google Play Store (AAB 업로드 완료, versionCode 4)
구조: WebView (auran.kr 래핑)

## 8. 현재 파트너사

시바산 (CIVASAN):
slug: civasan
login_role: ceo (테스트 중)
이메일: civasan@auran.kr
Brand Hub: auran.kr/brand/civasan
물류 허브: auran.kr/logi/civasan
테스트 직원: 윰탱 이사 (PIN: 123456)

## 9. 작업 후 문서 업데이트 규칙

새 기능 추가 시:
→ docs/CHANGELOG.md 상단에 추가

DB 변경 시:
→ docs/DATABASE.md 업데이트

오류 해결 시:
→ docs/TROUBLESHOOT.md에 기록

새 브랜드사 추가 시:
→ docs/DEPLOY.md 섹션 8에 추가
→ docs/AI_CONTEXT.md 섹션 10에 추가

커서 프롬에 항상 추가:
"작업 완료 후 docs/CHANGELOG.md에 변경사항 추가하고 커밋할 것"

## 10. 긴급 대응

빌드 실패 시:
1. Vercel 대시보드 → 해당 배포 → 에러 로그 확인
2. 모듈 없음 오류 → npm install 후 package.json 커밋
3. 타입 오류 → 로컬 npm run build로 먼저 확인
4. 이전 배포로 롤백: Vercel → Deployments → 이전 버전 → Promote to Production

DB 접근 불가 시:
1. Supabase 대시보드 → 프로젝트 상태 확인
2. RLS 정책 확인 (SELECT 누락 자주 발생)
3. auth_id 연결 확인

로그인 튕김 시:
1. users.auth_id NULL 확인
2. profiles.active_role 확인 (brand여야 함)
3. brands.user_id 연결 확인
4. middleware isBrand/isLogiLogin 패턴 확인
