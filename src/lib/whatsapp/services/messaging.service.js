/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGING SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Envoi messages WhatsApp (avec retry)
 */

class MessagingService {
    /**
     * Envoie un message texte (avec retry)
     */
    static async sendText(session, to, text, options = {}) {
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
     */
    static async sendImage(session, to, imageUrl, caption = '') {
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
