-- Stream 34: Birthday Reminders
-- SQL function to compute days until the next birthday from today.

CREATE OR REPLACE FUNCTION public.days_until_birthday(dob DATE)
RETURNS INTEGER
LANGUAGE SQL
STABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT (
    CASE
      WHEN (DATE_TRUNC('year', CURRENT_DATE)::DATE + (dob - DATE_TRUNC('year', dob)::DATE)) >= CURRENT_DATE
      THEN (DATE_TRUNC('year', CURRENT_DATE)::DATE + (dob - DATE_TRUNC('year', dob)::DATE)) - CURRENT_DATE
      ELSE (DATE_TRUNC('year', CURRENT_DATE + INTERVAL '1 year')::DATE + (dob - DATE_TRUNC('year', dob)::DATE)) - CURRENT_DATE
    END
  )::INTEGER;
$$;
