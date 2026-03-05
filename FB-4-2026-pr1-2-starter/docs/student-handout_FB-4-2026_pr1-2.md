# Методичка для студентов: практики 1–2 (SASS/LESS + Express CRUD)

---

## Практика 1. CSS-препроцессоры (SASS или LESS)

### Цель

Сделать **карточку товара** (название, описание, «фото/плашка») с применением:

- переменных (минимум 2),
- миксина (минимум 1),
- вложенной структуры селекторов. fileciteturn1file0

### Где делать

Папка: `frontend/`  
Файлы:

- исходник: `frontend/styles/main.scss` _(или_ `frontend/styles/main.less`_)_
- результат компиляции: `frontend/public/*.css`
- разметка: `frontend/index.html`

### Шаги

1. Откройте папку `frontend/`.
2. Установите зависимости:

```bash
npm i
```

3. Запустите компиляцию:

- SASS:

```bash
npm run watch:sass
```

- (опционально) LESS:

```bash
npm run watch:less
```

4. Откройте `frontend/index.html` в браузере (лучше через Live Server).
5. Измените карточку под **свой** товар:

- текст (название/описание),
- визуал (цвета/размеры/отступы),
- добавьте 1 элемент на выбор: **бейдж скидки**, **рейтинг**, **кнопку “В избранное”**, **состояние “нет в наличии”**.

### Критерии сдачи (минимум)

- В репозитории есть исходник `main.scss`/`main.less` + скомпилированный CSS в `public/`.
- В стилях используются **переменные**, **миксин**, **вложенность**.
- Карточка заметно отличается от стартёра (ваш товар + ваши стили).

---

## Практика 2. Node.js + Express: CRUD API для товаров

### Цель

Реализовать API, которое предоставляет CRUD-операции для списка товаров. fileciteturn1file1

Обязательные операции:

- GET `/api/products` — список
- GET `/api/products/:id` — один товар
- POST `/api/products` — добавить товар
- PATCH `/api/products/:id` — редактировать товар
- DELETE `/api/products/:id` — удалить товар fileciteturn1file1

**Объект товара (обязательные поля):**

- `id` — число
- `title` — название (строка)
- `price` — стоимость (число) fileciteturn1file1

**Чтобы работа не была “копипастой”:**
добавьте **1 дополнительное поле на выбор** и поддержите его в POST/PATCH/GET (например `category`, `inStock`, `description`, `vendor`).

### Где делать

Папка: `backend/`  
Файлы:

- старт сервера: `backend/app.js`
- роуты: `backend/routes/products.js`

### Запуск

1. Откройте папку `backend/`.
2. Установите зависимости:

```bash
npm i
```

3. Запустите сервер:

```bash
npm run dev
```

Сервер: `http://localhost:3000`

---

## Postman: проверка API (обязательно на защите)

Вот тут более подробно про Postman - https://github.com/dv0retsky/fastapi-tutorial/blob/main/FAPI4_Postman/FAPI4_Postman.md

### Быстрая настройка (рекомендуется)

1. Postman → **Environments** → **Create environment**
2. Name: `Local`
3. Variable: `baseUrl` = `http://localhost:3000`
4. Выберите окружение `Local` (справа сверху)

Далее используйте URL вида `{{baseUrl}}/api/products`.

### Запросы для проверки

1. **GET** `{{baseUrl}}/api/products`  
   Ожидаемо: `200 OK` + массив.

2. **POST** `{{baseUrl}}/api/products`  
   Headers: `Content-Type: application/json`  
   Body → raw → JSON:

```json
{
  "title": "Печенье",
  "price": 79
}
```

Ожидаемо: `201 Created` + объект с `id`.

3. **PATCH** `{{baseUrl}}/api/products/1`  
   Body → raw → JSON (пример):

```json
{
  "price": 250
}
```

Ожидаемо: `200 OK`.

4. **DELETE** `{{baseUrl}}/api/products/2`  
   Ожидаемо: `200 OK` и `{ "ok": true }` (или эквивалент).

### Что показывать на сдаче

**Сдача на паре:**

- показываете работающий сервер + 2–3 запроса в Postman (GET + POST + PATCH/DELETE) и ответы со статусами.

**Если сдаёте ссылкой (без демонстрации):**

- добавьте в репозиторий папку `docs/screens/` и положите 2–3 скриншота из Postman:
  - GET список (200),
  - POST создание (201),
  - PATCH или DELETE (200/204).

---

## Формат отчёта

Ссылка на **ваш** репозиторий (публичный), где есть:

- `frontend/` с исходниками препроцессора и результатом компиляции,
- `backend/` с рабочим CRUD API,
- (если нужно) `docs/screens/` со скриншотами Postman.
