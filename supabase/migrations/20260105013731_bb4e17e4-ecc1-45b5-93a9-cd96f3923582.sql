-- Create table for per-link call configuration
CREATE TABLE IF NOT EXISTS public.call_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  duration_seconds integer NOT NULL,
  status text NOT NULL DEFAULT 'unused',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  consumed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.call_links ENABLE ROW LEVEL SECURITY;

-- Everyone can read call_links to validate links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_links'
      AND policyname = 'Call links are readable by everyone'
  ) THEN
    CREATE POLICY "Call links are readable by everyone"
      ON public.call_links
      FOR SELECT
      USING (true);
  END IF;
END$$;

-- Anyone (including anônimos) can consume an unused link, but only by marking it as used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_links'
      AND policyname = 'Anyone can consume unused call links'
  ) THEN
    CREATE POLICY "Anyone can consume unused call links"
      ON public.call_links
      FOR UPDATE
      USING (status = 'unused')
      WITH CHECK (status = 'used');
  END IF;
END$$;

-- Only the admin user can create new call links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'call_links'
      AND policyname = 'Only admin can insert call links'
  ) THEN
    CREATE POLICY "Only admin can insert call links"
      ON public.call_links
      FOR INSERT
      WITH CHECK (auth.uid() = 'f0340c35-8dc1-41fd-9956-c16ebe6f3f6e'::uuid);
  END IF;
END$$;

-- Increase upload limit for call-media bucket to allow larger videos (e.g. ~1GB)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'file_size_limit'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 1073741824 -- 1 GB
    WHERE id = 'call-media';
  END IF;
END$$;