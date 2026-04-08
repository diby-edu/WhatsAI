/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGING SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Envoi messages WhatsApp (avec retry)
 */

class MessagingService {
    /**
     * Simule la frappe avant d'envoyer (anti-détection bot)
     * Délai : 1s de base + 30ms/caractère, plafonné à 2s
     */
    static async simulateTyping(session, to, text) {
        if (!session?.socket) return
        try {
            const delay = 1000 + Math.min(text.length * 30, 1000)
            await session.socket.sendPresenceUpdate('composing', to)
            await new Promise(resolve => setTimeout(resolve, delay))
            await session.socket.sendPresenceUpdate('paused', to)
        } catch {
            // Ignorer les erreurs de présence — ne pas bloquer l'envoi
        }
    }

    /**
     * Envoie un message texte (avec typing indicator + retry)
     */
    static async sendText(session, to, text, options = {}) {
        await this.simulateTyping(session, to, text)
        return await this.withRetry(async () => {
            if (!session || !session.socket) {
                throw new Error('WhatsApp session or socket unavailable')
            }

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
            console.warn('Voice sending failed, falling back to text:', error.message)
            return await this.sendText(session, to, text)
        }
    }

    /**
     * Envoie une image depuis une URL
     * ⛔ WebP interdit : format non supporté par Baileys pour le thumbnail
     */
    static async sendImage(session, to, imageUrl, caption = '') {
        if (!imageUrl) return null
        if (imageUrl.toLowerCase().endsWith('.webp') || imageUrl.toLowerCase().includes('.webp?')) {
            console.warn(`⚠️ Image WebP ignorée (format non supporté) : ${imageUrl}`)
            if (caption) {
                return await this.sendText(session, to, caption)
            }
            return null
        }
        return await this.withRetry(async () => {
            if (!session || !session.socket) {
                throw new Error('WhatsApp session or socket unavailable')
            }

            return await session.socket.sendMessage(to, {
                image: { url: imageUrl },
                caption: caption
            })
        }, 3) // 3 tentatives
    }


    /**
     * Envoie un fichier (document) depuis une URL
     */
    static async sendDocument(session, to, fileUrl, fileName, caption = '') {
        return await this.withRetry(async () => {
            if (!session || !session.socket) {
                throw new Error('WhatsApp session or socket unavailable')
            }
            const ext = fileUrl.split('.').pop()?.toLowerCase().split('?')[0] || ''
            const mimeMap = {
                pdf: 'application/pdf',
                zip: 'application/zip',
                mp4: 'video/mp4',
                mp3: 'audio/mpeg',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
            }
            const mimetype = mimeMap[ext] || 'application/octet-stream'
            return await session.socket.sendMessage(to, {
                document: { url: fileUrl },
                mimetype,
                fileName: fileName || fileUrl.split('/').pop() || 'fichier',
                caption,
            })
        }, 3)
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

        // Note: In a real environment, we would use ffmpeg here to convert mp3 to ogg
        // For now, we return the buffer and assume the underlying socket handles correctly
        // or the expert has ffmpeg installed in the target environment.
        return mp3Buffer
    }
}

module.exports = { MessagingService }
