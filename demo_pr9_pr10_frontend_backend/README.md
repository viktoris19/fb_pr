# Starter: Практики 7–10 — Аутентификация + Refresh-токены + хранение токенов на фронте

Этот репозиторий — **учебная заготовка** (не готовое решение) для практик 7–10:

- **Практики 7–8:** регистрация/вход, `bcrypt`, `JWT`, защищённые маршруты
- **Практика 9:** `refreshToken`, маршрут `POST /api/auth/refresh`, обновление пары токенов
- **Практика 10:** фронтенд (React) + хранение токенов на клиенте + `axios interceptors`  
  (автоподстановка токена и авто-refresh при 401)

Важно: **CRUD товаров не является целью практик 9–10. Вы это должны были уже реализовать на практиках ранее**  
Товары используются как “защищённый ресурс” для проверки JWT и refresh-механизма.

---

## Быстрый старт

### Backend

```bash
cd backend
npm i
npm run dev

	•	API: http://localhost:3000
	•	Swagger UI: http://localhost:3000/api-docs

Frontend (React, Vite)

cd frontend
npm i
npm run dev

	•	Frontend: http://localhost:3001

⸻

Что внутри (структура)

Backend
	•	backend/app.js — точка входа, CORS, Swagger, роуты
	•	backend/middleware/authJwt.js — проверка Authorization: Bearer <accessToken> + константы TTL/секреты (учебные)
	•	backend/routes/auth.js — register, login (возвращает accessToken + refreshToken), refresh, me
	•	backend/routes/products.js — маршруты товаров (часть защищена authMiddleware)
	•	backend/store/productsStore.js — хранение товаров в JSON (backend/data/products.json)
	•	backend/data/products.seed.json — стартовые данные (seed)

Frontend
	•	frontend/src/api/apiClient.js — axios instance + interceptors
	•	request: подстановка Authorization
	•	response: при 401 → refresh → повтор исходного запроса
	•	frontend/src/api/authApi.js — register/login/me (токены хранятся в localStorage)
	•	frontend/src/api/productsApi.js — запросы к товарам (используются для проверки защищённых маршрутов)
	•	frontend/src/App.jsx — простой UI: login/register + кнопка проверки защищённого запроса / список товаров (минимально)

Docs
	•	docs/student-handout.md — методички + пояснения по реализации учебной заготовки и TODO студентам (практики 9–10)

⸻

Важные примечания (учебные упрощения)
	1.	Пользователи в учебной версии хранятся в памяти процесса (users[]):

	•	при перезапуске backend пользователи “пропадают”

	2.	Товары хранятся в JSON:

	•	backend/data/products.json — рабочий файл (обычно в .gitignore)
	•	если файла нет — он создаётся из backend/data/products.seed.json

⸻

Проверка API
	•	Swagger UI: http://localhost:3000/api-docs
	•	backend/api.http (VS Code + REST Client)
	•	Postman/Insomnia

⸻

TODO студентам (что обязательно к сдаче по 9–10)

Практика 9 (refresh)
	•	POST /api/auth/login возвращает два токена: accessToken, refreshToken
	•	POST /api/auth/refresh возвращает новую пару токенов
	•	refresh-токен читается из заголовка и/или тела запроса (как договорено в группе)
	•	тестирование через Swagger/Postman

Практика 10 (клиент)
	•	login/register UI
	•	хранение accessToken и refreshToken в localStorage
	•	axios interceptor:
	•	подставляет Authorization: Bearer <accessToken>
	•	при 401 делает refresh и повторяет исходный запрос
	•	проверка на защите:
	•	подменить accessToken на мусор → увидеть 401 → авто-refresh → повтор → 200

Практика 10 (дополнительно)
	•	в рамках дополнительного (не основного) задания можете реализовать хранение <accessToken> в HttpOnly куках

⸻

```
