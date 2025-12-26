-- ==========================================
-- SCRIPT DE SÉCURITÉ PRODUCTION (RLS CLEAN)
-- ==========================================

-- 1. Nettoyage complet des politiques existantes
-- (Pour éviter tout conflit ou recursion)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own agents" ON agents;
DROP POLICY IF EXISTS "Users can create own agents" ON agents;
DROP POLICY IF EXISTS "Users can update own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON agents;

-- 2. Activation de la sécurité sur les tables critiques
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- 3. Politiques PROFILES (Simples et sans récursion)
-- Lecture : Chacun voit son propre profil. 
-- Note : L'admin verra aussi le sien, mais pas ceux des autres via cette regle. 
-- Pour l'admin, on utilisera le bypass via Service Role Key coté serveur ou une politique spéciale SANS query sur profiles.
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Modification : Chacun modifie son propre profil
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- 4. Politiques AGENTS
-- Lecture : Voir ses propres agents
CREATE POLICY "Use users own agents" 
ON agents FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Creation : Créer un agent pour soi-même
CREATE POLICY "Users create own agents" 
ON agents FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Modification : Modifier ses propres agents
CREATE POLICY "Users update own agents" 
ON agents FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Suppression : Supprimer ses propres agents
CREATE POLICY "Users delete own agents" 
ON agents FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 5. Politique ADMIN (Optionnelle mais sécurisée via métadonnées)
-- Si l'utilisateur a le claim 'admin' dans son token JWT (auth.jwt()), il peut tout faire.
-- Cette méthode est ultra-performante et évite de lire la table 'profiles' (donc 0 recursion).
CREATE POLICY "Admins can do everything on profiles"
ON profiles
TO authenticated
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY "Admins can do everything on agents"
ON agents
TO authenticated
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

