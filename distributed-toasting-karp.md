# Plan: Fix Devise Profil (fetchProfileCurrency jamais appelé)

## CORRECTION DEVISE — AUDIT RÉSULTAT

### Architecture devise (confirmée et correcte)

| Contexte | Stockage DB | Unité réelle | Conversion |
|----------|------------|--------------|-----------|
| `subscription_plans.price_fcfa` | "price_fcfa" (mal nommé) | **USD** | × 655 → XOF pour CinetPay |
| `credit_packs.price` | INTEGER | **USD** | × 655 → XOF pour CinetPay |
| `products.price_fcfa` | "price_fcfa" | **FCFA** | ÷ 655 pour USD, ÷ 656 pour EUR |
| `payments.amount_fcfa` | "amount_fcfa" | **FCFA** | Toujours en XOF réel |

### Ce qui fonctionne ✅

- `formatPrice()` dans `billing/page.tsx` gère correctement les 3 devises :
  - USD: prix tel quel (29$)
  - XOF: `price × 655` → 18 995 FCFA
  - EUR: `price × 0.92` → €26.68
- `sections.js` (bot WhatsApp) : `convertFromFcfa()` convertit bien les prix produits
- `payments/initialize/route.ts` : `amountFCFA = amount × 655` (correct si `amount` est en USD)
- Historique des paiements toujours en XOF (correct, CinetPay traite en XOF)

### Bug critique trouvé ❌

**`fetchProfileCurrency()` n'est JAMAIS appelé dans le useEffect !**

```typescript
// billing/page.tsx — useEffect actuel (ligne 131-136)
useEffect(() => {
    fetchData()       // ✓ appelé
    fetchPlans()      // ✓ appelé
    fetchCreditPacks() // ✓ appelé
    fetchPayments()   // ✓ appelé
    // fetchProfileCurrency() ← MANQUANT !
}, [])
```

Résultat : `currency` state reste toujours `'USD'` quelle que soit la devise configurée dans le profil.

### Fix : 1 ligne à ajouter

**Fichier :** `src/app/[locale]/dashboard/billing/page.tsx`

```typescript
useEffect(() => {
    fetchData()
    fetchPlans()
    fetchCreditPacks()
    fetchPayments()
    fetchProfileCurrency() // ← AJOUTER cette ligne
}, [])
```

### Vérification
- Configurer la devise du profil sur EUR → plans et packs s'affichent en €
- Configurer sur XOF → plans s'affichent en FCFA (ex: 29 USD → 18 995 FCFA)
- Configurer sur USD → plans s'affichent en $ (comportement actuel par défaut)

---

# Plan archivé: Correction Complète APK + Audit Production

## PARTIE 1: Corrections APK Initiales (5 problèmes)

| # | Problème | Cause | Fichier |
|---|----------|-------|---------|
| 1 | Empreinte digitale ne fonctionne pas | `isAuthenticated` non persisté | `useBiometricAuth.ts` |
| 2 | Admin dashboard non responsive | CSS className non appliqués sur APK | `admin/page.tsx` |
| 3 | Bouton retour défaillant | `pathname.includes()` trop large | `useAndroidBackButton.ts` |
| 4 | Google signOut incomplet | `GoogleAuth.initialize()` manquant | layouts |
| 5 | Audit général | Voir PARTIE 2 ci-dessous | Multiple fichiers |

---

## PARTIE 2: AUDIT COMPLET - RÉSUMÉ

### Statistiques Globales

| Sévérité | Sécurité | UI/UX | Code | Total |
|----------|----------|-------|------|-------|
| CRITIQUE | 4 | 8 | 10 | **22** |
| HAUTE | 7 | 5 | 13 | **25** |
| MOYENNE | 10 | 6 | 17 | **33** |
| **TOTAL** | **21** | **19** | **40** | **80** |

---

## PROBLÈMES CRITIQUES À CORRIGER IMMÉDIATEMENT

### 🔴 SÉCURITÉ CRITIQUE

| # | Problème | Fichier | Ligne |
|---|----------|---------|-------|
| S1 | WebView debugging activé en prod | `capacitor.config.ts` | 16 |
| S2 | Cleartext traffic autorisé | `AndroidManifest.xml` | 10 |
| S3 | Backup Android activé | `AndroidManifest.xml` | 5 |
| S4 | API interne accepte sans secret | `api/internal/send/route.ts` | 23-28 |
| S5 | CinetPay signature ignorée si clé manquante | `lib/payments/cinetpay.ts` | 170 |
| S6 | TypeScript errors ignorés | `next.config.ts` | 11-13 |

### 🔴 UI/UX CRITIQUE

| # | Problème | Action |
|---|----------|--------|
| U1 | 27 fichiers avec console.log | Supprimer tous les DEBUG |
| U2 | Pas de page 404/error | Créer `not-found.tsx` et `error.tsx` |
| U3 | Catch blocks vides | Ajouter feedback utilisateur |
| U4 | Pas d'accessibility (aria-labels) | Ajouter sur éléments interactifs |

### 🔴 CODE CRITIQUE

| # | Problème | Fichier | Impact |
|---|----------|---------|--------|
| C1 | N+1 queries conversations | `api/conversations/route.ts:48-68` | Performance |
| C2 | Sessions Map non bornée | `lib/whatsapp/baileys.ts:36-37` | Memory leak |
| C3 | Payment sans transaction DB | `api/payments/webhook/route.ts` | Data corruption |
| C4 | Rate limit map unbounded | `handlers/message.js:66-76` | Memory leak |

---

## CORRECTIONS PRIORITAIRES (Phase 1 - Sécurité + APK)

### S1-S3: Corrections Android/Capacitor

**Fichier: `capacitor.config.ts`**
```typescript
// Ligne 16: CHANGER
webContentsDebuggingEnabled: false, // DÉSACTIVÉ en production
```

**Fichier: `android/app/src/main/AndroidManifest.xml`**
```xml
<!-- Ligne 5: CHANGER -->
android:allowBackup="false"

<!-- Ligne 10: CHANGER -->
android:usesCleartextTraffic="false"
```

### S4: Fix API Interne

**Fichier: `src/app/api/internal/send/route.ts`**
```typescript
// Lignes 23-28: REMPLACER
const expectedSecret = process.env.INTERNAL_API_SECRET
if (!expectedSecret || secretKey !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// SUPPRIMER le "backward compatibility" bypass
```

### S5: Fix CinetPay Webhook

**Fichier: `src/lib/payments/cinetpay.ts`**
```typescript
// Ligne 170: REMPLACER
if (!process.env.CINETPAY_SECRET_KEY) {
    console.error('CINETPAY_SECRET_KEY missing - rejecting webhook')
    return false // REJETER au lieu d'accepter
}
```

### S6: Fix TypeScript Build

**Fichier: `next.config.ts`**
```typescript
// Lignes 11-13: SUPPRIMER ou changer
typescript: {
    ignoreBuildErrors: false, // ACTIVER la vérification
},
```

---

## 1. Fix Biometric Authentication

### Problème Identifié
- L'état `isAuthenticated` est en mémoire seulement (ligne 21)
- Après refresh/navigation, il reset à `false`
- Le lock screen réapparaît mais `verifyIdentity()` peut échouer
- Le type affiché est "Scanner d'iris" car `biometryType = 3` sur certains devices

### Fichier: `src/hooks/useBiometricAuth.ts`

#### Correction 1: Ajouter persistence session
```typescript
const AUTH_SESSION_KEY = 'wazzapai_biometric_session'
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

// Dans checkBiometric, vérifier la session existante
const sessionData = localStorage.getItem(AUTH_SESSION_KEY)
if (sessionData) {
    const { timestamp } = JSON.parse(sessionData)
    if (Date.now() - timestamp < SESSION_TIMEOUT) {
        // Session valide, pas besoin de ré-authentifier
        setState({ isAuthenticated: true, ... })
    }
}

// Dans authenticate success:
localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ timestamp: Date.now() }))
```

#### Correction 2: Améliorer détection biometryType
```typescript
// Utiliser la méthode native pour détecter le vrai type
// Sur Samsung, iris scanner renvoie biometryType = 3
// Mais fingerprint est plus courant, afficher label générique
const getBiometricLabel = (): string => {
    if (state.biometricType === 'none') return 'Biométrie'
    return 'Authentification biométrique' // Label générique qui fonctionne pour tous
}
```

---

## 2. Fix Admin Dashboard Responsive

### Problème Identifié
- Les CSS sont définis mais pas appliqués sur mobile APK
- Le problème: `className="kpi-grid"` utilise `jsx global` mais l'APK peut ne pas l'appliquer correctement
- Solution: Utiliser inline styles avec détection mobile

### Fichier: `src/app/[locale]/admin/page.tsx`

#### Ajouter détection mobile
```typescript
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
}, [])
```

#### Remplacer className par style conditionnel
```typescript
<div style={{
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
    gap: 12
}}>
```

### Fichier: `src/app/[locale]/admin/layout.tsx`

#### Fix search input width (ligne 553)
```typescript
<input style={{
    width: isMobile ? '100%' : 320,
    maxWidth: '100%',
    ...
}} />
```

---

## 3. Fix Android Back Button

### Problème Identifié
- `pathname.includes('/dashboard')` match TOUTES les pages dashboard
- Résultat: `/dashboard/agents/123` → minimize au lieu de router.back()

### Fichier: `src/hooks/useAndroidBackButton.ts`

#### Logique corrigée
```typescript
// Pages racines EXACTES (pas de sous-route)
const exactRootPages = [
    '/login', '/register',
    '/dashboard', '/admin',
    '/fr/login', '/fr/register', '/fr/dashboard', '/fr/admin',
    '/en/login', '/en/register', '/en/dashboard', '/en/admin'
]

// Vérifier si c'est une page racine EXACTE
const isExactRootPage = exactRootPages.includes(pathname)

if (isExactRootPage) {
    if (pathname.endsWith('/dashboard') || pathname.endsWith('/admin')) {
        App.minimizeApp()
    } else {
        App.exitApp()
    }
} else if (canGoBack) {
    router.back()
} else {
    // Retour au dashboard avec locale
    const locale = pathname.startsWith('/en') ? 'en' : 'fr'
    router.push(`/${locale}/dashboard`)
}
```

---

## 4. Fix Google Auth signOut

### Problème Identifié
- Dashboard: `GoogleAuth.signOut()` appelé SANS `initialize()` → plugin pas initialisé
- Admin: `GoogleAuth.signOut()` PAS appelé du tout → session persist

### Fichier: `src/app/[locale]/dashboard/layout.tsx` (ligne 265-282)

#### Code corrigé
```typescript
const handleLogout = async () => {
    const supabase = createClient()

    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
    if (isCapacitor) {
        try {
            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')

            // INITIALISER AVANT signOut
            await GoogleAuth.initialize({
                clientId: '519109526767-1rfcfigbutf9217uuc69fosqjp6mis05.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            })

            await GoogleAuth.signOut()
        } catch (e) {
            console.log('Google signOut error:', e)
        }
    }

    // Clear biometric session
    localStorage.removeItem('wazzapai_biometric_session')

    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
}
```

### Fichier: `src/app/[locale]/admin/layout.tsx` (ligne 161-166)

#### Code corrigé (même logique)
```typescript
const handleLogout = async () => {
    const supabase = createClient()

    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
    if (isCapacitor) {
        try {
            const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
            await GoogleAuth.initialize({
                clientId: '519109526767-1rfcfigbutf9217uuc69fosqjp6mis05.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            })
            await GoogleAuth.signOut()
        } catch (e) {
            console.log('Google signOut error:', e)
        }
    }

    localStorage.removeItem('wazzapai_biometric_session')
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
}
```

---

## 5. Fichiers à Modifier

| Fichier | Modifications |
|---------|---------------|
| `src/hooks/useBiometricAuth.ts` | Session persistence, timeout, label générique |
| `src/hooks/useAndroidBackButton.ts` | Logique pathname exacte |
| `src/app/[locale]/dashboard/layout.tsx` | GoogleAuth.initialize() avant signOut |
| `src/app/[locale]/admin/layout.tsx` | Ajouter GoogleAuth signOut complet |
| `src/app/[locale]/admin/page.tsx` | Responsive avec isMobile state |

---

## Vérification

1. **Build et deploy VPS**
   ```bash
   git add . && git commit -m "fix: biometric, responsive, back button, google signout" && git push
   # Sur VPS: ./deploy.sh
   ```

2. **Rebuild APK**
   ```bash
   npx cap sync android
   # Android Studio: Build APK
   ```

3. **Tests sur APK**
   - [ ] Admin dashboard: grilles en 1 colonne sur mobile
   - [ ] Settings > Sécurité: Activer biométrie, fermer app, rouvrir → unlock avec empreinte
   - [ ] Naviguer dashboard/agents, appuyer retour → revient à /dashboard
   - [ ] Déconnexion → reconnexion Google affiche TOUS les comptes

---

## Note Importante

Le problème principal de l'empreinte était que l'authentification réussissait une fois mais le state n'était pas persisté. Avec la session localStorage + timeout de 30 minutes, l'utilisateur n'aura pas besoin de s'authentifier à chaque navigation, seulement:
- Au premier lancement de l'app
- Après 30 minutes d'inactivité
- Après avoir quitté complètement l'app (pas minimize)

---

## CORRECTIONS PHASE 2: Console.log & Erreurs

### U1: Supprimer console.log DEBUG (27 fichiers)

**Fichiers principaux à nettoyer:**
```
src/app/[locale]/dashboard/agents/new/page.tsx (lignes 426, 448, 526, 538, 541, 546)
src/components/BiometricLock.tsx (ligne 47)
src/lib/whatsapp/cron/outgoing.js (lignes 39-42, 108)
src/app/api/payments/cinetpay/webhook/route.ts (lignes 45-50)
src/lib/whatsapp/ai/generator.js (ligne 341, 353)
```

### U2: Créer pages d'erreur

**Créer: `src/app/[locale]/not-found.tsx`**
```typescript
export default function NotFound() {
    return (
        <div style={{ textAlign: 'center', padding: 40 }}>
            <h1>404 - Page non trouvée</h1>
            <a href="/dashboard">Retour au tableau de bord</a>
        </div>
    )
}
```

**Créer: `src/app/[locale]/error.tsx`**
```typescript
'use client'
export default function Error({ reset }: { reset: () => void }) {
    return (
        <div style={{ textAlign: 'center', padding: 40 }}>
            <h1>Une erreur est survenue</h1>
            <button onClick={reset}>Réessayer</button>
        </div>
    )
}
```

### U3: Fix catch blocks vides

**Fichier: `src/app/[locale]/admin/agents/page.tsx`**
```typescript
// Lignes 48-49: AJOUTER gestion erreur
} catch (error) {
    console.error('Error:', error)
    // Ajouter toast ou state error pour afficher à l'utilisateur
}
```

---

## CORRECTIONS PHASE 3: Performance & Memory

### C1: Fix N+1 Queries

**Fichier: `src/app/api/conversations/route.ts`**
- Remplacer boucle par requête batch avec LEFT JOIN
- Utiliser `.select('*, messages(count), messages!inner(content, created_at)')`

### C2: Fix Memory Leaks

**Fichier: `src/lib/whatsapp/baileys.ts`**
```typescript
// Ajouter limite de sessions
const MAX_SESSIONS = 100
if (activeSessions.size >= MAX_SESSIONS) {
    // Fermer la session la plus ancienne
    const oldest = activeSessions.keys().next().value
    await closeWhatsAppSession(oldest)
}
```

**Fichier: `src/lib/whatsapp/handlers/message.js`**
```typescript
// Ligne 66-76: Ajouter limite
const MAX_RATE_LIMIT_ENTRIES = 1000
if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    // Clear oldest entries
    const entries = Array.from(rateLimitMap.entries())
    entries.slice(0, 500).forEach(([key]) => rateLimitMap.delete(key))
}
```

---

## RÉSUMÉ DES FICHIERS À MODIFIER

### Phase 1 - Sécurité (URGENT)
| Fichier | Modifications |
|---------|---------------|
| `capacitor.config.ts` | webContentsDebuggingEnabled: false |
| `AndroidManifest.xml` | allowBackup + usesCleartextTraffic: false |
| `api/internal/send/route.ts` | Supprimer bypass auth |
| `lib/payments/cinetpay.ts` | Rejeter webhook sans signature |
| `next.config.ts` | ignoreBuildErrors: false |

### Phase 2 - APK Fixes
| Fichier | Modifications |
|---------|---------------|
| `useBiometricAuth.ts` | Session persistence |
| `useAndroidBackButton.ts` | Logique pathname exacte |
| `dashboard/layout.tsx` | GoogleAuth.initialize() avant signOut |
| `admin/layout.tsx` | Ajouter GoogleAuth signOut |
| `admin/page.tsx` | Responsive avec isMobile |

### Phase 3 - Production Ready
| Fichier | Modifications |
|---------|---------------|
| 27 fichiers | Supprimer console.log DEBUG |
| `not-found.tsx` | Créer page 404 |
| `error.tsx` | Créer page erreur |
| `conversations/route.ts` | Fix N+1 queries |
| `baileys.ts` | Limiter sessions Map |

---

## VÉRIFICATION FINALE

1. **Build local**
   ```bash
   npm run build
   # Vérifier 0 erreurs TypeScript
   ```

2. **Tests APK**
   - [ ] Admin responsive (grilles 1 colonne)
   - [ ] Biométrie fonctionnelle
   - [ ] Bouton retour naviguer correctement
   - [ ] Google signOut → tous les comptes affichés

3. **Tests Sécurité**
   - [ ] WebView debugging désactivé
   - [ ] Pas de cleartext traffic
   - [ ] API interne rejette sans secret
   - [ ] Webhook CinetPay vérifie signature

---

## ESTIMATION EFFORT

| Phase | Fichiers | Complexité |
|-------|----------|------------|
| 1 - Sécurité | 5 | Faible (config changes) |
| 2 - APK Fixes | 5 | Moyenne (logique) |
| 3 - Production | 30+ | Élevée (nettoyage) |

**Recommandation:** Commencer par Phase 1 + 2 pour avoir une APK fonctionnelle et sécurisée, puis Phase 3 avant publication store.

---

---

# Vérification Audit Expert — Claims vs Réalité (2026-02-28)

> Audit reçu d'un expert externe. Chaque claim a été vérifié par lecture directe des fichiers sources.
> Score global : **10/11 corrects** — expert globalement fiable mais 1 erreur et 1 impact surestimé.

---

## Tableau de vérification complet

| # | Niveau audit | Claim expert | Verdict vérifié | Fichier(s) |
|---|-------------|-------------|-----------------|-----------|
| 1 | 🔴 Critique | `payments/verify` sans auth ni ownership check | **CONFIRMÉ** | `api/payments/verify/route.ts` |
| 2 | 🔴 Critique | Routes push acceptent `userId` client sans session | **PARTIELLEMENT CONFIRMÉ** | `claim-token` ✅ vulnérable, `register-device-native` ✅ vulnérable, `register-device` ❌ déjà protégé |
| 3 | 🟠 Élevé | 4 routes peuvent toutes finaliser/créditer (double crédit) | **PARTIELLEMENT CONFIRMÉ** | Seul `payments/webhook` manque d'idempotence — les 3 autres vérifient `status === 'completed'` avant d'agir |
| 4 | 🟠 Élevé | Read-then-write non atomique sur crédits | **CONFIRMÉ** | `ai/generate` : 100% read-then-write. `playground/chat` : RPC utilisé mais fallback non-atomique si RPC échoue |
| 5 | 🟠 Élevé | `cinetpay/status` appelle RPC `add_credits` avec `p_credits` au lieu de `p_amount` | **CONFIRMÉ MAIS IMPACT SURESTIMÉ** | Bug réel (1 ligne), mais sans effet en pratique : les paiements passent par le webhook qui utilise `CreditsService.add()` directement — `/status` est un endpoint de secours rarement appelé |
| 6 | 🟡 Moyen | Admin utilise champ `credits` inexistant au lieu de `credits_balance` | **CONFIRMÉ** | `api/admin/users/[id]/route.ts` — `reset_credits` et `set_credits` écrivent sur un champ qui n'existe pas |
| 7 | 🟡 Moyen | RBAC incohérent : middleware autorise `superadmin`, API admin bloque `superadmin` | **CONFIRMÉ** | Middleware : `role === 'admin' \|\| 'superadmin'` ✅. Toutes les API admin : `role !== 'admin'` strict ❌ — un superadmin passe le middleware mais est bloqué partout |
| 8 | 🟡 Moyen | UI admin attend `json.success`, `successResponse()` retourne `{ data }` sans `success` | **CONFIRMÉ** | `admin/layout.tsx` ligne 134 : `if (json.success && json.data)` — toujours false, notifications admin jamais affichées |
| 9 | 🟡 Moyen | Deux implémentations différentes de vérification signature webhook | **CONFIRMÉ** | `cinetpay/webhook` : `Buffer.from(sig)` sans encodage. `lib/payments/cinetpay.ts` : `Buffer.from(sig, 'hex')`. Différences aussi sur `.update()` encoding et vérif longueur |
| 10 | 🟢 Faible | Rate limit fail-open si Redis indisponible | **CONFIRMÉ** | `lib/rate-limit.ts` catch : `return { success: true }` — rate limit désactivé si Redis crash |
| 11 | 🟢 Faible | `deploy.sh` utilise `git reset --hard` | **CONFIRMÉ** | Lignes 22 (deploy) et 53 (rollback) — écrase toute modification locale non committée |

---

## Erreur de l'expert

**Claim #2** : `register-device/route.ts` cité comme vulnérable — **FAUX**.
Ce fichier vérifie `supabase.auth.getUser()` et retourne 401 si pas de session. Il utilise `user.id` depuis la session, pas du body client. Déjà sécurisé correctement.

## Impact surestimé

**Claim #5** : L'expert présente le bug `p_credits`/`p_amount` comme bloquant les crédits.
En réalité, deux chemins coexistent :
- **Webhook** (`cinetpay/webhook`) → `CreditsService.add()` → **fonctionne** ✅ — c'est le chemin principal
- **Status** (`cinetpay/status`) → RPC `add_credits` avec `p_credits` → **cassé** ❌ — chemin de secours manuel

Les utilisateurs reçoivent leurs crédits normalement car CinetPay déclenche le webhook automatiquement.

---

## Plan de correction par priorité

### 🔴 Critique — à corriger en premier
| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 1 | Ajouter auth obligatoire + vérification `payment.user_id === user.id` | `api/payments/verify/route.ts` | Moyen |
| 2 | Supprimer `userId` du body, dériver depuis `supabase.auth.getUser()` | `api/notifications/claim-token/route.ts` + `register-device-native/route.ts` | Faible |
| 3 | Ajouter garde `if (payment.status === 'completed') return` avant crédit | `api/payments/webhook/route.ts` | Faible |

### 🟠 Élevé
| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 4 | Remplacer read-then-write par `rpc('deduct_credits', ...)` | `api/ai/generate/route.ts` | Faible |
| 5 | `p_credits` → `p_amount` (1 mot) | `api/payments/cinetpay/status/route.ts` | Minimal |
| 6 | `credits` → `credits_balance` dans actions admin | `api/admin/users/[id]/route.ts` | Faible |
| 7 | `role !== 'admin'` → `!['admin','superadmin'].includes(role)` dans toutes API admin | `api/admin/**` (5+ fichiers) | Moyen |

### 🟡 Moyen
| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 8 | Ajouter `success: true` dans `successResponse()` ou corriger la condition UI | `lib/api-utils.ts` | Minimal |
| 9 | Unifier vérification signature dans `lib/payments/cinetpay.ts`, supprimer doublon local | `api/payments/cinetpay/webhook/route.ts` | Faible |
| 10 | Fail-closed sur endpoints sensibles (`/payments/*`, `/ai/*`) | `lib/rate-limit.ts` | Faible |

### 🟢 Faible
| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 11 | Optionnel si pipeline CD contrôlé | `deploy.sh` | Faible |

---

## CORRECTION DEVISE BOT WHATSAPP

### Contexte
La devise de l'agent/boutique est configurée dans les paramètres du compte utilisateur (`profiles.currency` : `USD` | `EUR` | `XOF`). Elle détermine dans quelle devise les prix des produits sont affichés aux clients WhatsApp dans les réponses de l'IA.

**Bug identifié** : Dans le bot WhatsApp (`message.js`), la devise est hardcodée à `'XOF'` ligne 278 — elle ne lit jamais `profile.currency`. Résultat : même si un utilisateur configure USD ou EUR, l'IA affiche toujours les prix en FCFA aux clients WhatsApp.

### Fichier à modifier
`src/lib/whatsapp/handlers/message.js`

### Correction

**Étape 1** : Après la vérification des crédits (ligne 148), ajouter une lecture de la devise du profil :

```javascript
// 1.2b Récupérer la devise du compte (pour affichage IA)
const { data: userProfile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', agent.user_id)
    .single()
const agentCurrency = userProfile?.currency || 'XOF'
```

**Étape 2** : Ligne 278, remplacer `currency: 'XOF'` par `currency: agentCurrency` :

```javascript
// AVANT:
currency: 'XOF',

// APRÈS:
currency: agentCurrency,
```

### Vérification
- Configurer la devise du compte sur USD dans les paramètres
- Envoyer un message WhatsApp à l'agent
- Vérifier que les prix des produits dans la réponse IA s'affichent en `$` et non en `FCFA`

### Note sur les prix en DB
Les prix des produits sont stockés en `price_fcfa` (toujours FCFA). Le prompt builder (`sections.js`) gère la conversion/affichage selon la devise. Cette correction ne touche pas ce mécanisme — elle garantit juste que la bonne devise est transmise.
