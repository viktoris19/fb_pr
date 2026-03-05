const express = require("express");
const router = express.Router();

let products = require("../data/products");

// Вспомогательная функция: привести id к числу и найти товар
function findById(id) {
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  return products.find((p) => p.id === num) || null;
}

// GET /api/products — список товаров
router.get("/", (req, res) => {
  res.json(products);
});

// GET /api/products/:id — один товар
router.get("/:id", (req, res) => {
  const product = findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// POST /api/products — добавить товар
router.post("/", (req, res) => {
  const { title, price } = req.body;

  // Минимальная валидация 
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "title is required (string)" });
  }
  const numPrice = Number(price);
  if (Number.isNaN(numPrice) || numPrice < 0) {
    return res.status(400).json({ error: "price is required (number >= 0)" });
  }

  const nextId = products.length ? Math.max(...products.map((p) => p.id)) + 1 : 1;
  const newProduct = { id: nextId, title: title.trim(), price: numPrice };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

// PATCH /api/products/:id — частичное обновление
router.patch("/:id", (req, res) => {
  const product = findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { title, price } = req.body;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "title must be a non-empty string" });
    }
    product.title = title.trim();
  }

  if (price !== undefined) {
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: "price must be a number >= 0" });
    }
    product.price = numPrice;
  }

  res.json(product);
});

// DELETE /api/products/:id — удалить товар
router.delete("/:id", (req, res) => {
  const before = products.length;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "id must be a number" });

  products = products.filter((p) => p.id !== id);

  if (products.length === before) {
    return res.status(404).json({ error: "Product not found" });
  }

  // Вариант 1: вернуть 204 No Content (часто делают так)
  // return res.status(204).send();

  // Вариант 2: вернуть "ok" 
  res.json({ ok: true });
});

module.exports = router;
