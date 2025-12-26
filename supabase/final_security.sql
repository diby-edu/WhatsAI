-- Réactiver la sécurité (RLS) sur la table profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques potentiellement conflictuelles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Politique 1 : Un utilisateur peut voir UNIQUEMENT son propre profil
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Politique 2 : Un utilisateur peut modifier UNIQUEMENT son propre profil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- (Optionnel) Les admins peuvent tout voir
-- Attention : cela suppose que vous avez réussi à lire le rôle 'admin' d'abord.
-- Pour éviter la boucle infinie, on utilise une fonction ou on garde simple pour l'instant.
-- La politique ci-dessus suffit pour le Login.
