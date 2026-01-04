-- Create table for PushinPay configuration
CREATE TABLE IF NOT EXISTS public.pushinpay_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.pushinpay_config ENABLE ROW LEVEL SECURITY;

-- RLS: only admin can manage config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pushinpay_config' 
      AND policyname = 'Somente admin pode gerenciar pushinpay_config'
  ) THEN
    CREATE POLICY "Somente admin pode gerenciar pushinpay_config"
    ON public.pushinpay_config
    FOR ALL
    USING (auth.uid() = 'f0340c35-8dc1-41fd-9956-c16ebe6f3f6e'::uuid)
    WITH CHECK (auth.uid() = 'f0340c35-8dc1-41fd-9956-c16ebe6f3f6e'::uuid);
  END IF;
END $$;

-- Trigger to keep updated_at/updated_by in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_pushinpay_config_updated_at'
  ) THEN
    CREATE TRIGGER update_pushinpay_config_updated_at
    BEFORE UPDATE ON public.pushinpay_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_call_config_updated_at();
  END IF;
END $$;