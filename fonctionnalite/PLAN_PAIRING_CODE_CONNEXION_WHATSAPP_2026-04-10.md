# PLAN — Connexion WhatsApp par code de liaison (Pairing Code)

**Date :** 2026-04-10
**Statut :** À implémenter
**Priorité :** Moyenne — amélioration UX mobile

---

## Contexte & problème

Actuellement, connecter un agent WhatsApp nécessite de scanner un QR code. Si l'utilisateur est sur son téléphone (même appareil que le WhatsApp à connecter), il est impossible de scanner le QR affiché sur son propre écran.

Baileys (`@whiskeysockets/baileys v7.0.0-rc.9`) supporte `requestPairingCode()` — un code alphanumérique à 8 caractères que l'utilisateur entre manuellement dans WhatsApp. C'est exactement ce que WhatsApp Web propose sous "Lier avec un numéro de téléphone".

---

## Principe de sécurité (production)

**Le flux QR existant ne sera pas modifié.** Le pairing code est une option parallèle et indépendante. Si le pairing code a un problème, le QR continue de fonctionner pour tout le monde.

---

## Architecture cible

### Deux chemins de connexion coexistants

```
Utilisateur clique "Connecter WhatsApp"
          │
          ▼
┌─────────────────────────────────────┐
│  Choisissez votre méthode :         │
│                                     │
│  [📷 Scanner le QR code]            │
│  → flux actuel, inchangé            │
│                                     │
│  [📱 Utiliser un code de liaison]   │
│  → nouveau flux (pairing code)      │
└─────────────────────────────────────┘
```

### Flux QR (existant, inchangé)

```
POST /api/whatsapp/connect
  → PM2 détecte changement DB
  → Baileys génère QR
  → QR stocké en DB (base64)
  → Frontend poll GET /api/whatsapp/connect toutes les 2s
  → Affiche QR image
  → Utilisateur scanne avec un autre appareil
  → Connexion établie
```

### Flux Pairing Code (nouveau)

```
Utilisateur saisit son numéro WhatsApp
  → POST /api/whatsapp/connect-pairing { agentId, phoneNumber }
  → DB: whatsapp_connection_method = 'pairing_code'
  → PM2 détecte changement DB → initSession() avec flag pairing
  → Baileys: socket.requestPairingCode(phoneNumber)
  → Code stocké en DB (whatsapp_pairing_code, expires_at)
  → Frontend poll GET /api/whatsapp/connect toutes les 2s
  → Affiche code "ABC1-DE23" + countdown
  → Utilisateur entre le code dans WhatsApp
  → Connexion établie (même événement 'connection.update' qu'avec QR)
```

---

## Modifications techniques détaillées

### 1. Base de données — Migration Supabase

Ajouter 3 colonnes dans la table `agents` :

```sql
ALTER TABLE agents
  ADD COLUMN whatsapp_connection_method VARCHAR DEFAULT 'qr',
  -- 'qr' | 'pairing_code'

  ADD COLUMN whatsapp_pairing_code VARCHAR,
  -- Ex: 'ABC1-DE23' — null si méthode QR ou après connexion réussie

  ADD COLUMN whatsapp_pairing_code_expires_at TIMESTAMPTZ;
  -- Timestamp d'expiration du code (généralement now + 60s)
```

**Nettoyage automatique après connexion :**
```sql
-- Déclencher dans session.js quand connection === 'open'
UPDATE agents SET
  whatsapp_pairing_code = null,
  whatsapp_pairing_code_expires_at = null,
  whatsapp_connection_method = 'qr'  -- reset pour prochaine fois
WHERE id = agentId
```

---

### 2. Nouvelle route API — `POST /api/whatsapp/connect-pairing`

**Fichier à créer :** `src/app/api/whatsapp/connect-pairing/route.ts`

```typescript
// POST /api/whatsapp/connect-pairing
// Body: { agentId: string, phoneNumber: string }

export async function POST(req: Request) {
  const { agentId, phoneNumber } = await req.json()

  // 1. Vérifier ownership (même logique que connect/route.ts)
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, whatsapp_status')
    .eq('id', agentId)
    .eq('user_id', userId)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })

  // 2. Valider le numéro de téléphone (format international)
  const cleanPhone = phoneNumber.replace(/\D/g, '')
  if (cleanPhone.length < 8 || cleanPhone.length > 15) {
    return NextResponse.json({ error: 'Numéro invalide' }, { status: 400 })
  }

  // 3. Mettre à jour DB pour signaler au bot PM2
  await adminSupabase.from('agents').update({
    whatsapp_status: 'connecting',
    whatsapp_connection_method: 'pairing_code',
    whatsapp_pairing_code: null,
    whatsapp_pairing_code_expires_at: null,
    whatsapp_connected: false,
    whatsapp_qr_code: null,
  }).eq('id', agentId)

  // 4. Stocker le numéro temporairement pour que le bot l'utilise
  // (via un champ existant ou un nouveau champ whatsapp_pairing_phone)
  await adminSupabase.from('agents').update({
    whatsapp_pairing_phone: cleanPhone,
  }).eq('id', agentId)

  return NextResponse.json({ success: true, status: 'connecting' })
}
```

---

### 3. Modifier `session.js` — Détecter le mode pairing

**Fichier :** `src/lib/whatsapp/handlers/session.js`

**Où modifier :** Dans `initSession()`, après la création du socket, dans le handler `connection.update`.

**Bloc actuel (QR) — NE PAS TOUCHER :**
```javascript
if (qr) {
  session.status = 'qr_waiting'
  const qrDataUrl = await QRCode.toDataURL(qr)
  await supabase.from('agents').update({
    whatsapp_qr_code: qrDataUrl,
    whatsapp_status: 'qr_ready',
  }).eq('id', agentId)
}
```

**Bloc à ajouter AVANT le bloc QR existant :**
```javascript
// Récupérer la méthode de connexion depuis DB
const { data: agentConfig } = await supabase
  .from('agents')
  .select('whatsapp_connection_method, whatsapp_pairing_phone')
  .eq('id', agentId)
  .single()

const isPairingMode = agentConfig?.whatsapp_connection_method === 'pairing_code'
const pairingPhone = agentConfig?.whatsapp_pairing_phone

// Générer le pairing code si mode activé et QR disponible
// (Baileys génère d'abord un QR, puis on demande le code à la place)
if (qr && isPairingMode && pairingPhone) {
  try {
    const code = await socket.requestPairingCode(pairingPhone)
    // Formater: 'ABCDE123' → 'ABCD-E123'
    const formatted = code.slice(0, 4) + '-' + code.slice(4)

    await supabase.from('agents').update({
      whatsapp_pairing_code: formatted,
      whatsapp_pairing_code_expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      whatsapp_status: 'qr_ready',  // Réutiliser ce statut pour le polling frontend
      whatsapp_qr_code: null,        // Pas de QR en mode pairing
    }).eq('id', agentId)

    return  // Ne pas exécuter le bloc QR classique
  } catch (err) {
    console.error('[pairing] requestPairingCode failed:', err)
    // Fallback: laisser le QR s'afficher normalement
  }
}

// Bloc QR existant (inchangé) — s'exécute si pas en mode pairing
if (qr) {
  // ... code existant intact ...
}
```

**Nettoyage après connexion réussie (`connection === 'open'`) :**
```javascript
// Ajouter dans le bloc existant qui gère connection === 'open'
await supabase.from('agents').update({
  whatsapp_pairing_code: null,
  whatsapp_pairing_code_expires_at: null,
  whatsapp_connection_method: 'qr',  // Reset pour prochaine fois
  whatsapp_pairing_phone: null,
}).eq('id', agentId)
```

---

### 4. Modifier `GET /api/whatsapp/connect` — Retourner le pairing code

**Fichier :** `src/app/api/whatsapp/connect/route.ts`

**Ajouter dans la réponse GET :**
```typescript
// Sélectionner les nouveaux champs
const { data: agent } = await supabase
  .from('agents')
  .select(`
    whatsapp_status,
    whatsapp_connected,
    whatsapp_phone,
    whatsapp_qr_code,
    whatsapp_pairing_code,           // NOUVEAU
    whatsapp_pairing_code_expires_at, // NOUVEAU
    whatsapp_connection_method        // NOUVEAU
  `)
  .eq('id', agentId)
  .single()

return NextResponse.json({
  status: agent.whatsapp_status,
  connected: agent.whatsapp_connected,
  phoneNumber: agent.whatsapp_phone,
  qrCode: agent.whatsapp_qr_code,
  pairingCode: agent.whatsapp_pairing_code,            // NOUVEAU
  pairingCodeExpiresAt: agent.whatsapp_pairing_code_expires_at, // NOUVEAU
  connectionMethod: agent.whatsapp_connection_method,  // NOUVEAU
})
```

---

### 5. Frontend — Page agent

**Fichier :** `src/app/[locale]/dashboard/agents/[id]/page.tsx`

#### Étape 1 : Choix de la méthode (nouveau composant)

```tsx
// État local
const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing_code' | null>(null)
const [pairingPhone, setPairingPhone] = useState('')
const [pairingCode, setPairingCode] = useState<string | null>(null)
const [pairingExpiresAt, setPairingExpiresAt] = useState<Date | null>(null)

// Afficher le choix avant de connecter
{whatsappStatus === 'idle' && !connectionMethod && (
  <div className="connection-method-picker">
    <h3>Comment souhaitez-vous connecter WhatsApp ?</h3>

    <button onClick={() => handleConnect('qr')}>
      📷 Scanner le QR code
      <span>Depuis un autre appareil</span>
    </button>

    <button onClick={() => setConnectionMethod('pairing_code')}>
      📱 Utiliser un code de liaison
      <span>Si vous êtes sur ce téléphone</span>
    </button>
  </div>
)}
```

#### Étape 2 : Saisie du numéro (mode pairing)

```tsx
{connectionMethod === 'pairing_code' && !pairingCode && (
  <div className="pairing-phone-form">
    <h3>Entrez votre numéro WhatsApp</h3>
    <p>Le numéro doit être celui de la SIM dans ce téléphone.</p>

    <input
      type="tel"
      placeholder="+225 07 00 00 00 00"
      value={pairingPhone}
      onChange={(e) => setPairingPhone(e.target.value)}
    />

    <button onClick={handlePairingCodeRequest}>
      Générer le code →
    </button>

    <button onClick={() => setConnectionMethod(null)}>
      ← Retour
    </button>
  </div>
)}
```

#### Étape 3 : Affichage du code + countdown

```tsx
{pairingCode && (
  <div className="pairing-code-display">
    <h3>Entrez ce code dans WhatsApp</h3>

    {/* Code bien lisible */}
    <div className="pairing-code">
      {pairingCode}  {/* Ex: ABC1-DE23 */}
    </div>

    {/* Countdown */}
    <PairingCodeCountdown expiresAt={pairingExpiresAt} onExpire={handlePairingExpired} />

    {/* Instructions pas à pas */}
    <ol>
      <li>Ouvrez WhatsApp sur votre téléphone</li>
      <li>Allez dans <strong>Paramètres → Appareils liés</strong></li>
      <li>Appuyez sur <strong>Lier un appareil</strong></li>
      <li>Choisissez <strong>Lier avec un numéro de téléphone</strong></li>
      <li>Entrez le code affiché ci-dessus</li>
    </ol>

    {/* Bouton si code expiré */}
    <button onClick={handleRegenerateCode}>
      Le code a expiré — Générer un nouveau code
    </button>
  </div>
)}
```

#### Composant countdown

```tsx
function PairingCodeCountdown({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now()
      if (ms <= 0) {
        setRemaining(0)
        onExpire()
        clearInterval(interval)
      } else {
        setRemaining(Math.ceil(ms / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return (
    <p className={remaining < 15 ? 'text-red-500' : 'text-gray-500'}>
      Code valable encore {remaining}s
    </p>
  )
}
```

#### Polling (réutiliser l'existant, ajouter lecture du pairing code)

```typescript
// Dans le useEffect de polling existant (inchangé sauf ajout)
const data = await fetch(`/api/whatsapp/connect?agentId=${agentId}`).then(r => r.json())

if (data.connected) {
  setWhatsappStatus('connected')
  setPairingCode(null)
  clearInterval(interval)
  return
}

// NOUVEAU : lire le pairing code depuis la réponse
if (data.pairingCode && data.connectionMethod === 'pairing_code') {
  setPairingCode(data.pairingCode)
  setPairingExpiresAt(new Date(data.pairingCodeExpiresAt))
}
```

---

## Scénarios complets

### Scénario 1 — Utilisateur sur téléphone (succès)

```
1. Kofi ouvre la page agent sur son téléphone
2. Clique "Connecter WhatsApp"
3. Voit le choix → choisit "Utiliser un code de liaison"
4. Saisit : +225 07 12 34 56
5. Clique "Générer le code"
   → POST /api/whatsapp/connect-pairing { agentId, phoneNumber: '22507123456' }
   → DB: whatsapp_connection_method = 'pairing_code', status = 'connecting'
   → PM2 détecte → initSession()
   → Baileys génère QR en interne → requestPairingCode('22507123456')
   → Code retourné: 'ABCDE123'
   → DB: whatsapp_pairing_code = 'ABCD-E123', expires_at = now + 60s
6. Frontend affiche :
   ┌──────────────────────────────┐
   │ Entrez ce code dans WhatsApp │
   │                              │
   │        ABCD-E123             │
   │                              │
   │   Code valable encore 58s    │
   │                              │
   │ 1. Ouvrez WhatsApp           │
   │ 2. Paramètres → Appareils... │
   │ 3. Lier avec un numéro...    │
   │ 4. Entrez le code ci-dessus  │
   └──────────────────────────────┘
7. Kofi entre le code dans WhatsApp
8. Baileys reçoit connection === 'open'
9. DB: whatsapp_connected = true, pairing_code = null
10. Frontend poll détecte connected = true → affiche "Agent connecté ✓"
```

### Scénario 2 — Code expiré avant saisie

```
1-6. Même début que Scénario 1
7. Kofi ne saisit pas le code dans les 60s
8. Countdown atteint 0 → bouton "Générer un nouveau code" apparaît
9. Kofi clique → nouveau POST /api/whatsapp/connect-pairing
10. Nouveau code généré, cycle recommence
```

### Scénario 3 — Utilisateur desktop (QR, inchangé)

```
1. Paul ouvre la page agent sur son ordinateur
2. Clique "Connecter WhatsApp"
3. Voit le choix → choisit "Scanner le QR code"
4. Flux actuel exactement comme avant → QR affiché → scanne → connecté
```

### Scénario 4 — Numéro incorrect

```
1. Kofi saisit un numéro qui n'est pas celui de sa SIM WhatsApp
2. requestPairingCode() réussit côté Baileys (génère un code)
3. Kofi entre le code dans WhatsApp → WhatsApp répond "Code incorrect"
4. Kofi clique "Générer un nouveau code", ressaisit le bon numéro
→ Aucun impact sur l'agent ou les autres agents
```

---

## Ordre d'implémentation

1. Migration Supabase (ajouter 4 colonnes)
2. Nouvelle route `POST /api/whatsapp/connect-pairing`
3. Modifier `GET /api/whatsapp/connect` (retourner les nouveaux champs)
4. Modifier `session.js` (bloc pairing avant bloc QR)
5. Frontend : choix méthode + formulaire numéro + affichage code + countdown
6. Tests sur environnement de test avant déploiement en production
7. Déployer + redémarrer PM2

---

## Points de vigilance

| Point | Détail |
|-------|--------|
| Version Baileys | v7.0.0-rc.9 (RC) — tester `requestPairingCode` sur cette version avant tout |
| Expiration code | Baileys gère en interne (~60s) — notre countdown DB doit rester synchronisé |
| Numéro format | Toujours envoyer sans espaces ni `+` ni `()` à Baileys (ex: `22507123456`) |
| Fallback | Si `requestPairingCode` échoue → afficher QR classique automatiquement |
| Agents existants | Non touchés — aucun risque de déconnexion |
| Flux QR | Aucune ligne modifiée dans le bloc QR existant |

---

## Ce qui NE change pas

- Le flux QR complet (aucune ligne touchée)
- Les agents déjà connectés
- La logique de reconnexion automatique
- Le stockage des sessions (`whatsapp_sessions`)
- Toute autre fonctionnalité du bot
