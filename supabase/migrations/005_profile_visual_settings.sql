-- Add per-user tree visualization preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'descendant_highlight_depth'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN descendant_highlight_depth INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_descendant_highlight_depth_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_descendant_highlight_depth_check
  CHECK (descendant_highlight_depth >= 0 AND descendant_highlight_depth <= 10);
