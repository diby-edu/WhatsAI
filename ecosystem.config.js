module.exports = {
    apps: [
        {
            // Next.js Web Application
            name: 'whatsai-web',
            script: 'npm',
            args: 'start',
            cwd: '/root/WhatsAI',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            // Fork mode — plus stable avec npm start
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '1G',
            // PAS de wait_ready — Next.js ne signale pas PM2
            error_file: '/root/.pm2/logs/whatsai-web-error.log',
            out_file: '/root/.pm2/logs/whatsai-web-out.log',
            combine_logs: true,
            merge_logs: true
        },
        {
            // WhatsApp Service (Orchestrateur Bot)
            name: 'whatsai-bot',
            script: 'whatsapp-service.js',
            cwd: '/root/WhatsAI',
            env: {
                NODE_ENV: 'production'
            },
            // ⚠️ JAMAIS de cluster mode pour Baileys (sessions uniques)
            instances: 1,
            autorestart: true,
            watch: false,
            // Limite mémoire stricte pour éviter les fuites Node.js
            max_memory_restart: '800M',
            kill_timeout: 5000,  // Laisser 5s au gracefulShutdown pour sauvegarder les sessions
            error_file: '/root/.pm2/logs/whatsai-bot-error.log',
            out_file: '/root/.pm2/logs/whatsai-bot-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            ignore_watch: ['node_modules', '.whatsapp-sessions', '.next', '.git']
        }
    ]
}
