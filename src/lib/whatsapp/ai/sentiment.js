/**
 * Analyse du sentiment du client — sert à décider d'une escalade vers un humain.
 *
 * ⚠️ Une escalade est LOURDE : elle coupe la conversation et rend le bot définitivement
 * muet pour ce client jusqu'à intervention humaine (voir conversation.escalate). Un faux
 * positif coûte donc une vente entière, pas un simple message maladroit.
 *
 * Bug réel du 11/08/2026 : le message « Angre cgk » — le client donnait son quartier
 * d'Abidjan — était classé `angry` de façon déterministe (3 fois sur 3, température 0).
 * Le modèle lisait « Angre » comme *anger*. La conversation a été coupée, aucun lead créé.
 * Cause : on analysait le message NU, sans contexte, donc sans rien pour lever l'ambiguïté.
 */
async function analyzeSentiment(openai, text, conversationHistory = []) {
    try {
        // Les derniers échanges suffisent à distinguer « Angre cgk » (une adresse donnée
        // après une question de livraison) d'une vraie exaspération.
        const recentExchanges = (Array.isArray(conversationHistory) ? conversationHistory : [])
            .slice(-6)
            .map(m => `${m.role === 'user' ? 'Client' : 'Agent'}: ${String(m.content || '').slice(0, 300)}`)
            .join('\n')

        const systemPrompt = [
            "Tu évalues l'état émotionnel du CLIENT dans une conversation commerciale WhatsApp.",
            "Le résultat sert uniquement à détecter un client mécontent qu'il faut confier à un humain.",
            "",
            "Classe 'angry' UNIQUEMENT si le client exprime explicitement de la colère, de l'exaspération,",
            "une réclamation ou une insatisfaction : reproche, plainte, insulte, menace de partir,",
            "répétition agacée, demande de remboursement.",
            "",
            "Sont NEUTRES, sans exception :",
            "- un nom de lieu, de quartier, de commune ou de rue (même si un mot y ressemble à un terme négatif) ;",
            "- une réponse courte et factuelle : couleur, quantité, taille, prix, « oui », « non », « ok » ;",
            "- des coordonnées : nom, téléphone, adresse, email ;",
            "- une commande, un ajout ou un retrait d'article formulé calmement.",
            "",
            "Dans le doute, réponds 'neutral' : une escalade injustifiée coupe la conversation.",
            'Réponds en JSON : { "sentiment": "positive"|"neutral"|"negative"|"angry", "is_urgent": boolean }',
        ].join('\n')

        const userPrompt = recentExchanges
            ? `Derniers échanges :\n${recentExchanges}\n\nDernier message du client à évaluer : ${text}`
            : `Message du client à évaluer : ${text}`

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
        })
        return JSON.parse(response.choices[0].message.content)
    } catch (e) {
        console.error('Sentiment Analysis Error:', e)
        return { sentiment: 'neutral', is_urgent: false }
    }
}

module.exports = { analyzeSentiment }
