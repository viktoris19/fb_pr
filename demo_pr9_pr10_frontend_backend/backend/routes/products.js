const express = require("express");
const { nanoid } = require("nanoid");
const { authMiddleware, requireRole } = require("../middleware/authJwt");

// JSON-store (лекция 2): чтение/запись товаров в backend/data/products.json
// Важно: products.json — локальное runtime-хранилище (в .gitignore), а стартовые данные — в products.seed.json
const productsStore = require("../store/productsStore");

const router = express.Router();

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
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный ID товара
 *         title:
 *           type: string
 *           description: Название товара
 *         category:
 *           type: string
 *           description: Категория товара
 *         description:
 *           type: string
 *           description: Описание товара
 *         price:
 *           type: number
 *           description: Цена товара
 *         stock:
 *           type: integer
 *           description: Количество на складе
 *         rating:
 *           type: number
 *           description: Рейтинг (опционально)
 *         imageUrl:
 *           type: string
 *           description: URL картинки (опционально)
 *       example:
 *         id: "p1"
 *         title: "Печенье"
 *         category: "Сладости"
 *         description: "Хрустящее печенье к чаю."
 *         price: 79
 *         stock: 20
 *         rating: 4.6
 *         imageUrl: ""
 */

/**
 * TODO (Практика 8 — JWT):
 * - Сейчас защищены: GET /api/products/:id, PUT /api/products/:id, DELETE /api/products/:id
 * - PATCH /api/products/:id сейчас НЕ защищён.
 *   Сделайте его защищённым так же, как PUT/DELETE:
 *     router.patch("/:id", authMiddleware, ...)
 *
 * TODO (Практика 5 — Swagger):
 * - Допишите Swagger-аннотации для:
 *   - GET /api/products/:id
 *   - PUT /api/products/:id
 *   - PATCH /api/products/:id
 *   - DELETE /api/products/:id
 * - Для защищённых маршрутов добавьте:
 *     security:
 *       - bearerAuth: []
 *
 * TODO (Практика 3 — качество API):
 * - Добавьте строгую валидацию входных данных:
 *   title/category/description/price/stock (+ корректные типы, NaN, отрицательные значения)
 * - Приведите ошибки к единому формату:
 *   { error: "code", message: "Сообщение на русском" }
 */

// GET /api/products — список товаров (публичный)
router.get("/", async (req, res, next) => {
  try {
    const list = await productsStore.readAll();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id — один товар (защищённый)
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const list = await productsStore.readAll();
    const product = list.find((p) => p.id === req.params.id) || null;

    if (!product) return res.status(404).json({ error: "product_not_found", message: "Товар не найден" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products — добавить товар (публичный)
router.post("/", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const { title, category, description, price, stock, rating, imageUrl } = req.body;

    // TODO (студентам): полноценная валидация, иначе можно сохранить "мусор"
    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "validation_error", message: "Поле title обязательно (строка)" });
    }

    const newProduct = {
      id: nanoid(8),
      title: title.trim(),
      category: typeof category === "string" ? category.trim() : "Без категории",
      description: typeof description === "string" ? description.trim() : "",
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      rating: rating !== undefined ? Number(rating) : undefined,
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
    };

    await productsStore.add(newProduct);
    res.status(201).json(newProduct);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — полное обновление (защищённый маршрут в Практике 8)
router.put("/:id", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    // Учебный вариант: используем patch под капотом.
    // TODO (студентам): реализовать строгий PUT (обязательные поля и типы)
    const updated = await productsStore.patch(req.params.id, req.body);

    if (!updated) return res.status(404).json({ error: "product_not_found", message: "Товар не найден" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id — частичное обновление (СЕЙЧАС НЕ ЗАЩИЩЁН, как TODO для Практики 8)
router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const updated = await productsStore.patch(req.params.id, req.body);

    if (!updated) return res.status(404).json({ error: "product_not_found", message: "Товар не найден" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id — удалить товар (защищённый)
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const ok = await productsStore.remove(req.params.id);

    if (!ok) return res.status(404).json({ error: "product_not_found", message: "Товар не найден" });

    // Обычно делают 204 No Content, но для наглядности вернём JSON
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
