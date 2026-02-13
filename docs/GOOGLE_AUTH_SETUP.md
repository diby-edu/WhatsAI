# Configuration Authentification Google - WazzapAI

## Le code est déjà prêt ✅

Les fichiers suivants sont déjà configurés :
- `src/app/[locale]/login/page.tsx` - Bouton "Continuer avec Google"
- `src/app/[locale]/register/page.tsx` - Bouton "Continuer avec Google"
- `src/app/auth/callback/route.ts` - Callback OAuth

---

## Étape 1 : Google Cloud Console

### 1.1 Créer un projet (ou utiliser existant)
1. Allez sur https://console.cloud.google.com
2. Créez un nouveau projet ou sélectionnez un existant

### 1.2 Configurer OAuth Consent Screen
1. **APIs & Services** → **OAuth consent screen**
2. Choisissez **External**
3. Remplissez :
   - App name: `WazzapAI`
   - User support email: `support@wazzapai.com`
   - Developer contact: `support@wazzapai.com`
4. Scopes: Ajoutez `email` et `profile`
5. Test users: Ajoutez votre email pour les tests

### 1.3 Créer les identifiants OAuth
1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `WazzapAI Web`
5. **Authorized JavaScript origins:**
   ```
   https://wazzapai.com
   http://localhost:3000
   ```
6. **Authorized redirect URIs:**
   ```
   https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1/callback
   ```
7. Cliquez **Create**
8. **Copiez le Client ID et Client Secret**

---

## Étape 2 : Supabase Dashboard

1. Allez dans votre projet Supabase
2. **Authentication** → **Providers**
3. Trouvez **Google** et cliquez pour activer
4. Collez :
   - **Client ID** : Depuis Google Cloud
   - **Client Secret** : Depuis Google Cloud
5. **Save**

---

## Étape 3 : Vérification

### Test en local
```bash
npm run dev
```
Allez sur http://localhost:3000/login et cliquez "Continuer avec Google"

### Test en production
Allez sur https://wazzapai.com/login et testez

---

## Redirect URI Supabase

Votre redirect URI Supabase a ce format :
```
https://<project-ref>.supabase.co/auth/v1/callback
```

Trouvez-le dans : **Authentication** → **URL Configuration**

---

## Troubleshooting

### Erreur "redirect_uri_mismatch"
- Vérifiez que l'URI dans Google Cloud correspond exactement à celle de Supabase
- Pas d'espace ou slash en trop

### Erreur "Access blocked"
- Le OAuth consent screen n'est pas publié
- Ajoutez votre email comme "Test user"

### Utilisateur créé mais pas de profil
Le trigger `handle_new_user` dans Supabase devrait créer le profil automatiquement.

---

## Support

- 📧 support@wazzapai.com
- 📱 +225 05 54 58 59 27
