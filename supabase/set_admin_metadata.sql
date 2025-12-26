-- Mettre à jour les métadonnées de l'utilisateur pour inclure le rôle 'admin'
-- Cela permet au login de détecter le rôle sans interroger la table profiles (contourne le RLS).

UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data IS NULL THEN '{"role": "admin"}'::jsonb
    ELSE raw_user_meta_data || '{"role": "admin"}'::jsonb
  END
WHERE email = 'konointer@gmail.com';

-- Vérification
SELECT email, raw_user_meta_data FROM auth.users WHERE email = 'konointer@gmail.com';
