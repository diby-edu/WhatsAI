import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/ai/openai'
import { createApiClient, getAuthUser } from '@/lib/api-utils'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

// I2 — proxy OpenAI : réservé aux utilisateurs authentifiés (appelé depuis les
// pages dashboard agents) + rate-limit "ai" par utilisateur (DoS financier).

export async function POST(request: NextRequest) {
    try {
        const supabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(supabase)
        if (authError || !user) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        const rateLimit = await checkRateLimit(`analyze-conflict:${user.id}`, RATE_LIMITS.ai)
        if (!rateLimit.success) {
            return rateLimitResponse(rateLimit.resetTime)
        }

        const body = await request.json()
        // Support both naming conventions to be safe
        const structuredData = body.structuredData || body.structured_data
        const customRules = body.customRules || body.custom_rules_text || body.custom_rules

        if (!structuredData || !customRules) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 })
        }

        const prompt = `
            Tu es un EXPERT EN VÉRIFICATION DE COHÉRENCE.

            TA MISSION : Détecter si le "TEXTE HUMAIN" contredit les "DONNÉES OFFICIELLES".

            ---
            1. DONNÉES OFFICIELLES (La Vérité) :
            ${JSON.stringify(structuredData, null, 2)}

            2. TEXTE HUMAIN (Suspect) :
            "${customRules}"
            ---

            ANALYSE :
            - Cherche des contradictions FACTUELLES (Horaires, Adresse, Prix, Politique).
            - Ignore les reformulations ou le style.
            - Exemple de conflit : Données="Fermé Lundi", Texte="Ouvert 7/7".
            - Exemple de conflit : Données="Livraison 1000F", Texte="Livraison Gratuite".

            RÉPONSE JSON UNIQUEMENT :
            {
                "conflict": boolean,
                "reason": "Explication courte en Français (si conflit)"
            }
        `

        const completion = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Tu es un validateur logique strict qui répond en JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.0
        })

        const result = JSON.parse(completion.choices[0].message.content || '{}')
        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Analyze Conflict Error:', error)
        return NextResponse.json({ error: 'Analyse impossible' }, { status: 500 })
    }
}
