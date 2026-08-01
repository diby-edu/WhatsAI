import { Palette, Ruler, Scale, Clock, Settings, Bed, Utensils, Scissors, Car, Calendar, Users, Coffee, Sparkles, Plus } from 'lucide-react'
import type { VariantGroup, ProductCombination } from './types'

export const MAX_VARIANT_GROUPS = 3
export const MAX_COMBINATIONS = 100
// Produits physiques uniquement : Couleur/Taille/Poids/Pointure + types ajoutés librement.
// Au-delà, trop de questions obligatoires alourdiraient la conversation WhatsApp.
export const MAX_PHYSICAL_VARIANT_TYPES = 6

// Nom par défaut à stocker en DB pour chaque catégorie standard.
// Synchronisé avec VARIANT_CATEGORY_LABELS dans tool-helpers.js (minuscules).
// Evite les incohérences {name:"Couleur", category:"size"} qui font halluciner l'IA.
export const CATEGORY_DEFAULT_NAMES: Record<string, string> = {
    visual: 'Couleur',
    size: 'Taille',
    weight: 'Poids',
    shoe_size: 'Pointure',
    duration: 'Durée',
    room_type: 'Type de chambre',
    view: 'Vue',
    pension: 'Pension',
    menu: 'Menu',
    formula: 'Formule',
    service_type: 'Service',
    vehicle: 'Véhicule',
    option: 'Option',
    participants: 'Participants',
    version: 'Version',
    format: 'Format',
    language: 'Langue',
    license: 'Licence',
}

// Valeurs suggérées par catégorie — affichées comme puces cliquables pour
// remplir rapidement une variante physique sans tout taper à la main.
export const CATEGORY_VALUE_SUGGESTIONS: Record<string, string[]> = {
    visual: ['Rouge', 'Bleu', 'Vert', 'Noir', 'Blanc', 'Jaune', 'Rose', 'Gris'],
    size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    weight: ['100g', '250g', '500g', '1kg', '2kg', '5kg'],
    shoe_size: ['38', '39', '40', '41', '42', '43', '44', '45'],
}

// Default category configuration (for products)
// v2.30: needsImage=true pour TOUTES les catégories (l'image est optionnelle mais toujours disponible)
export const DEFAULT_CATEGORY_CONFIG: Record<string, { label: string; icon: any; needsImage: boolean; color: string }> = {
    visual: { label: '🎨 Couleur / Style', icon: Palette, needsImage: true, color: '#f59e0b' },
    size: { label: '📏 Taille', icon: Ruler, needsImage: true, color: '#3b82f6' },
    weight: { label: '⚖️ Poids / Volume', icon: Scale, needsImage: true, color: '#8b5cf6' },
    shoe_size: { label: '👞 Pointure', icon: Ruler, needsImage: true, color: '#3b82f6' },
    duration: { label: '⏱️ Durée', icon: Clock, needsImage: true, color: '#10b981' },
    custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
}

// Category configuration for digital products
export const DIGITAL_CATEGORY_CONFIG: Record<string, { label: string; icon: any; needsImage: boolean; color: string }> = {
    version: { label: '🔢 Version', icon: Settings, needsImage: false, color: '#3b82f6' },
    format: { label: '📄 Format (PDF, EPUB, MP4...)', icon: Ruler, needsImage: false, color: '#8b5cf6' },
    language: { label: '🌐 Langue', icon: Sparkles, needsImage: false, color: '#10b981' },
    license: { label: '📜 Licence', icon: Clock, needsImage: false, color: '#f59e0b' },
    duration: { label: '⏳ Durée d\'accès', icon: Clock, needsImage: false, color: '#ec4899' },
    custom: { label: '⚙️ Autre', icon: Settings, needsImage: false, color: '#64748b' }
}

// Service-specific category configurations
// v2.30: needsImage=true pour TOUTES les catégories
export const SERVICE_CATEGORY_CONFIGS: Record<string, Record<string, { label: string; icon: any; needsImage: boolean; color: string }>> = {
    hotel: {
        room_type: { label: '🛏️ Type de chambre', icon: Bed, needsImage: true, color: '#3b82f6' },
        view: { label: '🌅 Vue', icon: Sparkles, needsImage: true, color: '#10b981' },
        pension: { label: '🍽️ Pension', icon: Coffee, needsImage: true, color: '#f59e0b' },
        participants: { label: '👥 Nb personnes', icon: Users, needsImage: true, color: '#8b5cf6' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    residence: {
        room_type: { label: '🏠 Type logement', icon: Bed, needsImage: true, color: '#3b82f6' },
        participants: { label: '👥 Capacité', icon: Users, needsImage: true, color: '#8b5cf6' },
        duration: { label: '📅 Durée séjour', icon: Calendar, needsImage: true, color: '#10b981' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    restaurant: {
        menu: { label: '🍽️ Menu / Formule', icon: Utensils, needsImage: true, color: '#f59e0b' },
        participants: { label: '👥 Nb couverts', icon: Users, needsImage: true, color: '#8b5cf6' },
        option: { label: '➕ Supplément', icon: Plus, needsImage: true, color: '#10b981' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    coiffeur: {
        service_type: { label: '✂️ Type de service', icon: Scissors, needsImage: true, color: '#f59e0b' },
        duration: { label: '⏱️ Durée', icon: Clock, needsImage: true, color: '#3b82f6' },
        option: { label: '💆 Soin / Option', icon: Sparkles, needsImage: true, color: '#a855f7' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    medecin: {
        service_type: { label: '🩺 Type consultation', icon: Settings, needsImage: true, color: '#3b82f6' },
        duration: { label: '⏱️ Durée', icon: Clock, needsImage: true, color: '#10b981' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    formation: {
        formula: { label: '🎓 Formule', icon: Calendar, needsImage: true, color: '#3b82f6' },
        duration: { label: '⏱️ Durée', icon: Clock, needsImage: true, color: '#10b981' },
        participants: { label: '👥 Nb participants', icon: Users, needsImage: true, color: '#8b5cf6' },
        option: { label: '📚 Support inclus', icon: Plus, needsImage: true, color: '#f59e0b' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    event: {
        formula: { label: '🎟️ Type billet', icon: Calendar, needsImage: true, color: '#a855f7' },
        participants: { label: '👥 Nb places', icon: Users, needsImage: true, color: '#8b5cf6' },
        option: { label: '✨ Option VIP', icon: Sparkles, needsImage: true, color: '#f59e0b' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    coaching: {
        formula: { label: '🧠 Format', icon: Calendar, needsImage: true, color: '#3b82f6' },
        duration: { label: '⏱️ Durée session', icon: Clock, needsImage: true, color: '#10b981' },
        participants: { label: '👥 Individuel/Groupe', icon: Users, needsImage: true, color: '#8b5cf6' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    rental: {
        vehicle: { label: '🚗 Catégorie véhicule', icon: Car, needsImage: true, color: '#3b82f6' },
        duration: { label: '📅 Durée location', icon: Calendar, needsImage: true, color: '#10b981' },
        option: { label: '➕ Option (GPS, siège...)', icon: Plus, needsImage: true, color: '#f59e0b' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    },
    other: {
        service_type: { label: '🔧 Type de service', icon: Settings, needsImage: true, color: '#3b82f6' },
        duration: { label: '⏱️ Durée', icon: Clock, needsImage: true, color: '#10b981' },
        option: { label: '➕ Option', icon: Plus, needsImage: true, color: '#f59e0b' },
        custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
    }
}

// ── Helper functions ──────────────────────────────────────────────────────────

export function slugify(str: string): string {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'opt'
}

export function cartesian<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) return [[]]
    const [first, ...rest] = arrays
    const restCombos = cartesian(rest)
    return (first as T[]).flatMap(item => restCombos.map(combo => [item, ...combo]))
}

export function getOptionLabel(groupId: string, optionId: string, variants: VariantGroup[]): string {
    const group = variants.find(g => g.id === groupId)
    if (!group) return optionId
    const option = group.options.find(o => (o.id || slugify(o.value || '')) === optionId)
    return option?.value || optionId
}

export function getComboFallbackImage(combo: ProductCombination, variants: VariantGroup[]): string | null {
    const visualGroup = variants.find(g => g.category === 'visual')
    if (!visualGroup) return null
    const optionId = combo.attributes[visualGroup.id]
    if (!optionId) return null
    const option = visualGroup.options.find(o => (o.id || slugify(o.value || '')) === optionId)
    return option?.image || null
}

export function getCombinationLabel(combo: ProductCombination, variants: VariantGroup[]): string {
    return Object.entries(combo.attributes)
        .map(([groupId, optionId]) => getOptionLabel(groupId, optionId, variants))
        .join(' • ')
}

// Merge/sync combinations array with current variant groups (add new combos, keep existing)
export function mergeCombinations(variants: VariantGroup[], existing: ProductCombination[]): ProductCombination[] {
    const eligibleGroups = variants.filter(g => g.options.length > 0)
    if (eligibleGroups.length < 2) return existing

    const perGroup = eligibleGroups.map(g =>
        g.options.map(o => ({
            groupId: g.id,
            optionId: o.id || slugify(o.value || ''),
        }))
    )

    const allCombos = cartesian(perGroup).slice(0, MAX_COMBINATIONS)

    return allCombos.map(combo => {
        const attributes: Record<string, string> = {}
        const skuParts: string[] = []

        combo.forEach(({ groupId, optionId }: { groupId: string; optionId: string }) => {
            attributes[groupId] = optionId
            skuParts.push(optionId.toUpperCase().replace(/-/g, '').slice(0, 8))
        })

        // Keep existing combination if attributes match
        const found = existing.find(c => {
            const cKeys = Object.keys(c.attributes)
            const aKeys = Object.keys(attributes)
            return cKeys.length === aKeys.length && aKeys.every(k => c.attributes[k] === attributes[k])
        })

        return found || {
            sku: skuParts.join('-'),
            attributes,
            available: true,
            price: null,
            stock: null,
            image: null,
        }
    })
}
