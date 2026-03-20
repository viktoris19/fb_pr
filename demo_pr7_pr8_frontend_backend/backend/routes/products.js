const express = require("express");
const { nanoid } = require("nanoid");
const { authMiddleware } = require("../middleware/authJwt");

// JSON-store (лекция 2): чтение/запись товаров в backend/data/products.json
// Важно: products.json — локальное runtime-хранилище (в .gitignore), а стартовые данные — в products.seed.json
const productsStore = require("../store/productsStore");

const router = express.Router();

/**
 * Вспомогательные функции валидации
 */
function isValidNumber(value, min = 0) {
  const num = Number(value);
  return !isNaN(num) && num >= min;
}

function isValidString(value, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}

/**
 * products.js — маршруты (routes) для работы с товарами
 *
 * Как читать этот файл:
 * 1) Сверху подключаем зависимости (Express, nanoid, authMiddleware, productsStore).
 * 2) Создаём router = "мини-приложение" Express, куда складываем эндпоинты.
 * 3) Работаем с данными через productsStore (JSON-файл), а не через in-memory массив.
 *
 * Важно про хранение (лекция 2):
 * - productsStore.readAll() читает backend/data/products.json
 * - productsStore.add/patch/remove записывают изменения в products.json
 * - если products.json ещё не существует, store создаст его из products.seed.json
 *
 * Важно про "защиту" (Практика 8):
 * - authMiddleware проверяет JWT токен из заголовка:
 *   Authorization: Bearer <token>
 * - Если токена нет/он неверный → 401.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - title
 *         - price
 *         - stock
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный ID товара
 *           example: "p1"
 *         title:
 *           type: string
 *           description: Название товара
 *           example: "Печенье"
 *         category:
 *           type: string
 *           description: Категория товара
 *           example: "Сладости"
 *         description:
 *           type: string
 *           description: Описание товара
 *           example: "Хрустящее печенье к чаю."
 *         price:
 *           type: number
 *           description: Цена товара
 *           example: 79
 *         stock:
 *           type: integer
 *           description: Количество на складе
 *           example: 20
 *         rating:
 *           type: number
 *           description: Рейтинг (опционально, 0-5)
 *           example: 4.6
 *         imageUrl:
 *           type: string
 *           description: URL картинки (опционально)
 *           example: ""
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// ==================== ПУБЛИЧНЫЕ МАРШРУТЫ ====================

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Успешный ответ со списком товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get("/", async (req, res, next) => {
  try {
    const list = await productsStore.readAll();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать новый товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - price
 *               - stock
 *             properties:
 *               title:
 *                 type: string
 *                 description: Название товара
 *                 example: "Печенье"
 *               category:
 *                 type: string
 *                 description: Категория товара
 *                 example: "Сладости"
 *               description:
 *                 type: string
 *                 description: Описание товара
 *                 example: "Хрустящее печенье к чаю."
 *               price:
 *                 type: number
 *                 description: Цена товара (положительное число)
 *                 example: 79
 *               stock:
 *                 type: integer
 *                 description: Количество на складе (неотрицательное)
 *                 example: 20
 *               rating:
 *                 type: number
 *                 description: Рейтинг (0-5)
 *                 example: 4.6
 *               imageUrl:
 *                 type: string
 *                 description: Ссылка на изображение
 *                 example: ""
 *     responses:
 *       201:
 *         description: Товар успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка валидации
 */
router.post("/", async (req, res, next) => {
  try {
    const { title, category, description, price, stock, rating, imageUrl } = req.body;
    
    // УСИЛЕННАЯ ВАЛИДАЦИЯ
    const errors = [];

    // Проверка title (обязательное, непустая строка)
    if (!isValidString(title)) {
      errors.push("Поле title обязательно и должно быть непустой строкой");
    }

    // Проверка price (обязательное, положительное число)
    if (price === undefined || !isValidNumber(price, 0.01)) {
      errors.push("Поле price обязательно и должно быть положительным числом");
    }

    // Проверка stock (обязательное, неотрицательное целое число)
    if (stock === undefined || !isValidNumber(stock, 0) || !Number.isInteger(Number(stock))) {
      errors.push("Поле stock обязательно и должно быть неотрицательным целым числом");
    }

    // Проверка category (опциональное, но если есть — строка)
    if (category !== undefined && !isValidString(category)) {
      errors.push("Поле category, если указано, должно быть непустой строкой");
    }

    // Проверка description (опциональное, но если есть — строка)
    if (description !== undefined && !isValidString(description)) {
      errors.push("Поле description, если указано, должно быть непустой строкой");
    }

    // Проверка rating (опциональное, от 0 до 5)
    if (rating !== undefined) {
      if (!isValidNumber(rating, 0) || Number(rating) > 5) {
        errors.push("Поле rating, если указано, должно быть числом от 0 до 5");
      }
    }

    // Если есть ошибки валидации
    if (errors.length > 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "Ошибка валидации данных",
        details: errors
      });
    }

    const newProduct = {
      id: nanoid(8),
      title: title.trim(),
      category: typeof category === "string" && category.trim() ? category.trim() : "Без категории",
      description: typeof description === "string" ? description.trim() : "",
      price: Number(price),
      stock: Number(stock),
      rating: rating !== undefined ? Number(rating) : undefined,
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
    };

    await productsStore.add(newProduct);
    res.status(201).json(newProduct);
  } catch (err) {
    next(err);
  }
});

// ==================== ЗАЩИЩЁННЫЕ МАРШРУТЫ (требуют JWT) ====================

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара
 *         example: "p1"
 *     responses:
 *       200:
 *         description: Товар найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Не авторизован (нет или неверный JWT)
 *       404:
 *         description: Товар не найден
 */
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const list = await productsStore.readAll();
    const product = list.find((p) => p.id === req.params.id) || null;

    if (!product) {
      return res.status(404).json({ 
        error: "product_not_found", 
        message: "Товар не найден" 
      });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Полное обновление товара (заменяет все поля)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара
 *         example: "p1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - price
 *               - stock
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Печенье"
 *               category:
 *                 type: string
 *                 example: "Сладости"
 *               description:
 *                 type: string
 *                 example: "Хрустящее печенье к чаю."
 *               price:
 *                 type: number
 *                 example: 79
 *               stock:
 *                 type: integer
 *                 example: 20
 *               rating:
 *                 type: number
 *                 example: 4.6
 *               imageUrl:
 *                 type: string
 *                 example: ""
 *     responses:
 *       200:
 *         description: Товар обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { title, category, description, price, stock, rating, imageUrl } = req.body;
    
    // СТРОГАЯ ВАЛИДАЦИЯ ДЛЯ PUT (все поля обязательны)
    const errors = [];

    // Проверка title (обязательное)
    if (!isValidString(title)) {
      errors.push("Поле title обязательно и должно быть непустой строкой");
    }

    // Проверка price (обязательное, положительное число)
    if (price === undefined || !isValidNumber(price, 0.01)) {
      errors.push("Поле price обязательно и должно быть положительным числом");
    }

    // Проверка stock (обязательное, неотрицательное целое число)
    if (stock === undefined || !isValidNumber(stock, 0) || !Number.isInteger(Number(stock))) {
      errors.push("Поле stock обязательно и должно быть неотрицательным целым числом");
    }

    // Проверка category (опциональное, но если есть — строка)
    if (category !== undefined && !isValidString(category)) {
      errors.push("Поле category, если указано, должно быть непустой строкой");
    }

    // Проверка rating (опциональное, от 0 до 5)
    if (rating !== undefined && (!isValidNumber(rating, 0) || Number(rating) > 5)) {
      errors.push("Поле rating, если указано, должно быть числом от 0 до 5");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "Ошибка валидации данных",
        details: errors
      });
    }

    const updatedData = {
      title: title.trim(),
      category: typeof category === "string" && category.trim() ? category.trim() : "Без категории",
      description: typeof description === "string" ? description.trim() : "",
      price: Number(price),
      stock: Number(stock),
      rating: rating !== undefined ? Number(rating) : undefined,
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
    };

    const updated = await productsStore.patch(req.params.id, updatedData);

    if (!updated) {
      return res.status(404).json({ 
        error: "product_not_found", 
        message: "Товар не найден" 
      });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Частичное обновление товара (только переданные поля)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара
 *         example: "p1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Новое название"
 *               category:
 *                 type: string
 *                 example: "Новая категория"
 *               description:
 *                 type: string
 *                 example: "Новое описание"
 *               price:
 *                 type: number
 *                 example: 99
 *               stock:
 *                 type: integer
 *                 example: 15
 *               rating:
 *                 type: number
 *                 example: 4.5
 *               imageUrl:
 *                 type: string
 *                 example: "http://example.com/image.jpg"
 *     responses:
 *       200:
 *         description: Товар обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
router.patch("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { title, category, description, price, stock, rating, imageUrl } = req.body;
    
    // ВАЛИДАЦИЯ ДЛЯ PATCH (проверяем только переданные поля)
    const errors = [];
    const updateData = {};

    if (title !== undefined) {
      if (!isValidString(title)) {
        errors.push("Поле title должно быть непустой строкой");
      } else {
        updateData.title = title.trim();
      }
    }

    if (category !== undefined) {
      if (!isValidString(category)) {
        errors.push("Поле category должно быть непустой строкой");
      } else {
        updateData.category = category.trim();
      }
    }

    if (description !== undefined) {
      if (!isValidString(description)) {
        errors.push("Поле description должно быть непустой строкой");
      } else {
        updateData.description = description.trim();
      }
    }

    if (price !== undefined) {
      if (!isValidNumber(price, 0.01)) {
        errors.push("Поле price должно быть положительным числом");
      } else {
        updateData.price = Number(price);
      }
    }

    if (stock !== undefined) {
      if (!isValidNumber(stock, 0) || !Number.isInteger(Number(stock))) {
        errors.push("Поле stock должно быть неотрицательным целым числом");
      } else {
        updateData.stock = Number(stock);
      }
    }

    if (rating !== undefined) {
      if (!isValidNumber(rating, 0) || Number(rating) > 5) {
        errors.push("Поле rating должно быть числом от 0 до 5");
      } else {
        updateData.rating = Number(rating);
      }
    }

    if (imageUrl !== undefined) {
      if (typeof imageUrl !== "string") {
        errors.push("Поле imageUrl должно быть строкой");
      } else {
        updateData.imageUrl = imageUrl.trim();
      }
    }

    // Если нет данных для обновления
    if (Object.keys(updateData).length === 0 && errors.length === 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "Нет данных для обновления"
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "Ошибка валидации данных",
        details: errors
      });
    }

    const updated = await productsStore.patch(req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ 
        error: "product_not_found", 
        message: "Товар не найден" 
      });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара для удаления
 *         example: "p1"
 *     responses:
 *       200:
 *         description: Товар успешно удалён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const ok = await productsStore.remove(req.params.id);

    if (!ok) {
      return res.status(404).json({ 
        error: "product_not_found", 
        message: "Товар не найден" 
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;