// This file will contain the specific implementation for each MCP tool.
import {
  executeMethod as telegramExecuteMethod,
  getDialogs as telegramGetDialogs,
  getMessages as telegramGetMessages,
  sendMessage as telegramSendMessage,
  getClient
} from '../telegram.js';
import logger from '../logger.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

/**
 * Checks if the session exists and is valid
 * @param {string} session - Session ID
 * @returns {Promise<boolean>} - Whether a valid session exists
 */
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

/**
 * MCP Tool: Get dialogs.
 * @param {object} params - Validated parameters.
 * @param {string} params.session - Session ID.
 * @param {number} [params.limit=100] - Max dialogs.
 * @returns {Promise<object>} Result content for MCP response.
 */
export async function getDialogsTool({ session, limit = 100 }) {
  logger.debug(`Executing getDialogsTool for session ${session} with limit ${limit}`);
  
  try {
    // Check if session file exists and is valid
    const sessionExists = await checkSessionExists(session);
    if (!sessionExists) {
      return { 
        error: true, 
        message: `Session file for ${session} does not exist or is invalid. Please create a session first.` 
      };
    }
    
    const dialogs = await telegramGetDialogs(session, limit);
    
    // Return result in correct MCP format
    return {
      type: "text",
      text: JSON.stringify(dialogs, null, 2)
    };
  } catch (error) {
    logger.error(`Error in getDialogsTool: ${error.message}`);
    return { 
      error: true, 
      message: error.message,
      details: error.stack
    };
  }
}

/**
 * MCP Tool: Get messages.
 * @param {object} params - Validated parameters.
 * @param {string} params.session - Session ID.
 * @param {string} params.chatId - Chat ID or username.
 * @param {number} [params.limit=100] - Max messages.
 * @returns {Promise<object>} Result content for MCP response.
 */
export async function getMessagesTool({ session, chatId, limit = 100 }) {
  logger.debug(`Executing getMessagesTool for session ${session}, chat ${chatId}, limit ${limit}`);
  
  try {
    // Check if session file exists and is valid
    const sessionExists = await checkSessionExists(session);
    if (!sessionExists) {
      return { 
        error: true, 
        message: `Session file for ${session} does not exist or is invalid. Please create a session first.` 
      };
    }
    
    const messages = await telegramGetMessages(session, chatId, limit);
    
    // Return result in correct MCP format
    return {
      type: "text",
      text: JSON.stringify(messages, null, 2)
    };
  } catch (error) {
    logger.error(`Error in getMessagesTool: ${error.message}`);
    return { 
      error: true, 
      message: error.message,
      details: error.stack
    };
  }
}

/**
 * MCP Tool: Send message.
 * @param {object} params - Validated parameters.
 * @param {string} params.session - Session ID.
 * @param {string} params.chatId - Chat ID or username.
 * @param {string} params.message - Message text.
 * @returns {Promise<object>} Result content for MCP response.
 */
export async function sendMessageTool({ session, chatId, message }) {
  logger.debug(`Executing sendMessageTool for session ${session}, chat ${chatId}`);
  
  try {
    // Check if session file exists and is valid
    const sessionExists = await checkSessionExists(session);
    if (!sessionExists) {
      return { 
        error: true, 
        message: `Session file for ${session} does not exist or is invalid. Please create a session first.` 
      };
    }
    
    const result = await telegramSendMessage(session, chatId, message);
    
    // Return result in correct MCP format
    return {
      type: "text",
      text: JSON.stringify(result, null, 2)
    };
  } catch (error) {
    logger.error(`Error in sendMessageTool: ${error.message}`);
    return { 
      error: true, 
      message: error.message,
      details: error.stack
    };
  }
}

/**
 * MCP Tool: Execute arbitrary Telegram method.
 * @param {object} params - Validated parameters.
 * @param {string} params.session - Session ID.
 * @param {string} params.method - Telegram method name.
 * @param {object} [params.params={}] - Method parameters.
 * @returns {Promise<object>} Result content for MCP response.
 */
export async function executeMethodTool({ session, method, params = {} }) {
  logger.debug(`Executing executeMethodTool for session ${session}, method ${method}`);
  
  try {
    // Check if session file exists and is valid
    const sessionExists = await checkSessionExists(session);
    if (!sessionExists) {
      return { 
        error: true, 
        message: `Session file for ${session} does not exist or is invalid. Please create a session first.` 
      };
    }
    
    const result = await telegramExecuteMethod(session, method, params);
    
    // Return result in correct MCP format
    return {
      type: "text",
      text: JSON.stringify(result, null, 2)
    };
  } catch (error) {
    logger.error(`Error in executeMethodTool: ${error.message}`);
    return { 
      error: true, 
      message: error.message,
      details: error.stack
    };
  }
} 