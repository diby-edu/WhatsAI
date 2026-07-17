import { Code2, Shield } from 'lucide-react'
import { sectionStyle } from '../styles'

export function TestsTab() {
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <div style={sectionStyle}>
                <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code2 size={16} />
                    Exemples de tests rapides
                </h2>

                <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>1. Test send</div>
                        <pre style={{
                            margin: 0,
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--border, #2a2a3e)',
                            background: 'var(--input-bg, #0f0f1a)',
                            color: '#a5f3fc',
                            fontSize: 12,
                            overflowX: 'auto',
                            lineHeight: 1.6,
                        }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/send \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "to": "+2250700000000",
    "message": "Bonjour ! Votre panier vous attend.",
    "idempotency_key": "cart_reminder_1001_v1"
  }'`}
                        </pre>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>2. Test trigger</div>
                        <pre style={{
                            margin: 0,
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--border, #2a2a3e)',
                            background: 'var(--input-bg, #0f0f1a)',
                            color: '#a5f3fc',
                            fontSize: 12,
                            overflowX: 'auto',
                            lineHeight: 1.6,
                        }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/trigger \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "event": "order_created",
    "customer": {
      "name": "Client test",
      "phone": "+2250700000000",
      "email": "client@example.com"
    },
    "order": {
      "id": "4587",
      "reference": "CMD-4587",
      "total": 12500
    },
    "idempotency_key": "order_created_4587_v1"
  }'`}
                        </pre>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>3. Test sync</div>
                        <pre style={{
                            margin: 0,
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--border, #2a2a3e)',
                            background: 'var(--input-bg, #0f0f1a)',
                            color: '#a5f3fc',
                            fontSize: 12,
                            overflowX: 'auto',
                            lineHeight: 1.6,
                        }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/sync \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "type": "product",
    "items": [
      {
        "id": "sku_robe_noire",
        "name": "Robe noire",
        "description": "Robe de soiree elegante",
        "price": 18000,
        "stock": 5
      }
    ]
  }'`}
                        </pre>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>4. Test incoming direct (Woo)</div>
                        <pre style={{
                            margin: 0,
                            padding: 14,
                            borderRadius: 12,
                            border: '1px solid var(--border, #2a2a3e)',
                            background: 'var(--input-bg, #0f0f1a)',
                            color: '#a5f3fc',
                            fontSize: 12,
                            overflowX: 'auto',
                            lineHeight: 1.6,
                        }}>
{`curl -X POST "https://votre-domaine.com/api/public/v1/incoming/pwk_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "X-WC-Webhook-Topic: order.created" \\
  -H "X-WC-Webhook-Delivery-ID: 95cbf8ad-baa4-4a0f-9d72-9ff13fe1999a" \\
  -H "X-WC-Webhook-Signature: <signature_base64>" \\
  -d '{
    "id": 4587,
    "number": "CMD-4587",
    "total": "12500",
    "billing": {
      "first_name": "Client",
      "last_name": "Direct",
      "phone": "+2250700000000"
    }
  }'`}
                        </pre>
                    </div>
                </div>
            </div>

            <div style={sectionStyle}>
                <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} />
                    Checklist de validation
                </h2>
                <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                    <div>1. Verifier que le webhook entrant repond 200 avec une signature valide.</div>
                    <div>2. Rejouer le meme event avec le meme delivery id et verifier l en-tete <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>x-idempotent-replayed: true</code>.</div>
                    <div>3. Tester une mauvaise signature et verifier 401.</div>
                    <div>4. Confirmer qu une seule ligne outbound est creee pour un event idempotent.</div>
                    <div>5. Verifier dans l onglet Logs que les appels sont traces avec le bon code HTTP.</div>
                </div>
            </div>
        </div>
    )
}
