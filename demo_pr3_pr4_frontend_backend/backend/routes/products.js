const express = require("express");
const { nanoid } = require("nanoid");

const router = express.Router();

let products = require("../data/products");

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - price
 *         - stock
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный идентификатор товара
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
 *           example: "Хрустящее печенье к чаю. 200г"
 *         price:
 *           type: number
 *           description: Цена товара в рублях
 *           example: 79
 *         stock:
 *           type: integer
 *           description: Количество на складе
 *           example: 20
 *         rating:
 *           type: number
 *           description: Рейтинг товара (0-5)
 *           example: 4.6
 *         imageUrl:
 *           type: string
 *           description: Ссылка на изображение
 *           example: ""
 */

/**
 * Вспомогательная функция: найти товар по id (id строковый)
 */
function findById(id) {
  return products.find((p) => p.id === id) || null;
}

function isValidNumber(value, min = 0) {
  const num = Number(value);
  return !isNaN(num) && num >= min;
}

function isValidString(value, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}

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
router.get("/", (req, res) => {
  res.status(200).json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара (например, p1)
 *         example: "p1"
 *     responses:
 *       200:
 *         description: Товар найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Product not found"
 *                 message:
 *                   type: string
 *                   example: "Товар с ID p1 не найден"
 */
router.get("/:id", (req, res) => {
  const product = findById(req.params.id);
  if (!product) {
    return res.status(404).json({ 
      error: "Product not found",
      message: `Товар с ID ${req.params.id} не найден`
    });
  }
  res.status(200).json(product);
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
 *                 description: Название товара (обязательно)
 *                 example: "Кофе"
 *               category:
 *                 type: string
 *                 description: Категория товара
 *                 example: "Напитки"
 *               description:
 *                 type: string
 *                 description: Описание товара
 *                 example: "Молотый кофе, 250г"
 *               price:
 *                 type: number
 *                 description: Цена товара (обязательно, положительное число)
 *                 example: 450
 *               stock:
 *                 type: integer
 *                 description: Количество на складе (обязательно, неотрицательное целое)
 *                 example: 15
 *               rating:
 *                 type: number
 *                 description: Рейтинг товара (0-5)
 *                 example: 4.8
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Validation failed"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [
 *                     "title is required and must be a non-empty string",
 *                     "price is required and must be a positive number"
 *                   ]
 */
router.post("/", (req, res) => {
  const { title, category, description, price, stock, rating, imageUrl } = req.body;
  
  // Валидация обязательных полей
  const errors = [];

  // Проверка title (обязательное)
  if (!isValidString(title)) {
    errors.push("title is required and must be a non-empty string");
  }

  // Проверка price (обязательное, положительное число)
  if (price === undefined || !isValidNumber(price, 0.01)) {
    errors.push("price is required and must be a positive number");
  }

  // Проверка stock (обязательное, неотрицательное целое число)
  if (stock === undefined || !isValidNumber(stock, 0) || !Number.isInteger(Number(stock))) {
    errors.push("stock is required and must be a non-negative integer");
  }

  // Проверка category (опциональное, но если есть - должна быть строкой)
  if (category !== undefined && !isValidString(category)) {
    errors.push("category must be a non-empty string if provided");
  }

  // Проверка description (опциональное, но если есть - должна быть строкой)
  if (description !== undefined && !isValidString(description)) {
    errors.push("description must be a non-empty string if provided");
  }

  // Проверка rating (опциональное, должно быть от 0 до 5)
  if (rating !== undefined) {
    if (!isValidNumber(rating, 0) || Number(rating) > 5) {
      errors.push("rating must be a number between 0 and 5 if provided");
    }
  }

  // Если есть ошибки валидации - возвращаем 400
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: "Validation failed",
      details: errors 
    });
  }

  const newProduct = {
    id: nanoid(8),
    title: title.trim(),
    category: typeof category === "string" ? category.trim() : "Без категории",
    description: typeof description === "string" ? description.trim() : "",
    price: Number(price),
    stock: Number(stock),
    rating: rating !== undefined ? Number(rating) : undefined,
    imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Частичное обновление товара
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара для обновления
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
 *                 description: Новое название товара
 *                 example: "Печенье сдобное"
 *               category:
 *                 type: string
 *                 description: Новая категория
 *                 example: "Сладости"
 *               description:
 *                 type: string
 *                 description: Новое описание
 *                 example: "Обновленное описание товара"
 *               price:
 *                 type: number
 *                 description: Новая цена
 *                 example: 89
 *               stock:
 *                 type: integer
 *                 description: Новое количество на складе
 *                 example: 18
 *               rating:
 *                 type: number
 *                 description: Новый рейтинг
 *                 example: 4.7
 *               imageUrl:
 *                 type: string
 *                 description: Новая ссылка на изображение
 *                 example: "http://example.com/image.jpg"
 *     responses:
 *       200:
 *         description: Товар успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Validation failed"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["price must be a positive number"]
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Product not found"
 */
router.patch("/:id", (req, res) => {
  const product = findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { title, category, description, price, stock, rating, imageUrl } = req.body;

  const errors = [];

  // Если title передан - проверяем
  if (title !== undefined) {
    if (!isValidString(title)) {
      errors.push("title must be a non-empty string");
    } else {
      product.title = title.trim();
    }
  }

  // Если category передан - проверяем
  if (category !== undefined) {
    if (!isValidString(category)) {
      errors.push("category must be a non-empty string");
    } else {
      product.category = category.trim();
    }
  }

  // Если description передан - проверяем
  if (description !== undefined) {
    if (!isValidString(description)) {
      errors.push("description must be a non-empty string");
    } else {
      product.description = description.trim();
    }
  }

  // Если price передан - проверяем
  if (price !== undefined) {
    if (!isValidNumber(price, 0.01)) {
      errors.push("price must be a positive number");
    } else {
      product.price = Number(price);
    }
  }

  // Если stock передан - проверяем
  if (stock !== undefined) {
    if (!isValidNumber(stock, 0) || !Number.isInteger(Number(stock))) {
      errors.push("stock must be a non-negative integer");
    } else {
      product.stock = Number(stock);
    }
  }

  // Если rating передан - проверяем
  if (rating !== undefined) {
    if (!isValidNumber(rating, 0) || Number(rating) > 5) {
      errors.push("rating must be a number between 0 and 5");
    } else {
      product.rating = Number(rating);
    }
  }

  // Если imageUrl передан - проверяем
  if (imageUrl !== undefined) {
    if (typeof imageUrl !== "string") {
      errors.push("imageUrl must be a string");
    } else {
      product.imageUrl = imageUrl.trim();
    }
  }

  // Если есть ошибки валидации - возвращаем 400
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: "Validation failed",
      details: errors 
    });
  }

  res.status(200).json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID товара для удаления
 *         example: "p1"
 *     responses:
 *       204:
 *         description: Товар успешно удален (нет содержимого)
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Product not found"
 */
router.delete("/:id", (req, res) => {
  const id = req.params.id;
  const before = products.length;
  products = products.filter((p) => p.id !== id);

  if (products.length === before) {
    return res.status(404).json({ error: "Product not found" });
  }

  res.status(204).send();
});

module.exports = router;