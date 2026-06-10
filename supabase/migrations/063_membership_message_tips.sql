-- 멤버십 선물·리추얼 상담톡 트랙별 팁 (admin_settings JSON)

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  (
    'membership_message',
    'gift_message_tips',
    '{
      "general": "호르몬 주기에 맞춘 케어가 중요합니다",
      "menopause_peri": "피부 변화 시기, 보습과 진정이 우선입니다",
      "menopause_post": "안정된 루틴으로 피부 재생을 돕습니다",
      "pregnant": "자극 없는 순한 제품으로 안전하게 관리하세요",
      "postpartum": "호르몬 변화로 예민한 피부, 진정 케어를 우선으로",
      "male": "남성 피부 특성에 맞춘 빠른 흡수 케어",
      "male_menopause": "호르몬 변화에 따른 피부 톤 관리가 필요합니다",
      "irregular": "생리 불규칙할 때는 진정과 보습 케어를 함께 챙기세요"
    }',
    '선물 메시지 팁',
    '',
    'json'
  ),
  (
    'membership_message',
    'ritual_message_tips',
    '{
      "general": "호르몬 주기에 맞춘 케어가 중요합니다",
      "menopause_peri": "피부 변화 시기, 보습과 진정이 우선입니다",
      "menopause_post": "안정된 루틴으로 피부 재생을 돕습니다",
      "pregnant": "자극 없는 순한 제품으로 안전하게 관리하세요",
      "postpartum": "호르몬 변화로 예민한 피부, 진정 케어를 우선으로",
      "male": "남성 피부 특성에 맞춘 빠른 흡수 케어",
      "male_menopause": "호르몬 변화에 따른 피부 톤 관리가 필요합니다",
      "irregular": "생리 불규칙할 때는 진정과 보습 케어를 함께 챙기세요"
    }',
    '리추얼 메시지 팁',
    '',
    'json'
  )
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();
