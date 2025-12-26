'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const faqs = [
    {
        question: "Comment fonctionne WhatsAI ?",
        answer: "WhatsAI se connecte à votre WhatsApp via un QR code (comme WhatsApp Web). Une fois connecté, notre IA analyse les messages entrants et génère des réponses personnalisées basées sur vos instructions et votre base de connaissances. Tout est automatique et en temps réel."
    },
    {
        question: "Est-ce que WhatsApp peut me bannir ?",
        answer: "Notre système utilise Baileys, une solution éprouvée qui simule le comportement humain. En respectant les bonnes pratiques (délais de réponse, personnalisation des messages), le risque est minimal. Nous avons des milliers d'utilisateurs actifs sans problème."
    },
    {
        question: "Puis-je tester gratuitement ?",
        answer: "Absolument ! Créez un compte et recevez 100 crédits gratuits pour tester toutes les fonctionnalités. Aucune carte de crédit requise. Vous pouvez passer à un plan payant quand vous êtes prêt."
    },
    {
        question: "Comment fonctionne le système de crédits ?",
        answer: "1 crédit = 1 message envoyé par l'IA. Les messages reçus ne consomment pas de crédits. Vos crédits se renouvellent chaque mois selon votre forfait. Vous pouvez acheter des crédits supplémentaires à tout moment."
    },
    {
        question: "Puis-je utiliser plusieurs numéros WhatsApp ?",
        answer: "Oui ! Le nombre de numéros dépend de votre forfait. Starter : 1 numéro, Pro : 2 numéros, Business : 4 numéros. Chaque numéro peut avoir son propre agent IA avec des instructions différentes."
    },
    {
        question: "L'IA peut-elle prendre des rendez-vous ?",
        answer: "Oui ! Vous pouvez configurer votre agent pour collecter des informations et proposer des créneaux. L'intégration avec Google Calendar et d'autres outils est disponible sur les plans Pro et Business."
    },
    {
        question: "Mes données sont-elles sécurisées ?",
        answer: "Absolument. Nous utilisons un chiffrement de bout en bout, vos sessions WhatsApp sont stockées de manière sécurisée, et nous sommes conformes au RGPD. Nous ne lisons jamais vos conversations."
    },
    {
        question: "Puis-je annuler à tout moment ?",
        answer: "Oui, sans engagement ! Vous pouvez annuler votre abonnement à tout moment depuis votre tableau de bord. Vos crédits restants seront utilisables jusqu'à la fin de la période de facturation."
    },
]

const FAQItem = ({ faq, index }: { faq: typeof faqs[0], index: number }) => {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-50px" })

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: index * 0.05 }}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-start gap-4 p-6 rounded-2xl text-left transition-all ${isOpen
                        ? 'bg-gradient-to-r from-primary-500/10 to-transparent border border-primary-500/20'
                        : 'glass-card hover:bg-dark-800/50'
                    }`}
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${isOpen
                        ? 'bg-primary-500 rotate-180'
                        : 'bg-dark-700'
                    }`}>
                    {isOpen ? (
                        <Minus className="w-5 h-5 text-white" />
                    ) : (
                        <Plus className="w-5 h-5 text-dark-400" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className={`text-lg font-semibold transition-colors ${isOpen ? 'text-white' : 'text-dark-200'
                        }`}>
                        {faq.question}
                    </h3>
                    <motion.div
                        initial={false}
                        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <p className="mt-4 text-dark-400 leading-relaxed">
                            {faq.answer}
                        </p>
                    </motion.div>
                </div>
            </button>
        </motion.div>
    )
}

export default function FAQ() {
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="faq" className="py-32 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-dots opacity-30" />

            <div className="container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                        <span className="text-white">Questions </span>
                        <span className="text-gradient">fréquentes</span>
                    </h2>
                    <p className="text-xl text-dark-400">
                        Tout ce que vous devez savoir sur WhatsAI
                    </p>
                </motion.div>

                {/* FAQ Grid */}
                <div className="max-w-3xl mx-auto space-y-4">
                    {faqs.map((faq, index) => (
                        <FAQItem key={index} faq={faq} index={index} />
                    ))}
                </div>

                {/* Still have questions */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-16 text-center"
                >
                    <p className="text-dark-400 mb-4">
                        Vous avez d'autres questions ?
                    </p>
                    <a
                        href="mailto:support@whatsai.com"
                        className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                    >
                        Contactez notre équipe →
                    </a>
                </motion.div>
            </div>
        </section>
    )
}
