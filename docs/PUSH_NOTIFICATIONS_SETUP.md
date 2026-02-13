# Configuration Push Notifications - WazzapAI APK

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      WazzapAI APK                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Capacitor Push Notifications            │    │
│  │  - Demande permissions                          │    │
│  │  - Reçoit notifications                         │    │
│  │  - Gère les actions utilisateur                 │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────┘
                         │ FCM Token
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 WazzapAI Backend (Next.js)               │
│  ┌─────────────────────────────────────────────────┐    │
│  │         /api/notifications/register-device       │    │
│  │         /api/notifications/unregister-device     │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Firebase Admin SDK                       │    │
│  │         - Envoie notifications via FCM          │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Firebase Cloud Messaging (FCM)              │
└──────────────────────────────────────────────────────────┘
```

---

## Étape 1 : Firebase Console

### 1.1 Créer un projet Firebase
1. Allez sur https://console.firebase.google.com
2. Cliquez **Ajouter un projet**
3. Nom : `WazzapAI`
4. Désactivez Google Analytics (optionnel)
5. Cliquez **Créer le projet**

### 1.2 Ajouter l'application Android
1. Dans votre projet, cliquez sur l'icône **Android**
2. Package name : `com.wazzapai.app`
3. App nickname : `WazzapAI Android`
4. Cliquez **Enregistrer l'application**
5. **Téléchargez `google-services.json`**

### 1.3 Placer google-services.json
Copiez le fichier téléchargé dans :
```
android/app/google-services.json
```

---

## Étape 2 : Service Account pour le Backend

### 2.1 Générer la clé de service
1. Firebase Console → **Paramètres du projet** (engrenage)
2. Onglet **Comptes de service**
3. Cliquez **Générer une nouvelle clé privée**
4. **Téléchargez le fichier JSON**

### 2.2 Configurer la variable d'environnement
Ajoutez dans votre `.env` :
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project",...}'
```

**⚠️ Important :**
- Collez tout le contenu JSON sur une seule ligne
- Entourez de guillemets simples
- Ne commitez JAMAIS ce fichier

---

## Étape 3 : Base de données Supabase

Exécutez la migration pour créer la table `device_tokens` :

```sql
-- Fichier: supabase/migrations/010_device_tokens.sql
-- Exécutez dans Supabase SQL Editor
```

---

## Étape 4 : Test

### 4.1 Compiler l'APK
```bash
cd wazzap-clone
npx cap sync android
cd android && ./gradlew assembleDebug
```

### 4.2 Installer et tester
1. Installez l'APK sur votre téléphone
2. Connectez-vous à votre compte
3. Vérifiez les logs : le token FCM devrait s'afficher

### 4.3 Envoyer une notification de test
Utilisez Firebase Console → **Messaging** → **Nouvelle campagne** → **Notifications**

---

## Utilisation dans le code

### Initialiser les notifications (automatique)
```tsx
// Dans le dashboard ou layout après connexion
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function DashboardLayout({ children }) {
    const { isSupported, isInitialized, error } = usePushNotifications();

    // Les notifications sont initialisées automatiquement
    return <>{children}</>;
}
```

### Envoyer une notification depuis le backend
```typescript
import { sendNotificationToUser } from '@/lib/notifications/firebase-admin';
import { createClient } from '@/lib/supabase/server';

// Exemple : notifier un nouveau message
const supabase = await createClient();
await sendNotificationToUser(supabase, userId, {
    title: '💬 Nouveau message',
    body: 'Vous avez reçu un nouveau message sur WhatsApp',
    data: {
        type: 'new_message',
        agentId: 'xxx'
    }
});
```

---

## Types de notifications

| Type | Titre | Description |
|------|-------|-------------|
| `new_message` | 💬 Nouveau message | Message reçu sur WhatsApp |
| `new_order` | 🛒 Nouvelle commande | Commande créée par un client |
| `low_credits` | ⚠️ Crédits faibles | Moins de X crédits restants |
| `payment_success` | ✅ Paiement reçu | Confirmation de paiement |
| `agent_offline` | 🔴 Agent hors ligne | L'agent WhatsApp est déconnecté |

---

## Fichiers concernés

| Fichier | Description |
|---------|-------------|
| `src/lib/notifications/push-notifications.ts` | Client-side: init, listeners |
| `src/lib/notifications/firebase-admin.ts` | Server-side: envoi FCM |
| `src/hooks/usePushNotifications.ts` | React hook |
| `src/app/api/notifications/register-device/route.ts` | API enregistrement token |
| `src/app/api/notifications/unregister-device/route.ts` | API suppression token |
| `android/app/google-services.json` | Config Firebase Android |
| `supabase/migrations/010_device_tokens.sql` | Table tokens |

---

## Troubleshooting

### Erreur "Firebase not initialized"
- Vérifiez `FIREBASE_SERVICE_ACCOUNT_KEY` dans `.env`
- Le JSON doit être sur une seule ligne

### Token non reçu
- Vérifiez que `google-services.json` est bien placé
- Rebuild l'APK après modification

### Notification non reçue
- Vérifiez le channel ID : `wazzapai_notifications`
- Vérifiez les permissions de l'app sur le téléphone

---

## Support

- 📧 support@wazzapai.com
- 📱 +225 05 54 58 59 27
