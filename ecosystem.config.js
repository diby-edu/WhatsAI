module.exports = {
    apps: [
        {
            // Next.js Web Application
            // This CAN be restarted during deployments
            name: 'whatsai-web',
            script: 'npm',
            args: 'start',
            cwd: '/root/WhatsAI',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            error_file: '/root/.pm2/logs/whatsai-web-error.log',
            out_file: '/root/.pm2/logs/whatsai-web-out.log'
        },
        {
            // WhatsApp Service
            // This should NEVER be restarted during deployments!
            // Only restart if explicitly needed
            name: 'whatsai-bot',
            script: 'whatsapp-service.js',
            cwd: '/root/WhatsAI',
            env: {
                NODE_ENV: 'production'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            error_file: '/root/.pm2/logs/whatsai-bot-error.log',
            out_file: '/root/.pm2/logs/whatsai-bot-out.log',
            // Don't restart on file changes
            ignore_watch: ['node_modules', '.whatsapp-sessions', '.next', '.git']
        }
    ]
}
