# 🗄️ ARCHITECTURE BASE DE DONNÉES (SCHEMA VALIDÉ v6.0 - STRICT PROD)
*Dernière mise à jour : 23 Jan 2026*

Ce document pointe vers le schéma SQL **VÉRIFIÉ ET STRICT** (Source : `pg_constraint` live dump).

## 📄 Source de Vérité SQL
👉 **Fichier Maître :** `PRODUCTION_SCHEMA.sql`

> [!IMPORTANT]
> Ce fichier contient les règles **EXACTES** de Production :
> *   ✅ **Contraintes Uniques** (`orders.order_number`, `key`...)
> *   ✅ **Listes de Valeurs (CHECK)** précises pour `status`, `role`, `message_type`.
> *   ✅ **Clés Étrangères** avec les règles de suppression (`ON DELETE CASCADE`).
> *   ✅ **v2.19** : Colonne `service_subtype` sur `products` avec contrainte CHECK.

## ⚠️ Notes Techniques
*   Ce schéma est IDEMPOTENT par rapport à la base de donnée active.
*   C'est la référence absolue pour toute requête SQL générée par l'IA.

## 🚀 Migration v2.19 (Service Verticalization)
Si la production n'a pas encore la colonne `service_subtype`, exécutez :
👉 `supabase/migrations/20260124_service_verticalization.sql`

---
*L'IA doit se référer exclusivement à `PRODUCTION_SCHEMA.sql`.*
