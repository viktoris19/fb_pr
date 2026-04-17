const fs = require('fs');
const path = require('path');
const https = require('https');

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { Server } = require('socket.io');
const { configureWebPush, sendNotification } = require('./push');

/**
 * Практика 15–17: HTTPS сервер
 *
 * Зачем HTTPS в PWA:
 * - Service Worker требует secure context (https) для большинства фич.
 * - Push API также требует secure context.
 *
 * Этот сервер:
 * 1) отдаёт статические файлы фронтенда (PWA)
 * 2) поднимает Socket.IO (WebSocket) канал
 * 3) даёт endpoints для Push подписки и отправки уведомлений
 * 4) управляет отложенными push-уведомлениями (Практика 17)
 */

const app = express();
const PORT = Number(process.env.PORT || 3443);

app.use(cors());
app.use(express.json());

// --- Статика (фронтенд PWA) ---
const FRONTEND_DIR = path.join(__dirname, '..', '..');
app.use(express.static(FRONTEND_DIR));

// =========================================================
// Хранилища данных (в памяти процесса)
// =========================================================

// Хранилище push-подписок (массив, т.к. нужен порядок и простая фильтрация)
let pushSubscriptions = [];

// Хранилище напоминаний (Map: id → объект напоминания)
const reminders = new Map();
let nextReminderId = 1;

// =========================================================
// Вспомогательные функции
// =========================================================

/**
 * Возвращает список всех задач (заглушка для синхронизации)
 * В реальном проекте здесь должно быть чтение из БД
 */
function getAllTasks() {
  return [];
}

/**
 * Отправка push-уведомления всем подписчикам
 * @param {string} title - Заголовок уведомления
 * @param {string} body - Текст уведомления
 * @param {string} url - URL для открытия при клике
 * @returns {Promise<boolean>} - Успешность отправки хотя бы одного уведомления
 */
async function sendPushToAllSubscriptions(title, body, url = '/') {
  if (!pushSubscriptions || pushSubscriptions.length === 0) {
    console.log('📭 Нет активных push-подписок');
    return false;
  }
  
  try {
    const webpush = require('web-push');
    
    // Настройка VAPID (если ещё не настроено)
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:teacher@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    
    const payload = JSON.stringify({ title, body, url });
    
    console.log(`📨 Отправка push уведомления "${title}" ${pushSubscriptions.length} подписчикам...`);
    
    // Отправляем всем подписчикам параллельно
    const results = await Promise.allSettled(
      pushSubscriptions.map((subscription, index) => 
        webpush.sendNotification(subscription, payload)
          .then(() => ({ success: true, index }))
          .catch(err => ({ success: false, index, error: err }))
      )
    );
    
    // Подсчитываем результаты
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    console.log(`📊 Push отправка: ✅ ${succeeded} успешно, ❌ ${failed} ошибок`);
    
    // Удаляем невалидные подписки (код 410)
    const newSubscriptions = [...pushSubscriptions];
    let removedCount = 0;
    
    results.forEach((result, idx) => {
      if (result.status === 'rejected' && result.reason?.statusCode === 410) {
        newSubscriptions[idx] = null;
        removedCount++;
      } else if (result.status === 'fulfilled' && result.value.error?.statusCode === 410) {
        newSubscriptions[idx] = null;
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      pushSubscriptions = newSubscriptions.filter(sub => sub !== null);
      console.log(`🗑️ Удалено ${removedCount} невалидных подписок`);
    }
    
    return succeeded > 0;
  } catch (error) {
    console.error('❌ Ошибка отправки push:', error);
    return false;
  }
}

// =========================================================
// API: Health Check
// =========================================================

app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    ts: new Date().toISOString(),
    pushSubscriptionsCount: pushSubscriptions.length,
    remindersCount: reminders.size
  });
});

// =========================================================
// API: Push уведомления (Практика 16)
// =========================================================

/**
 * Получить публичный VAPID ключ для подписки
 */
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID ключ не настроен. Запустите npm run vapid' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

/**
 * Сохранить push-подписку от клиента
 */
app.post('/api/push/subscribe', async (req, res) => {
  const subscription = req.body;
  
  // Валидация
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Невалидная подписка' });
  }
  
  // Проверяем, нет ли уже такой подписки
  const exists = pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
  if (!exists) {
    pushSubscriptions.push(subscription);
    console.log(`✅ Новая push-подписка добавлена. Всего: ${pushSubscriptions.length}`);
    console.log(`   Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
  } else {
    console.log(`📝 Подписка уже существует: ${subscription.endpoint.substring(0, 50)}...`);
  }
  
  res.json({ 
    success: true, 
    subscriptionsCount: pushSubscriptions.length 
  });
});

/**
 * Отправить тестовое push-уведомление всем подписчикам
 */
app.post('/api/push/test', async (req, res) => {
  const { title, body, url } = req.body;
  
  if (pushSubscriptions.length === 0) {
    return res.status(400).json({ error: 'Нет активных подписок. Сначала подпишитесь на уведомления.' });
  }
  
  const sent = await sendPushToAllSubscriptions(
    title || '🔔 Тестовое уведомление',
    body || `Это тестовое push-уведомление. Время: ${new Date().toLocaleTimeString()}`,
    url || '/'
  );
  
  res.json({ 
    success: sent, 
    message: sent ? 'Уведомления отправлены' : 'Не удалось отправить уведомления',
    subscriptionsCount: pushSubscriptions.length
  });
});

// =========================================================
// API: Отложенные уведомления (Практика 17)
// =========================================================

/**
 * Запланировать отложенное уведомление
 * POST /api/reminders/schedule
 * Body: { title, body, delaySeconds, url? }
 */
app.post('/api/reminders/schedule', async (req, res) => {
  const { title, body, delaySeconds, url = '/' } = req.body;
  
  // Валидация
  if (!title || !body) {
    return res.status(400).json({ error: 'Поля title и body обязательны' });
  }
  
  const delay = parseInt(delaySeconds);
  if (isNaN(delay) || delay <= 0 || delay > 3600) {
    return res.status(400).json({ error: 'delaySeconds должно быть от 1 до 3600 секунд (1 час)' });
  }
  
  if (pushSubscriptions.length === 0) {
    return res.status(400).json({ 
      error: 'Нет активных push-подписок. Сначала подпишитесь на уведомления.' 
    });
  }
  
  const reminderId = nextReminderId++;
  const scheduledFor = new Date(Date.now() + delay * 1000);
  
  console.log(`⏰ Планирование напоминания #${reminderId}: "${title}" через ${delay} секунд (в ${scheduledFor.toLocaleTimeString()})`);
  
  // Создаём таймер
  const timeout = setTimeout(async () => {
    console.log(`🔔 Сработало напоминание #${reminderId}: "${title}"`);
    
    const sent = await sendPushToAllSubscriptions(title, body, url);
    
    if (sent) {
      console.log(`✅ Напоминание #${reminderId} успешно отправлено`);
    } else {
      console.log(`❌ Не удалось отправить напоминание #${reminderId}`);
    }
    
    reminders.delete(reminderId);
    console.log(`🗑️ Напоминание #${reminderId} удалено из хранилища`);
  }, delay * 1000);
  
  // Сохраняем напоминание
  reminders.set(reminderId, {
    id: reminderId,
    timeout,
    title,
    body,
    delaySeconds: delay,
    url,
    createdAt: new Date().toISOString(),
    scheduledFor: scheduledFor.toISOString()
  });
  
  res.json({
    success: true,
    reminderId,
    scheduledFor: scheduledFor.toISOString(),
    message: `Уведомление "${title}" запланировано через ${delay} секунд`
  });
});

/**
 * Получить список активных напоминаний
 * GET /api/reminders/list
 */
app.get('/api/reminders/list', (req, res) => {
  const activeReminders = Array.from(reminders.values()).map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    delaySeconds: r.delaySeconds,
    scheduledFor: r.scheduledFor,
    createdAt: r.createdAt
  }));
  
  res.json({ 
    reminders: activeReminders,
    count: activeReminders.length 
  });
});

/**
 * Отменить напоминание
 * POST /api/reminders/cancel
 * Body: { reminderId }
 */
app.post('/api/reminders/cancel', (req, res) => {
  const { reminderId } = req.body;
  
  if (!reminderId) {
    return res.status(400).json({ error: 'reminderId обязателен' });
  }
  
  const reminderIdNum = parseInt(reminderId);
  const reminder = reminders.get(reminderIdNum);
  
  if (!reminder) {
    return res.status(404).json({ error: `Напоминание #${reminderId} не найдено` });
  }
  
  clearTimeout(reminder.timeout);
  reminders.delete(reminderIdNum);
  
  console.log(`❌ Напоминание #${reminderId} "${reminder.title}" отменено`);
  res.json({ 
    success: true, 
    message: `Напоминание "${reminder.title}" отменено` 
  });
});

/**
 * Отложить напоминание на 5 минут (snooze)
 * POST /api/reminders/snooze
 * Body: { reminderId }
 */
app.post('/api/reminders/snooze', (req, res) => {
  const { reminderId } = req.body;
  
  if (!reminderId) {
    return res.status(400).json({ error: 'reminderId обязателен' });
  }
  
  const reminderIdNum = parseInt(reminderId);
  const reminder = reminders.get(reminderIdNum);
  
  if (!reminder) {
    return res.status(404).json({ error: `Напоминание #${reminderId} не найдено` });
  }
  
  // Отменяем старый таймер
  clearTimeout(reminder.timeout);
  
  // Устанавливаем новый на 5 минут (300 секунд)
  const snoozeSeconds = 300;
  const newScheduledFor = new Date(Date.now() + snoozeSeconds * 1000);
  
  const newTimeout = setTimeout(async () => {
    console.log(`🔔 Сработало отложенное напоминание #${reminderId}: "${reminder.title}"`);
    
    const sent = await sendPushToAllSubscriptions(reminder.title, reminder.body, reminder.url);
    
    if (sent) {
      console.log(`✅ Отложенное напоминание #${reminderId} успешно отправлено`);
    }
    
    reminders.delete(reminderIdNum);
  }, snoozeSeconds * 1000);
  
  // Обновляем данные напоминания
  reminder.timeout = newTimeout;
  reminder.scheduledFor = newScheduledFor.toISOString();
  reminder.delaySeconds = snoozeSeconds;
  reminders.set(reminderIdNum, reminder);
  
  console.log(`⏰ Напоминание #${reminderId} "${reminder.title}" отложено на 5 минут (до ${newScheduledFor.toLocaleTimeString()})`);
  
  res.json({
    success: true,
    message: `Напоминание "${reminder.title}" отложено на 5 минут`,
    scheduledFor: reminder.scheduledFor
  });
});

// =========================================================
// HTTPS сервер
// =========================================================

const CERT_DIR = path.join(__dirname, '..', 'certs');
const keyPath = path.join(CERT_DIR, 'localhost-key.pem');
const certPath = path.join(CERT_DIR, 'localhost-cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ HTTPS сертификаты не найдены!');
  console.error('   Создайте сертификаты в папке:', CERT_DIR);
  console.error('   Файлы: localhost-key.pem и localhost-cert.pem');
  console.error('   Инструкция:');
  console.error('     mkdir -p certs');
  console.error('     openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost-key.pem -out certs/localhost-cert.pem -days 365 -subj "/CN=localhost"');
  process.exit(1);
}

const httpsServer = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  },
  app
);

// =========================================================
// Socket.IO (WebSocket для реального времени)
// =========================================================

const io = new Server(httpsServer, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log(`🔌 Клиент подключён: ${socket.id}`);
  
  // Отправляем новому клиенту текущее состояние (опционально)
  socket.emit('connected', { message: 'WebSocket подключён', socketId: socket.id });
  
  // Обработка добавления задачи
  socket.on('task:added', (task) => {
    console.log(`📝 Задача добавлена: "${task.text}" (${socket.id})`);
    socket.broadcast.emit('task:added', task);
    io.emit('task:sync', getAllTasks());
  });
  
  // Обработка удаления задачи
  socket.on('task:deleted', (taskId) => {
    console.log(`🗑️ Задача удалена: ${taskId} (${socket.id})`);
    socket.broadcast.emit('task:deleted', taskId);
  });
  
  // Обработка обновления задачи
  socket.on('task:updated', (task) => {
    console.log(`✏️ Задача обновлена: "${task.text}" (${socket.id})`);
    socket.broadcast.emit('task:updated', task);
  });
  
  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`🔌 Клиент отключён: ${socket.id}`);
  });
});

// =========================================================
// Graceful Shutdown (корректное завершение)
// =========================================================

function shutdown(signal) {
  console.log(`\n🛑 Получен сигнал ${signal}. Завершение работы...`);
  
  // Очищаем все таймеры напоминаний
  let clearedCount = 0;
  for (const [id, reminder] of reminders.entries()) {
    clearTimeout(reminder.timeout);
    clearedCount++;
    console.log(`   Очищен таймер напоминания #${id}`);
  }
  console.log(`✅ Очищено ${clearedCount} таймеров`);
  
  // Закрываем Socket.IO соединения
  io.close(() => {
    console.log('✅ Socket.IO закрыт');
  });
  
  // Закрываем HTTPS сервер
  httpsServer.close(() => {
    console.log('✅ HTTPS сервер закрыт');
    process.exit(0);
  });
  
  // Принудительное завершение через 5 секунд, если что-то зависло
  setTimeout(() => {
    console.error('⚠️ Принудительное завершение...');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =========================================================
// Запуск сервера
// =========================================================

httpsServer.listen(PORT, () => {
  console.log(`\n🚀 HTTPS сервер запущен: https://localhost:${PORT}`);
  console.log(`❤️  Health check: https://localhost:${PORT}/api/health`);
  console.log(`📡 WebSocket: wss://localhost:${PORT}`);
  console.log(`🔔 Push API: /api/push/*`);
  console.log(`⏰ Reminders API: /api/reminders/*`);
  console.log(`\n📊 Статистика:`);
  console.log(`   - Push подписок: ${pushSubscriptions.length}`);
  console.log(`   - Активных напоминаний: ${reminders.size}`);
  console.log(`\n✨ Сервер готов к работе!\n`);
});

// =========================================================
// Экспорт (для тестирования)
// =========================================================

module.exports = { app, httpsServer, io, pushSubscriptions, reminders };