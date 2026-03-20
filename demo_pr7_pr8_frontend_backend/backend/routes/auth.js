const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");

const { authMiddleware, JWT_SECRET } = require("../middleware/authJwt");

const router = express.Router();

/**
 * Учебное хранилище пользователей.
 * Здесь НЕТ базы данных: пользователи живут в памяти процесса Node.js.
 *
 * Важно:
 * - После перезапуска сервера массив users очищается.
 * - В реальных проектах вместо users[] будет БД (Postgres, Mongo, SQLite) или файл.
 * - В users[] мы НЕ храним пароль, только bcrypt-хеш (passwordHash).
 */
const users = [];

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Регистрация и вход (практики 7–8)
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
  const { email, first_name, last_name, password } = req.body;

  // 2) УСИЛЕННАЯ ВАЛИДАЦИЯ: все поля обязательны, проверка формата email, длины пароля
  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({
      error: "validation_error",
      message: "Нужны поля: email, first_name, last_name, password",
    });
  }

  // Проверка формата email (регулярное выражение)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: "validation_error",
      message: "Некорректный формат email",
    });
  }

  // Проверка длины пароля (минимум 6 символов)
  if (password.length < 6) {
    return res.status(400).json({
      error: "validation_error",
      message: "Пароль должен содержать минимум 6 символов",
    });
  }

  // Проверка, что имя и фамилия не пустые после trim
  if (!first_name.trim() || !last_name.trim()) {
    return res.status(400).json({
      error: "validation_error",
      message: "Имя и фамилия не могут быть пустыми",
    });
  }

  // 3) Проверяем, что пользователь с таким email ещё не зарегистрирован
  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = users.find((u) => u.email === normalizedEmail);
  if (exists) {
    return res.status(400).json({
      error: "user_exists",
      message: "Пользователь с таким email уже зарегистрирован",
    });
  }

  // 4) bcrypt.hash — это “солёный” хеш пароля.
  // 10 — cost factor (сколько “тяжело” считать хеш). Чем больше, тем медленнее, но безопаснее.
  const passwordHash = await bcrypt.hash(String(password), 10);

  // 5) Создаём пользователя (id — случайный)
  const user = {
    id: nanoid(8),
    email: normalizedEmail,
    first_name: String(first_name).trim(),
    last_name: String(last_name).trim(),
    passwordHash, // ВАЖНО: храним только хеш, не пароль
  };

  // 6) Сохраняем в "учебное хранилище" (память)
  users.push(user);

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
 *     description: Проверяет пароль и возвращает accessToken (JWT).
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
 *         description: Успешный вход (JWT выдан)
 *       401:
 *         description: Неверные учётные данные
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // 1) УСИЛЕННАЯ ПРОВЕРКА входных данных
  if (!email || !password) {
    return res.status(400).json({
      error: "validation_error",
      message: "Нужны поля: email, password",
    });
  }

  // 2) Находим пользователя по email
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = users.find((u) => u.email === normalizedEmail);
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

  // 4) JWT — это токен, который клиент кладёт в заголовок:
  // Authorization: Bearer <token>
  //
  // payload (то что попадет в токен):
  // - sub (subject) = id пользователя
  // - email = для удобства
  //
  // expiresIn: "15m" — токен протухнет через 15 минут
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

  // JWT_SECRET - Это ключ подписи.

  return res.json({ 
    accessToken,
    expiresIn: 15 * 60, // 15 минут в секундах (для фронтенда)
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  });
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
  const user = users.find((u) => u.id === userId);
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