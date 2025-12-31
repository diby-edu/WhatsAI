import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { type, name, context } = body

        if (!name || !type) {
            return errorResponse('Missing required fields', 400)
        }

        // 1. Check & Deduct Credits
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credits_balance')
            .eq('id', user!.id)
            .single()

        if (profileError || !profile) {
            return errorResponse('Profile not found', 404)
        }

        if (profile.credits_balance < 1) {
            return errorResponse('Crédits insuffisants. Rechargez votre compte.', 402) // 402 Payment Required
        }

        // Deduct 1 credit
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ credits_balance: profile.credits_balance - 1 })
            .eq('id', user!.id)

        if (updateError) {
            return errorResponse('Error deducting credit', 500)
        }

        // 2. Generate Content
        let systemPrompt = ''
        let userPrompt = ''

        switch (type) {
            case 'product_description':
                systemPrompt = "Tu es un copywriter d'élite spécialisé en e-commerce. Ta plume est persuasive, directe et émotionnelle."
                userPrompt = `Écris une description de vente irrésistible (3-4 phrases) pour : "${name}".
                Contexte : ${context || 'Aucun'}.
                Règles :
                1. Commence par une accroche forte.
                2. Mets en avant les bénéfices (pas juste les fonctionnalités).
                3. Utilise des emojis stratégiques (🚀, ✨, ✅).
                4. Ton : Enthousiaste et professionnel.
                Langue : Français.`
                break

            case 'product_instructions':
                systemPrompt = "Tu es un architecte de comportement IA. Tu crées les PERSONA de vendeurs d'élite."
                userPrompt = `Crée le System Prompt pour une IA qui doit vendre ce produit : "${name}".
                Contexte : ${context || 'Aucun'}.
                L'IA doit agir comme un vendeur top-niveau :
                - Connaisseur mais pas ennuyeux.
                - Proactif (ferme la vente).
                - Empathique.
                
                Structure attendue (sans guillemets) :
                "Tu es un expert de [Nom].
                Ta mission : Transformer chaque question en vente.
                Règles de conversation :
                1. [Règle d'approche]
                2. [Gestion des objections]
                3. [Closing]
                Si on te demande le prix : [Stratégie de prix]."
                Langue : Français.`
                break

            case 'agent_description':
                systemPrompt = "Tu es un consultant en stratégie de marque. Tu rédiges des biographies d'assistants virtuels qui inspirent confiance et modernité."
                userPrompt = `Rédige une description courte et impactante (2 phrases max) pour l'agent : "${name}".
                Son rôle : ${context || 'Assister les clients sur WhatsApp'}.
                Il doit paraître : Intelligent, Disponible 24/7, et Spécialisé.
                Utilise un ton expert.
                Exemple de style : "Expert en [Domaine], je guide vos clients 24h/24..."
                Langue : Français.`
                break

            default:
                return errorResponse('Invalid generation type', 400)
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        })

        const generatedText = completion.choices[0].message.content

        return successResponse({
            text: generatedText,
            remaining_credits: profile.credits_balance - 1
        })

    } catch (err) {
        console.error('Generation error:', err)
        return errorResponse('Internal Server Error', 500)
    }
}
