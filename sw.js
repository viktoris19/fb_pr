/**
 * Service Worker (Практики 15–16)
 *
 * Практика 15:
 * - HTTPS + App Shell: оболочка приложения (index.html) и статика должны работать офлайн.
 * - Контент вынесен в /content/*.html и подгружается fetch‑ом.
 * - Для контента обычно подходит стратегия Network First (если сеть есть — обновить, иначе взять из кеша).
 *
 * Практика 16:
 * - Push API: Service Worker принимает push‑события и показывает уведомления.
 */

const SHELL_CACHE = 'pwa-shell-v1';
const RUNTIME_CACHE = 'pwa-runtime-v1';

// --- App Shell (precache) ---
// Это «оболочка»: минимальный набор, чтобы приложение стартовало офлайн.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/hero.png',

  // Иконки (важно для установки PWA)
  '/assets/icons/favicon.ico',
  '/assets/icons/favicon-16x16.png',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon-48x48.png',
  '/assets/icons/favicon-64x64.png',
  '/assets/icons/favicon-128x128.png',
  '/assets/icons/favicon-256x256.png',
  '/assets/icons/favicon-512x512.png',
  '/assets/icons/apple-touch-icon.png'
];

// Контентные страницы (App Shell)
const CONTENT_PAGES = [
  '/content/home.html',
  '/content/theory.html',
  '/content/push.html'
];

const OFFLINE_FALLBACK = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);

      // Практика 15: можно также положить стартовый контент в precache
      // (чтобы навигация работала офлайн сразу).
      // TODO (студентам): решите, нужно ли precache для content.
      await cache.addAll(CONTENT_PAGES);
    })()
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );

      self.clients.claim();
    })()
  );
});

/**
 * Fetch handler
 *
 * 1) App Shell: Cache First (быстро и офлайн)
 * 2) /content/*.html: Network First (обновляем при наличии сети)
 * 3) Остальное: simple fallback (Cache First)
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/content/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res && res.status === 200) { 
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone()); 
    }
    return res;
  } catch (error) {
    console.warn('Не удалось загрузить ресурс:', request.url);
    if (request.url.match(/\.(png|jpg|jpeg|svg|gif)$/i)) {
      return new Response('', { status: 204 });
    }
    return new Response('Офлайн: ресурс недоступен', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      cache.put(request,res.clone());
    }
    // Кешируем свежую версию
    cache.put(request, res.clone());
    return res;
  } catch (error) {
    console.log('Сеть недоступна, берём из кэша:', request.url);
    // Сети нет — отдаём из runtime cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Последний шанс — shell cache (если положили content в precache)
    const shellCached = await caches.match(request);
    if (shellCached) return shellCached;

    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(OFFLINE_FALLBACK);
    }

    return new Response('Офлайн: контент недоступен и не найден в кеше.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(res => {
    if (res && res.status === 200) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);
  
  return cached || fetchPromise;
}

// =========================
// Практика 16: Push API
// =========================

self.addEventListener('push', (event) => {
  // payload обычно приходит строкой JSON
  const data = event.data ? safeJson(event.data.text()) : {};

  const title = data.title || 'PWA уведомление';
  const options = {
    body: data.body || 'У вас новое событие.',
    data: { url: data.url || '/' },
    icon: '/assets/icons/favicon-128x128.png',
    badge: '/assets/icons/favicon-64x64.png',
    actions: [
      {
        action: 'snooze_5m',
        title: 'Отложить на 5 минут'
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || '/';
  const action = event.action;
  const reminderId = event.notification?.data?.reminderId;

  if (action === 'snooze_5m') {
    event.waitUntil(
      (async () => {
        console.log('Пользователь отложил уведомление на 5 минут');

        if (reminderId) {
          await fetch('/api/reminders/snooze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminderId: parseInt(reminderId) })
          });
        }

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'SHOW_TOAST',
            message: 'Напоминание отложено на 5 минут'
          });
        }
      })()
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of allClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })()
  );
});

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
