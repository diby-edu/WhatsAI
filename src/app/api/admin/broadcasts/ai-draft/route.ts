import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

// POST — génère un brouillon via IA
export async function POST(request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return errorResponse('OPENAI_API_KEY non configurée', 500)

    try {
        const { prompt, channel, spellcheck, text } = await request.json()

        // Mode correcteur orthographique
        if (spellcheck && text) {
            const openai = new OpenAI({ apiKey })
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Tu es un correcteur orthographique et grammatical en français. Corrige le texte fourni sans changer le sens ni le ton. Retourne uniquement le texte corrigé, sans explication.'
                    },
                    { role: 'user', content: text }
                ],
                temperature: 0.2,
                max_tokens: 1000,
            })
            return successResponse({ corrected: completion.choices[0]?.message?.content?.trim() || text })
        }

        if (!prompt?.trim()) return errorResponse('Prompt requis', 400)
        if (!['email', 'push', 'whatsapp'].includes(channel)) return errorResponse('Canal invalide', 400)

        const openai = new OpenAI({ apiKey })

        let systemPrompt = ''
        let responseFormat = ''

        if (channel === 'email') {
            systemPrompt = `Tu es un rédacteur professionnel qui crée des emails de communication pour une plateforme SaaS d'automatisation WhatsApp (WazzapAI).
Rédige des emails clairs, professionnels et en français.
Retourne UNIQUEMENT un JSON avec exactement ces deux clés : {"subject": "...", "body": "..."}.
- subject : objet de l'email (court, impactant, max 80 caractères)
- body : corps du message (plusieurs paragraphes si nécessaire, pas de formule de salutation ni de signature, celles-ci sont ajoutées automatiquement)
Ne mets rien d'autre que le JSON.`
            responseFormat = 'json'
        } else if (channel === 'push') {
            systemPrompt = `Tu es un rédacteur professionnel qui crée des notifications push pour une plateforme SaaS d'automatisation WhatsApp (WazzapAI).
Rédige des notifications courtes, percutantes et en français.
Retourne UNIQUEMENT un JSON avec exactement ces deux clés : {"title": "...", "body": "..."}.
- title : titre de la notification (max 65 caractères)
- body : message de la notification (max 240 caractères, accrocheur et direct)
Ne mets rien d'autre que le JSON.`
            responseFormat = 'json'
        } else {
            systemPrompt = `Tu es un rédacteur professionnel qui crée des messages WhatsApp pour une plateforme SaaS d'automatisation WhatsApp (WazzapAI).
Rédige des messages naturels, directs et en français. Tu peux utiliser le gras WhatsApp (*texte*) et les emojis avec parcimonie.
Retourne UNIQUEMENT un JSON avec la clé : {"body": "..."}.
- body : le message WhatsApp (max 500 caractères)
Ne mets rien d'autre que le JSON.`
            responseFormat = 'json'
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Rédige le contenu suivant : ${prompt.trim()}` }
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
        })

        const raw = completion.choices[0]?.message?.content?.trim() || '{}'
        let parsed: Record<string, string>
        try {
            parsed = JSON.parse(raw)
        } catch {
            return errorResponse('Erreur de génération IA', 500)
        }

        return successResponse({ generated: parsed, channel })
    } catch (err) {
        console.error('AI draft error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
