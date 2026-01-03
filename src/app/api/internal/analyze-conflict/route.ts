import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { structuredData, customRules } = body

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

        const completion = await openai.chat.completions.create({
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
