# ÉTAT DES DASHBOARDS — API WAZZAPAI

## DASHBOARD UTILISATEUR — /dashboard/developers

### Statut : Implémenté

**Accès :** Menu latéral → "API" (lien grisé "Bientôt disponible" si api_access_enabled = false)

**Fonctionnalités disponibles :**

| Fonctionnalité | Statut |
|---|---|
| Créer une clé API (nom, env, rate limit) | Implémenté |
| Affichage one-shot de la clé brute | Implémenté |
| Activer / Désactiver une clé | Implémenté |
| Supprimer une clé | Implémenté |
| Voir le préfixe de la clé (sk_live_xxxx••••) | Implémenté |
| Logs d'usage (endpoint, statut, latence, date) | Implémenté |
| Filtrer les logs par clé | Implémenté |
| Guide de démarrage rapide (curl exemple) | Implémenté |

**Ce qui manque (non prioritaire) :**

| Fonctionnalité | Priorité |
|---|---|
| Graphique d'usage (appels / jour) | Moyen |
| Filtres sur les logs (par date, par statut) | Moyen |
| UI gestion webhooks (créer / supprimer) | Moyen |
| Tester un endpoint directement depuis l'UI | Bas |

**Note webhooks :** Les routes `/api/developer/webhooks` (GET/POST) et `/api/developer/webhooks/[id]` (PATCH/DELETE) sont implémentées. Seule l'UI dashboard n'existe pas encore — les clients peuvent gérer leurs webhooks via l'API directement.

---

## DASHBOARD ADMIN — /admin/api-monitoring

### Statut : Implémenté

**Accès :** Menu admin → "API Monitoring" (icône Code2)

**Fonctionnalités disponibles :**

| Fonctionnalité | Statut |
|---|---|
| Kill switch global (api_public_enabled) | Implémenté |
| Stats overview (appels total/today/7j, clés actives, users, taux erreur) | Implémenté |
| Volume par jour sur 14 jours | Implémenté |
| Top 10 utilisateurs (30 jours) | Implémenté |
| Liste utilisateurs + statut accès API | Implémenté |
| Toggle accès par utilisateur (individuel) | Implémenté |
| Toggle accès en masse (bulk select) | Implémenté |
| Filtre utilisateurs (search + accès enabled/disabled) | Implémenté |
| Liste toutes les clés API (tous users) | Implémenté |
| Révocation admin d'une clé | Implémenté |
| Logs globaux (100 derniers appels) | Implémenté |

**Routes admin utilisées :**
```
GET  /api/admin/api-stats            → statistiques globales
GET  /api/admin/api-keys-admin       → toutes les clés (tous utilisateurs)
PATCH /api/admin/api-keys-admin/[id] → révoquer / réactiver une clé
GET  /api/admin/api-logs-admin       → tous les logs (tous utilisateurs)
GET  /api/admin/api-users-access     → liste users + statut api_access_enabled
PATCH /api/admin/api-users-access    → toggle accès (user_id ou user_ids[])
```

---

## CONTRÔLE D'ACCÈS — 3 NIVEAUX

| Niveau | Mécanisme | Où configurer |
|---|---|---|
| Kill switch global | `feature_flags.api_public_enabled = false` | /admin/features OU /admin/api-monitoring |
| Par utilisateur | `profiles.api_access_enabled = false` | /admin/api-monitoring → onglet Accès utilisateurs |
| Par clé | `api_keys.is_active = false` | /admin/api-monitoring → onglet Clés API |

**Comportement sidebar utilisateur :**
- `api_access_enabled = false` → lien "API" grisé, badge orange "Bientôt", non cliquable
- `api_access_enabled = true` → lien actif normalement

---

## RÉSUMÉ

```
Utilisateur (/dashboard/developers)
  → Clés API           ✅ Implémenté
  → Logs d'usage       ✅ Implémenté
  → Guide rapide       ✅ Implémenté
  → Contrôle d'accès  ✅ Lien grisé si accès fermé
  → Webhooks UI        ⏳ Routes OK, UI à faire
  → Graphiques usage   ⏳ Non prioritaire

Admin (/admin/api-monitoring)
  → Kill switch global ✅ Implémenté
  → Accès par user     ✅ Implémenté (toggle + bulk)
  → Monitoring global  ✅ Implémenté
  → Vue toutes clés    ✅ Implémenté
  → Révocation admin   ✅ Implémenté
  → Logs globaux       ✅ Implémenté
```
