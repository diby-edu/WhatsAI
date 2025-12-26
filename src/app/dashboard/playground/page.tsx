'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Send,
    Bot,
    User,
    Settings,
    RotateCcw,
    ChevronDown
} from 'lucide-react'

// Mock agents
const mockAgents = [
    { id: '1', name: 'Assistant Commercial' },
    { id: '2', name: 'Support Client' },
]

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export default function PlaygroundPage() {
    const [selectedAgent, setSelectedAgent] = useState(mockAgents[0])
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Bonjour ! 👋 Je suis votre Assistant Commercial. Comment puis-je vous aider aujourd\'hui ?',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsTyping(true)

        // Simulate AI response
        await new Promise(resolve => setTimeout(resolve, 1500))

        const responses = [
            'Excellent ! Je comprends votre demande. Pouvez-vous me donner plus de détails sur vos besoins ? 🤔',
            'C\'est noté ! Je serais ravi de vous aider. Quel est votre budget approximatif ?',
            'Parfait ! Nous avons plusieurs options qui pourraient vous convenir. Souhaitez-vous prendre un rendez-vous avec un conseiller ? 📅',
            'Je comprends ! Voici quelques informations qui pourraient vous être utiles. N\'hésitez pas si vous avez d\'autres questions ! 😊',
        ]

        const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: responses[Math.floor(Math.random() * responses.length)],
            timestamp: new Date(),
        }

        setIsTyping(false)
        setMessages(prev => [...prev, aiMessage])
    }

    const handleReset = () => {
        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: 'Bonjour ! 👋 Je suis votre Assistant Commercial. Comment puis-je vous aider aujourd\'hui ?',
                timestamp: new Date(),
            },
        ])
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Playground</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Testez votre agent avant de le déployer
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="btn-secondary"
                >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                </button>
            </div>

            <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
                {/* Chat area */}
                <div className="lg:col-span-2 card flex flex-col">
                    {/* Agent selector */}
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <select
                                value={selectedAgent.id}
                                onChange={(e) => setSelectedAgent(mockAgents.find(a => a.id === e.target.value) || mockAgents[0])}
                                className="font-semibold bg-transparent focus:outline-none cursor-pointer"
                            >
                                {mockAgents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                            <div className="text-xs text-green-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                En ligne (Mode test)
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-end gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                                            ? 'bg-gray-200 dark:bg-gray-700'
                                            : 'bg-gradient-to-r from-green-500 to-emerald-500'
                                        }`}>
                                        {message.role === 'user' ? (
                                            <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl ${message.role === 'user'
                                            ? 'bg-green-500 text-white rounded-br-sm'
                                            : 'bg-gray-100 dark:bg-gray-700 rounded-bl-sm'
                                        }`}>
                                        <p className="text-sm">{message.content}</p>
                                        <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-green-100' : 'text-gray-500'
                                            }`}>
                                            {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {isTyping && (
                            <div className="flex items-end gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex gap-3"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Écrivez un message..."
                                className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="btn-primary px-4 disabled:opacity-50"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Settings panel */}
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Paramètres de test
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Agent sélectionné
                            </label>
                            <select
                                value={selectedAgent.id}
                                onChange={(e) => setSelectedAgent(mockAgents.find(a => a.id === e.target.value) || mockAgents[0])}
                                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                            >
                                {mockAgents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                                💡 Mode test
                            </h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Les messages envoyés ici ne sont pas réels. C&apos;est un environnement de test pour affiner votre agent.
                            </p>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <h4 className="font-medium mb-2">Statistiques de session</h4>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Messages</dt>
                                    <dd className="font-medium">{messages.length}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Temps moyen</dt>
                                    <dd className="font-medium">1.5s</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
