# 🗄️ ARCHITECTURE BASE DE DONNÉES (SCHEMA VALIDÉ v5.0 - STRICT PROD)
*Dernière mise à jour : 18 Jan 2026*

Ce document pointe vers le schéma SQL **VÉRIFIÉ ET STRICT** (Source : `pg_constraint` live dump).

## 📄 Source de Vérité SQL
👉 **Fichier Maître :** `PRODUCTION_SCHEMA.sql`

> [!IMPORTANT]
> Ce fichier contient les règles **EXACTES** de Production :
> *   ✅ **Contraintes Uniques** (`orders.order_number`, `key`...)
> *   ✅ **Listes de Valeurs (CHECK)** précises pour `status`, `role`, `message_type`.
> *   ✅ **Clés Étrangères** avec les règles de suppression (`ON DELETE CASCADE`).

## ⚠️ Notes Techniques
*   Ce schéma est IDEMPOTENT par rapport à la base de donnée active.
*   C'est la référence absolue pour toute requête SQL générée par l'IA.

---
*L'IA doit se référer exclusivement à `PRODUCTION_SCHEMA.sql`.*
