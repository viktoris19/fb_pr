import { api, setTokens, clearTokens } from "./apiClient";

/**
 * authApi.js — "тонкий слой" над /api/auth/...
 * Здесь нет UI: только сетевые вызовы и работа с токенами.
 *
 * Практики 9–10:
 * - Практика 9: login возвращает ПАРУ токенов (accessToken + refreshToken),
 *   и мы обязаны сохранить их на клиенте (setTokens → localStorage).
 * - Практика 10: дальше токены используются автоматически через axios interceptors
 *   в apiClient.js (Authorization подставляется без ручного кода в каждом запросе).
 */

/**
 * async означает:
 * “эта функция делает запрос в сеть и вернёт результат не сразу, а чуть позже”.
 * Технически async-функция всегда возвращает Promise (обещание результата).
 * await означает: “подожди, пока запрос завершится, и только потом продолжай”
 */

export async function registerUser(payload) {
  // payload: { email, first_name, last_name, password }
  // Регистрация токены НЕ выдаёт (в учебной логике токены выдаются на login).
  return (await api.post("/auth/register", payload)).data;
}

export async function loginUser(payload) {
  // payload: { email, password }

  // Практика 9: сервер отдаёт { accessToken, refreshToken }
  const data = (await api.post("/auth/login", payload)).data;

  // Практика 10: сохраняем пару токенов в localStorage.
  // После этого request interceptor начнёт автоматически подставлять Authorization во все запросы через `api`.
  setTokens(data);

  return data;
}

export async function logoutUser() {
  // Учебный "logout" (Практика 10):
  // - на сервер ничего не отправляем
  // - просто удаляем токены из localStorage
  // (в реальных проектах часто ещё делают отзыв refresh-токена на сервере)
  clearTokens();
}

export async function getMe() {
  // Практика 10:
  // Мы НЕ пишем сюда токен руками.
  // request interceptor в apiClient.js автоматически добавит:
  // Authorization: Bearer <accessToken>
  return (await api.get("/auth/me")).data;
}