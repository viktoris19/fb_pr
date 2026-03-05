# FB-4-2026-pr1-2-starter

## Студентам — как забрать проект и что сдавать

Репозиторий: https://github.com/ZagorodnikhNick/FB-4-2026-pr1-2-starter.git

1. Заберите код одним из способов:

- **Clone (рекомендуется):**
  ```bash
  git clone https://github.com/ZagorodnikhNick/FB-4-2026-pr1-2-starter.git
  ```
- **Download ZIP:** `Code → Download ZIP` (распаковать на компьютере)

2. Для сдачи: сделайте **свой репозиторий** (fork/import/новый репо) и сдайте **ссылку на свой репозиторий**.

---

## Практика 1 — SASS/LESS (карточка товара)

### Запуск

```bash
cd frontend
npm i
npm run watch:sass
```

### Открыть в браузере

Откройте `frontend/index.html` (лучше через Live Server).

---

## Практика 2 — Node.js + Express (CRUD API)

### Запуск сервера

```bash
cd backend
npm i
npm run dev
```

### База URL

`http://localhost:3000`

---

## Postman — как проверить API (быстро)

Вот тут более подробно про Postman - https://github.com/dv0retsky/fastapi-tutorial/blob/main/FAPI4_Postman/FAPI4_Postman.md

### 1) Создайте переменную baseUrl (рекомендуется)

**Вариант A (Environment):**

1. Postman → **Environments** → **Create environment**
2. Name: `Local`
3. Variable: `baseUrl` → Initial/Current value: `http://localhost:3000`
4. Сохраните и выберите окружение `Local` сверху справа.

**Вариант B (без окружений):** просто используйте URL целиком в каждом запросе.

### 2) Создайте коллекцию и запросы

1. Postman → **Collections** → **New Collection**
2. Название: `FB pr1-2`
3. Внутри коллекции создайте 5 запросов (New Request) и сохраните.

---

## Postman — эндпоинты и шаблоны запросов

> Если вы используете окружение, пишите URL как `{baseUrl}/...`

### 1) Получить все товары

**Method:** GET  
**URL:** `{baseUrl}/api/products`

Ожидаемо: `200 OK` и массив товаров.

---

### 2) Получить товар по id

**Method:** GET  
**URL:** `{baseUrl}/api/products/1`

Ожидаемо:

- `200 OK` и объект товара
- или `404 Not Found`, если такого id нет.

---

### 3) Создать товар

**Method:** POST  
**URL:** `{baseUrl}/api/products`

**Headers:**

- `Content-Type: application/json`

**Body → raw → JSON:**

```json
{
  "title": "Печенье",
  "price": 79
}
```

Ожидаемо: `201 Created` и созданный объект (с новым `id`).

---

### 4) Частично обновить товар

**Method:** PATCH  
**URL:** `{baseUrl}/api/products/1`

**Headers:**

- `Content-Type: application/json`

**Body → raw → JSON (пример):**

```json
{
  "price": 250
}
```

Ожидаемо:

- `200 OK` и обновлённый объект
- или `404 Not Found`, если id нет.

---

### 5) Удалить товар

**Method:** DELETE  
**URL:** `{baseUrl}/api/products/2`

Ожидаемо:

- `200 OK` и `{ "ok": true }`
- или `404 Not Found`, если id нет.

---

## Где смотреть код

- Практика 1: `frontend/styles/main.scss`
- Практика 2: `backend/app.js`, `backend/routes/products.js`
