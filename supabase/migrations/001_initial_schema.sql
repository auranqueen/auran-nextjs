-- ============================================================
-- AURAN Platform - Supabase Schema v1.0
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('customer', 'partner', 'owner', 'brand', 'admin');
CREATE TYPE auth_provider AS ENUM ('email', 'kakao', 'naver', 'google');
CREATE TYPE order_status AS ENUM ('주문확인', '발송준비', '배송중', '배송완료', '취소', '환불');
CREATE TYPE settlement_status AS ENUM ('정산대기', '정산완료', '보류');
CREATE TYPE refund_status AS ENUM ('요청', '승인', '완료', '거절');
CREATE TYPE coupon_type AS ENUM ('rate', 'amount');
CREATE TYPE review_status AS ENUM ('대기', '게시', '숨김', '삭제');
CREATE TYPE notification_target AS ENUM ('all', 'customer', 'partner', 'owner', 'brand');
CREATE TYPE plan_type AS ENUM ('basic', 'pro', 'premium');
CREATE TYPE store_grade AS ENUM ('none', 'basic', 'silver', 'gold');
CREATE TYPE partner_grade AS ENUM ('rookie', 'silver', 'gold', 'platinum');

-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE,                        -- Supabase auth.users 연결
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  birthday      DATE,
  age_group     TEXT,
  role          user_role NOT NULL DEFAULT 'customer',
  provider      auth_provider NOT NULL DEFAULT 'email',
  status        TEXT NOT NULL DEFAULT 'active',     -- active | suspended | deleted
  avatar_url    TEXT,
  -- 고객 전용
  skin_type     TEXT,
  skin_concerns TEXT[],
  -- 파트너 전용
  partner_grade partner_grade DEFAULT 'rookie',
  commission_rate DECIMAL(5,2) DEFAULT 5.0,
  referral_code TEXT UNIQUE,
  referred_by   UUID REFERENCES public.users(id),
  -- 원장님 전용
  salon_name    TEXT,
  salon_area    TEXT,
  plan          plan_type DEFAULT 'basic',
  store_grade   store_grade DEFAULT 'none',
  store_commission DECIMAL(5,2) DEFAULT 0,
  plan_expires_at TIMESTAMPTZ,
  auto_renew    BOOLEAN DEFAULT true,
  -- 브랜드사 전용
  brand_name    TEXT,
  brand_origin  TEXT,
  brand_desc    TEXT,
  supply_rate   DECIMAL(5,2) DEFAULT 45,
  biz_no        TEXT,
  brand_status  TEXT DEFAULT 'pending',             -- pending | active | suspended
  -- 공통
  points        INTEGER NOT NULL DEFAULT 0,
  charge_balance INTEGER NOT NULL DEFAULT 0,
  total_orders  INTEGER DEFAULT 0,
  invite_count  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_referred_by ON public.users(referred_by);

-- ============================================================
-- 2. 로그인 로그
-- ============================================================

CREATE TABLE public.login_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email      TEXT,
  role       user_role,
  provider   auth_provider,
  ip_address TEXT,
  user_agent TEXT,
  status     TEXT NOT NULL DEFAULT 'success',        -- success | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_logs_user ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_created ON public.login_logs(created_at DESC);

-- ============================================================
-- 3. 개인정보 동의 로그
-- ============================================================

CREATE TABLE public.privacy_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  log_type    TEXT NOT NULL,                         -- consent | collect | access | delete
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 브랜드 (입점 브랜드)
-- ============================================================

CREATE TABLE public.brands (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  origin       TEXT,
  description  TEXT,
  logo_url     TEXT,
  supply_rate  DECIMAL(5,2) DEFAULT 45,
  min_order    INTEGER DEFAULT 0,
  contact      TEXT,
  biz_no       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',      -- pending | active | suspended
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. 제품
-- ============================================================

CREATE TABLE public.products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  ingredient    TEXT,
  detail_html   TEXT,
  retail_price  INTEGER NOT NULL DEFAULT 0,
  supply_price  INTEGER DEFAULT 0,
  stock         INTEGER DEFAULT 0,
  thumb_img     TEXT,
  detail_imgs   TEXT[],
  icon          TEXT DEFAULT '💊',
  tag           TEXT,
  category      TEXT,
  skin_types    TEXT[],
  age_groups    TEXT[],
  quiz_match    TEXT[],
  status        TEXT NOT NULL DEFAULT 'pending',     -- pending | active | discontinued
  approved_at   TIMESTAMPTZ,
  sales_count   INTEGER DEFAULT 0,
  review_count  INTEGER DEFAULT 0,
  avg_rating    DECIMAL(3,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category);

-- ============================================================
-- 6. 살롱 (원장님 샵)
-- ============================================================

CREATE TABLE public.salons (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  area           TEXT,
  address        TEXT,
  phone          TEXT,
  banner_url     TEXT,
  avatar_url     TEXT,
  services       JSONB DEFAULT '[]',
  open_hours     JSONB DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'active',
  review_count   INTEGER DEFAULT 0,
  avg_rating     DECIMAL(3,2) DEFAULT 0,
  monthly_sales  INTEGER DEFAULT 0,
  total_sales    INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. 예약
-- ============================================================

CREATE TABLE public.bookings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  salon_id     UUID REFERENCES public.salons(id) ON DELETE SET NULL,
  owner_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  service_price INTEGER DEFAULT 0,
  booking_date DATE NOT NULL,
  booking_time TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT '예약확정',    -- 예약확정 | 완료 | 취소 | 대기
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_salon ON public.bookings(salon_id);
CREATE INDEX idx_bookings_date ON public.bookings(booking_date DESC);

-- ============================================================
-- 8. 주문
-- ============================================================

CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no        TEXT UNIQUE NOT NULL DEFAULT 'AUR'||TO_CHAR(NOW(),'YYMMDD')||LPAD(FLOOR(RANDOM()*99999)::TEXT,5,'0'),
  customer_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status          order_status NOT NULL DEFAULT '주문확인',
  total_amount    INTEGER NOT NULL DEFAULT 0,
  point_used      INTEGER DEFAULT 0,
  charge_used     INTEGER DEFAULT 0,
  coupon_discount INTEGER DEFAULT 0,
  final_amount    INTEGER NOT NULL DEFAULT 0,
  earn_points     INTEGER DEFAULT 0,
  points_awarded  BOOLEAN DEFAULT false,
  -- 배송 정보
  tracking_no     TEXT,
  courier         TEXT,
  recipient_name  TEXT,
  recipient_phone TEXT,
  address         TEXT,
  -- 파트너 연결
  partner_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  partner_commission INTEGER DEFAULT 0,
  -- 원장님 연결
  owner_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_commission INTEGER DEFAULT 0,
  -- 날짜
  ordered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  -- 알림
  ship_notified   BOOLEAN DEFAULT false,
  delivery_notified BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_no ON public.orders(order_no);
CREATE INDEX idx_orders_partner ON public.orders(partner_id);

-- ============================================================
-- 9. 주문 아이템
-- ============================================================

CREATE TABLE public.order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  brand_id    UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  subtotal    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ============================================================
-- 10. 환불
-- ============================================================

CREATE TABLE public.refunds (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount       INTEGER NOT NULL,
  reason       TEXT,
  status       refund_status NOT NULL DEFAULT '요청',
  is_partial   BOOLEAN DEFAULT false,
  partial_items JSONB,
  approved_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refunds_order ON public.refunds(order_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);

-- ============================================================
-- 11. 정산
-- ============================================================

CREATE TABLE public.settlements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_role     user_role NOT NULL,
  target_name     TEXT,
  amount          INTEGER NOT NULL,
  platform_fee    INTEGER DEFAULT 0,
  net_amount      INTEGER NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          settlement_status NOT NULL DEFAULT '정산대기',
  order_ids       UUID[],
  approved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  memo            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_target ON public.settlements(target_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);

-- ============================================================
-- 12. 포인트 내역
-- ============================================================

CREATE TABLE public.point_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                         -- earn | use | expire | admin
  amount      INTEGER NOT NULL,
  balance     INTEGER NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT '✨',
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  admin_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_history_user ON public.point_history(user_id);
CREATE INDEX idx_point_history_created ON public.point_history(created_at DESC);

-- ============================================================
-- 13. 충전 내역
-- ============================================================

CREATE TABLE public.charge_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  bonus       INTEGER NOT NULL DEFAULT 0,
  plan_label  TEXT,
  method      TEXT DEFAULT '카드',
  pg_tid      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. 충전 플랜 설정
-- ============================================================

CREATE TABLE public.charge_plans (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  bonus      INTEGER NOT NULL DEFAULT 0,
  pct        DECIMAL(5,2) DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  is_active  BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 충전 플랜
INSERT INTO public.charge_plans (label, amount, bonus, pct, is_popular, sort_order) VALUES
  ('1만원', 10000, 1000, 10.0, false, 1),
  ('3만원', 30000, 4000, 13.3, false, 2),
  ('5만원', 50000, 8000, 16.0, true,  3),
  ('10만원', 100000, 18000, 18.0, false, 4),
  ('20만원', 200000, 42000, 21.0, false, 5);

-- ============================================================
-- 15. 쿠폰
-- ============================================================

CREATE TABLE public.coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  type            coupon_type NOT NULL DEFAULT 'rate',
  discount_rate   DECIMAL(5,2),
  discount_amount INTEGER,
  min_order       INTEGER DEFAULT 0,
  max_discount    INTEGER,
  start_at        TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  usage_limit     INTEGER,
  used_count      INTEGER DEFAULT 0,
  brand_ids       UUID[],
  product_ids     UUID[],
  target_roles    user_role[],
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.coupon_usage (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id   UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount    INTEGER NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

-- ============================================================
-- 16. 리뷰
-- ============================================================

CREATE TABLE public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  review_type  TEXT NOT NULL,                        -- product | salon | owner
  target_id    UUID NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content      TEXT,
  images       TEXT[],
  status       review_status NOT NULL DEFAULT '대기',
  report_count INTEGER DEFAULT 0,
  approved_by  UUID REFERENCES public.users(id),
  approved_at  TIMESTAMPTZ,
  order_id     UUID REFERENCES public.orders(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_target ON public.reviews(target_id);
CREATE INDEX idx_reviews_author ON public.reviews(author_id);
CREATE INDEX idx_reviews_status ON public.reviews(status);
CREATE INDEX idx_reviews_type ON public.reviews(review_type);

-- 리뷰 신고
CREATE TABLE public.review_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id   UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. 커뮤니티
-- ============================================================

CREATE TABLE public.posts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category     TEXT NOT NULL DEFAULT 'general',      -- tip | review | qna | video
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  images       TEXT[],
  video_url    TEXT,
  skin_type    TEXT,
  like_count   INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count   INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  is_hidden    BOOLEAN DEFAULT false,
  is_deleted   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_category ON public.posts(category);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

CREATE TABLE public.comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id      UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content      TEXT NOT NULL,
  like_count   INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  is_hidden    BOOLEAN DEFAULT false,
  is_deleted   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON public.comments(post_id);

-- 신고
CREATE TABLE public.content_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,                        -- post | comment
  content_id   UUID NOT NULL,
  reason       TEXT,
  status       TEXT DEFAULT '대기',                  -- 대기 | 처리 | 기각
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. 피부 분석 기록
-- ============================================================

CREATE TABLE public.skin_analyses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_answers JSONB NOT NULL DEFAULT '{}',
  skin_type   TEXT,
  skin_score  INTEGER,
  concerns    TEXT[],
  recommended_products UUID[],
  result_data JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skin_analyses_user ON public.skin_analyses(user_id);
CREATE INDEX idx_skin_analyses_skin_type ON public.skin_analyses(skin_type);

-- ============================================================
-- 19. 알림 (고객용)
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                         -- delivery | point | promo | system
  title       TEXT NOT NULL,
  body        TEXT,
  icon        TEXT DEFAULT '🔔',
  is_read     BOOLEAN DEFAULT false,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);

-- ============================================================
-- 20. 관리자 알림 발송 (Push)
-- ============================================================

CREATE TABLE public.admin_broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID REFERENCES public.users(id),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  target      notification_target NOT NULL DEFAULT 'all',
  type        TEXT DEFAULT 'notice',                 -- notice | event | push
  sent_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. 초대 링크
-- ============================================================

CREATE TABLE public.invite_links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  role        user_role NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  note        TEXT,
  url         TEXT NOT NULL,
  used_count  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invite_links_code ON public.invite_links(code);

-- ============================================================
-- 22. 추천 매핑 룰
-- ============================================================

CREATE TABLE public.mapping_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  q_condition  TEXT NOT NULL,
  brand_id     UUID REFERENCES public.brands(id),
  product_id   UUID REFERENCES public.products(id),
  priority     INTEGER DEFAULT 1,
  memo         TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 23. 납품 프로모션
-- ============================================================

CREATE TABLE public.supply_promos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id     UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  promo_type   TEXT NOT NULL,                        -- bundle | qty_price | discount
  title        TEXT NOT NULL,
  condition    TEXT,
  bonus        TEXT,
  qty          INTEGER,
  bonus_qty    INTEGER,
  total_price  INTEGER,
  discount_pct DECIMAL(5,2),
  start_date   DATE,
  end_date     DATE,
  status       TEXT DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 24. 브랜드 공지
-- ============================================================

CREATE TABLE public.brand_notices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id    UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  notice_type TEXT NOT NULL DEFAULT 'info',          -- promo | info | urgent
  title       TEXT NOT NULL,
  body        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',       -- pending | active | rejected
  approved_by UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 25. 유입 분석
-- ============================================================

CREATE TABLE public.traffic_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source      TEXT NOT NULL DEFAULT 'direct',        -- naver | instagram | kakao | direct | partner
  medium      TEXT,
  campaign    TEXT,
  invite_code TEXT,
  partner_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  page        TEXT,
  action      TEXT,                                  -- visit | signup | purchase
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traffic_source ON public.traffic_logs(source);
CREATE INDEX idx_traffic_action ON public.traffic_logs(action);
CREATE INDEX idx_traffic_created ON public.traffic_logs(created_at DESC);

-- ============================================================
-- 26. 앱 설정
-- ============================================================

CREATE TABLE public.app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  label       TEXT,
  type        TEXT DEFAULT 'text',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_config (key, value, label) VALUES
  ('social_kakao', 'true', '카카오 로그인'),
  ('social_naver', 'true', '네이버 로그인'),
  ('social_google', 'true', '구글 로그인'),
  ('welcome_point', '500', '가입 포인트'),
  ('analysis_point', '500', '피부분석 포인트'),
  ('diary_point', '5', '일지 작성 포인트'),
  ('purchase_point_rate', '1', '구매 적립률(%)'),
  ('platform_fee_rate', '9.5', '플랫폼 수수료율(%)'),
  ('referral_point', '2000', '추천인 포인트');

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 조회 (users)
CREATE POLICY "users_own" ON public.users
  FOR ALL USING (auth.uid() = auth_id);

-- 관리자는 전체 접근
CREATE POLICY "admin_all_users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 주문 본인만
CREATE POLICY "orders_own" ON public.orders
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- 관리자 주문 전체
CREATE POLICY "admin_all_orders" ON public.orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 알림 본인만
CREATE POLICY "notif_own" ON public.notifications
  FOR ALL USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER salons_updated_at BEFORE UPDATE ON public.salons FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 포인트 지급 함수
CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_icon TEXT DEFAULT '✨',
  p_order_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE public.users SET points = points + p_amount WHERE id = p_user_id RETURNING points INTO v_balance;
  INSERT INTO public.point_history (user_id, type, amount, balance, description, icon, order_id)
    VALUES (p_user_id, 'earn', p_amount, v_balance, p_description, p_icon, p_order_id);
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 배송완료 포인트 자동 적립
CREATE OR REPLACE FUNCTION handle_delivery_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = '배송완료' AND OLD.status != '배송완료' AND NOT NEW.points_awarded THEN
    PERFORM award_points(NEW.customer_id, NEW.earn_points, '구매 포인트 적립', '🛒', NEW.id);
    UPDATE public.orders SET points_awarded = true WHERE id = NEW.id;
    INSERT INTO public.notifications (user_id, type, title, body, icon)
      SELECT NEW.customer_id, 'delivery_done', '배송 완료', 
        '주문하신 상품이 도착했습니다. +' || NEW.earn_points || 'P 적립!', '📦';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_delivery_complete
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION handle_delivery_complete();

-- 회원가입 포인트
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE v_welcome_pts INTEGER;
BEGIN
  SELECT value::INTEGER INTO v_welcome_pts FROM public.app_config WHERE key = 'welcome_point';
  v_welcome_pts := COALESCE(v_welcome_pts, 500);
  PERFORM award_points(NEW.id, v_welcome_pts, '회원가입 환영 포인트', '🎁');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_user
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 리뷰 평점 자동 업데이트
CREATE OR REPLACE FUNCTION update_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'reviews' THEN
    IF NEW.review_type = 'product' THEN
      UPDATE public.products SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE target_id = NEW.target_id AND review_type='product' AND status='게시'),
        avg_rating = (SELECT AVG(rating) FROM reviews WHERE target_id = NEW.target_id AND review_type='product' AND status='게시')
      WHERE id = NEW.target_id;
    ELSIF NEW.review_type = 'salon' THEN
      UPDATE public.salons SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE target_id = NEW.target_id AND review_type='salon' AND status='게시'),
        avg_rating = (SELECT AVG(rating) FROM reviews WHERE target_id = NEW.target_id AND review_type='salon' AND status='게시')
      WHERE id = NEW.target_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_update AFTER INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_review_stats();
