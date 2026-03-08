export const dynamic = 'force-dynamic'

export async function GET() {
    const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    }

    const swContent = `
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || payload.data?.title || 'WazzapAI';
    const body = payload.notification?.body || payload.data?.body || '';
    const icon = '/logo.png';

    self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: icon,
        data: payload.data || {},
        vibrate: [200, 100, 200]
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const route = event.notification.data?.route || '/dashboard';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(route);
                    return client.focus();
                }
            }
            return clients.openWindow(route);
        })
    );
});
`

    return new Response(swContent, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Service-Worker-Allowed': '/',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    })
}
