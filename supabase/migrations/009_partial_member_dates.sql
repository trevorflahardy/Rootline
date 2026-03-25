-- Add partial date support for member birth/death fields
ALTER TABLE public.tree_members
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS birth_month INTEGER,
  ADD COLUMN IF NOT EXISTS birth_day INTEGER,
  ADD COLUMN IF NOT EXISTS death_year INTEGER,
  ADD COLUMN IF NOT EXISTS death_month INTEGER,
  ADD COLUMN IF NOT EXISTS death_day INTEGER;

ALTER TABLE public.tree_members
  ADD CONSTRAINT tree_members_birth_month_range CHECK (birth_month IS NULL OR (birth_month >= 1 AND birth_month <= 12)),
  ADD CONSTRAINT tree_members_birth_day_range CHECK (birth_day IS NULL OR (birth_day >= 1 AND birth_day <= 31)),
  ADD CONSTRAINT tree_members_death_month_range CHECK (death_month IS NULL OR (death_month >= 1 AND death_month <= 12)),
  ADD CONSTRAINT tree_members_death_day_range CHECK (death_day IS NULL OR (death_day >= 1 AND death_day <= 31));

-- Backfill partial date columns from existing full dates where available
UPDATE public.tree_members
SET
  birth_year = COALESCE(birth_year, EXTRACT(YEAR FROM date_of_birth)::INTEGER),
  birth_month = COALESCE(birth_month, EXTRACT(MONTH FROM date_of_birth)::INTEGER),
  birth_day = COALESCE(birth_day, EXTRACT(DAY FROM date_of_birth)::INTEGER)
WHERE date_of_birth IS NOT NULL;

UPDATE public.tree_members
SET
  death_year = COALESCE(death_year, EXTRACT(YEAR FROM date_of_death)::INTEGER),
  death_month = COALESCE(death_month, EXTRACT(MONTH FROM date_of_death)::INTEGER),
  death_day = COALESCE(death_day, EXTRACT(DAY FROM date_of_death)::INTEGER)
WHERE date_of_death IS NOT NULL;
