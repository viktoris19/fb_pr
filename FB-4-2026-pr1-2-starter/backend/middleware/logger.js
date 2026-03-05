module.exports = function logger(req, res, next) {
  // Логируем метод + URL, чтобы студентам было видно, что реально прилетает на сервер
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
};
