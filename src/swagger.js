import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Telegram MCP API',
      version: '1.0.0',
      description: 'MCP server для работы с Telegram API через MTProto протокол',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    components: {
      schemas: {
        Dialog: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Уникальный идентификатор диалога',
            },
            name: {
              type: 'string',
              description: 'Название диалога или имя пользователя',
            },
            unreadCount: {
              type: 'integer',
              description: 'Количество непрочитанных сообщений',
            },
            lastMessage: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'ID последнего сообщения',
                },
                text: {
                  type: 'string',
                  description: 'Текст последнего сообщения',
                },
                date: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Дата последнего сообщения',
                },
                senderId: {
                  type: 'string',
                  description: 'ID отправителя последнего сообщения',
                },
              },
            },
            isChannel: {
              type: 'boolean',
              description: 'Является ли диалог каналом',
            },
            isGroup: {
              type: 'boolean',
              description: 'Является ли диалог группой',
            },
            isUser: {
              type: 'boolean',
              description: 'Является ли диалог пользователем',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID сообщения',
            },
            text: {
              type: 'string',
              description: 'Текст сообщения',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Дата сообщения',
            },
            senderId: {
              type: 'string',
              description: 'ID отправителя',
            },
            replyToMsgId: {
              type: 'integer',
              description: 'ID сообщения, на которое отвечают',
              nullable: true,
            },
            isOutgoing: {
              type: 'boolean',
              description: 'Является ли сообщение исходящим',
            },
            media: {
              type: 'object',
              nullable: true,
              properties: {
                type: {
                  type: 'string',
                  description: 'Тип медиа (фото, видео и т.д.)',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Описание ошибки',
            },
          },
        },
      },
    },
  },
  apis: ['./src/index.js'], // Путь к файлам с аннотациями JSDoc
};

const specs = swaggerJsdoc(options);
export default specs; 