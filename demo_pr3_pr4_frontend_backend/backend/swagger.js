const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API интернет-магазина',
      version: '1.0.0',
      description: 'Документация для практической работы №5',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Сервер для разработки',
      },
    ],
  },
  apis: ['./routes/*.js'], // указываем, где искать JSDoc комментарии
};

const specs = swaggerJsdoc(options);
module.exports = specs;