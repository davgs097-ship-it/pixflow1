const CACHE = 'payos-v1';

// Install
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Push notification recebida
self.addEventListener('push', e => {
  let data = { title: 'PayOS', body: '✅ Novo pagamento confirmado!', amount: null };
  try { data = e.data.json(); } catch(err) {}

  const title = data.title || 'PayOS';
  const options = {
    body: data.body || '✅ Novo pagamento confirmado!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'payos-payment-' + Date.now(),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '→ Ver no painel' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Mensagem do app (notificação local via postMessage)
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY_PAYMENT') {
    const { amount, product, gateway } = e.data;
    const gwLabel = gateway === 'zero_one_pay' ? 'Zero One' : gateway === 'ghosts_pays' ? 'GhostsPays' : 'Paradise';
    self.registration.showNotification('💸 PayOS — Pagamento confirmado!', {
      body: `✅ R$ ${amount} recebido${product ? ' · ' + product : ''}  [${gwLabel}]`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'payos-payment-' + Date.now(),
      requireInteraction: false,
      vibrate: [150, 80, 150],
      data: { url: '/' }
    });
  }
});
