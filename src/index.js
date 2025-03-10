import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { executeMethod, getDialogs, getMessages, sendMessage } from './telegram.js';
import config from './config.js';
import logger from './logger.js';
import swaggerSpecs from './swagger.js';
import { handleMcpRequest, getMcpManifest } from './mcp.js';

const app = express();

// API metadata for external AI systems
const apiMetadata = {
  name: "Telegram MCP Server",
  version: "1.0.0",
  description: "Server for working with Telegram API via MTProto protocol",
  endpoints: [
    {
      path: "/",
      method: "GET",
      description: "Returns server status information",
      parameters: [],
      returns: {
        status: "String - Server status (OK)",
        version: "String - API version",
        message: "String - Status message"
      }
    },
    {
      path: "/api/execute",
      method: "POST",
      description: "Executes any Telegram API method",
      parameters: [
        {
          name: "session",
          type: "String",
          required: true,
          description: "Session identifier (phone number)"
        },
        {
          name: "method",
          type: "String",
          required: true,
          description: "Telegram API method name"
        },
        {
          name: "params",
          type: "Object",
          required: false,
          description: "Method parameters"
        }
      ],
      returns: {
        result: "Object - Result of the API method call"
      }
    },
    {
      path: "/api/dialogs",
      method: "GET",
      description: "Returns user's dialog list (chats)",
      parameters: [
        {
          name: "session",
          type: "String",
          required: true,
          description: "Session identifier (phone number)"
        },
        {
          name: "limit",
          type: "Number",
          required: false,
          description: "Maximum number of dialogs to return (default: 100)"
        }
      ],
      returns: {
        dialogs: "Array - List of dialog objects with metadata"
      }
    },
    {
      path: "/api/messages",
      method: "GET",
      description: "Returns messages from a chat",
      parameters: [
        {
          name: "session",
          type: "String",
          required: true,
          description: "Session identifier (phone number)"
        },
        {
          name: "chatId",
          type: "String|Number",
          required: true,
          description: "Chat ID or username"
        },
        {
          name: "limit",
          type: "Number",
          required: false,
          description: "Maximum number of messages to return (default: 100)"
        }
      ],
      returns: {
        messages: "Array - List of message objects"
      }
    },
    {
      path: "/api/send",
      method: "POST",
      description: "Sends a message to a chat",
      parameters: [
        {
          name: "session",
          type: "String",
          required: true,
          description: "Session identifier (phone number)"
        },
        {
          name: "chatId",
          type: "String|Number",
          required: true,
          description: "Chat ID or username"
        },
        {
          name: "message",
          type: "String",
          required: true,
          description: "Message text to send"
        }
      ],
      returns: {
        result: "Object - Information about the sent message"
      }
    },
    {
      path: "/api/metadata",
      method: "GET",
      description: "Returns API metadata for AI systems and other clients",
      parameters: [],
      returns: {
        metadata: "Object - Complete API metadata"
      }
    }
  ],
  telegramMethods: [
    "messages.getDialogs",
    "messages.getHistory",
    "messages.sendMessage",
    "auth.sendCode",
    "auth.signIn",
    "updates.getState",
    "updates.getDifference",
    "upload.saveFilePart",
    "messages.sendMedia"
    // This list can be expanded with more supported methods
  ],
  examples: {
    getDialogs: {
      request: {
        method: "GET",
        url: "/api/dialogs?session=+79001234567&limit=10"
      },
      response: {
        dialogs: [
          {
            id: 123456789,
            name: "Chat Name",
            unreadCount: 5,
            lastMessage: {
              id: 987654321,
              text: "Hello world",
              date: "2023-05-15T12:00:00Z",
              senderId: 12345
            },
            isChannel: false,
            isGroup: true,
            isUser: false
          }
        ]
      }
    },
    sendMessage: {
      request: {
        method: "POST",
        url: "/api/send",
        body: {
          session: "+79001234567",
          chatId: "username",
          message: "Hello, world!"
        }
      },
      response: {
        result: {
          id: 12345,
          text: "Hello, world!",
          date: "2023-05-15T12:05:00Z",
          isOutgoing: true
        }
      }
    }
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// MCP Routes
app.get('/mcp/manifest', (req, res) => {
  res.json(getMcpManifest());
});

app.post('/mcp/execute', handleMcpRequest);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Получение статуса сервера
 *     description: Возвращает информацию о статусе MCP сервера
 *     responses:
 *       200:
 *         description: Статус сервера
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 message:
 *                   type: string
 *                   example: Telegram MCP server is running
 */
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    message: 'Telegram MCP server is running'
  });
});

// Metadata endpoint for AI systems
app.get('/api/metadata', (req, res) => {
  res.json(apiMetadata);
});

// API description in OpenAPI format (for Swagger UI)
app.get('/api/openapi', (req, res) => {
  res.json({
    openapi: "3.0.0",
    info: {
      title: "Telegram MCP API",
      version: "1.0.0",
      description: "API for interacting with Telegram via MTProto"
    },
    paths: {
      "/": {
        get: {
          summary: "Server status",
          responses: {
            "200": {
              description: "Server status information"
            }
          }
        }
      },
      "/api/execute": {
        post: {
          summary: "Execute any Telegram API method",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["session", "method"],
                  properties: {
                    session: {
                      type: "string",
                      description: "Session identifier (phone number)"
                    },
                    method: {
                      type: "string",
                      description: "Telegram API method name"
                    },
                    params: {
                      type: "object",
                      description: "Method parameters"
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Result of the API method call"
            }
          }
        }
      },
      "/api/dialogs": {
        get: {
          summary: "Get user dialogs (chats)",
          parameters: [
            {
              name: "session",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "Session identifier (phone number)"
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 100
              },
              description: "Maximum number of dialogs to return"
            }
          ],
          responses: {
            "200": {
              description: "List of dialogs"
            }
          }
        }
      },
      "/api/messages": {
        get: {
          summary: "Get messages from a chat",
          parameters: [
            {
              name: "session",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "Session identifier (phone number)"
            },
            {
              name: "chatId",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "Chat ID or username"
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 100
              },
              description: "Maximum number of messages to return"
            }
          ],
          responses: {
            "200": {
              description: "List of messages"
            }
          }
        }
      },
      "/api/send": {
        post: {
          summary: "Send a message",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["session", "chatId", "message"],
                  properties: {
                    session: {
                      type: "string",
                      description: "Session identifier (phone number)"
                    },
                    chatId: {
                      type: "string",
                      description: "Chat ID or username"
                    },
                    message: {
                      type: "string",
                      description: "Message text"
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Sent message information"
            }
          }
        }
      }
    }
  });
});

/**
 * @swagger
 * /api/execute:
 *   post:
 *     summary: Выполнение произвольного метода Telegram API
 *     description: Выполняет любой метод Telegram API с указанными параметрами
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session
 *               - method
 *             properties:
 *               session:
 *                 type: string
 *                 description: ID сессии (обычно номер телефона)
 *                 example: +79001234567
 *               method:
 *                 type: string
 *                 description: Метод API Telegram
 *                 example: messages.getDialogs
 *               params:
 *                 type: object
 *                 description: Параметры метода
 *                 example: { limit: 10 }
 *     responses:
 *       200:
 *         description: Результат выполнения метода
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: object
 *                   description: Результат выполнения метода
 *       400:
 *         description: Ошибка валидации параметров
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/execute', async (req, res) => {
  try {
    const { session, method, params } = req.body;
    
    if (!session || !method) {
      return res.status(400).json({ 
        error: 'Missing required parameters: session, method' 
      });
    }
    
    const result = await executeMethod(session, method, params || {});
    res.json({ result });
  } catch (error) {
    logger.error(`Error in /api/execute: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/dialogs:
 *   get:
 *     summary: Получение списка диалогов
 *     description: Возвращает список диалогов пользователя (чатов, групп, каналов)
 *     parameters:
 *       - in: query
 *         name: session
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сессии (обычно номер телефона)
 *         example: +79001234567
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Максимальное количество диалогов для получения
 *         example: 10
 *     responses:
 *       200:
 *         description: Список диалогов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dialogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Dialog'
 *       400:
 *         description: Ошибка валидации параметров
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/dialogs', async (req, res) => {
  try {
    const { session, limit } = req.query;
    
    if (!session) {
      return res.status(400).json({ error: 'Session parameter is required' });
    }
    
    const dialogs = await getDialogs(session, parseInt(limit) || 100);
    res.json({ dialogs });
  } catch (error) {
    logger.error(`Error in /api/dialogs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Получение сообщений из чата
 *     description: Возвращает сообщения из указанного чата
 *     parameters:
 *       - in: query
 *         name: session
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сессии (обычно номер телефона)
 *         example: +79001234567
 *       - in: query
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID чата или юзернейм
 *         example: durov
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Максимальное количество сообщений для получения
 *         example: 10
 *     responses:
 *       200:
 *         description: Список сообщений
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       400:
 *         description: Ошибка валидации параметров
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/messages', async (req, res) => {
  try {
    const { session, chatId, limit } = req.query;
    
    if (!session || !chatId) {
      return res.status(400).json({ 
        error: 'Missing required parameters: session, chatId' 
      });
    }
    
    const messages = await getMessages(
      session, 
      chatId, 
      parseInt(limit) || 100
    );
    res.json({ messages });
  } catch (error) {
    logger.error(`Error in /api/messages: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/send:
 *   post:
 *     summary: Отправка сообщения
 *     description: Отправляет сообщение в указанный чат
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session
 *               - chatId
 *               - message
 *             properties:
 *               session:
 *                 type: string
 *                 description: ID сессии (обычно номер телефона)
 *                 example: +79001234567
 *               chatId:
 *                 type: string
 *                 description: ID чата или юзернейм
 *                 example: durov
 *               message:
 *                 type: string
 *                 description: Текст сообщения
 *                 example: Hello, world!
 *     responses:
 *       200:
 *         description: Отправленное сообщение
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Ошибка валидации параметров
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/send', async (req, res) => {
  try {
    const { session, chatId, message } = req.body;
    
    if (!session || !chatId || !message) {
      return res.status(400).json({ 
        error: 'Missing required parameters: session, chatId, message' 
      });
    }
    
    const result = await sendMessage(session, chatId, message);
    res.json({ result });
  } catch (error) {
    logger.error(`Error in /api/send: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/methods:
 *   get:
 *     summary: Получение списка поддерживаемых методов
 *     description: Возвращает информацию о поддерживаемых методах API
 *     responses:
 *       200:
 *         description: Список поддерживаемых методов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Название метода
 *                       description:
 *                         type: string
 *                         description: Описание метода
 *                       params:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                             required:
 *                               type: boolean
 */
app.get('/api/methods', (req, res) => {
  // Предоставляем информацию о поддерживаемых методах для внешних систем
  const methods = [
    {
      name: 'dialogs',
      description: 'Получение списка диалогов',
      endpoint: '/api/dialogs',
      method: 'GET',
      params: [
        { name: 'session', description: 'ID сессии (номер телефона)', required: true },
        { name: 'limit', description: 'Максимальное количество диалогов', required: false, defaultValue: 100 }
      ]
    },
    {
      name: 'messages',
      description: 'Получение сообщений из чата',
      endpoint: '/api/messages',
      method: 'GET',
      params: [
        { name: 'session', description: 'ID сессии (номер телефона)', required: true },
        { name: 'chatId', description: 'ID чата или юзернейм', required: true },
        { name: 'limit', description: 'Максимальное количество сообщений', required: false, defaultValue: 100 }
      ]
    },
    {
      name: 'send',
      description: 'Отправка сообщения',
      endpoint: '/api/send',
      method: 'POST',
      params: [
        { name: 'session', description: 'ID сессии (номер телефона)', required: true },
        { name: 'chatId', description: 'ID чата или юзернейм', required: true },
        { name: 'message', description: 'Текст сообщения', required: true }
      ]
    },
    {
      name: 'execute',
      description: 'Выполнение произвольного метода Telegram API',
      endpoint: '/api/execute',
      method: 'POST',
      params: [
        { name: 'session', description: 'ID сессии (номер телефона)', required: true },
        { name: 'method', description: 'Метод API Telegram', required: true },
        { name: 'params', description: 'Параметры метода', required: false, defaultValue: {} }
      ]
    }
  ];
  
  res.json({ methods });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(config.port, config.host, () => {
  logger.info(`Server running at http://${config.host}:${config.port}/`);
  logger.info(`API Documentation available at http://${config.host}:${config.port}/api-docs`);
  logger.info(`MCP Manifest available at http://${config.host}:${config.port}/mcp/manifest`);
  
  if (config.apiId === 0 || !config.apiHash) {
    logger.warn('API_ID or API_HASH not set in .env file. Please configure them before using the API.');
  }
}); 