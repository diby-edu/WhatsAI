# Templates Email WazzapAI - Configuration Supabase

## Configuration dans Supabase Dashboard

Allez dans : **Authentication** → **Email Templates**

---

## 1. Confirmer l'inscription (Confirm signup)

**Objet :**
```
🎉 Bienvenue sur WazzapAI - Confirmez votre compte
```

**Corps (Message body) :** Copiez le contenu de `confirm-signup.html`

---

## 2. Réinitialiser le mot de passe (Reset Password)

**Objet :**
```
🔐 WazzapAI - Réinitialisation de votre mot de passe
```

**Corps (Message body) :** Copiez le contenu de `reset-password.html`

---

## 3. Mot de passe changé (Password Changed)

**Objet :**
```
✅ WazzapAI - Votre mot de passe a été modifié
```

**Corps (Message body) :** Copiez le contenu de `password-changed.html`

---

## Variables Supabase disponibles

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Lien de confirmation |
| `{{ .Token }}` | Code de vérification (6 chiffres) |
| `{{ .TokenHash }}` | Hash du token |
| `{{ .SiteURL }}` | URL du site |
| `{{ .Email }}` | Email de l'utilisateur |
| `{{ .NewEmail }}` | Nouvel email (changement d'email) |

---

## Configuration SMTP recommandée

Dans **Project Settings** → **Authentication** → **SMTP Settings** :

| Paramètre | Valeur |
|-----------|--------|
| Sender email | `noreply@wazzapai.com` |
| Sender name | `WazzapAI` |
| Host | Votre serveur SMTP |
| Port | 587 (TLS) ou 465 (SSL) |

---

## Aperçu des templates

Les templates utilisent le design WazzapAI avec :
- 🎨 Fond sombre (#0f172a, #1e293b)
- 💚 Couleur principale verte (#10b981, #34d399)
- 📱 Design responsive
- 🔒 Conseils de sécurité intégrés
- 📞 Contact support visible

---

## Support

- 📧 support@wazzapai.com
- 📱 +225 05 54 58 59 27
