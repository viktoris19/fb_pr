const express = require("express");
const cors = require("cors");

const logger = require("./middleware/logger");
const productsRouter = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: разрешаем запросы с фронта (на практике можно обсудить CORS)
app.use(cors());

// Middleware: чтобы читать JSON из тела запроса (req.body)
app.use(express.json());

// Собственный logger для наглядности
app.use(logger);

// Healthcheck / главная
app.get("/", (req, res) => {
  res.send("Express API is running. Try /api/products");
});

// Роуты API
app.use("/api/products", productsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
