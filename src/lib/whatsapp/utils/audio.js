const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Transcribe Audio using OpenAI Whisper
 * @param {Object} openai OpenAI instance
 * @param {Buffer} audioBuffer 
 * @returns {Promise<string>} Transcription text
 */
async function transcribeAudio(openai, audioBuffer) {
    try {
        // Use system temp dir to avoid pollution
        const tempFile = path.join(os.tmpdir(), `whatsapp_audio_${Date.now()}.ogg`)
        fs.writeFileSync(tempFile, audioBuffer)

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: "whisper-1",
        })

        fs.unlinkSync(tempFile) // Cleanup
        return transcription.text
    } catch (e) {
        console.error('Transcription Error:', e)
        return ""
    }
}

module.exports = { transcribeAudio }
