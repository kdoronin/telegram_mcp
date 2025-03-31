#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import logger from './src/logger.js';
import { getDialogs, getMessages, sendMessage, executeMethod, checkSessionsOnStartup } from './src/telegram.js';
import fs from 'fs';
import path from 'path';
import config from './src/config.js';

// Create MCP server instance
const server = new McpServer({
  name: 'telegram-mcp',
  version: '1.0.0',
  description: 'Telegram API via Model Context Protocol (MCP)'
});

// Check if session exists and is valid
async function checkSessionExists(session) {
  const sessionFile = path.join(config.sessionPath, `${session}.json`);
  logger.debug(`Checking session file: ${sessionFile}`);
  
  if (!fs.existsSync(sessionFile)) {
    logger.warn(`Session file not found: ${sessionFile}`);
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    if (!data.session) {
      logger.warn(`Invalid session data in file: ${sessionFile}`);
      return false;
    }
    
    // If session file is valid, return true
    return true;
  } catch (error) {
    logger.error(`Error reading session file: ${error.message}`);
    return false;
  }
}

// Define tools

// 1. getDialogs - get list of dialogs
server.tool(
  'getDialogs',
  {
    session: z.string().describe('Session ID (usually phone number)'),
    limit: z.number().optional().default(100).describe('Maximum number of dialogs to return')
  },
  async ({ session, limit }) => {
    logger.debug(`Executing getDialogs tool for session ${session}, limit ${limit}`);
    
    try {
      // Check if session file exists and is valid
      const sessionExists = await checkSessionExists(session);
      if (!sessionExists) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session file for ${session} does not exist or is invalid. Please create a session first.` }]
        };
      }
      
      // Directly call function from telegram.js
      const dialogs = await getDialogs(session, limit);
      
      // Return result as JSON text
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(dialogs, null, 2) 
        }]
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

// 2. getMessages - get messages from a chat
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
      // Check if session file exists and is valid
      const sessionExists = await checkSessionExists(session);
      if (!sessionExists) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session file for ${session} does not exist or is invalid. Please create a session first.` }]
        };
      }
      
      // Directly call function from telegram.js
      const messages = await getMessages(session, chatId, limit);
      
      // Return result as JSON text
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(messages, null, 2) 
        }]
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

// 3. sendMessage - send a message
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
      // Check if session file exists and is valid
      const sessionExists = await checkSessionExists(session);
      if (!sessionExists) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session file for ${session} does not exist or is invalid. Please create a session first.` }]
        };
      }
      
      // Directly call function from telegram.js
      const result = await sendMessage(session, chatId, message);
      
      // Return result as JSON text
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(result, null, 2) 
        }]
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

// 4. executeMethod - execute arbitrary API method
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
      // Check if session file exists and is valid
      const sessionExists = await checkSessionExists(session);
      if (!sessionExists) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Session file for ${session} does not exist or is invalid. Please create a session first.` }]
        };
      }
      
      // Directly call function from telegram.js
      const result = await executeMethod(session, method, params);
      
      // Return result as JSON text
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(result, null, 2) 
        }]
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

// Start server using stdio transport
async function startServer() {
  try {
    // Check for existing sessions and offer authorization
    await checkSessionsOnStartup();
    
    logger.info('Starting Telegram MCP server (stdio)...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Server connected to stdio transport.');
  } catch (error) {
    logger.error(`Error starting MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start server
startServer(); 