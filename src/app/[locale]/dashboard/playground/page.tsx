'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Send,
    Bot,
    User,
    Settings,
    RotateCcw,
    Loader2
} from 'lucide-react'
import Link from 'next/link'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export default function PlaygroundPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [selectedAgent, setSelectedAgent] = useState<any>(null)
    const [loadingAgents, setLoadingAgents] = useState(true)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents')
            const data = await res.json()
            if (data.data?.agents && data.data.agents.length > 0) {
                setAgents(data.data.agents)
                setSelectedAgent(data.data.agents[0])
                // Add initial greeting
                setMessages([{
                    id: 'init',
                    role: 'assistant',
                    content: `Bonjour ! Je suis ${data.data.agents[0].name}. Comment puis-je vous aider ?`,
                    timestamp: new Date()
                }])
            }
        } catch (err) {
            console.error('Error fetching agents:', err)
        } finally {
            setLoadingAgents(false)
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || !selectedAgent) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsTyping(true)

        try {
            // Call real API for AI response
            const res = await fetch('/api/playground/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: selectedAgent.id,
                    message: userMessage.content,
                    conversationHistory: messages
                })
            })

            const data = await res.json()

            if (res.ok && data.data?.response) {
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.data.response,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, aiMessage])
            } else {
                // Fallback to simulation if API fails
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.error || `[${selectedAgent.name}] Désolé, je n'ai pas pu répondre. Vérifiez vos crédits.`,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, aiMessage])
            }
        } catch (err) {
            console.error('Error:', err)
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `[Erreur] Impossible de contacter le serveur.`,
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, aiMessage])
        } finally {
            setIsTyping(false)
        }
    }

    const handleReset = () => {
        if (!selectedAgent) return
        setMessages([
            {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Bonjour ! je suis ${selectedAgent.name}. On recommence ?`,
                timestamp: new Date(),
            },
        ])
    }

    if (loadingAgents) {
        return (
            <div className="flex h-[calc(100vh-120px)] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        )
    }

    if (agents.length === 0) {
        return (
            <div className="flex h-[calc(100vh-120px)] flex-col items-center justify-center gap-4">
                <Bot className="w-16 h-16 text-dark-500" />
                <h2 className="text-xl font-semibold text-white">Aucun agent disponible</h2>
                <p className="text-dark-400">Créez d'abord un agent pour utiliser le Playground.</p>
                <Link href="/dashboard/agents/new" className="btn btn-primary">
                    Créer un agent
                </Link>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Playground</h1>
                    <p className="text-dark-400">
                        Testez votre agent en temps réel
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="btn btn-secondary text-sm"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Réinitialiser
                </button>
            </div>

            <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
                {/* Chat area */}
                <div className="lg:col-span-2 glass-card rounded-2xl flex flex-col overflow-hidden">
                    {/* Agent selector */}
                    <div className="p-4 border-b border-dark-700 bg-dark-800/50 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <select
                                value={selectedAgent?.id}
                                onChange={(e) => {
                                    const agent = agents.find(a => a.id === e.target.value)
                                    setSelectedAgent(agent)
                                    setMessages([{
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: `Bonjour ! Je suis ${agent.name}.`,
                                        timestamp: new Date()
                                    }])
                                }}
                                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer w-full"
                            >
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id} className="bg-dark-800 text-white">
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                            <div className="text-xs text-primary-400 flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                                Test IA Réel
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-end gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                                        ? 'bg-dark-700'
                                        : 'bg-gradient-to-br from-primary-500 to-primary-600'
                                        }`}>
                                        {message.role === 'user' ? (
                                            <User className="w-4 h-4 text-dark-300" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl ${message.role === 'user'
                                        ? 'bg-primary-500 text-white rounded-br-sm shadow-md shadow-primary-900/20'
                                        : 'bg-dark-700 text-dark-200 rounded-bl-sm'
                                        }`}>
                                        <p className="text-sm leading-relaxed">{message.content}</p>
                                        <p className={`text-[10px] mt-1 opacity-60 text-right`}>
                                            {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {isTyping && (
                            <div className="flex items-end gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="px-4 py-3 bg-dark-700 rounded-2xl rounded-bl-sm">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-dark-800/50 border-t border-dark-700">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex gap-3"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Écrivez un message..."
                                className="flex-1 px-4 py-3 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="btn btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Settings panel */}
                <div className="glass-card rounded-2xl p-6 h-fit">
                    <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-dark-400" />
                        Configuration
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Agent actif
                            </label>
                            <div className="p-3 bg-dark-800 rounded-lg border border-dark-700 text-white text-sm">
                                {selectedAgent?.name || 'Aucun agent'}
                            </div>
                        </div>

                        <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl">
                            <h4 className="font-medium text-primary-400 mb-1 flex items-center gap-2">
                                <Bot className="w-4 h-4" />
                                Mode Test Réel
                            </h4>
                            <p className="text-xs text-primary-200/70 leading-relaxed">
                                Ce test utilise l'IA réelle et consomme 1 crédit par message. Parfait pour vérifier le comportement de votre agent.
                            </p>
                        </div>

                        <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700">
                            <h4 className="font-medium text-white mb-3 text-sm">Débogage</h4>
                            <div className="space-y-2 text-xs text-dark-400">
                                <div className="flex justify-between">
                                    <span>Messages</span>
                                    <span className="text-white">{messages.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Latence (simulée)</span>
                                    <span className="text-white">1.5s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
