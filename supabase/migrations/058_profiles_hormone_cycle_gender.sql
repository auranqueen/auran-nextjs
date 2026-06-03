-- profiles: 호르몬 사이클 적용 여부 + 성별
-- hormone_cycle_applicable: TRUE=호르몬 페이즈 적용, FALSE=연령 기반 추천, NULL=온보딩 미완료
-- gender: 'F' | 'M' | 'Trans_MtF' | 'Trans_FtM' | 'other' | null

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hormone_cycle_applicable BOOLEAN DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.hormone_cycle_applicable IS
  '호르몬 사이클 작동 여부. TRUE=가임기/불임+호르몬정상/MtF, FALSE=갱년기/호르몬결핍, NULL=미입력';

COMMENT ON COLUMN public.profiles.gender IS
  '성별: F | M | Trans_MtF | Trans_FtM | other | null';
