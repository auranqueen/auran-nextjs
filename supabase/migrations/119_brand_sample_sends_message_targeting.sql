-- brand_sample_sends.owner_id, brand_messages.target_owner_id 추가 (수동 실행 완료, 문서화 목적)
ALTER TABLE brand_sample_sends ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE brand_messages ADD COLUMN IF NOT EXISTS target_owner_id UUID REFERENCES profiles(id);
