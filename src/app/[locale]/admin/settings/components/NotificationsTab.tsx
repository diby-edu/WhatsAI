import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import { Bell, Users, Bot, Zap, Activity, Loader2, CheckCircle, Save } from 'lucide-react'
import { ToggleSwitch } from './shared'
import type { AdminNotificationSettings } from '../types'

interface NotificationsTabProps {
    notificationSettings: AdminNotificationSettings
    setNotificationSettings: Dispatch<SetStateAction<AdminNotificationSettings>>
    handleSaveNotifications: () => void
    saving: boolean
    saved: boolean
}

export function NotificationsTab({ notificationSettings, setNotificationSettings, handleSaveNotifications, saving, saved }: NotificationsTabProps) {
    const NotificationItem = ({ label, description, emailKey, pushKey, critical }: {
        label: string,
        description: string,
        emailKey: keyof AdminNotificationSettings,
        pushKey: keyof AdminNotificationSettings,
        critical?: boolean
    }) => (
        <div className="admin-settings-notif-item" style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            alignItems: 'center',
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(15, 23, 42, 0.3)',
            gap: 16
        }}>
            <div>
                <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{description}</div>
            </div>
            <div className="admin-settings-notif-channel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Email</span>
                <ToggleSwitch
                    value={notificationSettings[emailKey] as boolean}
                    onChange={() => setNotificationSettings(s => ({ ...s, [emailKey]: !s[emailKey] }))}
                    color={critical ? '#ef4444' : '#10b981'}
                />
            </div>
            <div className="admin-settings-notif-channel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Push</span>
                <ToggleSwitch
                    value={notificationSettings[pushKey] as boolean}
                    onChange={() => setNotificationSettings(s => ({ ...s, [pushKey]: !s[pushKey] }))}
                    color={critical ? '#ef4444' : '#3b82f6'}
                />
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Info Banner */}
            <div style={{
                padding: 16,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
            }}>
                <Bell style={{ width: 20, height: 20, color: '#60a5fa' }} />
                <div>
                    <div style={{ fontWeight: 600, color: '#60a5fa' }}>Canaux de notification</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                        Configurez séparément les notifications par <strong>Email</strong> et par <strong>Push</strong> (in-app).
                    </div>
                </div>
            </div>

            {/* Users & Revenue */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Users style={{ width: 18, height: 18, color: '#3b82f6' }} />
                    <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Utilisateurs & Revenus</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <NotificationItem label="Nouvel utilisateur inscrit" description="Alerte quand un nouveau compte est créé" emailKey="email_new_user" pushKey="push_new_user" />
                    <NotificationItem label="Upgrade de plan" description="Un utilisateur passe à un plan supérieur" emailKey="email_plan_upgrade" pushKey="push_plan_upgrade" />
                    <NotificationItem label="Downgrade de plan" description="Un utilisateur passe à un plan inférieur" emailKey="email_plan_downgrade" pushKey="push_plan_downgrade" />
                    <NotificationItem label="Paiement reçu" description="Confirmation de paiement en ligne" emailKey="email_payment_received" pushKey="push_payment_received" />
                    <NotificationItem label="Paiement échoué" description="Échec d'un paiement" emailKey="email_payment_failed" pushKey="push_payment_failed" critical />
                    <NotificationItem label="Abonnement annulé" description="Un utilisateur annule son abonnement" emailKey="email_subscription_cancelled" pushKey="push_subscription_cancelled" />
                </div>
            </div>

            {/* Agents */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Bot style={{ width: 18, height: 18, color: '#10b981' }} />
                    <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Agents IA</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <NotificationItem label="Nouvel agent créé" description="Un utilisateur crée un nouvel agent" emailKey="email_agent_created" pushKey="push_agent_created" />
                    <NotificationItem label="Agent connecté WhatsApp" description="Un agent se connecte avec succès" emailKey="email_agent_connected" pushKey="push_agent_connected" />
                    <NotificationItem label="Agent déconnecté WhatsApp" description="Perte de connexion WhatsApp" emailKey="email_agent_disconnected" pushKey="push_agent_disconnected" critical />
                    <NotificationItem label="Quota agents dépassé" description="Tentative de créer plus d'agents que permis" emailKey="email_agent_quota_exceeded" pushKey="push_agent_quota_exceeded" />
                </div>
            </div>

            {/* System & Health */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Zap style={{ width: 18, height: 18, color: '#f59e0b' }} />
                    <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Système & Santé</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <NotificationItem label="Erreur API OpenAI" description="Problème avec l'API IA" emailKey="email_openai_error" pushKey="push_openai_error" critical />
                    <NotificationItem label="Service WhatsApp down" description="Le bot ne répond plus" emailKey="email_whatsapp_down" pushKey="push_whatsapp_down" critical />
                    <NotificationItem label="Taux d'erreur élevé" description="> 5% de messages échoués" emailKey="email_high_error_rate" pushKey="push_high_error_rate" critical />
                </div>
            </div>

            {/* Activity */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Activity style={{ width: 18, height: 18, color: '#8b5cf6' }} />
                    <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Activité</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <NotificationItem label="Nouvelle conversation" description="Un client contacte un agent (volume élevé)" emailKey="email_new_conversation" pushKey="push_new_conversation" />
                    <NotificationItem label="Nouvelle commande" description="Une commande est passée" emailKey="email_new_order" pushKey="push_new_order" />
                    <NotificationItem label="Escalade conversation" description="Conversation transférée à humain" emailKey="email_escalation" pushKey="push_escalation" />
                </div>
            </div>

            {/* Save Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveNotifications}
                disabled={saving}
                style={{
                    padding: '14px 24px',
                    borderRadius: 12,
                    background: saved ? '#22c55e' : 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 600,
                    cursor: saving ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 8
                }}
            >
                {saving ? (
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                ) : saved ? (
                    <CheckCircle style={{ width: 18, height: 18 }} />
                ) : (
                    <Save style={{ width: 18, height: 18 }} />
                )}
                {saved ? 'Sauvegardé !' : 'Sauvegarder les notifications'}
            </motion.button>
        </div>
    )
}
