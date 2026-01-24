-- Harden sensitive tables and reduce stored PII

-- 1) Profiles: stop storing email in public table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update signup trigger function to no longer write email into profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- 2) Usage analytics: disallow anonymous rows by enforcing NOT NULL + default to current user
DELETE FROM public.usage_analytics WHERE user_id IS NULL;

ALTER TABLE public.usage_analytics
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

-- 3) Force RLS so table owners can't bypass it (hardening for sensitive tables)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.business_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_analyses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics FORCE ROW LEVEL SECURITY;
