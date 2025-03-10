import { executeMethod, getDialogs, getMessages, sendMessage } from './telegram.js';
import logger from './logger.js';

/**
 * Адаптер для Model Context Protocol (MCP)
 * Преобразует запросы MCP в вызовы нашего Telegram API
 */
export async function handleMcpRequest(req, res) {
  try {
    const body = req.body;
    
    // Проверяем, что это корректный MCP запрос
    if (!body || !body.function_call) {
      return res.status(400).json({
        error: 'Invalid MCP request format',
        details: 'Request must include function_call property'
      });
    }
    
    const { function_call } = body;
    const { name, parameters } = function_call;
    
    logger.info(`MCP request: ${name} with parameters ${JSON.stringify(parameters)}`);
    
    let result;
    
    // Обрабатываем различные функции MCP
    switch (name) {
      case 'getDialogs':
        result = await getDialogs(
          parameters.session, 
          parameters.limit || 100
        );
        break;
        
      case 'getMessages':
        result = await getMessages(
          parameters.session,
          parameters.chatId,
          parameters.limit || 100
        );
        break;
        
      case 'sendMessage':
        result = await sendMessage(
          parameters.session,
          parameters.chatId,
          parameters.message
        );
        break;
        
      case 'executeMethod':
        result = await executeMethod(
          parameters.session,
          parameters.method,
          parameters.params || {}
        );
        break;
        
      default:
        return res.status(404).json({
          error: 'Function not found',
          details: `The function '${name}' is not supported by this MCP server`
        });
    }
    
    // Формируем ответ согласно MCP протоколу
    return res.json({
      result: {
        content: result
      }
    });
  } catch (error) {
    logger.error(`MCP error: ${error.message}`);
    return res.status(500).json({
      error: 'MCP execution error',
      details: error.message
    });
  }
}

/**
 * Получить манифест MCP для описания возможностей сервера
 */
export function getMcpManifest() {
  return {
    schema_version: "v1",
    name: "telegram-mcp",
    description: "MCP server for Telegram API integration",
    tools: [
      {
        name: "getDialogs",
        description: "Get a list of user dialogs (chats)",
        parameters: {
          type: "object",
          properties: {
            session: {
              type: "string",
              description: "Session ID (usually phone number)",
            },
            limit: {
              type: "integer",
              description: "Maximum number of dialogs to return",
              default: 100
            }
          },
          required: ["session"]
        }
      },
      {
        name: "getMessages",
        description: "Get messages from a specific chat",
        parameters: {
          type: "object",
          properties: {
            session: {
              type: "string",
              description: "Session ID (usually phone number)",
            },
            chatId: {
              type: "string",
              description: "Chat ID or username",
            },
            limit: {
              type: "integer",
              description: "Maximum number of messages to return",
              default: 100
            }
          },
          required: ["session", "chatId"]
        }
      },
      {
        name: "sendMessage",
        description: "Send a message to a specific chat",
        parameters: {
          type: "object",
          properties: {
            session: {
              type: "string",
              description: "Session ID (usually phone number)",
            },
            chatId: {
              type: "string",
              description: "Chat ID or username",
            },
            message: {
              type: "string",
              description: "Message text to send",
            }
          },
          required: ["session", "chatId", "message"]
        }
      },
      {
        name: "executeMethod",
        description: "Execute any Telegram API method",
        parameters: {
          type: "object",
          properties: {
            session: {
              type: "string",
              description: "Session ID (usually phone number)",
            },
            method: {
              type: "string",
              description: "Telegram API method name",
            },
            params: {
              type: "object",
              description: "Method parameters",
              default: {}
            }
          },
          required: ["session", "method"]
        }
      }
    ],
    version: "1.0.0"
  };
} 