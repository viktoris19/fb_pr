const express = require("express");
const cors = require("cors");

// Swagger (OpenAPI)
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Наши модули
const logger = require("./middleware/logger");
const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Конвейер обработки запроса (pipeline) в Express:
 * - middleware выполняются сверху вниз
 * - затем роуты (router.get/post/...)
 * - если никто не ответил, доходим до 404
 *
 * Важно:
 * Порядок app.use(...) имеет значение.
 */

// 1) CORS: разрешаем браузеру (React dev server) ходить на API.
// Если фронт стартует на другом порту (например 5173), добавьте его сюда.
app.use(
  cors({
    origin: "http://localhost:3001",
  })
);

// 2) JSON parser: без этого req.body будет undefined
app.use(express.json());

// 3) Логирование запросов (для отладки)
app.use(logger);

/**
 * Swagger/OpenAPI:
 * - swagger-jsdoc читает JSDoc-комментарии @swagger в routes/*.js
 * - генерирует OpenAPI JSON (спеку)
 * - swagger-ui-express показывает UI на /api-docs
 *
 * bearerAuth нужен, чтобы Swagger UI умел подставлять JWT через кнопку Authorize.
 */
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Products API",
      version: "1.0.0",
      description: "Учебный REST API (товары + аутентификация) для практик 7–8",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Локальный сервер",
      },
    ],
  },
  apis: ["./routes/*.js", "./middleware/*.js", "./app.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// UI документации
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Healthcheck: быстрый индикатор “сервер жив”
app.get("/", (req, res) => {
  res.send("Express API is running. Try /api/products");
});

/**
 * Роуты API:
 * - /api/auth     — регистрация, логин, me
 * - /api/products — CRUD товаров
 */
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);

// Error handler: если в async-роуте случилась ошибка — вернём 500, а не “упадём”
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404: если ни один маршрут не подошёл
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});