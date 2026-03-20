import axios from "axios";

/**
 * apiClient.js — единое место настройки axios для всего фронтенда.
 * 
 * 
 * Теория (axios):
 *
 * 1) axios — это библиотека, которая делает HTTP-запросы из фронтенда
 *    (GET/POST/PUT/DELETE) к вашему серверу.
 *
 * 2) axios.create(...) — создаёт "настроенный axios-клиент":
 *    - мы один раз задаём baseURL (куда по умолчанию отправлять запросы)
 *    - и один раз подключаем перехватчики (interceptors)
 *    
 *    Дальше везде в проекте используем один и тот же объект `api`,
 *    чтобы не копировать настройки в каждом файле.
 *
 * 3) interceptors (перехватчики) — это функции, которые axios вызывает автоматически:
 *    - request interceptor: срабатывает перед запросом
 *      → добавляем Authorization: Bearer <accessToken>
 *    - response interceptor: срабатывает после ответа/ошибки
 *      → если пришёл 401, делаем /auth/refresh и повторяем исходный запрос
 * 
 * Метафора:
 *    •	Запрос — это письмо.
 *    •	Request interceptor — вы перед отправкой приклеили марку/подписали письмо (Authorization).
 *    •	Response interceptor — вы после получения ответа решили, что делать дальше (если 401 — “сходить за новой маркой” и отправить письмо заново).
 *
 *
 * Бэкенд (Express) слушает: http://localhost:3000
 * Мы используем префикс /api, поэтому baseURL = http://localhost:3000/api
 *
 * =========================
 * Практика 10 (клиент и токены):
 * =========================
 * - accessToken / refreshToken храним в localStorage (учебный вариант)
 * - accessToken автоматически подставляем в каждый запрос через request interceptor
 * - при 401 автоматически:
 *    1) вызываем /api/auth/refresh (с refreshToken)
 *    2) сохраняем новую пару токенов
 *    3) повторяем исходный запрос
 *
 * =========================
 * Практика 9 (refresh-токены, но на стороне клиента):
 * =========================
 * - refreshToken нужен для запроса /api/auth/refresh
 * - на бэкенде refreshToken проверяется и выдаётся новая пара (access + refresh)
 */
export const api = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 5000,
});

// --- Работа с localStorage (учебный вариант, Практика 10) ---
// Ключи для localStorage
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";


// Чтение accessToken из localStorage (Если найдено → вернёт строку (сам токен). Если ключа нет → вернётся null)
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

// Чтение refreshToken из localStorage
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/**
 * setTokens — сохраняем пару токенов после:
 * - login (Практика 9: login возвращает accessToken + refreshToken)
 * - refresh (Практика 9: refresh возвращает новую пару)
 */
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

/**
 * clearTokens — используем, если:
 * - refreshToken отсутствует (нечем обновлять)
 * - refresh не сработал (refresh протух/невалиден)
 * Тогда пользователю нужно выполнить login заново.
 */
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// --- Практика 10: Request interceptor — подставляем accessToken в каждый запрос ---
api.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      // Заголовок, который понимает наш authMiddleware на бэкенде:
      // Authorization: Bearer <accessToken>
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Практика 10: Response interceptor — авто-refresh при 401 и повтор запроса
 *
 * Важно:
 * - _retry защищает от бесконечного цикла (если refresh тоже вернёт 401)
 * - refreshInFlight защищает от параллельных refresh-запросов:
 *   если 5 запросов одновременно получили 401, refresh делаем один раз
 */
let refreshInFlight = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error.config;

    // 401 от защищённых маршрутов (accessToken протух/битый/отсутствует)
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        // Нечем обновлять → пользователь должен залогиниться заново
        clearTokens();
        return Promise.reject(error);
      }

      try {
        // Чтобы не стрелять refresh-запросами параллельно, используем один общий промис
        if (!refreshInFlight) {
          /**
           * Практика 9 (формат refresh запроса):
           * На бэкенде /api/auth/refresh принимает refreshToken.
           * В этой реализации отправляем его в заголовке:
           *   x-refresh-token: <refreshToken>
           *
           * (Если на бэкенде вы решите принимать refreshToken только в body,
           * то здесь надо будет отправлять { refreshToken } в JSON.)
           */
          refreshInFlight = api
            .post("/auth/refresh", null, {
              headers: {
                "x-refresh-token": refreshToken,
              },
            })
            .then((r) => r.data)
            .finally(() => {
              refreshInFlight = null;
            });
        }

        // tokens = { accessToken, refreshToken }
        const tokens = await refreshInFlight;
        setTokens(tokens);

        // Повторяем исходный запрос уже с новым accessToken
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        // refresh не сработал → чистим токены и "отдаём" ошибку наверх
        clearTokens();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);