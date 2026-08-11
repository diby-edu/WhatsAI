/**
 * ai.service.js recopie le contexte vers generator.js via une LISTE BLANCHE explicite.
 * Toute donnée oubliée dans cette liste disparaît en silence : ni erreur, ni log, ni test
 * rouge — la fonctionnalité qui en dépend cesse simplement d'exister.
 *
 * C'est arrivé le 11/08/2026 avec `leadState` : le garde-fou "question sur une quantité
 * déjà connue" avait ses 9 tests unitaires au vert, mais ne s'est jamais déclenché en
 * production faute de recevoir la donnée. Ces tests couvrent la traversée elle-même.
 */

jest.mock('../../../src/lib/whatsapp/ai/generator', () => ({
    generateAIResponse: jest.fn().mockResolvedValue({ content: 'ok', tokensUsed: 0 }),
}))

const { generateAIResponse } = require('../../../src/lib/whatsapp/ai/generator')
const AIService = require('../../../src/lib/whatsapp/services/ai.service')

const Service = AIService.AIService || AIService.default || AIService

const baseCall = (contextOverrides = {}) => Service.generate({
    agent: { id: 'a1', name: 'Test', conversation_mode: 'lead_only' },
    message: { text: 'Bonjour', from: '+2250700000000' },
    openai: {},
    context: {
        history: [], products: [], orders: [], currency: 'XOF', conversationId: 'c1',
        supabase: {}, activeSessions: {}, CinetPay: {},
        ...contextOverrides,
    },
})

describe('Liste de recopie ai.service.js → generator.js', () => {
    // Garde-fou STRUCTUREL. Le bug du 11/08/2026 n'était pas une erreur de logique mais un
    // oubli de recopie : `leadState` manquait dans la liste, le garde-fou quantité recevait
    // null et ne servait à rien, sans qu'aucun test ne rougisse. Plutôt que d'énumérer les
    // champs à la main — ce qui reproduit le même oubli — on compare les deux listes.
    const fs = require('fs')
    const path = require('path')
    const read = p => fs.readFileSync(path.join(__dirname, '../../../src/lib/whatsapp', p), 'utf8')

    const consumedByGenerator = () => {
        const source = read('ai/generator.js')
        // On remonte depuis "} = options" jusqu'au "const {" le plus proche : un simple
        // non-greedy partirait du premier "const {" du fichier (un import) et avalerait
        // tout le code intermédiaire.
        const end = source.indexOf('} = options')
        const block = source.slice(0, end)
        const start = block.lastIndexOf('const {')
        return block.slice(start + 'const {'.length).split('\n')
            .map(line => (line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=[^=]|,|$)/) || [])[1])
            .filter(Boolean)
    }

    // Exception CONNUE et non résolue : restaurantQuestionDetected est lu par le générateur
    // mais jamais recopié, il vaut donc toujours false et le signal "question détectée"
    // n'atteint jamais le prompt restaurant. C'est le même bug que leadState, découvert en
    // écrivant ce test. Non corrigé volontairement : il touche des agents restaurant réels,
    // hors du périmètre lead_only fixé pour ce chantier — décision en attente.
    // Cette liste ne doit JAMAIS servir à faire taire un nouvel oubli : elle documente une
    // dette identifiée, et tout champ absent qui n'y figure pas fait échouer le test.
    const OUBLIS_CONNUS = ['restaurantQuestionDetected']

    const forwardedByService = () => {
        const source = read('services/ai.service.js')
        const block = source.match(/const generatorOptions = \{([\s\S]*?)\n        \}/)
        return block[1].split('\n')
            .map(line => (line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:,]/) || [])[1])
            .filter(Boolean)
    }

    test('tout champ lu par le générateur est bien recopié par le service', () => {
        const forwarded = new Set(forwardedByService())
        const oublies = consumedByGenerator()
            .filter(key => !forwarded.has(key))
            .filter(key => !OUBLIS_CONNUS.includes(key))
        expect(oublies).toEqual([])
    })

    test('l\'exception connue existe toujours (à retirer une fois corrigée)', () => {
        // Si ce test échoue, c'est que restaurantQuestionDetected a été recopié :
        // supprimer alors OUBLIS_CONNUS et ce test.
        const forwarded = new Set(forwardedByService())
        for (const key of OUBLIS_CONNUS) expect(forwarded.has(key)).toBe(false)
    })

    test('les deux listes sont bien extraites (le test ne passe pas à vide)', () => {
        expect(consumedByGenerator().length).toBeGreaterThan(10)
        expect(forwardedByService().length).toBeGreaterThan(10)
        expect(consumedByGenerator()).toContain('leadState')
        expect(forwardedByService()).toContain('leadState')
    })
})

describe('AIService.generate — traversée du contexte vers le générateur', () => {
    beforeEach(() => generateAIResponse.mockClear())

    test('transmet leadState (sans lui, le garde-fou quantité est inerte)', async () => {
        const leadState = { items: [{ product_name: 'sac enfant', variant: 'Noir', quantity: 10 }] }
        await baseCall({ leadState })
        expect(generateAIResponse).toHaveBeenCalledTimes(1)
        expect(generateAIResponse.mock.calls[0][0].leadState).toEqual(leadState)
    })

    test('transmet leadStateSummary', async () => {
        await baseCall({ leadStateSummary: '- sac enfant (variante Noir) : quantité 10' })
        expect(generateAIResponse.mock.calls[0][0].leadStateSummary).toMatch(/sac enfant/)
    })

    test('vaut null quand le contexte ne les fournit pas, jamais undefined', async () => {
        await baseCall()
        const options = generateAIResponse.mock.calls[0][0]
        expect(options.leadState).toBeNull()
        expect(options.leadStateSummary).toBeNull()
    })

    test('transmet les autres données dont dépend le mode lead_only', async () => {
        const products = [{ id: 'p1', name: 'sac enfant' }]
        await baseCall({ products, hasKnowledgeBase: true })
        const options = generateAIResponse.mock.calls[0][0]
        expect(options.products).toEqual(products)
        expect(options.hasKnowledgeBase).toBe(true)
        expect(options.conversationId).toBe('c1')
        expect(options.customerPhone).toBe('+2250700000000')
    })
})
