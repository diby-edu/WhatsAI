// Category types for variants
export type VariantCategory = 'visual' | 'size' | 'weight' | 'shoe_size' | 'duration' | 'custom' |
    // Service-specific categories
    'room_type' | 'view' | 'pension' | 'menu' | 'formula' | 'service_type' | 'vehicle' | 'option' | 'participants' |
    // Digital-specific categories
    'version' | 'format' | 'language' | 'license'

export interface VariantOption {
    id?: string     // stable slug, auto-generated at creation — stays fixed even if value label changes
    value: string
    price: number
    image?: string  // Optional image URL for this option
}

export interface VariantGroup {
    id: string
    name: string
    type: 'fixed' | 'additive'
    category?: VariantCategory  // Category to determine if images are needed
    customName?: string          // Free-form name when category === 'custom' (used by WhatsApp agent)
    options: VariantOption[]
}

// Combination = specific SKU with its own price/stock/availability/image
export interface ProductCombination {
    sku: string                          // unique identifier, e.g. "TSHIRT-BLACK-M"
    attributes: Record<string, string>   // groupId -> optionId (stable slug)
    available: boolean
    price?: number | null                // null = use product default price
    stock?: number | null                // null = unlimited
    image?: string | null                // null = use product main image
}
