import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import { join } from 'path';
import fs from 'fs';
import logger from './logger.js';
import config from './config.js';

// Map to store active client sessions
const clientSessions = new Map();

/**
 * Get or create a client session
 * @param {string} sessionId - Unique session identifier (typically phone number)
 * @returns {Promise<TelegramClient>} Telegram client
 */
export async function getClient(sessionId) {
  // Generate a consistent session ID (remove any non-alphanumeric chars)
  const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9]/g, '');
  
  // Check if we already have an active session
  if (clientSessions.has(cleanSessionId)) {
    logger.info(`Using existing session for ${cleanSessionId}`);
    return clientSessions.get(cleanSessionId);
  }

  // Path to session file
  const sessionPath = join(config.sessionPath, `${cleanSessionId}.session`);
  
  // Check if we have a stored session
  let stringSession = new StringSession('');
  if (fs.existsSync(sessionPath)) {
    const sessionData = fs.readFileSync(sessionPath, 'utf8');
    stringSession = new StringSession(sessionData);
    logger.info(`Loaded session from file for ${cleanSessionId}`);
  }

  // Create new client
  const client = new TelegramClient(
    stringSession,
    config.apiId,
    config.apiHash,
    {
      connectionRetries: 5,
    }
  );

  // Start the client
  await client.start({
    phoneNumber: async () => sessionId,
    password: async () => await input.text('Please enter your password: '),
    phoneCode: async () => await input.text('Please enter the code you received: '),
    onError: (err) => logger.error(`Connection error: ${err}`),
  });

  // Save session to file
  fs.writeFileSync(sessionPath, client.session.save());
  logger.info(`Saved session to file for ${cleanSessionId}`);
  
  // Store in memory
  clientSessions.set(cleanSessionId, client);
  
  return client;
}

/**
 * Helper function to safely serialize Telegram objects
 * @param {object} obj - The object to serialize
 * @returns {object} - Safe-to-serialize object
 */
function serializeTelegramObject(obj) {
  if (!obj) return null;
  
  // If it's an array, process each item
  if (Array.isArray(obj)) {
    return obj.map(item => serializeTelegramObject(item));
  }
  
  // If it's not an object or null, return as is
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // For other objects, extract only serializable properties
  const result = {};
  for (const key in obj) {
    // Skip functions, symbols, and other non-serializable things
    if (typeof obj[key] === 'function' || typeof obj[key] === 'symbol') {
      continue;
    }
    
    // Skip properties that start with underscore (usually internal)
    if (key.startsWith('_')) {
      continue;
    }
    
    try {
      // Recursively process nested objects
      result[key] = serializeTelegramObject(obj[key]);
    } catch (e) {
      // If we can't serialize this property, skip it
      result[key] = `[Unserializable: ${e.message}]`;
    }
  }
  
  return result;
}

/**
 * Execute a Telegram API method
 * @param {string} sessionId - Session identifier (phone number)
 * @param {string} method - API method name
 * @param {object} params - Method parameters
 * @returns {Promise<any>} API response
 */
export async function executeMethod(sessionId, method, params = {}) {
  try {
    logger.info(`Executing method ${method} for session ${sessionId}`);
    const client = await getClient(sessionId);
    
    let result;
    
    // Check if method exists in the client
    if (typeof client[method] === 'function') {
      result = await client[method](params);
    } else {
      // Try to access nested API methods
      const [namespace, func] = method.split('.');
      if (client[namespace] && typeof client[namespace][func] === 'function') {
        result = await client[namespace][func](params);
      } else {
        // Invoke the method directly (advanced usage)
        result = await client.invoke({
          _: method,
          ...params
        });
      }
    }
    
    // Safely serialize the result
    return serializeTelegramObject(result);
  } catch (error) {
    logger.error(`Error executing method ${method}: ${error.message}`);
    throw error;
  }
}

/**
 * Get user dialogs (chats)
 * @param {string} sessionId - Session identifier
 * @param {number} limit - Maximum number of dialogs to return
 * @returns {Promise<any>} List of dialogs
 */
export async function getDialogs(sessionId, limit = 100) {
  try {
    const client = await getClient(sessionId);
    const dialogs = await client.getDialogs({ limit });
    
    // Process dialogs to make them serializable
    return dialogs.map(dialog => {
      return {
        id: dialog.id,
        name: dialog.title || dialog.name,
        unreadCount: dialog.unreadCount,
        lastMessage: dialog.message ? {
          id: dialog.message.id,
          text: dialog.message.message,
          date: dialog.message.date,
          senderId: dialog.message.senderId,
        } : null,
        isChannel: dialog.isChannel,
        isGroup: dialog.isGroup,
        isUser: dialog.isUser,
      };
    });
  } catch (error) {
    logger.error(`Error in getDialogs: ${error.message}`);
    throw error;
  }
}

/**
 * Get messages from a chat
 * @param {string} sessionId - Session identifier
 * @param {number|string} chatId - Chat ID or username
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<any>} List of messages
 */
export async function getMessages(sessionId, chatId, limit = 100) {
  try {
    const client = await getClient(sessionId);
    const messages = await client.getMessages(chatId, { limit });
    
    // Process messages to make them serializable
    return messages.map(msg => {
      return {
        id: msg.id,
        text: msg.message,
        date: msg.date,
        senderId: msg.senderId,
        replyToMsgId: msg.replyToMsgId,
        isOutgoing: msg.out,
        media: msg.media ? {
          type: msg.media.className || 'unknown',
          // Add other media properties as needed
        } : null,
      };
    });
  } catch (error) {
    logger.error(`Error in getMessages: ${error.message}`);
    throw error;
  }
}

/**
 * Send message to a chat
 * @param {string} sessionId - Session identifier
 * @param {number|string} chatId - Chat ID or username
 * @param {string} message - Message text
 * @returns {Promise<any>} Sent message
 */
export async function sendMessage(sessionId, chatId, message) {
  try {
    const client = await getClient(sessionId);
    const result = await client.sendMessage(chatId, { message });
    
    // Return a simplified version of the sent message
    return {
      id: result.id,
      text: result.message,
      date: result.date,
      isOutgoing: result.out,
    };
  } catch (error) {
    logger.error(`Error in sendMessage: ${error.message}`);
    throw error;
  }
} 