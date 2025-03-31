#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import logger from './logger.js';
import { getDialogsTool, getMessagesTool, sendMessageTool, executeMethodTool } from './mcp/tools.js';
import { checkSessionsOnStartup } from './telegram.js';

// Создаем экземпляр MCP-сервера
const server = new McpServer({
  name: 'telegram-mcp',
  version: '1.0.0',
  description: 'Telegram API через Model Context Protocol (MCP)'
});

// Определяем инструменты

// 1. getDialogs - получение списка диалогов
server.tool(
  'getDialogs',
  {
    session: z.string().describe('Session ID (usually phone number)'),
    limit: z.number().optional().default(100).describe('Maximum number of dialogs to return')
  },
  async ({ session, limit }) => {
    logger.debug(`Executing getDialogs tool for session ${session}, limit ${limit}`);
    
    try {
      const dialogs = await getDialogsTool({ session, limit });
      
      // Обработка ошибок из инструмента
      if (dialogs && dialogs.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: dialogs.message || 'Unknown error' }]
        };
      }
      
      return {
        content: dialogs
      };
    } catch (error) {
      logger.error(`Error executing getDialogs: ${error.message}`);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error getting dialogs: ${error.message}` }]
      };
    }
  }
);

// 2. getMessages - получение сообщений из чата
server.tool(
  'getMessages',
  {
    session: z.string().describe('Session ID (usually phone number)'),
    chatId: z.string().describe('Chat ID or username'),
    limit: z.number().optional().default(100).describe('Maximum number of messages to return')
  },
  async ({ session, chatId, limit }) => {
    logger.debug(`Executing getMessages tool for session ${session}, chat ${chatId}, limit ${limit}`);
    
    try {
      const messages = await getMessagesTool({ session, chatId, limit });
      
      // Обработка ошибок из инструмента
      if (messages && messages.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: messages.message || 'Unknown error' }]
        };
      }
      
      return {
        content: messages
      };
    } catch (error) {
      logger.error(`Error executing getMessages: ${error.message}`);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error getting messages: ${error.message}` }]
      };
    }
  }
);

// 3. sendMessage - отправка сообщения
server.tool(
  'sendMessage',
  {
    session: z.string().describe('Session ID (usually phone number)'),
    chatId: z.string().describe('Chat ID or username'),
    message: z.string().describe('Message text to send')
  },
  async ({ session, chatId, message }) => {
    logger.debug(`Executing sendMessage tool for session ${session}, chat ${chatId}`);
    
    try {
      const result = await sendMessageTool({ session, chatId, message });
      
      // Обработка ошибок из инструмента
      if (result && result.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: result.message || 'Unknown error' }]
        };
      }
      
      return {
        content: result
      };
    } catch (error) {
      logger.error(`Error executing sendMessage: ${error.message}`);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error sending message: ${error.message}` }]
      };
    }
  }
);

// 4. executeMethod - выполнение произвольного метода API
server.tool(
  'executeMethod',
  {
    session: z.string().describe('Session ID (usually phone number)'),
    method: z.string().describe('Telegram API method name'),
    params: z.object({}).passthrough().optional().default({}).describe('Method parameters')
  },
  async ({ session, method, params }) => {
    logger.debug(`Executing executeMethod tool for session ${session}, method ${method}`);
    
    try {
      const result = await executeMethodTool({ session, method, params });
      
      // Обработка ошибок из инструмента
      if (result && result.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: result.message || 'Unknown error' }]
        };
      }
      
      return {
        content: result
      };
    } catch (error) {
      logger.error(`Error executing executeMethod: ${error.message}`);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing method: ${error.message}` }]
      };
    }
  }
);

// Запускаем сервер, используя stdio транспорт
async function startServer() {
  try {
    // Проверяем наличие сессий и предлагаем авторизацию
    await checkSessionsOnStartup();
    
    logger.info('Запуск Telegram MCP сервера (stdio)...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Сервер подключен к транспорту stdio.');
  } catch (error) {
    logger.error(`Ошибка запуска MCP сервера: ${error.message}`);
    process.exit(1);
  }
}

// Запускаем сервер
startServer(); 