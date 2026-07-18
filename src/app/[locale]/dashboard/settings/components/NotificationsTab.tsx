import type { Dispatch, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Mail, Smartphone } from 'lucide-react'
import { ToggleOption, SaveButton } from './fields'
import type { NotificationSettings } from '../types'

interface NotificationsTabProps {
    t: ReturnType<typeof useTranslations>
    notifications: NotificationSettings
    setNotifications: Dispatch<SetStateAction<NotificationSettings>>
    saving: boolean
    saved: boolean
    handleSaveNotifications: () => void
}

export function NotificationsTab({ t, notifications, setNotifications, saving, saved, handleSaveNotifications }: NotificationsTabProps) {
    return (
        <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                {t('Notifications.title')}
            </h2>

            {/* Email Notifications Section */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Mail style={{ width: 20, height: 20, color: '#3b82f6' }} />
                    <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('Notifications.emailSection') || 'Notifications Email'}
                    </h3>
                </div>

                {/* Commandes */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Commandes</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.newOrder.label')}
                        description={t('Notifications.newOrder.description')}
                        checked={notifications.email_new_order}
                        onChange={(v) => setNotifications({ ...notifications, email_new_order: v })}
                    />
                    <ToggleOption
                        label={t('Notifications.orderCancelled.label') || 'Commande annulée'}
                        description={t('Notifications.orderCancelled.description') || 'Notification quand une commande est annulée'}
                        checked={notifications.email_order_cancelled}
                        onChange={(v) => setNotifications({ ...notifications, email_order_cancelled: v })}
                    />
                    <ToggleOption
                        label={'Paiement reçu'}
                        description={'Email quand un client paie une commande'}
                        checked={notifications.email_payment_received}
                        onChange={(v) => setNotifications({ ...notifications, email_payment_received: v })}
                    />
                </div>

                {/* Conversations */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Conversations</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.newConversation.label')}
                        description={t('Notifications.newConversation.description')}
                        checked={notifications.email_new_conversation}
                        onChange={(v) => setNotifications({ ...notifications, email_new_conversation: v })}
                    />
                    <ToggleOption
                        label={t('Notifications.escalation.label') || 'Escalade demandée'}
                        description={t('Notifications.escalation.description') || 'Le client veut parler à un humain'}
                        checked={notifications.email_escalation}
                        onChange={(v) => setNotifications({ ...notifications, email_escalation: v })}
                    />
                </div>

                {/* Agent */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Agent IA</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.agentStatus.label')}
                        description={t('Notifications.agentStatus.description')}
                        checked={notifications.email_agent_status_change}
                        onChange={(v) => setNotifications({ ...notifications, email_agent_status_change: v })}
                    />
                </div>

                {/* Crédits & Facturation */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Crédits & Facturation</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.lowCredits.label')}
                        description={t('Notifications.lowCredits.description')}
                        checked={notifications.email_low_credits}
                        onChange={(v) => setNotifications({ ...notifications, email_low_credits: v })}
                    />
                    <ToggleOption
                        label={t('Notifications.creditsDepleted.label') || 'Crédits épuisés'}
                        description={t('Notifications.creditsDepleted.description') || 'Alerte quand vos crédits atteignent zéro'}
                        checked={notifications.email_credits_depleted}
                        onChange={(v) => setNotifications({ ...notifications, email_credits_depleted: v })}
                    />
                    <ToggleOption
                        label={t('Notifications.subscriptionExpiring.label') || 'Abonnement expire bientôt'}
                        description={t('Notifications.subscriptionExpiring.description') || 'Rappel 7 jours avant expiration'}
                        checked={notifications.email_subscription_expiring}
                        onChange={(v) => setNotifications({ ...notifications, email_subscription_expiring: v })}
                    />
                </div>

                {/* Produits */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Produits</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.stockOut.label') || 'Stock épuisé'}
                        description={t('Notifications.stockOut.description') || 'Alerte quand un produit est en rupture'}
                        checked={notifications.email_stock_out}
                        onChange={(v) => setNotifications({ ...notifications, email_stock_out: v })}
                    />
                </div>

                {/* Leads */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Leads</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={'Nouveau lead qualifié'}
                        description={'Email quand un prospect est capturé par votre agent WhatsApp'}
                        checked={notifications.email_new_lead}
                        onChange={(v) => setNotifications({ ...notifications, email_new_lead: v })}
                    />
                </div>

                {/* Rapports */}
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Rapports</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.dailySummary.label')}
                        description={t('Notifications.dailySummary.description')}
                        checked={notifications.email_daily_summary}
                        onChange={(v) => setNotifications({ ...notifications, email_daily_summary: v })}
                    />
                </div>
            </div>

            {/* Push Notifications Section */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Smartphone style={{ width: 20, height: 20, color: '#10b981' }} />
                    <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('Notifications.pushSection') || 'Notifications Push (Mobile)'}
                    </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleOption
                        label={t('Notifications.pushEnabled.label') || 'Activer les notifications push'}
                        description={t('Notifications.pushEnabled.description') || 'Recevoir des notifications sur votre téléphone'}
                        checked={notifications.push_enabled}
                        onChange={(v) => setNotifications({ ...notifications, push_enabled: v })}
                    />
                    {notifications.push_enabled && (
                        <>
                            {/* Commandes */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Commandes</p>
                            <ToggleOption
                                label={t('Notifications.pushNewOrder.label') || 'Nouvelle commande'}
                                description={t('Notifications.pushNewOrder.description') || 'Notification quand une commande est passée'}
                                checked={notifications.push_new_order}
                                onChange={(v) => setNotifications({ ...notifications, push_new_order: v })}
                            />
                            <ToggleOption
                                label={t('Notifications.pushOrderCancelled.label') || 'Commande annulée'}
                                description={t('Notifications.pushOrderCancelled.description') || 'Notification quand une commande est annulée'}
                                checked={notifications.push_order_cancelled}
                                onChange={(v) => setNotifications({ ...notifications, push_order_cancelled: v })}
                            />
                            <ToggleOption
                                label={'Paiement reçu'}
                                description={'Notification quand un client paie une commande'}
                                checked={notifications.push_payment_received}
                                onChange={(v) => setNotifications({ ...notifications, push_payment_received: v })}
                            />

                            {/* Conversations */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Conversations</p>
                            <ToggleOption
                                label={t('Notifications.pushNewConversation.label') || 'Nouvelle conversation'}
                                description={t('Notifications.pushNewConversation.description') || 'Notification quand un nouveau client vous contacte'}
                                checked={notifications.push_new_conversation}
                                onChange={(v) => setNotifications({ ...notifications, push_new_conversation: v })}
                            />
                            <ToggleOption
                                label={t('Notifications.pushEscalation.label') || 'Escalade demandée'}
                                description={t('Notifications.pushEscalation.description') || 'Le client veut parler à un humain'}
                                checked={notifications.push_escalation}
                                onChange={(v) => setNotifications({ ...notifications, push_escalation: v })}
                            />

                            {/* Agent */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Agent IA</p>
                            <ToggleOption
                                label={t('Notifications.pushAgentStatus.label') || "Statut de l'agent"}
                                description={t('Notifications.pushAgentStatus.description') || "Notification quand votre agent change de statut"}
                                checked={notifications.push_agent_status_change}
                                onChange={(v) => setNotifications({ ...notifications, push_agent_status_change: v })}
                            />

                            {/* Crédits */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Crédits</p>
                            <ToggleOption
                                label={t('Notifications.pushLowCredits.label') || 'Crédits faibles'}
                                description={t('Notifications.pushLowCredits.description') || 'Alerte quand vos crédits sont bas'}
                                checked={notifications.push_low_credits}
                                onChange={(v) => setNotifications({ ...notifications, push_low_credits: v })}
                            />
                            <ToggleOption
                                label={t('Notifications.pushCreditsDepleted.label') || 'Crédits épuisés'}
                                description={t('Notifications.pushCreditsDepleted.description') || 'Alerte critique quand crédits = 0'}
                                checked={notifications.push_credits_depleted}
                                onChange={(v) => setNotifications({ ...notifications, push_credits_depleted: v })}
                            />
                            <ToggleOption
                                label={t('Notifications.pushSubscriptionExpiring.label') || 'Abonnement expire'}
                                description={t('Notifications.pushSubscriptionExpiring.description') || 'Rappel avant expiration'}
                                checked={notifications.push_subscription_expiring}
                                onChange={(v) => setNotifications({ ...notifications, push_subscription_expiring: v })}
                            />

                            {/* Produits */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Produits</p>
                            <ToggleOption
                                label={t('Notifications.pushStockOut.label') || 'Stock épuisé'}
                                description={t('Notifications.pushStockOut.description') || 'Alerte rupture de stock'}
                                checked={notifications.push_stock_out}
                                onChange={(v) => setNotifications({ ...notifications, push_stock_out: v })}
                            />

                            {/* Réservations */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Réservations</p>
                            <ToggleOption
                                label={'Nouvelle réservation'}
                                description={'Notification quand un client réserve un service'}
                                checked={notifications.push_new_booking}
                                onChange={(v) => setNotifications({ ...notifications, push_new_booking: v })}
                            />

                            {/* Leads */}
                            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Leads</p>
                            <ToggleOption
                                label={'Nouveau lead qualifié'}
                                description={'Notification push quand un prospect est capturé par votre agent'}
                                checked={notifications.push_new_lead}
                                onChange={(v) => setNotifications({ ...notifications, push_new_lead: v })}
                            />
                        </>
                    )}
                </div>
            </div>

            <SaveButton
                saving={saving}
                saved={saved}
                onClick={handleSaveNotifications}
                messages={{ save: t('Profile.save'), saving: t('Profile.saving'), saved: t('Profile.saved') }}
            />
        </motion.div>
    )
}
