/**
 * Script de test — envoie les 4 emails d'onboarding en prévisualisation
 * Usage : node send-test-emails.js konocigames@gmail.com
 *
 * À exécuter sur le VPS depuis /root/WhatsAI/
 */

require('dotenv').config({ path: '.env.local' })
const nodemailer = require('nodemailer')

const TO = process.argv[2] || 'konocigames@gmail.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

const SMTP = {
    host:   process.env.SMTP_HOST     || 'smtp.hostinger.com',
    port:   parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_PORT    || '465') === '465',
    auth: {
        user: process.env.SMTP_USER     || '',
        pass: process.env.SMTP_PASSWORD || '',
    },
}

const FROM_NAME  = process.env.SMTP_FROM_NAME  || 'WazzapAI'
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || ''

// ─── Template de base ───────────────────────────────────────────────────────

function base(content) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#020617;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);padding:12px 16px;border-radius:14px;">
        <span style="color:white;font-size:24px;font-weight:700;">💬 WazzapAI</span>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(148,163,184,0.15);border-radius:20px;padding:32px;color:#e2e8f0;">
      ${content}
    </div>
    <div style="text-align:center;margin-top:24px;color:#64748b;font-size:12px;">
      <p>WazzapAI — Automatisation WhatsApp intelligente</p>
      <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
    </div>
  </div>
</body>
</html>`
}

function btn(label, url) {
    return `<div style="margin-top:28px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;">${label}</a>
    </div>`
}

function badge(text) {
    return `<div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;">${text}</div>`
}

function listItem(emoji, text) {
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
      <span style="font-size:18px;flex-shrink:0;">${emoji}</span>
      <span style="color:#cbd5e1;font-size:14px;line-height:1.5;">${text}</span>
    </div>`
}

// ─── Email A — Pas encore d'agent ───────────────────────────────────────────

const emailA = {
    subject: '[PREVIEW A] Votre agent WhatsApp vous attend',
    html: base(`
      ${badge('Email A — Déclenchement : 0 agent créé après J+1')}
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>Jean</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Vous avez créé votre compte hier, mais vous n'avez pas encore configuré votre agent.</p>

      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:20px;margin-bottom:20px;">
        <div style="color:#e2e8f0;font-weight:600;margin-bottom:12px;">Un agent se crée en moins de 5 minutes :</div>
        ${listItem('🎯', 'Choisissez son rôle : support client, vente, e-commerce, restaurant…')}
        ${listItem('✏️', 'Donnez-lui un nom et définissez sa personnalité')}
        ${listItem('📱', 'Connectez votre numéro WhatsApp par QR code')}
      </div>

      <p style="color:#94a3b8;font-size:14px;">Votre essai dure encore <strong style="color:white;">6 jours</strong>. Ne le laissez pas expirer sans avoir testé.</p>
      ${btn('Créer mon premier agent', `${APP_URL}/dashboard/agents/new`)}
    `)
}

// ─── Email B — WhatsApp non connecté ────────────────────────────────────────

const emailB = {
    subject: '[PREVIEW B] Dernière étape — connectez votre WhatsApp',
    html: base(`
      ${badge('Email B — Déclenchement : agent créé mais WhatsApp non connecté')}
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>Jean</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">Mon Agent</strong> est configuré, mais il n'est pas encore connecté à WhatsApp.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 6px 0;">Sans connexion WhatsApp, votre agent est inactif.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Il ne peut recevoir ni envoyer aucun message.</p>
      </div>

      <p style="color:#94a3b8;font-size:14px;">La connexion prend <strong style="color:white;">30 secondes</strong> : ouvrez WhatsApp sur votre téléphone et scannez le QR code.</p>
      ${btn('Connecter WhatsApp maintenant', `${APP_URL}/dashboard/agents`)}
    `)
}

// ─── Email C1 — Support sans KB ──────────────────────────────────────────────

const emailC1 = {
    subject: '[PREVIEW C1 — Support] Votre agent ne sait rien — alimentez-le',
    html: base(`
      ${badge('Email C1 — Déclenchement : mission=support_client, KB vide, WhatsApp connecté')}
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>Jean</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">Mon Agent Support</strong> est connecté à WhatsApp, mais sa base de connaissances est vide.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 8px 0;">Si un client lui écrit aujourd'hui, il sera incapable de répondre correctement.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">La base de connaissances, c'est le cerveau de votre agent. Sans elle, il ne connaît rien de votre activité.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Ce que vous pouvez y ajouter</div>
        ${listItem('💰', 'Vos tarifs et offres')}
        ${listItem('🕐', 'Vos horaires d\'ouverture')}
        ${listItem('❓', 'Questions fréquentes de vos clients (FAQ)')}
        ${listItem('🛠️', 'Description de vos services')}
        ${listItem('📍', 'Votre localisation et contact')}
      </div>
      ${btn('Alimenter la base de connaissances', `${APP_URL}/dashboard/agents`)}
    `)
}

// ─── Email C2 — Non-support sans produits ────────────────────────────────────

const emailC2 = {
    subject: '[PREVIEW C2 — E-commerce/Resto/Hotel…] Votre agent est connecté — ajoutez vos produits',
    html: base(`
      ${badge('Email C2 — Déclenchement : mission≠support_client, 0 produit, WhatsApp connecté')}
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>Jean</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">Ma Boutique</strong> est connecté à WhatsApp, mais votre catalogue est vide.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 6px 0;">Sans produits, votre agent ne peut rien présenter ni vendre.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Il ne peut pas répondre aux questions sur vos offres, ni prendre de commandes.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Ajoutez dès maintenant</div>
        ${listItem('🛍️', 'Vos produits ou plats avec prix et description')}
        ${listItem('🖼️', 'Des photos (votre agent peut les envoyer aux clients)')}
        ${listItem('📦', 'Vos options de livraison et de paiement')}
      </div>
      ${btn('Ajouter mes produits au catalogue', `${APP_URL}/dashboard/products`)}
    `)
}

// ─── Email D — Tout configuré, 0 conversation ───────────────────────────────

const emailD = {
    subject: '[PREVIEW D] Votre agent est prêt — il attend ses premiers clients',
    html: base(`
      ${badge('Email D — Déclenchement : tout configuré mais 0 conversation')}
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>Jean</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">Mon Agent</strong> est entièrement configuré et prêt à répondre.</p>

      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#10b981;font-weight:600;margin:0 0 6px 0;">Il ne lui manque plus qu'un client à qui répondre.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Partagez votre numéro WhatsApp et votre agent prend le relai automatiquement, 24h/24.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Comment partager votre numéro</div>
        ${listItem('📲', 'Ajoutez-le à la bio de vos réseaux sociaux (Instagram, Facebook…)')}
        ${listItem('🌐', 'Intégrez un bouton WhatsApp sur votre site web')}
        ${listItem('🗣️', 'Communiquez-le directement à vos clients existants')}
        ${listItem('🖨️', 'Imprimez-le sur vos flyers, menus, cartes de visite')}
      </div>
      ${btn('Accéder à mon dashboard', `${APP_URL}/dashboard`)}
    `)
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

async function send() {
    if (!SMTP.auth.user || !SMTP.auth.pass) {
        console.error('SMTP non configuré. Vérifiez SMTP_USER et SMTP_PASSWORD dans .env.local')
        process.exit(1)
    }

    const transporter = nodemailer.createTransport(SMTP)

    const emails = [emailA, emailB, emailC1, emailC2, emailD]
    const labels = ['A', 'B', 'C1 (support)', 'C2 (e-commerce/autres)', 'D']

    console.log(`\nEnvoi de ${emails.length} emails de prévisualisation à ${TO}...\n`)

    for (let i = 0; i < emails.length; i++) {
        try {
            await transporter.sendMail({
                from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                to: TO,
                subject: emails[i].subject,
                html: emails[i].html,
            })
            console.log(`✓ Email ${labels[i]} envoyé`)
        } catch (err) {
            console.error(`✗ Email ${labels[i]} échoué :`, err.message)
        }
        // Petite pause entre chaque envoi
        await new Promise(r => setTimeout(r, 500))
    }

    console.log('\nTerminé. Vérifiez votre boîte konocigames@gmail.com')
}

send()
