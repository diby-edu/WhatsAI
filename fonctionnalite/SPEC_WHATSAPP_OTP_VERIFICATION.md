# SPEC — Vérification numéro WhatsApp par OTP (Option B)

## Principe
Lors de l'onboarding, vérifier que l'utilisateur possède réellement le numéro WhatsApp saisi
en lui envoyant un code via un bot WhatsApp "master" appartenant à la plateforme.

## Architecture

```
Bot WhatsApp "Master" (1 seul, appartient à Wazzap)
    ↓ envoie le code OTP
Numéro du marchand (ex: +2250700000000)
    ↓ l'utilisateur tape le code sur le site
Système vérifie → sauvegarde phone_verified: true
```

## Prérequis
1. Un numéro WhatsApp dédié à la plateforme (SIM physique ou eSIM)
2. Une session Baileys "master" connectée sur le VPS (indépendante des agents)
3. Table Supabase `phone_otp`
4. Routes API send-otp + verify-otp
5. Étape supplémentaire dans l'onboarding

## Migration SQL

```sql
CREATE TABLE phone_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Fichiers à créer/modifier
- `src/app/api/auth/send-otp/route.ts` — génère code, insère en DB, envoie via bot master
- `src/app/api/auth/verify-otp/route.ts` — vérifie code, marque verified: true
- `src/app/[locale]/onboarding/page.tsx` — ajout step "Entrez le code reçu sur WhatsApp"
- `src/lib/whatsapp/master-session.ts` — session Baileys dédiée plateforme

## Flux onboarding modifié
1. Saisie numéro → clic "Envoyer le code"
2. Bot master envoie : "Votre code WazzapAI : 847291 — valable 10 min."
3. Champ code s'affiche → utilisateur saisit le code
4. Validation → phone_verified: true → onboarding continue

## Avantages / Inconvénients
✅ Confirme la possession réelle du numéro WhatsApp
✅ Cohérent avec la plateforme
✅ Pas de coût SMS externe

❌ SIM dédiée nécessaire
❌ Si bot master déconnecté → inscriptions bloquées
❌ Plus fragile qu'un SMS provider (Baileys peut perdre la connexion)

## Statut
A implémenter — priorité basse
