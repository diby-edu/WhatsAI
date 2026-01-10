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
    "price": null ou nombre (prix de base si pas de variantes, sinon null),
    "content_included": [] liste de strings (éléments inclus dans le produit),
    "tags": [] liste de strings (caractéristiques, avantages),
    "variants": [] liste de groupes de variantes
  },
  "cleaned_description": "description nettoyée",
  "warnings": [] liste de warnings
}

RÈGLES POUR LES VARIANTES (TRÈS IMPORTANT):
- Si la description contient des OPTIONS avec des PRIX DIFFÉRENTS, c'est une variante de type "fixed"
- Chaque groupe de variantes doit avoir: {"name": "Nom du groupe", "type": "fixed" ou "additive", "options": [...]}
- Chaque option doit avoir: {"value": "Nom complet de l'option avec détails", "price": nombre}
- CRITIQUE: Le champ "price" doit contenir le PRIX COMPLET de l'option, PAS un ajustement!
- CRITIQUE: Dans "value", inclure TOUS les détails de l'option (ex: "Débutant - HTML, CSS, JavaScript, 20h vidéo")

EXEMPLE ENTRÉE:
"Formation web 2024. Pack Débutant 35000F: HTML, CSS, 20h. Pack Pro 65000F: React, Node, 50h."

EXEMPLE SORTIE:
{
  "extracted": {
    "price": null,
    "content_included": ["HTML", "CSS", "React", "Node.js"],
    "tags": ["Formation 2024"],
    "variants": [{
      "name": "Pack",
      "type": "fixed",
      "options": [
        {"value": "Débutant - HTML, CSS, JavaScript basics, 20h de vidéo", "price": 35000},
        {"value": "Pro - React, Node.js, MongoDB, 50h de vidéo + projets", "price": 65000}
      ]
    }]
  },
  "cleaned_description": "Formation en ligne complète développement web 2024. Accès à vie.",
  "warnings": []
}

- Si type="fixed", le prix de l'option REMPLACE le prix de base
- Si type="additive", le prix de l'option S'AJOUTE au prix de base
- Si une option n'a pas de prix, METS 0 et ajoute un warning

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
            max_tokens: 1500
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
                tags: parsed.extracted?.tags ?? parsed.tags ?? [],
                variants: parsed.extracted?.variants ?? parsed.variants ?? []
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
