# Audit Sécurité & Performance — WazzapAI
**Date :** 15 avril 2026
**Rédigé par :** Claude (analyse automatique du code source)
**Destinataires :** Équipe technique et non-technique

---

## Introduction

Ce document présente les résultats d'un audit complet du code de l'application WazzapAI. L'objectif est d'identifier les points faibles existants — qu'ils concernent la sécurité, la performance ou la qualité générale du code — et de proposer un plan d'action clair pour y remédier.

Les problèmes sont classés en trois niveaux de priorité :
- **CRITIQUE** : à corriger immédiatement, risque réel pour l'application ou les utilisateurs
- **MAJEUR** : important, à corriger rapidement mais sans urgence absolue
- **MINEUR** : amélioration qualité, peut attendre une fenêtre de maintenance

---

## CRITIQUES

### 1. Porte ouverte si la configuration serveur est absente
**Fichier concerné :** `src/lib/supabase/middleware.ts`

**Explication simple :**
Imagine que tu as une porte d'entrée sécurisée dans ton immeuble. Le système vérifie ta clé avant de te laisser entrer. Mais si le système de clé tombe en panne, au lieu de bloquer tout le monde, la porte s'ouvre automatiquement pour tout le monde. C'est exactement ce qui se passe ici.

Si les variables de configuration Supabase sont absentes du serveur (suite à un mauvais déploiement, une erreur de configuration, ou toute autre raison), le middleware laisse passer **toutes les requêtes sans vérification**. N'importe qui peut accéder au dashboard, aux données, aux agents — sans être connecté.

**Risque concret :**
Un déploiement raté sur le VPS qui efface les variables d'environnement → toute l'application devient publique sans authentification.

**Plan de correction :**
En mode production, si la configuration est absente, retourner une erreur 503 "Service indisponible" plutôt que de laisser passer. La porte doit rester fermée, peu importe la raison.

**Effort estimé :** 15 minutes. Modification de 3 lignes.

---

### 2. La route de diagnostic révèle trop d'informations
**Fichier concerné :** `src/app/api/admin/diagnostics/env/route.ts`

**Explication simple :**
Il existe une page réservée aux administrateurs qui affiche quels services sont configurés sur le serveur (Paystack, OpenAI, CinetPay, etc.). L'idée de départ est bonne — permettre à l'admin de vérifier que tout est bien branché. Mais en pratique, cette page retourne une liste détaillée de quels services sont actifs et lesquels ne le sont pas.

Un administrateur mal intentionné — ou un compte admin compromis — peut utiliser cette information pour cibler une attaque. Si la page révèle que Paystack est configuré mais pas CinetPay, un attaquant sait exactement où concentrer ses efforts.

**Risque concret :**
Un compte admin compromis donne à l'attaquant une carte des services actifs. C'est comme laisser le plan de sécurité d'un bâtiment dans le hall d'entrée.

**Plan de correction :**
Modifier la réponse pour ne retourner que les variables **manquantes** (ce qui est utile pour le diagnostic), jamais la liste de ce qui est configuré. Un simple "tout est OK" ou "il manque X" suffit.

**Effort estimé :** 10 minutes.

---

## MAJEURS

### 3. 50 commandes pour afficher 50 broadcasts (N+1 queries)
**Fichier concerné :** `src/app/api/admin/broadcasts/route.ts`

**Explication simple :**
Les broadcasts sont les envois de messages en masse (WhatsApp, Email, Push). Quand l'admin ouvre la liste des broadcasts, le code récupère d'abord tous les broadcasts, puis pour chaque broadcast, il retourne au serveur une deuxième fois pour chercher le nom de l'agent associé. 50 broadcasts = 51 requêtes au total (1 + 50).

C'est comme si tu commandais un menu dans un restaurant et que le serveur allait chercher chaque ingrédient un par un dans la cuisine, au lieu de tout apporter en une seule fois.

**Risque concret :**
Avec beaucoup de broadcasts, la page admin devient lente. En pic d'utilisation, ça peut surcharger la connexion à Supabase.

**Plan de correction :**
Utiliser une jointure SQL dans la première requête pour récupérer les broadcasts ET les noms d'agents en une seule opération. Supabase supporte cela nativement avec la syntaxe `select('*, agent:agents(name)')`.

**Effort estimé :** 30 minutes.

---

### 4. Le dashboard des conversations rafraîchit toutes les 5 secondes
**Fichier concerné :** `src/app/[locale]/dashboard/conversations/[id]/page.tsx`

**Explication simple :**
Quand un utilisateur ouvre une conversation dans son dashboard, le navigateur envoie automatiquement une requête au serveur toutes les 5 secondes pour savoir s'il y a de nouveaux messages à afficher. Que quelqu'un ait envoyé un message ou non, que l'utilisateur soit actif ou en train de faire autre chose — les requêtes partent quand même.

C'est comme appeler quelqu'un toutes les 5 secondes pour demander "t'as du courrier ?" au lieu d'attendre qu'on te prévienne.

**Note importante :**
Cela n'affecte PAS le fonctionnement du bot. Le bot répond aux clients WhatsApp via un système complètement séparé (Supabase Realtime côté serveur) qui fonctionne parfaitement sans que le dashboard soit ouvert. Ce problème concerne uniquement l'affichage dans l'interface utilisateur.

**Risque concret :**
À 100 utilisateurs avec leur dashboard ouvert simultanément = 1200 requêtes par minute vers le serveur. La plupart retournent "rien de nouveau". En période de croissance, cela peut créer une charge inutile.

**Plan de correction (deux options) :**
- **Option A (rapide) :** Passer le polling de 5 secondes à 30 secondes. 6x moins de requêtes, effort minimal.
- **Option B (idéale) :** Utiliser Supabase Realtime côté frontend — le serveur prévient le navigateur quand un nouveau message arrive, plus de polling du tout. L'infrastructure Realtime est déjà présente dans le projet côté serveur, donc c'est faisable.

**Effort estimé :** Option A : 5 minutes. Option B : 2-3 heures.

---

### 5. L'API publique s'ouvre automatiquement si la configuration échoue
**Fichier concerné :** `src/lib/api/public-auth.ts`

**Explication simple :**
L'API publique de WazzapAI permet à des développeurs externes d'interagir avec la plateforme via des clés API. Il existe un "interrupteur" global pour activer ou désactiver cette API. Mais si cet interrupteur ne peut pas être lu (table absente en DB, erreur réseau), au lieu de bloquer par prudence, le code laisse passer la requête.

C'est comme si l'alarme d'une banque tombait en panne et, au lieu de déclencher un verrouillage, ouvrait toutes les portes.

**Risque concret :**
Si la migration SQL de la table `feature_flags` n'a pas été exécutée, ou si Supabase a une panne momentanée, l'API devient publiquement accessible sans contrôle.

**Plan de correction :**
Inverser la logique : en cas d'erreur de lecture du flag, **bloquer par défaut** plutôt que laisser passer. La sécurité doit être l'état par défaut, pas l'exception.

**Effort estimé :** 10 minutes.

---

### 6. La validation des webhooks de paiement est insuffisante
**Fichiers concernés :** Webhooks CinetPay et Paystack

**Explication simple :**
Quand un paiement est effectué, CinetPay ou Paystack envoient une notification (webhook) au serveur pour confirmer la transaction. Pour s'assurer que cette notification vient bien de CinetPay et non d'un imposteur, le serveur vérifie un token secret dans l'en-tête de la requête.

Le problème : la vérification actuelle ne détecte pas une chaîne vide. Un attaquant peut envoyer un en-tête `x-token: ` (vide) et passer la vérification sans avoir le vrai token.

**Risque concret :**
Un attaquant pourrait simuler une confirmation de paiement fictive et déclencher l'activation d'un abonnement sans avoir réellement payé.

**Plan de correction :**
Vérifier non seulement que le token est présent, mais aussi qu'il a une longueur minimale et correspond exactement au token attendu.

**Effort estimé :** 20 minutes.

---

### 7. Les données des conversations ne sont pas vérifiées côté serveur
**Fichier concerné :** `src/app/api/conversations/[id]/route.ts`

**Explication simple :**
Quand un utilisateur demande à voir une conversation, le serveur fait confiance au système de sécurité de Supabase (appelé RLS) pour ne lui montrer que ses propres conversations. C'est généralement suffisant, mais il n'y a pas de double vérification côté code.

Si la RLS Supabase est mal configurée ou désactivée par erreur, un utilisateur pourrait accéder aux conversations d'un autre utilisateur.

**Risque concret :**
Fuite de données entre utilisateurs si la RLS est mal configurée. Probabilité faible mais impact élevé.

**Plan de correction :**
Ajouter une vérification explicite dans le code API : après avoir récupéré la conversation, vérifier que l'agent associé appartient bien à l'utilisateur connecté. Si ce n'est pas le cas, retourner une erreur 403 "Accès refusé".

**Effort estimé :** 30 minutes.

---

## MINEURS

### 8. Certaines divisions par zéro potentielles dans la pagination
**16 routes concernées**

Le code utilise `parseInt()` pour lire les paramètres de pagination (page, limite). Si un utilisateur malveillant ou un bug envoie une valeur non numérique (ex: "abc"), `parseInt()` retourne `NaN` ce qui peut causer des comportements imprévisibles dans les requêtes.

**Correction :** Ajouter une validation simple avec valeur par défaut.
**Effort :** 1 heure pour les 16 routes.

---

### 9. Logs verbeux en production
**568 occurrences dans le code**

L'application enregistre beaucoup d'informations dans les logs, y compris parfois des identifiants de transaction. En production, ces logs sont visibles dans les outils de monitoring et peuvent exposer des informations sensibles à quiconque a accès au serveur.

**Correction :** Mettre en place un système de logs qui filtre automatiquement les données sensibles en production.
**Effort :** 2-3 heures.

---

### 10. Erreurs silencieuses
**Plusieurs fichiers concernés**

Certains blocs de gestion d'erreur (`catch {}`) sont vides — ils capturent l'erreur mais ne font rien avec. Si quelque chose se passe mal dans ces zones du code, il n'y a aucune trace, aucun log, aucune alerte. Le bug devient impossible à diagnostiquer.

**Correction :** Ajouter au minimum un log dans chaque bloc `catch` vide.
**Effort :** 1 heure.

---

### 11. Absence de cache sur les données statiques
**Routes concernées :** `/api/plans`, `/api/features`

Les plans d'abonnement et les flags de fonctionnalités changent rarement. Pourtant, à chaque visite d'une page, le serveur les recharge depuis Supabase. Un simple cache de 60 secondes réduirait considérablement ces requêtes.

**Correction :** Ajouter un header `Cache-Control: public, max-age=60` sur ces routes.
**Effort :** 15 minutes.

---

### 12. Code mort — fichier legacy non utilisé
**Fichier :** `src/lib/whatsapp/message-handler.ts`

Ce fichier est explicitement marqué "LEGACY — NE PAS MODIFIER" dans le code lui-même. Il n'est jamais exécuté en production. Il encombre le projet sans utilité.

**Correction :** Supprimer le fichier.
**Effort :** 5 minutes.

---

## Résumé et plan d'action

| Priorité | Point | Effort | Impact |
|----------|-------|--------|--------|
| CRITIQUE | Middleware fail-open | 15 min | Très élevé |
| CRITIQUE | Route diagnostics trop bavarde | 10 min | Élevé |
| MAJEUR | API fail-open | 10 min | Élevé |
| MAJEUR | Webhook validation insuffisante | 20 min | Élevé |
| MAJEUR | N+1 queries broadcasts | 30 min | Moyen |
| MAJEUR | Vérification conversations | 30 min | Moyen |
| MAJEUR | Polling 5s conversations | 5-180 min | Faible |
| MINEUR | parseInt NaN | 1h | Faible |
| MINEUR | Logs verbeux | 2-3h | Faible |
| MINEUR | Catch vides | 1h | Faible |
| MINEUR | Cache routes statiques | 15 min | Faible |
| MINEUR | Supprimer code mort | 5 min | Aucun |

**Recommandation :** Commencer par les 4 premiers points. Ils représentent moins de 1 heure de travail au total pour un gain de sécurité significatif.
