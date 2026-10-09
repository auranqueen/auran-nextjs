-- 같은 큐레이터가 같은 제품을 pending 상태로 중복 신청 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_gbr_requester_product_pending
ON group_buy_requests (requester_id, product_id)
WHERE status = 'pending';
