const webpush = require('web-push');

/**
 * Практика 16: Push API
 *
 * Этот файл решает две задачи:
 * 1) Генерация VAPID ключей (скрипт npm run vapid)
 * 2) Утилиты для отправки push‑уведомлений по подписке (subscription)
 *
 * В реальных проектах подписки хранятся в БД.
 * В учебной версии мы храним подписки в памяти процесса (см. server.js).
 */

function generateVapidKeys() {
  const keys = webpush.generateVAPIDKeys();
  console.log('VAPID_PUBLIC_KEY=', keys.publicKey);
  console.log('VAPID_PRIVATE_KEY=', keys.privateKey);
}

function configureWebPush({ subject, publicKey, privateKey }) {
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
  }
  webpush.setVapidDetails(subject || 'mailto:teacher@example.com', publicKey, privateKey);
}

async function sendNotification(subscription, payload, reminderId = null) {
  let payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (reminderId) {
    payloadObj.reminderId = reminderId;
  }
  return webpush.sendNotification(subscription, JSON.stringify(payloadObj));
}

// CLI mode: npm run vapid
if (process.argv.includes('--gen')) {
  generateVapidKeys();
}

module.exports = { configureWebPush, sendNotification };
