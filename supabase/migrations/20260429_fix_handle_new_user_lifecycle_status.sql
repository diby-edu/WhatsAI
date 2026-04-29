-- Fix: handle_new_user trigger ne settait pas account_lifecycle_status
-- Résultat: tous les nouveaux comptes héritaient du DEFAULT 'inactive' de la colonne
-- au lieu de 'test', les faisant apparaître incorrectement comme inactifs dès l'inscription.

-- Étape 1: Corriger les comptes existants mal classés
-- (deadline dans le futur mais marqués inactive à tort)
UPDATE profiles
SET account_lifecycle_status = 'test'
WHERE test_account_cleanup_deadline > NOW()
  AND test_account_qualified_at IS NULL
  AND paid_until IS NULL
  AND grace_until IS NULL
  AND account_lifecycle_status = 'inactive';

-- Étape 2: Corriger le trigger pour les futurs comptes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits_balance, test_account_cleanup_deadline, account_lifecycle_status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        10,
        NOW() + INTERVAL '7 days',
        'test'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
