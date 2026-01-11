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
    "variants": [] liste de groupes de variantes avec catégorie
  },
  "cleaned_description": "description NETTOYÉE (sans les variantes/prix/options)",
  "warnings": [] liste de warnings
}

RÈGLES POUR LES VARIANTES (TRÈS IMPORTANT):
- Si la description contient des OPTIONS avec des PRIX DIFFÉRENTS, c'est une variante de type "fixed"
- Chaque groupe de variantes doit avoir: {"name": "Nom", "type": "fixed" ou "additive", "category": "...", "options": [...]}
- Chaque option doit avoir: {"value": "Nom complet avec détails", "price": nombre}

CATÉGORIES DE VARIANTES (NOUVEAU - TRÈS IMPORTANT):
Détecte automatiquement la catégorie selon le nom de la variante:
- "visual" : Couleur, Style, Design, Motif, Finition, Thème, Modèle visuel
- "size" : Taille, Dimension, Pointure, Format (S, M, L, XL, etc.)
- "weight" : Poids, Volume, Quantité, Capacité (100g, 500ml, 1kg, etc.)
- "duration" : Durée, Période, Abonnement, Mois, Semaine (1 mois, 6 mois, etc.)
- "custom" : Tout autre type de variante (Pack, Niveau, Type, etc.)

NETTOYAGE DE DESCRIPTION (NOUVEAU - TRÈS IMPORTANT):
La "cleaned_description" doit être DÉBARRASSÉE de:
- Les listes de couleurs/tailles/options mentionnées
- Les prix individuels des variantes
- Les énumérations d'options (ex: "Rouge, Bleu, Noir")
- Garde uniquement les caractéristiques générales du produit

EXEMPLE ENTRÉE:
"T-shirt coton bio 100%. Couleurs: Rouge 15000F, Bleu 15000F, Or Premium 25000F. Tailles: S, M, L +500F, XL +1000F. Livraison gratuite en CI."

EXEMPLE SORTIE:
{
  "extracted": {
    "price": null,
    "content_included": [],
    "tags": ["100% coton bio", "Livraison gratuite CI"],
    "variants": [
      {
        "name": "Couleur",
        "type": "fixed",
        "category": "visual",
        "options": [
          {"value": "Rouge", "price": 15000},
          {"value": "Bleu", "price": 15000},
          {"value": "Or Premium", "price": 25000}
        ]
      },
      {
        "name": "Taille",
        "type": "additive",
        "category": "size",
        "options": [
          {"value": "S", "price": 0},
          {"value": "M", "price": 0},
          {"value": "L", "price": 500},
          {"value": "XL", "price": 1000}
        ]
      }
    ]
  },
  "cleaned_description": "T-shirt 100% coton bio. Livraison gratuite en Côte d'Ivoire.",
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

    // Ensure proper structure with null safety + ADD UNIQUE IDs
    const rawVariants = parsed.extracted?.variants ?? parsed.variants ?? []
    const variantsWithIds = rawVariants.map((v: any, idx: number) => ({
      ...v,
      id: `${Date.now()}_${idx}`,  // Unique ID for each variant
      category: v.category || v.type === 'fixed' ? 'visual' : 'custom'  // Default category
    }))

    const result = {
      extracted: {
        price: parsed.extracted?.price ?? parsed.price ?? null,
        content_included: parsed.extracted?.content_included ?? parsed.content_included ?? [],
        tags: parsed.extracted?.tags ?? parsed.tags ?? [],
        variants: variantsWithIds
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
