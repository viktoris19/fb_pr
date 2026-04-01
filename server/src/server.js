const fs = require('fs');
const path = require('path');
const https = require('https');

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { Server } = require('socket.io');
const { configureWebPush, sendNotification } = require('./push');

/**
 * Практика 15–16: HTTPS сервер
 *
 * Зачем HTTPS в PWA:
 * - Service Worker требует secure context (https) для большинства фич.
 * - Push API также требует secure context.
 *
 * Этот сервер:
 * 1) отдаёт статические файлы фронтенда (PWA)
 * 2) поднимает Socket.IO (WebSocket) канал
 * 3) даёт endpoints для Push подписки и отправки уведомлений
 */

const app = express();
const PORT = Number(process.env.PORT || 3443);

app.use(cors());
app.use(express.json());

// --- Статика (фронтенд PWA) ---
const FRONTEND_DIR = path.join(__dirname, '..', '..');
app.use(express.static(FRONTEND_DIR));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Push: учебное хранилище подписок (в памяти процесса) ---
// TODO (студентам): заменить на БД/Redis, если усложняем проект.
const subscriptions = new Set();

// Настройка web-push (если ключи есть)
let pushReady = false;
try {
  configureWebPush({
    subject: process.env.VAPID_SUBJECT,
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  });
  pushReady = true;
} catch (e) {
  console.warn('[PUSH] Not configured:', e.message);
}

/**
 * Практика 16: сохранить push‑подписку
 * Клиент отправляет объект subscription (PushSubscription.toJSON())
 */
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription) {
    return res.status(400).json({ error: 'subscription_required' });
  }
  subscriptions.add(JSON.stringify(subscription));
  res.json({ ok: true, count: subscriptions.size, pushReady });
});

/**
 * Практика 16: отправить тестовый push всем подписчикам
 *
 * TODO (студентам):
 * - сделать payload содержательным (title/body/url)
 * - обработать отвалившиеся подписки (410/404)
 */
app.post('/api/push/test', async (req, res) => {
  if (!pushReady) {
    return res.status(400).json({ error: 'push_not_configured', message: 'Set VAPID keys in server/.env' });
  }

  const payload = JSON.stringify({
    title: 'PWA уведомление',
    body: 'Тестовое уведомление (Практика 16)',
    url: '/',
    ts: Date.now(),
  });

  let sent = 0;
  for (const raw of Array.from(subscriptions)) {
    const subscription = JSON.parse(raw);
    try {
      await sendNotification(subscription, payload);
      sent++;
    } catch (e) {
      // TODO (студентам): при 410 удалять подписку
      console.warn('[PUSH] send failed:', e.statusCode || '', e.body || e.message);
    }
  }

  res.json({ ok: true, sent, total: subscriptions.size });
});

// --- HTTPS server ---
const CERT_DIR = path.join(__dirname, '..', 'certs');
const keyPath = path.join(CERT_DIR, 'localhost-key.pem');
const certPath = path.join(CERT_DIR, 'localhost-cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('HTTPS certs not found. Create server/certs/localhost-key.pem and server/certs/localhost-cert.pem');
  console.error('See server/README.md');
  process.exit(1);
}

const httpsServer = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  },
  app
);

// --- Socket.IO (Практика 16) ---
const io = new Server(httpsServer, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log('[WS] connected:', socket.id);

  // TODO (студентам): придумать события для TODO‑листа
  // Например: 'todo:created', 'todo:toggled', 'todo:deleted'

  socket.on('todo:event', (payload) => {
    // payload — что угодно (например объект задачи)
    // Рассылаем всем остальным вкладкам/клиентам
    socket.broadcast.emit('todo:event', payload);
  });

  socket.on('disconnect', () => {
    console.log('[WS] disconnected:', socket.id);
  });
});

httpsServer.listen(PORT, () => {
  console.log(`HTTPS server: https://localhost:${PORT}`);
  console.log(`Health: https://localhost:${PORT}/api/health`);
});
