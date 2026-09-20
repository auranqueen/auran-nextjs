-- 205: toast_transactions "서비스 insert" 구멍 정책 제거
-- 브라우저 타인적립 3곳을 서버API로 전환 완료 후 제거
-- chat-award / order-completion / wallet-grant API가 서비스롤로 대체
DROP POLICY IF EXISTS "서비스 insert" ON toast_transactions;
