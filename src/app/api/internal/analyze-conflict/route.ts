import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/ai/openai'

// Initialize OpenAI lazily inside the handler


export async function POST(request: NextRequest) {
    try {
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
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
