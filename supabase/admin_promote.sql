-- Remplacez 'votre@email.com' par l'email de l'utilisateur que vous avez créé
UPDATE profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'votre@email.com'
);

-- Vérifier que la mise à jour a fonctionné
SELECT * FROM profiles WHERE role = 'admin';
