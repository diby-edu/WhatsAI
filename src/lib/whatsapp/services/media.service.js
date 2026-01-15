/**
 * ═══════════════════════════════════════════════════════════════
 * MEDIA SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Traitement audio, images, screenshots
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { AppError } = require('./errors')

class MediaService {
    /**
     * Transcrit un message vocal
     */
    static async transcribeAudio(openai, buffer) {
        let tempFile = null
        try {
            tempFile = path.join(os.tmpdir(), `whatsapp_audio_${Date.now()}.ogg`)
            fs.writeFileSync(tempFile, buffer)

            const response = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFile),
                model: 'whisper-1',
                language: 'fr'
            })

            return response.text
        } catch (error) {
            console.error('Transcription failed:', error)
            return "" // Fallback
        } finally {
            if (tempFile && fs.existsSync(tempFile)) {
                try { fs.unlinkSync(tempFile) } catch (e) { }
            }
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
            console.error('Image processing failed:', error)
            return null
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

        if (error) {
            console.error('Screenshot upload failed:', error)
            return null
        }

        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath)

        return urlData.publicUrl
    }
}

module.exports = { MediaService }
