import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import { Bot, X } from 'lucide-react'
import type { ProductFormData } from '../../types'

interface Step2StrategyProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    addMarketingTag: (tag: string) => void
}

export function Step2Strategy({ formData, setFormData, addMarketingTag }: Step2StrategyProps) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Bot className="text-purple-400" /> Stratégie IA</h2>
                <div className="space-y-6">
                    <div>
                        <label className="block text-slate-300 font-medium mb-3">Arguments Marketing</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {['Meilleure Vente', 'Nouveauté', 'Promo', 'Bio', 'Artisanal', 'Luxe', 'Garantie 2 ans', 'Livraison Rapide'].map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => addMarketingTag(tag)}
                                    className={`px-3 py-1 rounded-full text-sm border transition-all ${formData.marketing_tags.includes(tag) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 flex-wrap bg-slate-900/30 p-4 rounded-lg min-h-[50px]">
                            {formData.marketing_tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2">
                                    {tag} <X size={14} className="cursor-pointer hover:text-white" onClick={() => setFormData(p => ({ ...p, marketing_tags: p.marketing_tags.filter((_, idx) => idx !== i) }))} />
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
