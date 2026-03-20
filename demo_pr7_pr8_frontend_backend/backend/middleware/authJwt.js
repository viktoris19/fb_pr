const jwt = require("jsonwebtoken");

/**
 * JWT_SECRET — секретная строка, которой сервер:
 * 1) подписывает токен (jwt.sign)
 * 2) потом проверяет подпись токена (jwt.verify)
 *
 * Важно:
 * - Если поменять JWT_SECRET, то ВСЕ старые токены станут недействительными.
 * - В реальных проектах секрет хранится в переменных окружения (env), а не в коде.
 */
const JWT_SECRET = process.env.JWT_SECRET || "access_secret";
//берём process.env.JWT_SECRET, если он задан, иначе используем строку по умолчанию "access_secret"

/**
 * authMiddleware — "охранник" перед защищёнными маршрутами.
 *
 * Что он проверяет:
 * - клиент обязан прислать заголовок:
 *   Authorization: Bearer <token>
 *
 * Если всё ок:
 * - jwt.verify(token, JWT_SECRET) вернёт payload (то, что мы положили в jwt.sign)
 * - middleware кладёт payload в req.user
 * - вызывает next() → запрос идёт дальше в обработчик роутера
 *
 * Если не ок:
 * - возвращаем 401 и НЕ пускаем дальше
 */
function authMiddleware(req, res, next) {
  // Забираем заголовок Authorization (если его нет — будет пустая строка)
  const header = req.headers.authorization || "";

  // header должен быть вида: "Bearer eyJhbGciOi..."
  const [scheme, token] = header.split(" ");

  // 1) Нет "Bearer" или нет токена → сразу 401
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "auth_header_missing",
      message: "Нужен заголовок Authorization: Bearer <token>",
    });
  }

  try {
    // 2) Проверяем подпись токена и срок действия (exp)
    const payload = jwt.verify(token, JWT_SECRET);

    // payload — это объект, который мы подписали при логине.
    // Например: { sub: userId, email, iat, exp }
    req.user = payload;

    // 3) Пропускаем запрос дальше → к защищённому обработчику
    next();
  } catch (err) {
    // Сюда попадём, если токен:
    // - подделан
    // - протух (expired)
    // - подписан другим секретом
    return res.status(401).json({
      error: "token_invalid",
      message: "Токен недействителен или срок действия истёк",
    });
  }
}

module.exports = { authMiddleware, JWT_SECRET };