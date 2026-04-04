# ÉTAT DES DASHBOARDS — API WAZZAPAI

## DASHBOARD UTILISATEUR — /dashboard/developers

### Statut : Implémenté

**Accès :** Menu latéral → Développeurs (lien à ajouter dans layout.tsx)

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

**Ce qui manque :**

| Fonctionnalité | Priorité |
|---|---|
| Graphique d'usage (appels / jour) | Moyen |
| Filtres sur les logs (par date, par statut) | Moyen |
| Gestion des webhooks sortants (UI) | Moyen |
| Tester un endpoint directement depuis l'UI | Bas |

---

## DASHBOARD ADMIN — /admin

### Statut : Non implémenté pour l'API

**Ce qui existe déjà dans /admin :**
- Gestion des agents, utilisateurs, commandes, analytics, etc.
- Aucune section API pour l'instant

**Ce qu'il faut ajouter :**

### Page /admin/api-monitoring (à créer)

| Fonctionnalité | Description |
|---|---|
| Volume total d'appels | Graphique appels/jour sur 30 jours |
| Top utilisateurs par volume | Qui appelle le plus l'API |
| Taux d'erreur global | % de requêtes en erreur |
| Clés actives / inactives | Nombre total de clés |
| Détection d'abus | Utilisateurs dépassant régulièrement le rate limit |
| Révocation administrative | Désactiver une clé d'un utilisateur |
| Vue de tous les logs | Sans filtre user_id (vue admin) |

**Route API admin nécessaire :**
```
GET /api/admin/api-stats      → statistiques globales
GET /api/admin/api-keys       → toutes les clés (tous utilisateurs)
GET /api/admin/api-logs       → tous les logs (tous utilisateurs)
PATCH /api/admin/api-keys/[id] → révoquer une clé
```

Ces routes doivent vérifier que l'utilisateur est admin (via `is_admin` ou rôle Supabase).

---

## RÉSUMÉ

```
Utilisateur (/dashboard/developers)
  → Clés API           ✅ Implémenté
  → Logs d'usage       ✅ Implémenté
  → Guide rapide       ✅ Implémenté
  → Webhooks UI        ❌ À implémenter
  → Graphiques usage   ❌ À implémenter

Admin (/admin/api-monitoring)
  → Monitoring global  ❌ À implémenter
  → Vue toutes clés    ❌ À implémenter
  → Révocation admin   ❌ À implémenter
```

**Priorité recommandée :**
1. Lien sidebar "Développeurs" dans layout.tsx (si pas encore fait)
2. UI webhooks dans le dashboard utilisateur
3. Page admin /admin/api-monitoring
