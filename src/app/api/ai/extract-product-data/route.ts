import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

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

TÂCHE: Analyse la description fournie et extrait les éléments dans le format JSON suivant:

{
  "extracted": {
    "price": null ou nombre (ex: 25000),
    "content_included": [] liste de strings (ex: ["Word", "Excel", "PowerPoint"]),
    "tags": [] liste de strings (ex: ["Bio", "Garantie", "Livraison rapide"])
  },
  "cleaned_description": "description nettoyée sans prix ni éléments extraits",
  "warnings": [] liste de warnings si conflits détectés
}

RÈGLES:
- Price: Extrait le premier prix mentionné en nombre seulement (pas de devise)
- Content_included: Éléments/composants du produit (applications, accessoires inclus)
- Tags: Caractéristiques et avantages (Bio, Artisanal, Garantie, Livraison rapide, etc.)
- Cleaned_description: Ce qui reste de la description (usage, public cible, avantages généraux)
- Si aucun élément trouvé, retourne un array vide [] pour les listes ou null pour price

DONNÉES EXISTANTES (ne pas dupliquer):
${JSON.stringify(existingData || {}, null, 2)}

IMPORTANT: Réponds UNIQUEMENT avec le JSON valide, pas d'explication.`

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

        const parsed = JSON.parse(content)

        // Ensure proper structure with null safety
        const result = {
            extracted: {
                price: parsed.extracted?.price ?? parsed.price ?? null,
                content_included: parsed.extracted?.content_included ?? parsed.content_included ?? [],
                tags: parsed.extracted?.tags ?? parsed.tags ?? []
            },
            cleaned_description: parsed.cleaned_description ?? parsed.description ?? description,
            warnings: parsed.warnings ?? []
        }

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
