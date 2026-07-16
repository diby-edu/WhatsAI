module.exports = {
    apps: [
        {
            // Next.js Web Application
            name: 'whatsai-web',
            script: '/root/WhatsAI/node_modules/.bin/next',
            args: 'start -p 3000',
            cwd: '/root/WhatsAI',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                TZ: 'Africa/Abidjan'
            },
            // Fork mode — plus stable avec npm start. Si un cron/polling interne
            // (setInterval) est ajouté un jour à ce process, appliquer la même
            // règle que whatsai-bot ci-dessous : jamais de cluster/instances > 1
            // sans verrou distribué (pg_try_advisory_lock), sous peine de doubles
            // exécutions.
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
                NODE_ENV: 'production',
                TZ: 'Africa/Abidjan'
            },
            // ⚠️ JAMAIS de cluster mode ni instances > 1 pour ce process :
            // (1) Baileys exige une session WhatsApp unique par agent (socket en mémoire,
            //     un doublon casserait le pairing/l'état de connexion) ;
            // (2) les jobs cron internes (checkPendingPayments, cancelExpiredOrders,
            //     cancelExpiredBookingDeposits, requestFeedback, checkAgents,
            //     reconcileSessions) tournent en setInterval sans verrou distribué
            //     (pas de pg_try_advisory_lock) — plusieurs instances les exécuteraient
            //     en double (double annulation, double envoi WhatsApp, etc.).
            // Si un jour le clustering est nécessaire, ajouter un lock distribué
            // (ex: pg_try_advisory_lock) autour de chaque job avant d'augmenter `instances`.
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
