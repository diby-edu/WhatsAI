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
                systemPrompt = "Tu es un expert en marketing digital. Ton but est d'écrire des descriptions de produits vendeuses et attractives."
                userPrompt = `Écris une description courte (3-4 phrases) mais percutante pour un produit nommé : "${name}". 
                Contexte : ${context || 'Aucun'}.
                Utilise des emojis. Sois professionnel et enthousiaste. Langue : Français.`
                break

            case 'product_instructions':
                systemPrompt = "Tu es un expert en conception de prompts pour IA. Tu dois créer des instructions système (System Prompt) pour un agent vendeur."
                userPrompt = `Crée les instructions système pour une IA chargée de vendre le produit : "${name}".
                Contexte : ${context || 'Aucun'}.
                L'IA doit être : Persuasive, polie, orientée résultat (vente).
                Structure de la réponse attendue :
                "Tu es un vendeur expert de [Produit].
                Tes objectifs :
                1. ...
                2. ...
                ..."
                Ne mets pas de guillemets autour de la réponse. Langue : Français.`
                break

            case 'agent_description':
                systemPrompt = "Tu es un expert en communication. Tu aides à décrire des assistants virtuels."
                userPrompt = `Écris une description courte et claire (1-2 phrases) pour un assistant IA nommé : "${name}".
                Son rôle principal : ${context || 'Assister les clients'}.
                Ton modéré et professionnel. Langue : Français.`
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
