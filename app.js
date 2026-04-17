/**
 * Учебный TODO-менеджер для практик 13–14.
 *
 * Что уже реализовано в шаблоне:
 * 1. Добавление, удаление и переключение статуса задач.
 * 2. Хранение задач в localStorage.
 * 3. Вывод статистики по задачам.
 * 4. Регистрация Service Worker.
 * 5. Поддержка установки PWA в Chromium-браузерах.
 * 6. Отдельная подсказка по установке в Safari.
 * 7. Случайные мотивационные цитаты в футере.
 *
 * Что оставлено студентам:
 * - редактирование задачи;
 * - фильтрация списка;
 * - подтверждение удаления;
 * - улучшение кэширования в Service Worker;
 * - более продуманная обработка обновлений PWA.
 */

// =========================================================
// DOM-элементы интерфейса
// =========================================================

const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const taskStats = document.getElementById('taskStats');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const networkStatus = document.getElementById('networkStatus');
const installBtn = document.getElementById('installBtn');
const installHint = document.getElementById('installHint');
const quoteText = document.getElementById('quoteText');
const newQuoteBtn = document.getElementById('newQuoteBtn');

// =========================================================
// Константы приложения
// =========================================================

/**
 * Ключ, под которым массив задач лежит в localStorage.
 * Если поменять ключ, приложение начнёт читать и сохранять данные
 * уже в другую запись хранилища.
 */
const STORAGE_KEY = 'practice_13_14_todos_v2';
const VAPID_PUBLIC_KEY = 'BIofx2e8Gq_Zk6PtUFTFX8aRDxRh3XWfKVdsqHgfajhwQQ5t4gCIqFTsivbo8sSrQayEWWJbmfnKQU028bijihM';

/**
 * Массив цитат для нижнего блока.
 * Это небольшой пример клиентской динамики без обращения к серверу.
 */
const planningQuotes = [
  'Хороший план сегодня лучше идеального плана завтра.',
  'Планирование экономит время, которое иначе уходит на исправление хаоса.',
  'Большая цель достигается через маленькие запланированные шаги.',
  'Порядок в делах начинается с ясности следующего шага.',
  'Последовательность важнее разового вдохновения.',
  'План — это не ограничение, а инструмент управления неопределённостью.',
  'Когда задача записана, она перестаёт шуметь в голове.',
  'Хорошая система побеждает временный порыв.'
];

/**
 * В этой переменной будет временно храниться событие beforeinstallprompt.
 * Оно нужно для ручного показа системного диалога установки PWA.
 *
 * Значение будет равно:
 * - null, если установка сейчас недоступна;
 * - объекту события, если браузер разрешил показать install-prompt.
 */
let deferredInstallPrompt = null;
let socket = null;
let isSubscribed = false;

// =========================================================
// Работа с localStorage
// =========================================================

/**
 * Безопасно читает массив задач из localStorage.
 *
 * Почему здесь try/catch:
 * - строка в localStorage может оказаться повреждённой;
 * - JSON.parse выбросит ошибку при некорректном содержимом;
 * - интерфейс не должен полностью падать из-за одной ошибки хранения.
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Не удалось прочитать задачи из localStorage:', error);
    return [];
  }
}

async function loadContent(page) {
  try{
    const response = await fetch(`/content/${page}.html`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.innerHTML = html;
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.page == page) {
        link.classList.add('active');
      }
    });

    history.pushState({page}, '',`#${page}`);
  } catch (error) {
    console.error('Ошибка загрузки контента:', error);
    const appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.innerHTML = '<div class="card"><p>❌ Не удалось загрузить контент. Проверьте соединение.</p></div>';
    }
  }
}

/**
 * Сохраняет массив задач в localStorage.
 *
 * @param {Array} tasks - массив объектов задач.
 */
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// =========================================================
// Вспомогательные функции
// =========================================================

/**
 * Генерирует простой уникальный идентификатор задачи.
 * Для учебного приложения этого достаточно.
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Обновляет статус сети в интерфейсе.
 * navigator.onLine даёт базовую информацию, которой хватает для учебной демонстрации.
 */
function updateNetworkStatus() {
  const isOnline = navigator.onLine;

  networkStatus.textContent = isOnline ? 'Онлайн' : 'Офлайн';
  networkStatus.classList.toggle('badge--success', isOnline);
  networkStatus.classList.toggle('badge--offline', !isOnline);
}

/**
 * Возвращает случайную цитату и выводит её в футер.
 */
function showRandomQuote() {
  const randomIndex = Math.floor(Math.random() * planningQuotes.length);
  quoteText.textContent = planningQuotes[randomIndex];
}

/**
 * Формирует DOM-элемент для одной задачи.
 * Здесь выбран вариант именно с созданием DOM-узлов,
 * чтобы код был нагляднее и безопаснее для разбора.
 */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  li.dataset.id = task.id;

  const leftPart = document.createElement('div');
  leftPart.className = 'task-item__left';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.dataset.action = 'toggle';
  checkbox.setAttribute('aria-label', 'Отметить задачу выполненной');

  const text = document.createElement('span');
  text.className = 'task-item__text';
  text.textContent = task.text;

  if (task.completed) {
    text.classList.add('task-item__text--completed');
  }

  leftPart.appendChild(checkbox);
  leftPart.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'task-item__actions';

  // Кнопка редактирования
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'button button--secondary button--small';
  editBtn.textContent = 'Редактировать';
  editBtn.dataset.action = 'edit';
  actions.appendChild(editBtn);

  // Кнопка удаления
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'button button--danger button--small';
  deleteBtn.textContent = 'Просто удали это!';
  deleteBtn.dataset.action = 'delete';

  actions.appendChild(deleteBtn);

  li.appendChild(leftPart);
  li.appendChild(actions);

  return li;
}

/**
 * Перерисовывает блок статистики.
 */
function updateStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;

  taskStats.textContent = `Всего: ${total} | Активных: ${active} | Выполненных: ${completed}`;
}

let currentFilter = 'all';
/**
 * Полная перерисовка списка задач.
 * Для учебного проекта это допустимый и понятный подход.
 */
function renderTasks() {
  const allTasks = loadTasks();
  let filteredTasks = allTasks;

  if (currentFilter === 'active') {
    filteredTasks = allTasks.filter(task => !task.completed);
  } else if (currentFilter === 'completed') {
    filteredTasks = allTasks.filter(task => task.completed);
  }

  taskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    if (currentFilter === 'active') {
      emptyState.textContent = 'Нет активных задач. Отдохни! 🎉';
    } else if (currentFilter === 'completed') {
      emptyState.textContent = 'Нет выполненных задач. Вперёд! 🚀';
    } else {
      emptyState.textContent = 'Пока задач нет. Добавьте первую запись.';
    }
    taskList.appendChild(emptyState);
    updateStats(allTasks);
    return;
  }

  filteredTasks.forEach((task) => {
    taskList.appendChild(createTaskElement(task));
  });

  updateStats(allTasks);
}

// =========================================================
// Бизнес-логика TODO-списка
// =========================================================

/**
 * Добавляет новую задачу.
 *
 * @param {string} text - текст задачи.
 */
function addTask(text) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return;
  }

  const tasks = loadTasks();

  const newTask = {
    id: generateId(),
    text: normalizedText,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  saveTasks(tasks);
  renderTasks();
  emitTaskEvent('task:added',newTask);
}

function emitTaskEvent(eventName,taskData){
  if (socket && socket.connected) {
    socket.emit(eventName,taskData);
  }
}

/**
 * Переключает статус задачи по id.
 */
function toggleTask(taskId) {
  const updated = loadTasks().map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        completed: !task.completed
      };
    }

    return task;
  });

  saveTasks(updated);
  renderTasks();
}

/**
 * Редактирует задачу
 */
function editTask(taskId) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const newText = prompt('Редактировать задачу:', task.text);
  if (!newText || newText.trim() === '') return;

  task.text = newText.trim();
  saveTasks(tasks);
  renderTasks();
  emitTaskEvent('task:updated',task);
}

/**
 * Удаляет задачу по id.
 * Подтверждение специально не добавлено: это TODO для студентов.
 */
function deleteTask(taskId) {
  if (!confirm('Удалить задачу?')) return;
  const updated = loadTasks().filter((task) => task.id !== taskId);
  saveTasks(updated);
  renderTasks();
  emitTaskEvent('task:deleted',taskId);
}

/**
 * Удаляет все выполненные задачи.
 */
function clearCompletedTasks() {
  if (!confirm('Удалить все выполненные задачи?')) return;
  const updated = loadTasks().filter((task) => !task.completed);
  saveTasks(updated);
  renderTasks();
}

// =========================================================
// Установка PWA
// =========================================================

/**
 * Определяет, запущено ли приложение уже в standalone-режиме.
 * Это полезно, чтобы не показывать кнопку установки там,
 * где приложение уже установлено и открыто как отдельное окно.
 */
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/**
 * Обновляет текст подсказки по установке.
 * В Chromium мы можем показать собственную кнопку установки,
 * а в Safari остаётся сценарий через меню браузера.
 */
function updateInstallHint() {
  if (isStandaloneMode()) {
    installHint.textContent = 'Приложение уже запущено в standalone-режиме.';
    if (installBtn) {
      installBtn.hidden = true;
    }
    return;
  }

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isSafari) {
    installHint.textContent = 'Safari: для установки используйте File → Add to Dock.';
  } else {
    installHint.textContent = 'Chrome / Edge: установите приложение через кнопку браузера или кнопку «Установить PWA». ';
  }
}

/**
 * Событие beforeinstallprompt поддерживается в Chromium.
 * Здесь мы перехватываем стандартный prompt, сохраняем событие
 * и показываем свою кнопку установки в интерфейсе.
 */
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  if (installBtn && !isStandaloneMode()) {
    installBtn.hidden = false;
  }
});

/**
 * Нажатие на кнопку установки.
 */
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    console.log('Результат установки PWA:', choiceResult.outcome);

    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}

/**
 * Если приложение установлено, скрываем кнопку.
 */
window.addEventListener('appinstalled', () => {
  console.log('PWA успешно установлено.');
  deferredInstallPrompt = null;

  if (installBtn) {
    installBtn.hidden = true;
  }

  updateInstallHint();
});

// =========================================================
// Регистрация Service Worker
// =========================================================

/**
 * Регистрируем Service Worker только там, где технология поддерживается.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker не поддерживается в данном браузере.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker зарегистрирован:', registration.scope);

      showOfflineReadyNotification();

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('Найдена новая версия Service Worker');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification(registration);
          }
        });
      });

      if (registration.waiting) {
        showUpdateNotification(registration);
      }

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('Service Worker обновлён, перезагружаем страницу');
        window.location.reload();
      });

    } catch (error) {
      console.error('Ошибка регистрации Service Worker:', error);
    }
  });
}

function showOfflineReadyNotification() {
  const notification = document.createElement('div');
  notification.className = 'notification notification--success';
  notification.innerHTML = `
    <span>✅ Приложение готово к работе офлайн</span>
    <button class="notification-close">×</button>
  `;
  
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'),10);

  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });
}

function showUpdateNotification(registration) {
  if (document.querySelector('.notification--update')) return;

  const notification = document.createElement('div');
  notification.className = 'notification notification--update';
  notification.innerHTML = `
    <span>🔄 Доступна новая версия приложения</span>
    <button class="notification-update-btn">Обновить</button>
    <button class="notification-close">×</button>
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  
  notification.querySelector('.notification-update-btn').addEventListener('click', () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });
}

function initWebSocket() {
  socket = io('https://localhost:3443', {
    reconnection: true,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket подключён');
    updateNetworkStatus();
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket отключён');
  });

  socket.on('task:added',(task) => {
    console.log('Добавлена задача другим пользователем:',task);
    const tasks = loadTasks();
    if (!tasks.find (t => t.id === task.id)) {
      tasks.unshift(task);
      saveTasks(tasks);
      renderTasks();
      showToast(`Новая задача: ${task.text.substring(0, 30)}`);
    }
  })

  socket.on('task:deleted', (taskId) => {
    console.log('Удалена задача другим пользователем:', taskId);
    const tasks = loadTasks().filter(t => t.id !== taskId);
    saveTasks(tasks);
    renderTasks();
    showToast('Задача удалена другим пользователем');
  });

  socket.on('task:updated', (updatedTask) => {
    console.log('Обновлена задача другим пользователем:', updatedTask);
    const tasks = loadTasks().map(t => t.id === updatedTask.id ? updatedTask : t);
    saveTasks(tasks);
    renderTasks();
    showToast(`Задача обновлена: ${updatedTask.text.substring(0, 30)}`);
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

//Отправка push-уведомления
async function sendTestPush() {
  try {
    const response = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Тестовое уведомление',
        body: `Привет! Время: ${new Date().toLocaleTimeString()}`,
        url: '/'
      })
    });
    
    if (response.ok) {
      showPushStatus('Тестовое уведомление отправлено!', 'success');
    } else {
      throw new Error('Ошибка на сервере');
    }
  } catch (error) {
    console.error('Ошибка отправки тестового push:', error);
    showPushStatus(`Не удалось отправить: ${error.message}`, 'error');
  }
}

//отображение статуса push
function showPushStatus(message, type = 'info') {
  const statusEl = document.getElementById('pushStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#dc2626' : '#10b981';
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.style.color = '#6b7280';
      }
    }, 3000);
  }
}

//Показать временное всплывающее сообщение
function showToast(message, duration = 3000) {
  const oldToast = document.querySelector('.toast-message');
  if (oldToast) oldToast.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 2000;
    animation: fadeInOut 3s ease;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/**
 * Инициализация Push-интерфейса
 */
function initPushUI() {
  const subscribeBtn = document.getElementById('subscribePushBtn');
  const testBtn = document.getElementById('testPushBtn');
  
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', subscribeToPush);
  }
  
  if (testBtn) {
    testBtn.addEventListener('click', sendTestPush);
  }
  
  // Проверяем существующую подписку при загрузке
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(subscription => {
        if (subscription) {
          isSubscribed = true;
          if (testBtn) testBtn.disabled = false;
          showPushStatus('✅ Вы уже подписаны на уведомления', 'success');
        }
      });
    });
  }
}

// =========================================================
// Обработчики событий
// =========================================================

/**
 * Отправка формы добавления задачи.
 */
taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTask(taskInput.value);
  taskForm.reset();
  taskInput.focus();
});

/**
 * Делегирование кликов по списку задач.
 * Это удобнее, чем навешивать обработчики на каждую кнопку отдельно.
 */
taskList.addEventListener('click', (event) => {
  const target = event.target;
  const taskItem = target.closest('.task-item');

  if (!taskItem) {
    return;
  }

  const taskId = taskItem.dataset.id;
  const action = target.dataset.action;

  if (action === 'delete') {
    deleteTask(taskId);
  }

  if (action === 'edit') {
  editTask(taskId);
  }
});

/**
 * Отдельно обрабатываем изменение чекбокса.
 */
taskList.addEventListener('change', (event) => {
  const target = event.target;

  if (target.dataset.action !== 'toggle') {
    return;
  }

  const taskItem = target.closest('.task-item');
  if (!taskItem) {
    return;
  }

  toggleTask(taskItem.dataset.id);
});

clearCompletedBtn.addEventListener('click', clearCompletedTasks);
newQuoteBtn.addEventListener('click', showRandomQuote);
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// =========================================================
// Инициализация
// =========================================================


/**
 * Инициализация навигации
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        loadContent(page);
      }
    });
  });
  
  // Обработка кнопок назад/вперёд
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
      loadContent(event.state.page);
    } else {
      loadContent('home');
    }
  });
}

/**
 * Получение VAPID публичного ключа с сервера
 */
async function fetchVapidPublicKey() {
  try {
    const response = await fetch('/api/push/vapid-public-key');
    if (!response.ok) throw new Error('Не удалось получить VAPID ключ');
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('Ошибка получения VAPID ключа:', error);
    return null;
  }
}

/**
 * Подписка на push-уведомления
 */
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showPushStatus('❌ Push API не поддерживается в этом браузере', 'error');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showPushStatus('Разрешение на уведомления не получено', 'error');
      return false;
    }
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
  isSubscribed = true;
  showPushStatus('Вы подписаны на уведомления!', 'success');

  const testBtn = document.getElementById('testPushBtn');
  if (testBtn) testBtn.disabled = false;
  
  const delayedSection = document.getElementById('delayedNotificationsSection');
  if (delayedSection) delayedSection.style.display = 'block';
  
  return true;
}else {
      throw new Error('Ошибка при отправке подписки на сервер');
    }
  } catch (error) {
    console.error('Ошибка подписки на Push:', error);
    showPushStatus(`Ошибка: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Запланировать отложенное уведомление
 */
async function scheduleDelayedNotification() {
  const titleInput = document.getElementById('reminderTitle');
  const bodyInput = document.getElementById('reminderBody');
  const delayInput = document.getElementById('reminderDelay');
  
  const title = titleInput?.value.trim();
  const body = bodyInput?.value.trim();
  const delaySeconds = parseInt(delayInput?.value || '10');
  
  if (!title) {
    showPushStatus('Введите заголовок уведомления', 'error');
    return;
  }
  
  if (!body) {
    showPushStatus('Введите текст уведомления', 'error');
    return;
  }
  
  if (isNaN(delaySeconds) || delaySeconds < 1 || delaySeconds > 3600) {
    showPushStatus('Введите корректную задержку (1-3600 секунд)', 'error');
    return;
  }
  
  showPushStatus(`⏳ Планирование уведомления через ${delaySeconds} секунд...`, 'info');
  
  try {
    const response = await fetch('/api/reminders/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        delaySeconds,
        url: '/'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      showPushStatus(`Уведомление запланировано! Отправится через ${delaySeconds} секунд`, 'success');

      if (titleInput) titleInput.value = '';
      if (bodyInput) bodyInput.value = '';
      if (delayInput) delayInput.value = '10';

      loadRemindersList();
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка планирования');
    }
  } catch (error) {
    console.error('Ошибка планирования:', error);
    showPushStatus(`${error.message}`, 'error');
  }
}

/**
 * Загрузить список активных напоминаний
 */
async function loadRemindersList() {
  try {
    const response = await fetch('/api/reminders/list');
    if (!response.ok) throw new Error('Не удалось загрузить список');
    
    const data = await response.json();
    const remindersList = document.getElementById('remindersList');
    
    if (!remindersList) return;
    
    if (data.reminders.length === 0) {
      remindersList.innerHTML = '<p class="card__hint">Нет запланированных напоминаний</p>';
      return;
    }
    
    remindersList.innerHTML = `
      <ul class="reminders-items">
        ${data.reminders.map(r => `
          <li class="reminder-item" data-id="${r.id}">
            <div class="reminder-info">
              <strong>${escapeHtml(r.title)}</strong>
              <p>${escapeHtml(r.body)}</p>
              <small>Отправится: ${new Date(r.scheduledFor).toLocaleTimeString()}</small>
            </div>
            <button class="button button--danger button--small cancel-reminder" data-id="${r.id}">Отменить</button>
          </li>
        `).join('')}
      </ul>
    `;

    document.querySelectorAll('.cancel-reminder').forEach(btn => {
      btn.addEventListener('click', () => cancelReminder(btn.dataset.id));
    });
  } catch (error) {
    console.error('Ошибка загрузки списка:', error);
  }
}

/**
 * Отменить напоминание
 */
async function cancelReminder(reminderId) {
  try {
    const response = await fetch('/api/reminders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderId: parseInt(reminderId) })
    });
    
    if (response.ok) {
      showPushStatus('Напоминание отменено', 'success');
      loadRemindersList();
    } else {
      throw new Error('Ошибка отмены');
    }
  } catch (error) {
    console.error('Ошибка отмены:', error);
    showPushStatus('Не удалось отменить напоминание', 'error');
  }
}

/**
 * Экранирование HTML для безопасности
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Периодическое обновление списка напоминаний (каждые 5 секунд)
let remindersInterval = null;

init();

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    currentFilter = e.target.dataset.filter;
    renderTasks();
  });
});


function startRemindersAutoRefresh() {
  if (remindersInterval) clearInterval(remindersInterval);
  remindersInterval = setInterval(() => {
    if (document.getElementById('remindersList')) {
      loadRemindersList();
    }
  }, 5000);
}

function init() {
  updateNetworkStatus();
  updateInstallHint();
  showRandomQuote();
  renderTasks();
  registerServiceWorker();
  initWebSocket();
  initNavigation();
  initPushUI();
  startRemindersAutoRefresh();

  const defaultPage = window.location.hash.slice(1) || 'home';
  loadContent(defaultPage);

  const scheduleBtn = document.getElementById('scheduleReminderBtn');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', scheduleDelayedNotification);
  }
}