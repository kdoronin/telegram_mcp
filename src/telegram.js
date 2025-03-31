import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import fs from 'fs';
import path from 'path';
import { serializeError } from 'serialize-error';
import config from './config.js';
import logger from './logger.js';

// Map to store active client sessions
const clientSessions = new Map();

// Path to sessions directory
const sessionsDir = config.sessionPath;

// Proxy class for TelegramClient that will use existing session
// and ignore missing API ID/Hash
class SessionOnlyClient extends TelegramClient {
  constructor(session, apiId, apiHash, options) {
    super(session, apiId || 1, apiHash || 'placeholder_hash_for_session_only', options);
    this._sessionOnly = true;
  }
}

/**
 * Create or connect Telegram client for specified session
 * @param {string} sessionId - Session ID (usually phone number)
 * @param {boolean} forceNew - Force create new client (for testing)
 * @returns {Promise<TelegramClient>} Telegram client
 */
export async function getClient(sessionId, forceNew = false) {
  logger.info(`Client request for session ${sessionId}`);
  
  // Check if client already exists in memory
  if (!forceNew && clientSessions.has(sessionId)) {
    logger.info(`Using existing session from memory for ${sessionId}`);
    return clientSessions.get(sessionId);
  }

  // Check if session file exists
  const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
  let stringSession = new StringSession('');
  let existingSession = false;

  logger.info(`Session file path: ${sessionFile}`);
  logger.info(`Session file exists: ${fs.existsSync(sessionFile)}`);

  if (fs.existsSync(sessionFile)) {
    logger.debug(`Found existing session file for ${sessionId}`);
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      logger.info(`Session file content found`);
      
      if (sessionData.session) {
        stringSession = new StringSession(sessionData.session);
        existingSession = true;
        logger.debug(`Loaded session data for ${sessionId}`);
      } else {
        logger.warn(`Session file exists but has no valid session data for ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Error loading session file: ${error.message}`);
      // If file is damaged, continue with new session
    }
  }

  logger.info(`Existing session found: ${existingSession}`);
  logger.info(`Current API_ID and API_HASH: ${config.apiId}, ${config.apiHash ? 'set' : 'not set'}`);

  // If we have existing session, we can use default values for API ID and Hash
  // Otherwise we need them
  if (!existingSession && (!config.apiId || !config.apiHash)) {
    throw new Error('Your API ID or Hash cannot be empty or undefined for creating a new session');
  }

  // For existing session, use special client that ignores API ID/Hash
  // For new session, use standard client with real API ID/Hash
  let client;
  
  if (existingSession) {
    // Client only for working with existing session (can work with any API ID/Hash values)
    client = new SessionOnlyClient(
      stringSession,
      1,  // dummy API ID
      'placeholder_hash', // dummy API Hash
      { connectionRetries: 5 }
    );
  } else {
    // Standard client for creating new session (requires real API ID/Hash)
    client = new TelegramClient(
      stringSession,
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 }
    );
  }

  let authorized = false;
  let maxAttempts = 3;
  let attempts = 0;

  // If we have existing session, try to connect without interactive authorization
  if (existingSession) {
    try {
      logger.debug(`Connecting with existing session for ${sessionId}`);
      await client.connect();
      
      // Check that session is actually authorized
      if (await client.isUserAuthorized()) {
        logger.info(`Successfully connected with existing session for ${sessionId}`);
        authorized = true;
        clientSessions.set(sessionId, client);
        return client;
      } else {
        logger.warn(`Session exists but not authorized for ${sessionId}, will try interactive login`);
      }
    } catch (error) {
      logger.error(`Error connecting with existing session: ${error.message}`);
      // If failed to connect with existing session,
      // and we don't have API ID/Hash, throw error
      if (!config.apiId || !config.apiHash) {
        throw new Error('Cannot connect with existing session and no API credentials provided');
      }
      // Otherwise try interactive authorization
    }
  }

  // If no existing session or it didn't work, and we have API ID/Hash,
  // perform interactive authorization
  while (!authorized && attempts < maxAttempts) {
    attempts++;
    try {
      logger.debug(`Starting client for session ${sessionId} (attempt ${attempts})`);
      
      await client.start({
        phoneNumber: async () => sessionId,
        password: async () => {
          // If this is a repeated attempt, inform the user
          if (attempts > 1) {
            console.log("\nInvalid password. Please try again.");
          }
          return await input.text('Please enter your 2FA password: ');
        },
        phoneCode: async () => await input.text('Please enter the confirmation code: '),
        onError: (err) => {
          logger.error(`Error in client start: ${err.message}`);
          throw err;
        }
      });
      
      // If we reached this point, authorization is successful
      authorized = true;
      
      // Save session only after successful authorization
      const sessionString = client.session.save();
      fs.writeFileSync(
        sessionFile,
        JSON.stringify({ session: sessionString, timestamp: Date.now() })
      );
      logger.debug(`Saved session data for ${sessionId}`);
      
      // Add to active sessions Map
      clientSessions.set(sessionId, client);
      
    } catch (error) {
      if (error.message && error.message.includes('PASSWORD_HASH_INVALID')) {
        logger.warn(`Invalid password for session ${sessionId}, attempt ${attempts}`);
        // Continue loop for retry
      } else if (error.message && error.message.includes('PHONE_CODE_INVALID')) {
        logger.warn(`Invalid phone code for session ${sessionId}`);
        // Return to code request
        attempts--;
      } else {
        // If error is not related to password or code, abort attempts
        logger.error(`Authentication error for session ${sessionId}: ${error.message}`);
        throw error;
      }
    }
  }

  if (!authorized) {
    throw new Error(`Failed to authenticate after ${maxAttempts} attempts. Check your credentials.`);
  }

  return client;
}

/**
 * Check for existing sessions at startup
 * and offer authorization if sessions are missing
 */
export async function checkSessionsOnStartup() {
  logger.info('Checking for saved sessions...');
  
  // Create sessions directory if it doesn't exist
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    logger.info(`Created sessions directory: ${sessionsDir}`);
  }
  
  // Check if there are session files in the directory
  const sessionFiles = fs.readdirSync(sessionsDir)
    .filter(file => file.endsWith('.json'));
  
  if (sessionFiles.length > 0) {
    logger.info(`Found ${sessionFiles.length} saved sessions:`);
    
    // Array for valid sessions
    const validSessions = [];
    
    // Check each session
    for (const file of sessionFiles) {
      const sessionId = path.basename(file, '.json');
      
      // Check session functionality by trying to read it
      try {
        const sessionData = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
        if (sessionData.session) {
          validSessions.push(sessionId);
          logger.info(`- ${sessionId} (valid)`);
        } else {
          logger.warn(`- ${sessionId} (damaged - missing session string)`);
        }
      } catch (error) {
        logger.warn(`- ${sessionId} (failed to read: ${error.message})`);
      }
    }
    
    if (validSessions.length > 0) {
      logger.info(`Found ${validSessions.length} working sessions, can use any of them for API access`);
      
      // Optionally check the first session to make sure it works
      try {
        const testClient = await getClient(validSessions[0]);
        logger.info(`Test connection to ${validSessions[0]} successful`);
      } catch (error) {
        logger.warn(`Failed to connect to session ${validSessions[0]}: ${error.message}`);
      }
      
      return;
    }
    
    logger.warn('Found sessions are damaged or non-working');
  } else {
    logger.info('No saved sessions found.');
  }
  
  // If no working sessions found, offer to create a new one, but API_ID and API_HASH are needed
  if (!config.apiId || !config.apiHash) {
    logger.error('API_ID or API_HASH not specified in .env file');
    logger.info('To create a new session, you need to specify API_ID and API_HASH in the .env file');
    return;
  }
  
  const createSession = await input.text('Do you want to create a new session? (yes/no): ');
  if (createSession.toLowerCase() !== 'yes') {
    logger.info('Session creation cancelled.');
    return;
  }
  
  // Request phone number
  const phoneNumber = await input.text('Enter phone number (in international format, e.g. +79001234567): ');
  if (!phoneNumber) {
    logger.error('Phone number cannot be empty');
    return;
  }
  
  try {
    logger.info('Creating new session...');
    // Initiate client creation, which will request a code and perform authorization
    await getClient(phoneNumber);
    logger.info(`Session for number ${phoneNumber} successfully created and saved.`);
  } catch (error) {
    logger.error(`Error creating session: ${error.message}`);
  }
}

/**
 * Get list of dialogs (chats)
 * @param {string} sessionId - Session ID
 * @param {number} limit - Maximum number of dialogs
 * @returns {Promise<Array>} Array of dialogs
 */
export async function getDialogs(sessionId, limit = 100) {
  try {
    const client = await getClient(sessionId);
    const dialogs = await client.getDialogs({ limit });
    
    // Transform data into more readable format
    return dialogs.map(dialog => ({
      id: dialog.id.toString(),
      name: dialog.title,
      type: dialog.isUser ? 'user' : dialog.isGroup ? 'group' : dialog.isBroadcast ? 'channel' : 'unknown',
      unreadCount: dialog.unreadCount,
      lastMessage: dialog.message ? {
        text: dialog.message.message || '',
        date: new Date(dialog.message.date * 1000).toISOString(),
        fromMe: dialog.message.fromId?.toString() === client.session.userId?.toString()
      } : null
    }));
  } catch (error) {
    logger.error(`Error in getDialogs: ${error.message}`);
    throw error;
  }
}

/**
 * Get messages from chat
 * @param {string} sessionId - Session ID
 * @param {string} chatId - Chat ID or username
 * @param {number} limit - Maximum number of messages
 * @returns {Promise<Array>} Array of messages
 */
export async function getMessages(sessionId, chatId, limit = 100) {
  try {
    const client = await getClient(sessionId);
    const messages = await client.getMessages(chatId, { limit });
    
    // Transform data into more readable format
    return messages.map(msg => ({
      id: msg.id.toString(),
      text: msg.message || '',
      date: new Date(msg.date * 1000).toISOString(),
      fromMe: msg.fromId?.toString() === client.session.userId?.toString(),
      sender: msg.sender ? {
        id: msg.sender.id?.toString(),
        username: msg.sender.username || '',
        firstName: msg.sender.firstName || '',
        lastName: msg.sender.lastName || '',
      } : null,
      hasMedia: !!msg.media,
      mediaType: msg.media ? msg.media.className.replace('MessageMedia', '') : null
    }));
  } catch (error) {
    logger.error(`Error in getMessages: ${error.message}`);
    throw error;
  }
}

/**
 * Send message
 * @param {string} sessionId - Session ID
 * @param {string} chatId - Chat ID or username
 * @param {string} message - Message text
 * @returns {Promise<Object>} Send result
 */
export async function sendMessage(sessionId, chatId, message) {
  try {
    const client = await getClient(sessionId);
    const result = await client.sendMessage(chatId, { message });
    
    return {
      success: true,
      messageId: result.id.toString(),
      date: new Date(result.date * 1000).toISOString()
    };
  } catch (error) {
    logger.error(`Error in sendMessage: ${error.message}`);
    throw error;
  }
}

/**
 * Execute arbitrary Telegram API method
 * @param {string} sessionId - Session ID
 * @param {string} method - Method name
 * @param {Object} params - Method parameters
 * @returns {Promise<Object>} Method execution result
 */
export async function executeMethod(sessionId, method, params = {}) {
  try {
    const client = await getClient(sessionId);
    
    // Check if method exists in API
    if (!Api.functions[method]) {
      throw new Error(`Method ${method} not found in Telegram API`);
    }
    
    // Execute method
    const result = await client.invoke(new Api.functions[method](params));
    
    // Transform Telegram objects into serializable objects
    return JSON.parse(JSON.stringify(result, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.className) {
          return {
            ...value,
            _type: value.className
          };
        }
      }
      return value;
    }));
  } catch (error) {
    logger.error(`Error in executeMethod: ${error.message}`);
    
    // Serialize error for more detailed information
    const serializedError = serializeError(error);
    throw new Error(serializedError.message || 'Unknown error');
  }
} 
