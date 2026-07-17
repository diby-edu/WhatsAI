import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import type { NewAgentFormData } from '../types'

interface StepHoursProps {
    t: ReturnType<typeof useTranslations>
    formData: NewAgentFormData
    setFormData: Dispatch<SetStateAction<NewAgentFormData>>
    isSupportClient: boolean
    inputStyle: CSSProperties
}

export function StepHours({ t, formData, setFormData, isSupportClient, inputStyle }: StepHoursProps) {
    const set24_7 = () => {
        const allOpen: typeof formData.business_hours = {
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Notice Support Client */}
            {isSupportClient && (
                <div style={{ padding: 14, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12, fontSize: 13, color: '#a5b4fc' }}>
                    ℹ️ Les horaires ne s'appliquent pas au mode Support Client. Vous pouvez ignorer cette étape.
                </div>
            )}
            {/* 24/7 Quick Toggle */}
            <div className="agent-hours-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, marginBottom: 8 }}>
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
                <div className="agent-hours-row" key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
                    <span className="agent-hours-day" style={{ textTransform: 'capitalize', color: 'white', width: 100 }}>{t(`WeekDays.${day}`)}</span>
                    <div className="agent-hours-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                    className="agent-hours-time"
                                    style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
                                />
                                <span style={{ color: '#94a3b8' }}>-</span>
                                <input
                                    type="time"
                                    value={hours.close}
                                    onChange={e => setFormData({
                                        ...formData,
                                        business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                    })}
                                    className="agent-hours-time"
                                    style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
                                />
                            </>
                        ) : (
                            <span className="agent-hours-closed" style={{ color: '#64748b', fontStyle: 'italic', width: 216, textAlign: 'center' }}>Fermé</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
