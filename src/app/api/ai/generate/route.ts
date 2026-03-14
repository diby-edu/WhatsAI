import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { getOpenAIClient } from '@/lib/ai/openai'
import { getAIRuntimeSettings } from '@/lib/admin/settings'

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse(authError || 'Non autorise', 401)
    }

    try {
        const body = await request.json()
        const { type, name, context } = body

        if (!name || !type) {
            return errorResponse('Missing required fields', 400)
        }

        // Atomic deduction to avoid race conditions.
        const { data: newBalance, error: creditError } = await supabase
            .rpc('deduct_credits', { p_user_id: user.id, p_amount: 1 })

        if (creditError) {
            console.error('Credit deduction error:', creditError)
            return errorResponse('Erreur lors du debit de credit', 500)
        }

        if (newBalance === -1) {
            return errorResponse('Credits insuffisants. Rechargez votre compte.', 402)
        }

        if (newBalance === -2) {
            return errorResponse('Profile not found', 404)
        }

        const aiDefaults = await getAIRuntimeSettings(createAdminClient())

        let systemPrompt = ''
        let userPrompt = ''

        switch (type) {
            case 'product_description':
                systemPrompt = "Tu es un copywriter d'elite specialise en e-commerce. Ta plume est persuasive, directe et emotionnelle."
                userPrompt = `Ecris une description de vente irresistible (3-4 phrases) pour : "${name}".
Contexte : ${context || 'Aucun'}.
Regles :
1. Commence par une accroche forte.
2. Mets en avant les benefices (pas juste les fonctionnalites).
3. Utilise des emojis strategiques (🚀, ✨, ✅).
4. Ton : Enthousiaste et professionnel.
Langue : Francais.`
                break

            case 'product_instructions':
                systemPrompt = "Tu es un architecte de comportement IA. Tu crees les PERSONA de vendeurs d'elite."
                userPrompt = `Cree le System Prompt pour une IA qui doit vendre ce produit : "${name}".
Contexte : ${context || 'Aucun'}.
L'IA doit agir comme un vendeur top-niveau :
- Connaisseur mais pas ennuyeux.
- Proactif (ferme la vente).
- Empathique.

Structure attendue (sans guillemets) :
"Tu es un expert de [Nom].
Ta mission : Transformer chaque question en vente.
Regles de conversation :
1. [Regle d'approche]
2. [Gestion des objections]
3. [Closing]
Si on te demande le prix : [Strategie de prix]."
Langue : Francais.`
                break

            case 'agent_description':
                systemPrompt = "Tu es un consultant en strategie de marque. Tu rediges des biographies d'assistants virtuels qui inspirent confiance et modernite."
                userPrompt = `Redige une description courte et impactante (2 phrases max) pour l'agent : "${name}".
Son role : ${context || 'Assister les clients sur WhatsApp'}.
Il doit paraitre : Intelligent, Disponible 24/7, et Specialise.
Utilise un ton expert.
Exemple de style : "Expert en [Domaine], je guide vos clients 24h/24..."
Langue : Francais.`
                break

            default:
                return errorResponse('Invalid generation type', 400)
        }

        const completion = await getOpenAIClient().chat.completions.create({
            model: aiDefaults.openaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: aiDefaults.temperatureDefault,
            max_tokens: aiDefaults.maxTokensPerMessage,
        })

        const generatedText = completion.choices[0]?.message?.content

        return successResponse({
            text: generatedText,
            remaining_credits: newBalance,
        })
    } catch (err) {
        console.error('Generation error:', err)
        return errorResponse('Internal Server Error', 500)
    }
}
