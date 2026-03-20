const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");

const {
  authMiddleware,
  JWT_SECRET,
  REFRESH_SECRET,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
} = require("../middleware/authJwt");

const router = express.Router();

/**
 * =========================
 * Практики 7–10: что делает этот файл
 * =========================
 *
 * Практики 7–8 (база):
 * - /register: создаём пользователя, пароль хешируем через bcrypt (пароль НЕ храним в открытом виде)
 * - /login: проверяем пароль (bcrypt.compare) и выдаём accessToken (JWT)
 * - /me: защищённый маршрут, возвращает текущего пользователя (по accessToken)
 *
 * Практика 9 (НОВОЕ):
 * - вводим refreshToken (долгоживущий токен)
 * - добавляем /refresh: по refreshToken выдаём НОВУЮ пару токенов
 * - реализуем "ротацию refresh-токенов": старый refresh становится недействительным, выдаём новый
 *
 * Практика 10 (НОВОЕ, но на фронте):
 * - клиент хранит accessToken + refreshToken (в учебной раелизации в localStorage)
 * - клиент автоматически подставляет accessToken в Authorization
 * - если сервер вернул 401 (access протух/невалиден) → клиент вызывает /refresh
 *   и повторяет исходный запрос уже с новым accessToken
 *
 * Кратко и по сути:
 * 1) login выдаёт токены
 * 2) me требует accessToken
 * 3) refresh выдаёт новую пару токенов
 * 4) на фронте это происходит автоматически (interceptors) — но этот файл обеспечивает бэкенд-логику
 */

/**
 * Учебное хранилище пользователей.
 * Здесь НЕТ базы данных: пользователи живут в памяти процесса Node.js.
 *
 * Важно:
 * - После перезапуска сервера массив users очищается.
 * - В реальных проектах вместо users[] будет БД (Postgres, Mongo, SQLite) или файл.
 * - В users[] мы НЕ храним пароль, только bcrypt-хеш (passwordHash).
 */
const userStore = require("../store/usersStore");

/**
 * Практика 9: хранилище refresh-токенов в памяти процесса (учебный вариант).
 *
 * Зачем это нужно:
 * - чтобы можно было "отзывать" refresh-токены
 * - чтобы реализовать ротацию: старый refresh удаляем, новый выдаём и сохраняем
 *
 * Ограничение учебного подхода:
 * - после перезапуска сервера Set очищается → старые refresh-токены "забываются"
 *
 * TODO (Практика 9+ дополнительное задание - не обязетльно для сдачи практики): заменить на БД/Redis, если усложняем проект.
 */
const refreshTokens = new Set();

/**
 * Практика 9: генерация accessToken и refreshToken
 * - accessToken: короткий срок жизни (ACCESS_EXPIRES_IN), используется для Authorization: Bearer ...
 * - refreshToken: более долгий срок жизни (REFRESH_EXPIRES_IN), используется только для обновления пары токенов
 *
 * Важно:
 * - access и refresh подписываются РАЗНЫМИ секретами (JWT_SECRET и REFRESH_SECRET),
 *   чтобы нельзя было использовать refresh как access (и наоборот).
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role},
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}
// expiresIn: ACCESS_EXPIRES_IN - это TTL (время жизни) accessToken - задаем в AuthGwt.js
//const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || "15m";

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}
// expiresIn: REFRESH_EXPIRES_IN - это TTL (время жизни) refreshToken - задаем в AuthGwt.js
// const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "7d"; 


/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Регистрация и вход (практики 7–10)
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     description: Создаёт пользователя и сохраняет пароль в виде bcrypt-хеша.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, first_name, last_name, password]
 *             properties:
 *               email: { type: string, example: "ivan@mail.ru" }
 *               first_name: { type: string, example: "Иван" }
 *               last_name: { type: string, example: "Иванов" }
 *               password: { type: string, example: "qwerty123" }
 *     responses:
 *       201:
 *         description: Пользователь создан
 *       400:
 *         description: Некорректные данные
 */
router.post("/register", async (req, res) => {
  // 1) Из тела запроса (JSON) берём поля пользователя
  // req.body появляется благодаря app.use(express.json()) в app.js
  const { email, first_name, last_name, password } = req.body;

  // 2) Минимальная валидация: все поля обязательны
  // TODO студентам: валидировать email-формат, длину пароля, пробелы и т.д.
  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({
      error: "validation_error",
      message: "Нужны поля: email, first_name, last_name, password",
    });
  }

  // 3) Проверяем, что пользователь с таким email ещё не зарегистрирован
  const normalizedEmail = String(email).toLowerCase();
  const exists = userStore.find((u) => u.email === normalizedEmail);
  if (exists) {
    return res.status(400).json({
      error: "user_exists",
      message: "Пользователь с таким email уже зарегистрирован",
    });
  }

  // 4) bcrypt.hash — это “солёный” хеш пароля.
  // 10 — cost factor (сколько “тяжело” считать хеш). Чем больше, тем медленнее, но безопаснее.
  // Соль библиотека делает автоматически и "зашивает" внутрь итогового хеша.
  // Пример хеша:
  //  $2b$10$KYVbZ5JFVfqu0oV98LnF5eTk4QTe2e4PQG7QNYfhumEpGdi/867AO
  //  |--|--|----------------------|-------------------------------|
  //  |  |           |                          |
  //  |  |           |                          └─ итоговый хеш
  //  |  |           └─ соль
  //  |  └─ cost factor
  //  └─ версия bcrypt
  const passwordHash = await bcrypt.hash(String(password), 10);
  // 10 — cost factor; определяет, насколько вычисление хеша будет тяжёлым.
  //  • 8  — быстрее
  //  • 10 — стандартно
  //  • 12 — медленнее
  //  • 14 — ещё тяжелее

  // 5) Создаём пользователя (id — случайный)
  const user = {
    id: nanoid(8),
    email: normalizedEmail,
    first_name: String(first_name),
    last_name: String(last_name),
    passwordHash,
    role: "user",
  };

  // 6) Сохраняем в "учебное хранилище" (память)
  userStore.push(user);

  // 7) Возвращаем публичные данные (НИКОГДА не возвращаем passwordHash клиенту)
  return res.status(201).json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     description: Проверяет пароль и возвращает пару токенов (access + refresh).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "ivan@mail.ru" }
 *               password: { type: string, example: "qwerty123" }
 *     responses:
 *       200:
 *         description: Успешный вход (токены выданы)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       400:
 *         description: Некорректные данные (не хватает email/password)
 *       401:
 *         description: Неверные учётные данные
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // 1) Базовая проверка входных данных
  if (!email || !password) {
    return res.status(400).json({
      error: "validation_error",
      message: "Нужны поля: email, password",
    });
  }

  // 2) Находим пользователя по email
  const normalizedEmail = String(email).toLowerCase();
  const user = userStore.find((u) => u.email === normalizedEmail);
  if (!user) {
    // Важно: одинаковая ошибка и для “нет пользователя”, и для “неверный пароль”
    // чтобы не давать атакующему понять, существует ли email.
    return res.status(401).json({
      error: "invalid_credentials",
      message: "Неверный email или пароль",
    });
  }

  // 3) bcrypt.compare сравнивает “введённый пароль” с “хешем из хранилища”
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({
      error: "invalid_credentials",
      message: "Неверный email или пароль",
    });
  }

  /**
   * Практики 7–8:
   * - accessToken используется для доступа к защищённым маршрутам:
   *   Authorization: Bearer <accessToken>
   *
   * Практика 9 (главное изменение):
   * - login теперь выдаёт ПАРУ токенов: accessToken + refreshToken
   * - refreshToken нужен, чтобы получать новый accessToken без повторного логина
   * - refreshToken мы сохраняем в refreshTokens (Set), чтобы можно было:
   *   - проверять, что токен не "отозван"
   *   - делать ротацию токенов в /refresh (старый удалить, новый выдать)
   */

  // 4) Генерируем токены согласно настройкам (секреты и TTL в middleware/authJwt.js)
  const accessToken = generateAccessToken(user);     // короткоживущий
  const refreshToken = generateRefreshToken(user);   // долгоживущий

  // 5) Сохраняем refreshToken в "whitelist" (учебное хранилище в памяти)
  // Если сервак перезапустить — Set очистится (это норм для учебного проекта)
  refreshTokens.add(refreshToken);

  // 6) Возвращаем пару токенов клиенту (Практика 9)
  return res.json({ accessToken, refreshToken });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление пары токенов (access + refresh)
 *     description: Принимает refresh-токен и возвращает новую пару токенов.
 *     tags: [Auth]
 *     parameters:
 *       - in: header
 *         name: x-refresh-token
 *         required: false
 *         schema: { type: string }
 *         description: Refresh-токен (учебный вариант). Можно также передать в body как refreshToken.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Новая пара токенов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       400:
 *         description: Не передан refresh-токен
 *       401:
 *         description: Refresh-токен невалиден/протух/не найден
 */
router.post("/refresh", (req, res) => {
  /**
   * Практика 9: refresh-токен
   *
   * По заданию refreshToken обычно передают из заголовков.
   * Для удобства проверки в Swagger/Postman поддерживаем два варианта:
   * 1) Заголовок: x-refresh-token: <token>
   * 2) Тело запроса: { "refreshToken": "<token>" }
   */
  const headerToken = req.headers["x-refresh-token"];
  const refreshToken = headerToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      error: "refresh_token_required",
      message: "Нужен refreshToken (в заголовке x-refresh-token или в теле запроса)",
    });
  }

  // 1) Проверяем, что refreshToken есть в нашем "хранилище" (Set).
  // Это позволяет отбрасывать старые/украденные/отозванные токены.
  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      error: "invalid_refresh_token",
      message: "Refresh-токен недействителен (не найден в хранилище)",
    });
  }

  try {
    // 2) Проверяем подпись и срок действия refresh-токена.
    // Важно: refresh проверяется через REFRESH_SECRET (а не JWT_SECRET).
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);

    // 3) Находим пользователя
    const user = userStore.find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({
        error: "user_not_found",
        message: "Пользователь не найден",
      });
    }

    // 4) Ротация refresh-токена (Практика 9):
    // - старый refresh удаляем
    // - выдаём новый refresh и сохраняем его
    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.add(newRefreshToken);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    // Если токен протух или подделан — удаляем его из Set (на всякий случай)
    refreshTokens.delete(refreshToken);
    return res.status(401).json({
      error: "refresh_token_invalid_or_expired",
      message: "Refresh-токен недействителен или срок действия истёк",
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Возвращает текущего пользователя (по JWT)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Пользователь
 *       401:
 *         description: Нет токена или токен невалиден
 */
router.get("/me", authMiddleware, (req, res) => {
  // authMiddleware уже проверил JWT и положил payload в req.user
  // req.user = { sub, email, iat, exp }
  const userId = req.user.sub;

  // В учебной версии ищем пользователя в памяти
  const user = userStore.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({
      error: "user_not_found",
      message: "Пользователь не найден",
    });
  }

  // Возвращаем “профиль”
  return res.json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

module.exports = router;