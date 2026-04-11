-- products 테이블 태그 컬럼 추가
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS
    step_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    func_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    hormone_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    weather_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    season_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    gender_tag TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS
    situation_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    body_part_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    lifestyle_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    timing_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    event_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    ingredient_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    medical_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS
    ai_tag_status TEXT NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.products.step_tags
  IS '루틴단계: 클렌징|토너|앰플·세럼|크림|선케어|마스크|바디케어|헤어케어';
COMMENT ON COLUMN public.products.func_tags
  IS '기능: 보습·수분|탄력·주름|미백·톤업|진정·민감|장벽·재생|모공·피지|아로마·릴렉스|트러블케어|노화케어';
COMMENT ON COLUMN public.products.hormone_tags
  IS '호르몬: 달빛기|황금기|만개기|물들기|갱년기|남성|전연령';
COMMENT ON COLUMN public.products.weather_tags
  IS '날씨: 자외선높음|자외선매우높음|미세먼지나쁨|황사|건조한날|일교차큼|고온다습|전천후';
COMMENT ON COLUMN public.products.season_tags
  IS '계절: 봄|여름|가을|겨울|전계절';
COMMENT ON COLUMN public.products.gender_tag
  IS '성별: 여성|남성|공용';
COMMENT ON COLUMN public.products.situation_tags
  IS '상황: 여드름·뾰루지|피지·모공|좁쌀|가려움|벌레물림|압출후|시술후|음주후|수면부족|스트레스|반신욕용|족욕용|체취케어|마스크후|운동후|비행기탑승|임신·수유중|산후|아토피|10대사춘기';
COMMENT ON COLUMN public.products.body_part_tags
  IS '부위: 이마|코·T존|볼·U존|눈가|입술|턱라인|목·데콜테|등|팔닭살|겨드랑이|발뒤꿈치|복부|무릎·팔꿈치';
COMMENT ON COLUMN public.products.lifestyle_tags
  IS '라이프: 수면부족|야근후|음주후|다이어트중|카페인과다|시험·발표전후|직장스트레스';
COMMENT ON COLUMN public.products.timing_tags
  IS '타이밍: 기상직후|세안직후|외출전|점심리터치|퇴근후|취침전|주말스페셜|5분이내|10~15분|30분|1시간이상';
COMMENT ON COLUMN public.products.event_tags
  IS '이벤트: 웨딩신부|웨딩신랑|웨딩D-100|웨딩D-60|웨딩D-30|웨딩D-14|웨딩D-7|웨딩D-3|웨딩D-1|웨딩당일|웨딩후|졸업사진|소개팅|면접|해외여행|출산예정|선물용';
COMMENT ON COLUMN public.products.ingredient_tags
  IS '성분: 비건|크루얼티프리|무향|무색소|천연·유기농|EWG그린|임산부안전|스테로이드프리|파라벤프리|레티놀함유|AHA함유|BHA함유|나이아신아마이드|세라마이드|히알루론산|펩타이드';
COMMENT ON COLUMN public.products.medical_tags
  IS '의료: 아토피|건선|지루성피부염|로사세아|색소침착|흉터케어|보톡스후|필러후|레이저후|박피후|항암중';
COMMENT ON COLUMN public.products.ai_tag_status
  IS 'AI태깅상태: pending(미태깅)|ai_suggested(AI제안)|reviewed(검토완료)|approved(승인완료)';

-- GIN 인덱스 (배열 검색 최적화)
CREATE INDEX IF NOT EXISTS products_step_tags_idx
  ON public.products USING GIN (step_tags);
CREATE INDEX IF NOT EXISTS products_func_tags_idx
  ON public.products USING GIN (func_tags);
CREATE INDEX IF NOT EXISTS products_hormone_tags_idx
  ON public.products USING GIN (hormone_tags);
CREATE INDEX IF NOT EXISTS products_weather_tags_idx
  ON public.products USING GIN (weather_tags);
CREATE INDEX IF NOT EXISTS products_situation_tags_idx
  ON public.products USING GIN (situation_tags);
CREATE INDEX IF NOT EXISTS products_event_tags_idx
  ON public.products USING GIN (event_tags);
