# WazzapAI x WooCommerce - Court Terme (Doc + Snippet)

## Objectif
Mettre en production rapidement une integration WooCommerce vers WazzapAI, sans developper un plugin WooCommerce complet.

Approche court terme:
1. Configurer un webhook WooCommerce vers WazzapAI.
2. Ajouter un snippet WordPress pour fiabiliser le numero telephone client.
3. Verifier les envois WhatsApp avec un protocole de test simple.

---

## Ce que cette solution couvre
- Reception des evenements Woo `order.created` par WazzapAI.
- Signature webhook Woo verifiee.
- Anti-doublon (idempotence) cote WazzapAI.
- Envoi WhatsApp automatique apres commande.

## Ce que cette solution ne couvre pas parfaitement
- UX zero-config pour tous les marchands Woo.
- Validation telephone ultra-avancee multi-pays.
- Ecran d'administration Woo dedie WazzapAI.

---

## Prerequis

## Cote WazzapAI (deja en place)
- Un agent connecte a WhatsApp (`whatsapp_connected = true`).
- Une connexion plateforme Woo creee dans Dashboard Developers.
- Une URL incoming type:
`https://wazzapai.com/api/public/v1/incoming/pwk_xxx`
- Un secret type:
`wsec_xxx`

## Cote WooCommerce
- Boutique Woo active.
- Acces admin WordPress.

---

## Etape 1 - Configurer le webhook WooCommerce

Dans Woo:
`WooCommerce > Settings > Advanced > Webhooks > Add webhook`

Utiliser:
- `Name`: `WazzapAI - Order Created`
- `Status`: `Active`
- `Topic`: `Order created`
- `Delivery URL`: URL incoming WazzapAI (`/api/public/v1/incoming/pwk_...`)
- `Secret`: secret WazzapAI (`wsec_...`)
- `API Version`: `WP REST API Integration v3`

Puis cliquer `Save webhook`.

Attendu:
- Woo doit afficher `Webhook updated successfully`.

Note:
- Woo envoie parfois un "probe" non signe pendant la validation.
- WazzapAI l'ignore proprement (status 200) pour ne pas bloquer la sauvegarde.

---

## Etape 2 - Rendre le telephone checkout fiable (snippet)

Sans ce snippet:
- commande sans telephone => pas de message WhatsApp possible.
- telephone local mal formate => risque d'echec de livraison.

## Installation du snippet (methode recommandee)
1. WordPress admin -> `Plugins > Add New`.
2. Installer `Code Snippets`.
3. Activer le plugin.
4. Aller dans `Snippets > Add New`.
5. Nommer: `Wazzap - Phone checkout E164`.
6. Coller le code ci-dessous.
7. Selectionner `Run snippet everywhere`.
8. `Save and Activate`.

## Snippet
```php
add_filter('woocommerce_billing_fields', function ($fields) {
    if (isset($fields['billing_phone'])) {
        $fields['billing_phone']['required'] = true;
        $fields['billing_phone']['label'] = 'Téléphone WhatsApp (+ indicatif)';
        $fields['billing_phone']['placeholder'] = '+2250700000000';
    }
    return $fields;
}, 20);

function wazzap_normalize_phone_with_country($phone, $country) {
    $phone = trim((string) $phone);
    if ($phone === '') return '';

    $digits = preg_replace('/\D+/', '', $phone);
    if ($digits === '') return '';

    // Déjà en format +...
    if (str_starts_with($phone, '+')) return '+' . $digits;

    // Cas international saisi en 00...
    if (str_starts_with($digits, '00')) return '+' . substr($digits, 2);

    // Déduction indicatif depuis pays de facturation
    $cc = '';
    if (function_exists('WC') && WC()->countries) {
        $calling = WC()->countries->get_country_calling_code($country);
        if (is_array($calling)) $calling = reset($calling);
        if (is_string($calling) && $calling !== '') $cc = ltrim($calling, '+');
    }

    // Evite le doublon d'indicatif (ex: 225... + pays CI => pas de +225225...)
    if ($cc !== '' && str_starts_with($digits, $cc)) return '+' . $digits;
    if ($cc !== '') return '+' . $cc . $digits;

    // Fallback si pays inconnu
    return '+' . $digits;
}

add_filter('woocommerce_checkout_posted_data', function ($data) {
    if (!empty($data['billing_phone'])) {
        $country = !empty($data['billing_country']) ? $data['billing_country'] : '';
        $data['billing_phone'] = wazzap_normalize_phone_with_country($data['billing_phone'], $country);
    }
    return $data;
}, 20);

add_action('woocommerce_after_checkout_validation', function ($data, $errors) {
    $phone = isset($data['billing_phone']) ? trim((string) $data['billing_phone']) : '';

    if ($phone === '') {
        $errors->add('billing_phone_required', 'Le numéro WhatsApp est obligatoire.');
        return;
    }

    if (!preg_match('/^\+\d{8,15}$/', $phone)) {
        $errors->add('billing_phone_invalid', 'Numéro invalide. Format attendu: +2250700000000');
    }
}, 20, 2);
```

---

## Etape 3 - Cas reels et comportement attendu

## Cas A - Client met `+2250141859625`
- Normalise en `+2250141859625` (inchangé).
- Envoi webhook OK.
- Envoi WhatsApp possible.

## Cas B - Client met `2250141859625` (sans `+`)
- Si pays = CI, conserve `+2250141859625` (pas de doublon).
- Envoi WhatsApp possible.

## Cas C - Client met juste `225`
- Rejete au checkout (numero invalide).
- Aucune commande finalisee sans correction.

## Cas D - Client laisse vide
- Rejete au checkout (obligatoire).

---

## Etape 4 - Verifier en production

## Verif connexion incoming
```sql
select
  name, last_status_code, last_error, last_received_at
from public.api_platform_connections
where webhook_token = 'pwk_xxx';
```

Attendu:
- `last_status_code = 200`
- `last_error = null` (sur evenement reel signe)

## Verif outbound WhatsApp
```sql
select
  id, recipient_phone, message_content, status, created_at, sent_at
from public.outbound_messages
where agent_id = 'AGENT_ID'
order by created_at desc
limit 10;
```

Attendu:
- ligne creee avec `status = sent`

## Verif logs
```bash
grep -E "INCOMING\\]\\[PROBE|INCOMING\\]\\[SIGNATURE|OUTBOUND\\]|accepted by WhatsApp" \
~/.pm2/logs/whatsai-web-error.log \
~/.pm2/logs/whatsai-web-out.log \
~/.pm2/logs/whatsai-bot-out.log | tail -n 120
```

---

## FAQ rapide

## Faut-il plusieurs webhooks Woo?
Oui. En Woo natif:
- 1 webhook = 1 topic.
- Exemple: `Order created`, `Order updated`, `Order failed` = 3 webhooks.

## Est-ce que ce snippet est obligatoire?
Obligatoire si vous voulez un niveau de fiabilite eleve en production.
Sinon les commandes sans telephone resteront non joignables par WhatsApp.

## WazzapAI peut-il forcer le checkout Woo sans snippet?
Non. Le checkout appartient a la boutique Woo du marchand.

---

## Check-list Go Live (court terme)
- Agent WazzapAI WhatsApp connecte.
- Webhook Woo `Order created` actif.
- Snippet telephone actif.
- Commande test reelle validee.
- `outbound_messages.status = sent`.
- Message recu sur le numero client.

