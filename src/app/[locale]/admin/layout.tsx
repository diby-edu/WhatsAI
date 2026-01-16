// ═══════════════════════════════════════════════════════════════
// FIX : Admin Layout avec vérification de rôle côté client
// ═══════════════════════════════════════════════════════════════
// 
// Fichier : src/app/[locale]/admin/layout.tsx
// 
// Ce layout s'assure que seuls les admin/superadmin peuvent accéder
// Il empêche le flash du dashboard user lors du refresh
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        checkAdminAccess()
    }, [])

    const checkAdminAccess = async () => {
        try {
            const supabase = createClient()
            
            // Récupérer l'utilisateur
            const { data: { user }, error } = await supabase.auth.getUser()
            
            if (error || !user) {
                console.log('❌ No user session, redirecting to login')
                router.push('/fr/login')
                return
            }
            
            // ⭐ Vérifier le rôle (metadata PUIS DB)
            let role = user.user_metadata?.role
            
            console.log('🔐 Admin Layout - Checking role...')
            console.log('   User:', user.email)
            console.log('   Metadata role:', role)
            
            // Si pas de rôle dans metadata, vérifier DB
            if (!role || (role !== 'admin' && role !== 'superadmin')) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()
                
                role = profile?.role
                console.log('   DB role:', role)
            }
            
            // ⭐ Vérifier autorisation
            if (role === 'admin' || role === 'superadmin') {
                console.log('✅ Admin access granted:', role)
                setIsAuthorized(true)
            } else {
                console.log('❌ Access denied, role:', role)
                router.push('/fr/dashboard')
            }
        } catch (err) {
            console.error('❌ Error checking admin access:', err)
            router.push('/fr/login')
        } finally {
            setIsChecking(false)
        }
    }
    
    // ⭐ Écran de chargement pendant vérification
    if (isChecking) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617'
            }}>
                <div style={{
                    textAlign: 'center'
                }}>
                    <Loader2 
                        style={{ 
                            width: 48, 
                            height: 48, 
                            color: '#10b981',
                            animation: 'spin 1s linear infinite'
                        }} 
                    />
                    <p style={{
                        marginTop: 16,
                        color: '#64748b',
                        fontSize: 14
                    }}>
                        Vérification des accès...
                    </p>
                </div>
            </div>
        )
    }
    
    // ⭐ N'afficher le contenu que si autorisé
    if (!isAuthorized) {
        return null
    }
    
    return <>{children}</>
}
