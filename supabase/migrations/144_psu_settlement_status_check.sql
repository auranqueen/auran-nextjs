-- purchase_session_usages.settlement_status가 'pending'/'정산완료' 외 값을 갖지 못하게 구조적으로 제약. DB는 이미 반영됨 — 레포 기록용
alter table public.purchase_session_usages
  add constraint psu_settlement_status_check
  check (settlement_status in ('pending', '정산완료'));