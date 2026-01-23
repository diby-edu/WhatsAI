# 🗄️ ARCHITECTURE BASE DE DONNÉES (SCHEMA VALIDÉ v7.0 - STRICT PROD)
*Dernière mise à jour : 23 Jan 2026 (Extraction Live)*

Ce document pointe vers le schéma SQL **VÉRIFIÉ ET STRICT** (Source : `pg_constraint` live dump).

## 📊 Statistiques
- **Tables**: 21
- **Contraintes**: 68 (CHECK, PK, FK, UNIQUE)
- **Foreign Keys**: 26

## 📄 Source de Vérité SQL
👉 **Fichier Maître :** `PRODUCTION_SCHEMA.sql` (v4)

> [!IMPORTANT]
> Ce fichier contient les règles **EXACTES** de Production :
> *   ✅ **Contraintes Uniques** (`orders.order_number`, `key`...)
> *   ✅ **Listes de Valeurs (CHECK)** précises pour `status`, `role`, `message_type`.
> *   ✅ **Clés Étrangères** avec les règles de suppression (`ON DELETE CASCADE`).
> *   ✅ **v2.19** : Colonne `service_subtype` sur `products` avec 11 valeurs possibles.

## ⚠️ Notes Techniques
*   Ce schéma est IDEMPOTENT par rapport à la base de donnée active.
*   C'est la référence absolue pour toute requête SQL générée par l'IA.

## 🚀 Migration v2.19 (Service Verticalization)
La colonne `service_subtype` est présente avec contrainte CHECK:
```
hotel, residence, restaurant, formation, event, coiffeur, medecin, coaching, prestation, rental, other
```

---
*L'IA doit se référer exclusivement à `PRODUCTION_SCHEMA.sql`.*
