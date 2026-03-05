# Демо‑проект к практикам 3–4 (Frontend + Backend)

Этот репозиторий — **заготовка** для практических:
- **Практика 3:** JSON + API + Postman (свой API + внешнее API)
- **Практика 4:** React + API (frontend ↔ backend)

## Структура
- `backend/` — Express API (CRUD /api/products)
- `frontend/` — React (Vite) клиент
- `docs/student-handout.md` — методичка для студентов
- `docs/teacher-notes.md` — заметки для преподавателя

## Быстрый старт
### 1) Backend
```bash
cd backend
npm i
npm run dev
```
API: `http://localhost:3000`

### 2) Frontend (React)
```bash
cd frontend
npm i
npm run dev
```
UI: `http://localhost:3001`

## Проверка API
- Рекомендуется: Postman
- Запасной вариант: `backend/api.http` (VS Code + REST Client)
