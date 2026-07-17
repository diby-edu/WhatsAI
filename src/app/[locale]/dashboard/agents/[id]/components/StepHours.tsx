import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import type { AgentFormData } from '../types'

interface StepHoursProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    isSupportClient: boolean
}

export function StepHours({ formData, setFormData, isSupportClient }: StepHoursProps) {
    const set24_7 = () => {
        const allOpen = {
            monday: { open: '00:00', close: '23:59', closed: false },
            tuesday: { open: '00:00', close: '23:59', closed: false },
            wednesday: { open: '00:00', close: '23:59', closed: false },
            thursday: { open: '00:00', close: '23:59', closed: false },
            friday: { open: '00:00', close: '23:59', closed: false },
            saturday: { open: '00:00', close: '23:59', closed: false },
            sunday: { open: '00:00', close: '23:59', closed: false }
        }
        setFormData({ ...formData, business_hours: allOpen })
    }

    const dayNames: { [key: string]: string } = {
        monday: 'Lundi',
        tuesday: 'Mardi',
        wednesday: 'Mercredi',
        thursday: 'Jeudi',
        friday: 'Vendredi',
        saturday: 'Samedi',
        sunday: 'Dimanche'
    }

    const timeInputStyle = {
        padding: '4px 8px',
        width: 100,
        borderRadius: 8,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        background: 'rgba(30, 41, 59, 0.5)',
        color: 'white',
        outline: 'none'
    }

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Notice Support Client */}
            {isSupportClient && (
                <div style={{ padding: 10, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 10, fontSize: 12, color: '#a5b4fc' }}>
                    ℹ️ Les horaires ne s'appliquent pas au mode Support Client. Vous pouvez ignorer cette étape.
                </div>
            )}
            {/* 24/7 Quick Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, marginBottom: 4 }}>
                <div>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>🌐 Ouvert 24h/24, 7j/7</span>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Service disponible en permanence</p>
                </div>
                <button
                    type="button"
                    onClick={set24_7}
                    style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    Appliquer
                </button>
            </div>

            {Object.entries(formData.business_hours).map(([day, hours]) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
                    <span style={{ textTransform: 'capitalize', color: 'white', width: 100 }}>{dayNames[day] || day}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={!hours.closed}
                            onChange={e => setFormData({
                                ...formData,
                                business_hours: { ...formData.business_hours, [day]: { ...hours, closed: !e.target.checked } }
                            })}
                            style={{ accentColor: '#10b981', width: 16, height: 16 }}
                        />
                        {!hours.closed ? (
                            <>
                                <input
                                    type="time"
                                    value={hours.open}
                                    onChange={e => setFormData({
                                        ...formData,
                                        business_hours: { ...formData.business_hours, [day]: { ...hours, open: e.target.value } }
                                    })}
                                    style={timeInputStyle}
                                />
                                <span style={{ color: '#94a3b8' }}>-</span>
                                <input
                                    type="time"
                                    value={hours.close}
                                    onChange={e => setFormData({
                                        ...formData,
                                        business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                    })}
                                    style={timeInputStyle}
                                />
                            </>
                        ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic', width: 216, textAlign: 'center' }}>Fermé</span>
                        )}
                    </div>
                </div>
            ))}
        </motion.div>
    )
}
