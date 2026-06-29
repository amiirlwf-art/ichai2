-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name_fa TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✦',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
  name_fa TEXT NOT NULL,
  description_fa TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add search_vector column to existing tables (safe for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE public.products ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(name_fa, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description_fa, '')), 'B')
    ) STORED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cafe_info (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  name TEXT NOT NULL,
  tagline TEXT,
  phone TEXT,
  address_fa TEXT,
  instagram TEXT,
  telegram TEXT,
  hours_fa TEXT,
  about_fa TEXT,
  welcome_fa TEXT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_order ON public.products ("order");
CREATE INDEX IF NOT EXISTS idx_products_name_fa ON public.products (name_fa text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories ("order");

-- 3. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_info ENABLE ROW LEVEL SECURITY;

-- 4. Policies for public (anonymous) read access
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read cafe_info" ON public.cafe_info;
CREATE POLICY "Public read cafe_info" ON public.cafe_info FOR SELECT USING (true);

-- 5. Policies for authenticated (admin) INSERT/UPDATE/DELETE (split to avoid multiple permissive)
DROP POLICY IF EXISTS "Admin insert categories" ON public.categories;
CREATE POLICY "Admin insert categories" ON public.categories FOR INSERT
  TO authenticated WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin update categories" ON public.categories;
CREATE POLICY "Admin update categories" ON public.categories FOR UPDATE
  TO authenticated USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin delete categories" ON public.categories;
CREATE POLICY "Admin delete categories" ON public.categories FOR DELETE
  TO authenticated USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin all categories" ON public.categories;

DROP POLICY IF EXISTS "Admin insert products" ON public.products;
CREATE POLICY "Admin insert products" ON public.products FOR INSERT
  TO authenticated WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin update products" ON public.products;
CREATE POLICY "Admin update products" ON public.products FOR UPDATE
  TO authenticated USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin delete products" ON public.products;
CREATE POLICY "Admin delete products" ON public.products FOR DELETE
  TO authenticated USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin all products" ON public.products;

DROP POLICY IF EXISTS "Admin insert cafe_info" ON public.cafe_info;
CREATE POLICY "Admin insert cafe_info" ON public.cafe_info FOR INSERT
  TO authenticated WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin update cafe_info" ON public.cafe_info;
CREATE POLICY "Admin update cafe_info" ON public.cafe_info FOR UPDATE
  TO authenticated USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin delete cafe_info" ON public.cafe_info;
CREATE POLICY "Admin delete cafe_info" ON public.cafe_info FOR DELETE
  TO authenticated USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admin all cafe_info" ON public.cafe_info;

-- 6. Seed data (insert initial values)
INSERT INTO public.categories (id, name_fa, icon, "order") VALUES
  ('cat-1', 'همه', '✦', 0),
  ('cat-2', 'قهوه‌های گرم', '☕️', 1),
  ('cat-3', 'نوشیدنی‌های سرد', '🧊', 2),
  ('cat-4', 'چای و دمنوش', '🍵', 3),
  ('cat-5', 'دسرها', '🍰', 4),
  ('cat-6', 'صبحانه', '🥐', 5),
  ('cat-7', 'غذاهای سبک', '🥗', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cafe_info (id, name, tagline, phone, address_fa, instagram, telegram, hours_fa, about_fa, welcome_fa)
VALUES (
  'singleton',
  'کافه آی‌چای',
  'تجربه‌ای ناب از طعم و آرامش',
  '۰۲۱-۸۸۷۷۶۶۵۵',
  'تهران، خیابان ولیعصر، نبش کوچه گلستان، پلاک ۱۲۰',
  '@aichai_cafe',
  '@aichai_cafe',
  'هر روز از ساعت ۸ صبح تا ۱۲ شب',
  'کافه آی‌چای با هدف خلق فضایی آرام و دل‌نشین در قلب تهران تأسیس شده است. ما با بهترین دانه‌های قهوه از سراسر جهان و تازه‌ترین مواد اولیه، تجربه‌ای متفاوت از طعم و کیفیت را برای شما به ارمغان می‌آوریم. فضای گرم و صمیمی کافه، همراه با موسیقی ملایم و سرویس حرفه‌ای، مکانی ایده‌آل برای دورهمی‌های دوستانه، جلسات کاری و لحظات آرام شماست.',
  'به کافه آی‌چای خوش آمدید'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, category_id, name_fa, description_fa, price, image_url, is_featured, "order") VALUES
  ('prod-1', 'cat-2', 'اسپرسو', 'عصاره خالص قهوه با طعمی غلیظ و عطری بی‌نظیر', 85000, 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&q=80', true, 1),
  ('prod-2', 'cat-2', 'لاته', 'ترکیب لطیف اسپرسو با شیر بخار‌خورده و فوم مخملی', 125000, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80', true, 2),
  ('prod-3', 'cat-2', 'کاپوچینو', 'اسپرسو با شیر فوم‌گرفته و پودر دارچین', 115000, 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400&q=80', false, 3),
  ('prod-4', 'cat-2', 'آمریکانو', 'اسپرسو رقیق با آب داغ، مناسب برای عاشقان قهوه خالص', 95000, 'https://images.unsplash.com/photo-1497636577773-f1231844b336?w=400&q=80', false, 4),
  ('prod-5', 'cat-2', 'موکا', 'ترکیب شکلات تلخ با اسپرسو و شیر بخار‌خورده', 135000, 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400&q=80', true, 5),
  ('prod-6', 'cat-2', 'قهوه ترک', 'قهوه سنتی ترک با طعمی ماندگار و عطری دل‌انگیز', 105000, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80', false, 6),
  ('prod-7', 'cat-3', 'آیس لاته', 'لاته سرد با یخ، مناسب روزهای گرم تابستان', 130000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80', false, 7),
  ('prod-8', 'cat-3', 'فراپوچینو', 'نوشیدنی یخی قهوه با خامه و سس شکلات', 145000, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80', true, 8),
  ('prod-9', 'cat-3', 'آبمیوه طبیعی', 'آبمیوه تازه فصل، بدون افزودنی و شکر', 95000, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80', false, 9),
  ('prod-10', 'cat-3', 'اسموتی میوه', 'ترکیب میوه‌های تازه با ماست و عسل طبیعی', 140000, 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&q=80', false, 10),
  ('prod-11', 'cat-4', 'چای سیاه', 'چای اصیل ایرانی با عطر بهارنارنج', 65000, 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&q=80', false, 11),
  ('prod-12', 'cat-4', 'دمنوش بابونه', 'آرامش‌بخش و مناسب برای رفع خستگی روزانه', 75000, 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80', false, 12),
  ('prod-13', 'cat-4', 'چای ماسالا', 'چای هندی با ادویه‌های معطر و شیر بخار‌خورده', 110000, 'https://images.unsplash.com/photo-1593527141222-ee3e83766b2f?w=400&q=80', true, 13),
  ('prod-14', 'cat-5', 'تیرامیسو', 'دسر ایتالیایی با قهوه اسپرسو و پنیر ماسکارپونه', 155000, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&q=80', true, 14),
  ('prod-15', 'cat-5', 'چیزکیک', 'کیک پنیری نرم با سس توت‌فرنگی تازه', 145000, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80', false, 15),
  ('prod-16', 'cat-5', 'براونی شکلاتی', 'براونی تازه با مغز گردو و سس شکلات تلخ', 125000, 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&q=80', false, 16)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- Feedbacks table
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT DEFAULT 'ناشناس',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.feedbacks (created_at);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous insert" ON public.feedbacks;
CREATE POLICY "Allow anonymous insert" ON public.feedbacks
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select" ON public.feedbacks;
CREATE POLICY "Allow authenticated select" ON public.feedbacks
  FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete" ON public.feedbacks;
CREATE POLICY "Allow authenticated delete" ON public.feedbacks
  FOR DELETE TO authenticated USING ((select auth.role()) = 'authenticated');

-- Auto-delete feedbacks older than 7 days
CREATE OR REPLACE FUNCTION delete_old_feedbacks()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.feedbacks WHERE created_at < now() - INTERVAL '7 days';
END;
$$;

-- ═══════════════════════════════════════════════════
-- Task 1: Orphaned image cleanup with audit log
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.image_cleanup_log (
  id BIGSERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  image_url TEXT,
  reason TEXT NOT NULL,
  cleaned_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_cleanup_log_cleaned_at ON public.image_cleanup_log (cleaned_at);

ALTER TABLE public.image_cleanup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage cleanup log" ON public.image_cleanup_log;
CREATE POLICY "Service role can manage cleanup log" ON public.image_cleanup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function: find and delete orphaned storage files not referenced by any product
CREATE OR REPLACE FUNCTION cleanup_orphaned_images()
RETURNS TABLE(deleted_path TEXT, deleted_url TEXT, delete_reason TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  storage_path TEXT;
  marker TEXT := '/storage/v1/object/public/cafe-images/';
  pos INTEGER;
BEGIN
  FOR rec IN
    SELECT DISTINCT
      so.name AS file_name,
      so.bucket_id,
      so.created_at AS file_created
    FROM storage.objects so
    WHERE so.bucket_id = 'cafe-images'
      AND so.created_at < now() - INTERVAL '7 days'
  LOOP
    storage_path := rec.file_name;

    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.image_url LIKE '%cafe-images/' || storage_path || '%'
    ) THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'cafe-images' AND name = storage_path;

      INSERT INTO public.image_cleanup_log (file_path, image_url, reason)
      VALUES (
        storage_path,
        'https://ehdwvdubcudlvbpbsvld.supabase.co/storage/v1/object/public/cafe-images/' || storage_path,
        'orphaned_7_days'
      );

      deleted_path := storage_path;
      deleted_url := 'https://ehdwvdubcudlvbpbsvld.supabase.co/storage/v1/object/public/cafe-images/' || storage_path;
      delete_reason := 'orphaned_7_days';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Schedule daily cleanup jobs via pg_cron (requires pg_cron extension)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'delete-old-feedbacks',
      '0 3 * * *',
      'SELECT delete_old_feedbacks()'
    );
    PERFORM cron.schedule(
      'cleanup-orphaned-images',
      '30 3 * * *',
      'SELECT cleanup_orphaned_images()'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- Storage: cafe-images bucket + policies
-- ═══════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('cafe-images', 'cafe-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cafe-images');

-- Public bucket allows direct URL access; no broad SELECT policy needed
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cafe-images');
