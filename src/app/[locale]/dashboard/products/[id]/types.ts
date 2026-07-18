import type { VariantGroup, ProductCombination } from '@/components/dashboard/ProductVariantsEditor'

export interface ProductFormData {
    name: string
    price: string | number
    images: string[]
    image_url: string
    category: string
    is_available: boolean
    agent_id: string

    description: string
    content_included: string[]
    features: string[]
    variants: VariantGroup[]
    combinations: ProductCombination[] | null
    marketing_tags: string[]
    related_product_ids: string[]

    product_type: string
    service_subtype: string
    menu_section_slug: string
    menu_sort_order: string | number
    stock_quantity: number
    lead_fields: any[]
}
