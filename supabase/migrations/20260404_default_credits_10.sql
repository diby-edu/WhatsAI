-- Réduire les crédits initiaux des nouveaux clients de 50 à 10

-- 1. Mettre à jour le trigger handle_new_user pour expliciter credits_balance = 10
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits_balance, test_account_cleanup_deadline)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        10,
        NOW() + INTERVAL '7 days'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- 2. Mettre à jour la valeur par défaut dans app_settings
INSERT INTO public.app_settings (key, value)
VALUES ('defaultCredits', '10')
ON CONFLICT (key) DO UPDATE SET value = '10', updated_at = NOW();
