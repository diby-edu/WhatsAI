import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

interface ExtractionResult {
    extracted: {
        price?: number
        currency?: string
        content_included?: string[]
        variants?: { name: string; options: string[] }[]
        tags?: string[]
    }
    cleaned_description: string
    warnings: string[]
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
        }

        const { description, existingData } = await request.json()

        if (!description || description.trim().length < 10) {
            return NextResponse.json({
                error: 'Description trop courte (minimum 10 caractères)'
            }, { status: 400 })
        }

        const systemPrompt = `Tu es un assistant qui analyse des descriptions de produits pour extraire les données structurées.

TÂCHE: Analyse la description fournie et extrait les éléments suivants dans les champs appropriés:

1. **Prix**: Tout montant mentionné (ex: "25000F", "15.000 FCFA", "50€")
2. **Contenu inclus**: Liste des éléments/composants du produit (ex: "Word, Excel, PowerPoint")
3. **Variantes**: Tailles, couleurs, options (ex: "Taille L", "Rouge/Bleu", "1 PC / 5 PC")
4. **Tags**: Caractéristiques (ex: "Bio", "Artisanal", "Livraison rapide", "Garantie")

RÈGLES:
- Extrais UNIQUEMENT ce qui est clairement mentionné
- La description nettoyée doit contenir SEULEMENT les infos qualitatives (usage, public cible, avantages généraux)
- Si un élément est déjà dans les données existantes et correspond, ne pas le dupliquer
- Signale les conflits potentiels dans "warnings"

DONNÉES EXISTANTES:
${JSON.stringify(existingData || {}, null, 2)}

Réponds en JSON valide uniquement.`

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyse cette description:\n\n"${description}"` }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 1000
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
            throw new Error('Pas de réponse de l\'IA')
        }

        const result: ExtractionResult = JSON.parse(content)

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error: any) {
        console.error('Extract product data error:', error)
        return NextResponse.json({
            error: error.message || 'Erreur d\'analyse'
        }, { status: 500 })
    }
}
