# FeexPay - Matrice De Test Prod (Réseau Par Réseau)
Date: 23 avril 2026  
Portée: validation fonctionnelle complète FeexPay multi-pays dans WazzapAI  
Référence correctif retour/polling: `ec95bd50`

## 1) Objectif
Valider en production, pour **chaque réseau**, que:
- l'initiation part bien chez FeexPay,
- le parcours utilisateur est cohérent (redirection web ou confirmation mobile),
- le statut final remonte correctement dans WazzapAI (`completed` ou `failed`),
- aucun paiement ne reste bloqué indéfiniment en `processing`.

---

## 2) Pré-requis obligatoires (avant tests)
1. Admin > Settings > fournisseur de paiement par défaut = `FeexPay`.
2. Variables env VPS configurées:
   - `FEEXPAY_API_KEY`
   - `FEEXPAY_SHOP_ID`
   - `FEEXPAY_API_BASE_URL`
   - `FEEXPAY_STATUS_BASE_URL`
   - `NEXT_PUBLIC_APP_URL`
3. Webhook FeexPay configuré vers:
   - `https://wazzapai.com/api/payments/feexpay/webhook`
   - événements: `transaction.successful`, `transaction.failed`
4. Déploiement contenant au minimum le commit `ec95bd50`.
5. Avoir des numéros test réels disponibles par réseau.

---

## 3) Comportement attendu par type de réseau
- **Hosted redirect**: une page de paiement FeexPay s'ouvre (ex: Wave/Orange/Moov web), puis retour marchand.
- **Confirmation mobile**: pas de page web complète, confirmation sur téléphone/USSD/push; WazzapAI reste sur état "en attente" puis finalise.
- **OTP**: champ OTP obligatoire dans la modale avant initiation.

---

## 4) Matrice réseau à exécuter
| ID | Pays | Réseau | OTP | Type attendu | Statut attendu fin test |
|---|---|---|---|---|---|
| TC-BJ-01 | Bénin | `mtn` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-BJ-02 | Bénin | `moov` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-BJ-03 | Bénin | `celtiis_bj` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-BJ-04 | Bénin | `coris` | Oui | OTP + confirmation mobile | `completed` ou `failed` cohérent |
| TC-TG-01 | Togo | `togocom_tg` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-TG-02 | Togo | `moov_tg` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-CI-01 | Côte d'Ivoire | `mtn_ci` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-CI-02 | Côte d'Ivoire | `moov_ci` | Non | Hosted redirect (si `payment_url`) | `completed` ou `failed` cohérent |
| TC-CI-03 | Côte d'Ivoire | `wave_ci` | Non | Hosted redirect (si `payment_url`) | `completed` ou `failed` cohérent |
| TC-CI-04 | Côte d'Ivoire | `orange_ci` | Non | Hosted redirect (si `payment_url`) | `completed` ou `failed` cohérent |
| TC-CG-01 | Congo Brazzaville | `mtn_cg` | Non | Confirmation mobile | `completed` ou `failed` cohérent |
| TC-SN-01 | Sénégal | `orange_sn` | Oui | OTP + confirmation mobile | `completed` ou `failed` cohérent |
| TC-SN-02 | Sénégal | `wave_sn` | Non | Hosted redirect (si `payment_url`) | `completed` ou `failed` cohérent |
| TC-SN-03 | Sénégal | `free_sn` | Non | Hosted redirect (si `payment_url`) | `completed` ou `failed` cohérent |

---

## 5) Procédure exacte pour chaque test (copier-coller opératoire)
Pour chaque ligne de la matrice:

1. Ouvrir Dashboard Billing WazzapAI.
2. Cliquer "Acheter des crédits" (pack 100 FCFA conseillé).
3. Dans la modale FeexPay:
   - sélectionner **pays**,
   - sélectionner **réseau**,
   - saisir **numéro payeur** au format international `+...`,
   - saisir OTP si demandé.
4. Valider.
5. Si page FeexPay s'ouvre:
   - confirmer ou refuser le paiement,
   - revenir sur site marchand.
6. Si confirmation mobile:
   - confirmer sur téléphone,
   - attendre le polling (quelques secondes) + webhook.
7. Capturer le résultat:
   - FeexPay dashboard (status),
   - WazzapAI billing (status),
   - DB `payments`.

---

## 6) SQL de vérification (Supabase)
### 6.1 Derniers paiements FeexPay
```sql
select
  id,
  status,
  payment_provider,
  provider_transaction_id,
  payment_channel,
  payment_channel_detail,
  created_at,
  completed_at
from public.payments
where payment_provider = 'feexpay'
order by created_at desc
limit 20;
```

### 6.2 Paiements bloqués anormalement (> 10 min)
```sql
select
  id,
  status,
  provider_transaction_id,
  created_at
from public.payments
where payment_provider = 'feexpay'
  and status in ('pending', 'processing')
  and created_at < now() - interval '10 minutes'
order by created_at desc;
```

### 6.3 Détail payload provider pour un paiement
```sql
select
  id,
  status,
  provider_transaction_id,
  provider_response
from public.payments
where id = 'REMPLACER_PAR_ID';
```

---

## 7) Logs VPS utiles
```bash
grep -E "PAY\\]\\[FEEXPAY\\]\\[INIT|PAY\\]\\[FEEXPAY\\]\\[FALLBACK_PENDING_URL|FeexPay Webhook|Account payment finalized|Finalization failed" \
~/.pm2/logs/whatsai-web-out.log ~/.pm2/logs/whatsai-web-error.log | tail -n 200
```

---

## 8) Critères d'acceptation Go-Live
Go-Live validé si:
1. Au moins **1 test réussi + 1 test refusé** par pays clé (CI, BJ, TG, SN, CG).
2. Les statuts FeexPay et WazzapAI convergent correctement (`completed` / `failed`).
3. Aucun paiement FeexPay ne reste en `processing` > 10 min sans justification opérateur.
4. Les réseaux OTP refusent correctement l'initiation sans OTP.
5. Les réseaux hosted redirigent quand `payment_url` est fourni.

---

## 9) Incident playbook rapide
Si "débité mais en cours":
1. Vérifier statut côté FeexPay (est-il vraiment `successful` ou encore `pending`?).
2. Vérifier webhook reçu (`FeexPay Webhook` dans logs).
3. Vérifier `provider_transaction_id` et `provider_response.last_verification_payload`.
4. Si final côté FeexPay mais pas WazzapAI:
   - relancer un check via endpoint verify (session utilisateur concernée),
   - confirmer mise à jour `payments.status`.

---

## 10) Recommandation d'exécution
Ordre conseillé:
1. CI (mtn_ci, wave_ci, orange_ci)  
2. SN (wave_sn, orange_sn, free_sn)  
3. BJ (mtn, moov, celtiis_bj, coris)  
4. TG (togocom_tg, moov_tg)  
5. CG (mtn_cg)

Ce plan réduit le risque car vous commencez par les flux déjà partiellement validés.

