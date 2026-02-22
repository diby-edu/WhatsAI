# Architecture Realtime — WhatsAI Bot

> **Version** : 2.0.0 (Dual-Client)  
> **Date** : 22 février 2026  
> **Fichiers concernés** :  
> - [`whatsapp-service.js`](../whatsapp-service.js) — Point d'entrée du bot  
> - [`src/lib/whatsapp/realtime/listeners.js`](../src/lib/whatsapp/realtime/listeners.js) — Listeners Realtime  

---

## 1. Qu'est-ce que le Realtime ?

Le **Realtime** est une connexion WebSocket permanente entre le bot et Supabase.  
Au lieu de demander en boucle « Y a-t-il du nouveau ? » (**polling**), Supabase **pousse** instantanément les changements au bot dès qu'ils se produisent dans la base de données.

### Comparaison

| Méthode | Latence | CPU au repos | Principe |
|---------|---------|--------------|----------|
| **Polling** (ancien) | 5–15 secondes | Élevé (requêtes constantes) | Le bot interroge la DB à intervalle fixe |
| **Realtime** (actuel) | ~100 ms | Quasi nul | Supabase notifie le bot instantanément |

---

## 2. Quand le Realtime intervient-il ?

Le Realtime ne gère **pas** les messages WhatsApp entrants. Ceux-ci sont captés directement par le socket WhatsApp (**Baileys**). Le Realtime gère uniquement les **actions initiées depuis le Dashboard web**.

### Les 3 événements écoutés

| # | Événement | Table surveillée | Filtre | Déclencheur | Action du bot |
|---|-----------|-----------------|--------|-------------|---------------|
| 1 | **Message assistant** | `messages` | `role = 'assistant'`, `status = 'pending'` | Un opérateur tape une réponse **depuis le Dashboard** | Le bot envoie le texte sur WhatsApp au contact |
| 2 | **Message outbound** | `outbound_messages` | `status = 'pending'` | Une notification est programmée depuis le Dashboard | Le bot envoie la notification au destinataire |
| 3 | **Connexion agent** | `agents` | `whatsapp_status = 'connecting'` | Un utilisateur clique « Connecter WhatsApp » sur le Dashboard | Le bot initialise une session et génère un QR code |

### Ce que le Realtime ne fait PAS

- ❌ Réception des messages WhatsApp entrants → géré par **Baileys** (socket WhatsApp direct)
- ❌ Génération des réponses IA → géré par le handler de messages entrants
- ❌ Opérations CRUD sur la base de données → géré par le client `supabaseAdmin`

---

## 3. Architecture Dual-Client

### Pourquoi deux clients Supabase ?

Supabase Realtime **rejette silencieusement** la `service_role_key` pour les subscriptions `postgres_changes`, car cette clé bypass le Row Level Security (RLS). Le serveur ne renvoie jamais la réponse de synchronisation initiale, ce qui provoque un `TIMED_OUT` systématique.

**Solution** : utiliser deux clients Supabase séparés.

```
┌─────────────────────────────────────────────────────────┐
│                     Dashboard Web                        │
│            (l'opérateur envoie un message)                │
└──────────────────────┬──────────────────────────────────┘
                       │ INSERT dans la table `messages`
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase (DB)                         │
│                                                          │
│  Table `messages`  ──── Realtime (anon_key) ──────────┐  │
│  Table `outbound`  ──── Realtime (anon_key) ──────────┤  │
│  Table `agents`    ──── Realtime (anon_key) ──────────┤  │
└─────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Bot WhatsAI (VPS)                      │
│                                                          │
│  supabaseRealtime (anon_key)                             │
│    → Reçoit les events Realtime                          │
│    → Exécute les handlers                                │
│                                                          │
│  supabaseAdmin (service_role_key)                        │
│    → Écrit les résultats en DB (update status, etc.)     │
│    → Lit les données (agents, conversations, etc.)       │
│                                                          │
│  Baileys (socket WhatsApp)                               │
│    → Envoie/reçoit les messages WhatsApp                 │
└─────────────────────────────────────────────────────────┘
```

### Les deux clients dans le code

```javascript
// CLIENT 1 : Opérations DB (lecture, écriture, RPC)
// Utilise service_role_key → bypass RLS (accès admin complet)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, opts) => undiciFetch(url, { ...opts, dispatcher }) }
    // PAS de config realtime
})

// CLIENT 2 : Subscriptions Realtime uniquement
// Utilise anon_key → respecte RLS (OBLIGATOIRE pour postgres_changes)
const supabaseRealtime = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
        transport: WebSocket,        // Driver ws pour Node.js
        params: { eventsPerSecond: 10 }
    }
})

// Alias pour compatibilité avec le code existant
const supabase = supabaseAdmin
```

---

## 4. Système de Fallback (Polling Adaptatif)

Si le Realtime tombe, un mécanisme de polling adaptatif prend le relais automatiquement.

```
Realtime connecté ?
    ├── OUI → Polling lent (toutes les 5 minutes, filet de sécurité)
    └── NON → Polling rapide (toutes les 15 secondes, mode urgence)
```

Le flag `context.realtimeConnected` contrôle ce basculement :
- `true` après réception du status `SUBSCRIBED`
- `false` après `TIMED_OUT`, `CLOSED`, ou `CHANNEL_ERROR`

---

## 5. Flux complet : Message depuis le Dashboard

Voici le parcours complet d'un message envoyé par un opérateur depuis le Dashboard :

```
1. L'opérateur tape un message dans le Dashboard
                    │
2. Le frontend fait un INSERT :
   INSERT INTO messages (conversation_id, content, role, status)
   VALUES ('xxx', 'Bonjour !', 'assistant', 'pending')
                    │
3. Supabase détecte le changement et le pousse via Realtime
                    │
4. Le bot reçoit le payload dans le handler `handlePendingMessage`
                    │
5. Le bot récupère les infos de la conversation (numéro, agent_id)
   → via supabaseAdmin.from('conversations').select(...)
                    │
6. Le bot envoie le message sur WhatsApp
   → via session.socket.sendMessage(jid, { text: content })
                    │
7. Le bot met à jour le statut en DB
   → via supabaseAdmin.from('messages').update({ status: 'sent' })
                    │
8. Le Dashboard affiche le message comme "envoyé" ✅
```

**Temps total** : ~100–300ms (contre 5–15s avec le polling)

---

## 6. Clés API : Résumé

| Clé | Variable d'env | Usage | Realtime |
|-----|---------------|-------|----------|
| `service_role_key` | `SUPABASE_SERVICE_ROLE_KEY` | Opérations DB (CRUD, RPC) | ❌ Rejetée |
| `anon_key` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Subscriptions Realtime | ✅ Acceptée |

> **⚠️ Piège Supabase** : La `service_role_key` est acceptée pour ouvrir la connexion WebSocket, mais le serveur ne répond jamais au `phx_join` pour les `postgres_changes`. Aucune erreur explicite n'est renvoyée — le client reste bloqué en `AwaitingInitialSync` jusqu'au timeout. C'est un comportement silencieux et non documenté.

---

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `TIMED_OUT` après 90s | `service_role_key` utilisée pour Realtime | Vérifier que `supabaseRealtime` utilise bien `SUPABASE_ANON_KEY` |
| `CHANNEL_ERROR` | Clé invalide ou projet Supabase inactif | Vérifier la clé avec `echo $NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `Realtime offline, next check in 15s` | Connexion Realtime perdue | Le polling rapide prend le relais, le bot reste opérationnel |
| Pas de logs `⚡ [REALTIME]` | Normal si aucune action Dashboard | Le Realtime ne traite que les actions web, pas les messages WhatsApp entrants |
