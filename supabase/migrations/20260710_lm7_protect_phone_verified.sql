-- LM-7 : interdire l'écriture cliente de profiles.phone_verified
-- La policy RLS "Users can update own profile" autorise l'UPDATE de la ligne
-- entière (RLS est ligne, pas colonne) : n'importe quel utilisateur connecté
-- pouvait passer phone_verified à true directement via le client Supabase,
-- contournant l'OTP. Seul le service role (routes serveur : phone-verify/confirm,
-- profile) peut désormais faire évoluer cette colonne.

CREATE OR REPLACE FUNCTION public.protect_profile_phone_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
        NEW.phone_verified := OLD.phone_verified;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_phone_verified ON public.profiles;
CREATE TRIGGER trg_protect_profile_phone_verified
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_phone_verified();
