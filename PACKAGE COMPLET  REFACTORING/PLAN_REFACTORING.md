# 🏗️ PLAN DE REFACTORING `message.js`

## 📊 DIAGNOSTIC ACTUEL

### État des Lieux (742 lignes)

```
src/lib/whatsapp/handlers/message.js
├─ handleMessage() : 742 lignes
│  ├─ Conversation management (50 lignes)
│  ├─ Agent & credits check (40 lignes)
│  ├─ Message storage (30 lignes)
│  ├─ Audio transcription (50 lignes)
│  ├─ Image processing (70 lignes)
│  ├─ Conversation history fetch (40 lignes)
│  ├─ Products fetch (30 lignes)
│  ├─ Orders fetch (40 lignes)
│  ├─ Sentiment analysis (60 lignes)
│  ├─ AI response generation (80 lignes)
│  ├─ Voice synthesis (60 lignes)
│  ├─ WhatsApp message sending (50 lignes)
│  ├─ Database updates (60 lignes)
│  ├─ Stats updates (40 lignes)
│  └─ Error handling (20 lignes)
```

### ❌ Problèmes Identifiés

| Problème | Impact | Gravité |
|----------|--------|---------|
| **God Function** | Impossible à tester unitairement | 🔴 CRITIQUE |
| **Mixed Concerns** | Violation SRP (Single Responsibility) | 🔴 CRITIQUE |
| **Race Conditions** | Déduction crédits non atomique | 🔴 CRITIQUE |
| **Silent Errors** | Erreurs non remontées au client | 🟠 HAUTE |
| **Code Dupliqué** | DB queries répétées | 🟡 MOYENNE |
| **No Retry Logic** | Baileys peut échouer sans retry | 🟡 MOYENNE |

---

## 🎯 OBJECTIFS DU REFACTORING

### Principes Directeurs

1. **Séparation des Responsabilités** (SRP)
2. **Testabilité** (chaque service testable indépendamment)
3. **Maintenabilité** (fichiers < 200 lignes)
4. **Atomicité** (transactions DB sécurisées)
5. **Observabilité** (logs structurés)

### Résultat Attendu

```
src/lib/whatsapp/
├─ handlers/
│  └─ message.js (orchestrateur - 150 lignes max)
├─ services/
│  ├─ conversation.service.js
│  ├─ media.service.js
│  ├─ ai.service.js
│  ├─ credits.service.js
│  ├─ messaging.service.js
│  └─ analytics.service.js
└─ utils/
   ├─ errors.js
   └─ retry.js
```

---

## 🏛️ NOUVELLE ARCHITECTURE

### 1. Orchestrateur Principal (`message.js`)

**Rôle** : Coordonner les services, pas exécuter la logique.

```javascript
async function handleMessage(context, agentId, message, isVoiceMessage) {
    try {
        // 1. Vérifications initiales
        const conversation = await ConversationService.getOrCreate(...)
        if (conversation.isPaused()) return
        
        const agent = await AgentService.get(agentId)
        const hasCredits = await CreditsService.check(agent.user_id)
        if (!hasCredits) return
        
        // 2. Traitement message entrant
        await MessageStorageService.store(...)
        
        // 3. Traitement média (si applicable)
        if (isVoiceMessage) {
            message.text = await MediaService.transcribeAudio(...)
        }
        if (message.imageMessage) {
            message.imageBase64 = await MediaService.processImage(...)
        }
        
        // 4. Chargement contexte
        const context = await ContextService.load(agent, conversation)
        
        // 5. Génération réponse IA
        const aiResponse = await AIService.generate(message, context)
        
        // 6. Envoi réponse
        await MessagingService.send(agentId, message.from, aiResponse)
        
        // 7. Mise à jour stats & crédits (atomique)
        await CreditsService.deduct(agent.user_id, creditsUsed)
        await AnalyticsService.track(agent, conversation)
        
    } catch (error) {
        await ErrorHandler.handle(error, { agentId, message })
    }
}
```

**Taille** : ~150 lignes (au lieu de 742)

---

## 📦 SERVICES À CRÉER

### Service 1 : `conversation.service.js`

**Responsabilité** : Gestion du cycle de vie des conversations.

```javascript
class ConversationService {
    /**
     * Récupère ou crée une conversation
     */
    static async getOrCreate(supabase, agentId, contactPhone, metadata) {
        let conversation = await this.findByContact(agentId, contactPhone)
        
        if (!conversation) {
            conversation = await this.create({
                agent_id: agentId,
                contact_phone: contactPhone,
                status: 'active',
                metadata
            })
        }
        
        return new Conversation(conversation)
    }
    
    /**
     * Met en pause le bot
     */
    static async pause(conversationId, reason = null) {
        return await supabase.from('conversations').update({
            bot_paused: true,
            paused_at: new Date().toISOString(),
            pause_reason: reason
        }).eq('id', conversationId)
    }
    
    /**
     * Escalade vers humain
     */
    static async escalate(conversationId, reason) {
        return await supabase.from('conversations').update({
            status: 'escalated',
            bot_paused: true,
            escalation_reason: reason,
            escalated_at: new Date().toISOString()
        }).eq('id', conversationId)
    }
    
    /**
     * Charge l'historique
     */
    static async getHistory(conversationId, limit = 20) {
        const { data } = await supabase
            .from('messages')
            .select('role, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(limit)
        
        return data || []
    }
}

// Classe Conversation (Domain Model)
class Conversation {
    constructor(data) {
        Object.assign(this, data)
    }
    
    isPaused() {
        return this.bot_paused === true
    }
    
    isEscalated() {
        return this.status === 'escalated'
    }
    
    shouldEscalate(sentimentAnalysis) {
        return (
            sentimentAnalysis.sentiment === 'angry' ||
            (sentimentAnalysis.sentiment === 'negative' && sentimentAnalysis.is_urgent)
        )
    }
}
```

**Taille** : ~120 lignes  
**Tests** : 15 tests unitaires

---

### Service 2 : `media.service.js`

**Responsabilité** : Traitement audio, images, screenshots.

```javascript
class MediaService {
    /**
     * Transcrit un message vocal
     */
    static async transcribeAudio(openai, buffer) {
        try {
            // Convertir buffer en File-like object
            const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' })
            
            const response = await openai.audio.transcriptions.create({
                file,
                model: 'whisper-1',
                language: 'fr'
            })
            
            return response.text
        } catch (error) {
            console.error('Transcription failed:', error)
            throw new TranscriptionError('Audio incompréhensible', { cause: error })
        }
    }
    
    /**
     * Traite une image (download + base64)
     */
    static async processImage(message, downloadMediaMessage) {
        try {
            const buffer = await downloadMediaMessage(
                {
                    key: message.key,
                    message: { imageMessage: message.imageMessage }
                },
                'buffer',
                { logger: console }
            )
            
            return buffer.toString('base64')
        } catch (error) {
            throw new ImageProcessingError('Image inaccessible', { cause: error })
        }
    }
    
    /**
     * Upload screenshot paiement
     */
    static async uploadScreenshot(supabase, buffer, conversationId) {
        const fileName = `payment_${conversationId}_${Date.now()}.jpg`
        const filePath = `screenshots/${fileName}`
        
        const { data, error } = await supabase.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600'
            })
        
        if (error) throw new UploadError('Screenshot upload failed', { cause: error })
        
        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath)
        
        return urlData.publicUrl
    }
}
```

**Taille** : ~80 lignes  
**Tests** : 8 tests unitaires

---

### Service 3 : `credits.service.js`

**Responsabilité** : Gestion atomique des crédits.

```javascript
class CreditsService {
    /**
     * Vérifie si l'utilisateur a assez de crédits
     */
    static async check(supabase, userId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance')
            .eq('id', userId)
            .single()
        
        return profile && profile.credits_balance > 0
    }
    
    /**
     * Déduit des crédits (ATOMIQUE via RPC)
     */
    static async deduct(supabase, userId, amount) {
        // ⭐ Utilise une fonction Postgres pour garantir l'atomicité
        const { data, error } = await supabase.rpc('deduct_credits', {
            p_user_id: userId,
            p_amount: amount
        })
        
        if (error) {
            if (error.code === 'P0001') {
                throw new InsufficientCreditsError('Crédits insuffisants')
            }
            throw error
        }
        
        return data
    }
    
    /**
     * Calcule le coût d'un message
     */
    static calculateCost(isVoiceEnabled) {
        // Base : 1 crédit
        // Voice : +4 crédits
        return isVoiceEnabled ? 5 : 1
    }
}
```

**Taille** : ~60 lignes  
**Tests** : 6 tests + 1 test integration DB

**⚠️ Nécessite Migration SQL** :
```sql
-- Fonction Postgres pour déduction atomique
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_amount INTEGER
) RETURNS TABLE(new_balance INTEGER) AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    -- Lock la ligne pour éviter race condition
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Vérifier suffisance
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits'
            USING ERRCODE = 'P0001';
    END IF;
    
    -- Déduire atomiquement
    UPDATE profiles SET
        credits_balance = credits_balance - p_amount,
        credits_used_this_month = credits_used_this_month + p_amount
    WHERE id = p_user_id
    RETURNING credits_balance INTO v_current_balance;
    
    RETURN QUERY SELECT v_current_balance;
END;
$$ LANGUAGE plpgsql;
```

---

### Service 4 : `messaging.service.js`

**Responsabilité** : Envoi messages WhatsApp (avec retry).

```javascript
class MessagingService {
    /**
     * Envoie un message texte (avec retry)
     */
    static async sendText(session, to, text, options = {}) {
        return await this.withRetry(async () => {
            return await session.socket.sendMessage(to, {
                text
            }, {
                linkPreview: options.linkPreview ?? false
            })
        }, 3) // 3 tentatives
    }
    
    /**
     * Envoie un message vocal
     */
    static async sendVoice(openai, session, to, text) {
        try {
            // 1. Générer audio
            const audioBuffer = await this.synthesizeVoice(openai, text)
            
            // 2. Envoyer
            return await this.withRetry(async () => {
                return await session.socket.sendMessage(to, {
                    audio: audioBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                })
            }, 2)
        } catch (error) {
            console.warn('Voice sending failed, falling back to text')
            return await this.sendText(session, to, text)
        }
    }
    
    /**
     * Retry logic (exponentiel backoff)
     */
    static async withRetry(fn, maxAttempts, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn()
            } catch (error) {
                if (attempt === maxAttempts) throw error
                
                const delay = baseDelay * Math.pow(2, attempt - 1) // 1s, 2s, 4s
                console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    
    /**
     * Synthétise la voix
     */
    static async synthesizeVoice(openai, text) {
        const mp3Response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: text.substring(0, 4000) // Limite TTS
        })
        
        const mp3Buffer = Buffer.from(await mp3Response.arrayBuffer())
        
        // Convertir MP3 → OGG (WhatsApp)
        const ffmpeg = require('fluent-ffmpeg')
        return new Promise((resolve, reject) => {
            // [Code de conversion - déjà existant dans votre code]
        })
    }
}
```

**Taille** : ~100 lignes  
**Tests** : 10 tests

---

### Service 5 : `ai.service.js`

**Responsabilité** : Génération de réponses IA (wrapper).

```javascript
class AIService {
    /**
     * Génère une réponse IA
     */
    static async generate(options) {
        const {
            agent,
            message,
            context,
            openai
        } = options
        
        // Déléguer à la fonction existante
        return await generateAIResponse({
            agent,
            conversationHistory: context.history,
            userMessage: message.text,
            imageBase64: message.imageBase64,
            products: context.products,
            currency: context.currency,
            orders: context.orders,
            activeSessions: context.activeSessions,
            supabase: context.supabase,
            openai,
            CinetPay: context.CinetPay
        })
    }
}
```

**Taille** : ~30 lignes  
**Tests** : 5 tests (mock OpenAI)

---

### Service 6 : `analytics.service.js`

**Responsabilité** : Mise à jour stats agents.

```javascript
class AnalyticsService {
    /**
     * Enregistre une interaction
     */
    static async trackInteraction(supabase, agentId, messageCount = 2) {
        return await supabase
            .from('agents')
            .update({
                total_messages: supabase.raw(`total_messages + ${messageCount}`),
                last_message_at: new Date().toISOString()
            })
            .eq('id', agentId)
    }
    
    /**
     * Analyse la qualité du lead
     */
    static async analyzeLeadQuality(openai, conversationHistory) {
        // Tous les 5 messages
        if (conversationHistory.length % 5 !== 0) return null
        
        // [Logique existante analyzeLeadQuality]
        return { status, score, reasoning }
    }
}
```

**Taille** : ~40 lignes

---

## 📋 PLAN D'EXÉCUTION

### Phase 1 : Préparation (Jour 1)

- [ ] Créer la structure de dossiers
- [ ] Créer les classes vides
- [ ] Écrire les tests (TDD)
- [ ] Migration SQL (fonction `deduct_credits`)

### Phase 2 : Extraction Services (Jour 2-3)

- [ ] ConversationService
- [ ] MediaService
- [ ] CreditsService
- [ ] MessagingService
- [ ] AIService
- [ ] AnalyticsService

### Phase 3 : Refactoring Orchestrateur (Jour 4)

- [ ] Réécrire `handleMessage()` avec les services
- [ ] Ajouter gestion d'erreurs robuste
- [ ] Tests d'intégration

### Phase 4 : Migration (Jour 5)

- [ ] Déployer en staging
- [ ] Tests end-to-end
- [ ] Monitoring (comparer ancien vs nouveau)
- [ ] Rollback plan

### Phase 5 : Production (Jour 6)

- [ ] Déploiement progressif (10% → 50% → 100%)
- [ ] Monitoring alertes
- [ ] Documentation

---

## 📊 GAINS ATTENDUS

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| **Lignes par fichier** | 742 | <200 | **-73%** |
| **Testabilité** | 0% | 80%+ | **+80%** |
| **Couverture tests** | 0% | 70%+ | **+70%** |
| **Maintenabilité** | 🔴 F | 🟢 A | **+5 grades** |
| **Race conditions** | Oui | Non | **Éliminées** |
| **Time to debug** | 2h | 15min | **-87%** |

**ROI** : -10h debug/mois × 15,000 FCFA/h = **-150,000 FCFA/mois**

---

## ⚠️ RISQUES & MITIGATION

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Régression bugs | 🟡 Moyenne | 🔴 Haute | Tests complets + rollback |
| Performance dégradée | 🟢 Faible | 🟡 Moyenne | Benchmarks avant/après |
| Downtime migration | 🟢 Faible | 🔴 Haute | Blue-green deployment |

---

## ✅ CRITÈRES DE SUCCÈS

- [ ] **Aucune régression** : Tous les flows existants fonctionnent
- [ ] **Tests passent** : 70%+ couverture
- [ ] **Performance** : Latence ≤ ancienne version
- [ ] **Monitoring** : Métriques stables 7 jours
- [ ] **Documentation** : README à jour

---

**Prêt pour Phase 1 ? 🚀**
