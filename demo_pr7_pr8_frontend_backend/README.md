# Starter: Практики 7–8 — Аутентификация (bcrypt + JWT)

Этот репозиторий — **учебная заготовка** для практик 7–8:

- Практика 7: регистрация и вход с **bcrypt** (пароль хранится как хеш)
- Практика 8: выдача **JWT**, middleware проверки токена, защищённые маршруты

## Быстрый старт

### Backend

```bash
cd backend
npm i
npm run dev
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/api-docs

### Проверка запросов

- Postman/Insomnia
- или файл `backend/api.http` (VS Code + REST Client)

## Что в коде уже есть, а что нужно дописать студентам

Есть (пример):

- `POST /api/auth/register`
- `POST /api/auth/login` (выдаёт JWT)
- `GET /api/auth/me` (JWT обязателен)
- CRUD для товаров (частично)

TODO студентам:

- усилить валидацию и статусы
- дописать/допривести к требованиям все маршруты (см. student-handout)
- задокументировать все маршруты в Swagger (OpenAPI)
- выполнить TODO в каждом файле проекта
- добавить refresh token

## Структура

- `backend/app.js` — точка входа, подключение Swagger, роуты
- `backend/routes/auth.js` — регистрация/вход/JWT/me
- `backend/middleware/authJwt.js` — проверка токена (Bearer)
- `backend/routes/products.js` — товары (часть маршрутов защищена)
- `docs/student-handout.md` — методичка для студентов
