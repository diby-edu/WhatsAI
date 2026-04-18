# Programme du 9 avril - nettoyage des comptes test

## Objectif

Supprimer uniquement les comptes qui sont encore de vrais comptes test a l'expiration du delai affiche dans le dashboard.

Un compte est supprimable seulement si toutes les conditions suivantes sont encore vraies au moment du controle :

- plan `free`
- role non protege (`user` classique seulement)
- `test_account_cleanup_deadline <= now()`
- `test_account_qualified_at is null`
- aucun paiement `completed`
- aucun agent deja vraiment connecte

Important :

- le `0` actuel dans `comptes_supprimables_a_date` est normal tant que la deadline n'est pas atteinte
- pour la campagne en cours, les comptes existants ont tous recu une deadline commune au `2026-04-09 20:35:29 UTC`

## SQL 1 - Resume global

A lancer en premier le 9 avril.

```sql
with candidates as (
  select
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    p.test_account_cleanup_deadline,
    p.test_account_qualified_at,
    exists (
      select 1
      from public.payments pay
      where pay.user_id = p.id
        and pay.status = 'completed'
    ) as has_completed_payment,
    exists (
      select 1
      from public.agents a
      where a.user_id = p.id
        and (
          coalesce(a.whatsapp_ever_connected, false) = true
          or coalesce(a.whatsapp_connected, false) = true
          or a.whatsapp_phone is not null
          or a.whatsapp_status in ('connected', 'reconnect_required', 'disconnected')
        )
    ) as has_qualifying_agent
  from public.profiles p
  where coalesce(p.plan, 'free') = 'free'
    and coalesce(p.role, 'user') not in ('admin', 'superadmin', 'support')
)
select
  count(*) filter (where test_account_cleanup_deadline is not null) as comptes_avec_deadline,
  count(*) filter (where test_account_qualified_at is not null) as comptes_deja_qualifies,
  count(*) filter (
    where test_account_cleanup_deadline <= now()
      and test_account_qualified_at is null
      and not has_completed_payment
      and not has_qualifying_agent
  ) as comptes_supprimables_maintenant
from candidates;
```

## SQL 2 - Liste finale a exporter

A lancer juste avant la suppression automatique.

```sql
with deletable as (
  select
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    p.test_account_cleanup_deadline
  from public.profiles p
  where coalesce(p.plan, 'free') = 'free'
    and coalesce(p.role, 'user') not in ('admin', 'superadmin', 'support')
    and p.test_account_cleanup_deadline is not null
    and p.test_account_cleanup_deadline <= now()
    and p.test_account_qualified_at is null
    and not exists (
      select 1
      from public.payments pay
      where pay.user_id = p.id
        and pay.status = 'completed'
    )
    and not exists (
      select 1
      from public.agents a
      where a.user_id = p.id
        and (
          coalesce(a.whatsapp_ever_connected, false) = true
          or coalesce(a.whatsapp_connected, false) = true
          or a.whatsapp_phone is not null
          or a.whatsapp_status in ('connected', 'reconnect_required', 'disconnected')
        )
    )
)
select *
from deletable
order by test_account_cleanup_deadline asc, created_at asc;
```

## SQL 3 - Spot check post-suppression

Utiliser 2 ou 3 IDs supprimes pour verifier que les agents ont aussi disparu.

```sql
select
  user_id,
  count(*) as agents_restants
from public.agents
where user_id in (
  'ID_UTILISATEUR_1',
  'ID_UTILISATEUR_2',
  'ID_UTILISATEUR_3'
)
group by user_id;
```

Attendu :

- aucune ligne retournee

## SQL 4 - Simulation avant l'echeance

Si tu veux savoir qui serait supprimable exactement a l'heure de la deadline commune :

```sql
with deletable as (
  select
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    p.test_account_cleanup_deadline
  from public.profiles p
  where coalesce(p.plan, 'free') = 'free'
    and coalesce(p.role, 'user') not in ('admin', 'superadmin', 'support')
    and p.test_account_cleanup_deadline is not null
    and p.test_account_cleanup_deadline <= timestamptz '2026-04-09 20:35:29+00'
    and p.test_account_qualified_at is null
    and not exists (
      select 1
      from public.payments pay
      where pay.user_id = p.id
        and pay.status = 'completed'
    )
    and not exists (
      select 1
      from public.agents a
      where a.user_id = p.id
        and (
          coalesce(a.whatsapp_ever_connected, false) = true
          or coalesce(a.whatsapp_connected, false) = true
          or a.whatsapp_phone is not null
          or a.whatsapp_status in ('connected', 'reconnect_required', 'disconnected')
        )
    )
)
select *
from deletable
order by test_account_cleanup_deadline asc, created_at asc;
```

## Deroule operatoire du 9 avril

### 08:50

- lancer SQL 1
- verifier que les chiffres paraissent coherents

### 08:52

- lancer SQL 2
- exporter la liste en CSV depuis Supabase

### 08:55

- relecture rapide des noms et emails
- verifier qu'il n'y a pas un faux positif evident

### 08:58

- verifier qu'aucun compte de la liste n'a entre-temps :
  - un paiement `completed`
  - un agent vraiment connecte

### 09:00

- laisser le cron faire la suppression

### 09:05

- relancer SQL 2
- attendu : `0 ligne`

### 09:10

- lancer SQL 3 sur quelques IDs supprimes
- attendu : aucun agent restant

## Message support si contestation

```text
Bonjour,

Votre compte gratuit a ete supprime automatiquement car il etait encore considere comme un compte de test a l'expiration du delai affiche dans le tableau de bord, sans paiement valide ni agent WhatsApp reellement connecte.

Si vous estimez qu'il s'agit d'une erreur, repondez a ce message avec l'email du compte concerne. Nous verifierons immediatement les journaux de paiement et de connexion associes.

Merci.
L'equipe WazzapAI
```

## Decision produit a ne pas oublier

Le nettoyage doit rester strictement borne aux comptes test. Il ne faut jamais supprimer :

- un compte admin, superadmin ou support
- un compte avec paiement `completed`
- un compte qui a deja vraiment connecte un agent
- un compte dont la deadline n'est pas encore atteinte
