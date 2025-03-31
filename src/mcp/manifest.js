import logger from '../logger.js';

// Keep the JSON schemas separate for validation and manifest generation
const toolSchemas = {
  getDialogs: {
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
  },
  getMessages: {
    type: "object",
    properties: {
      session: {
        type: "string",
        description: "Session ID (usually phone number)",
      },
      chatId: {
        type: "string", // Keep as string for consistency (usernames or IDs)
        description: "Chat ID or username",
      },
      limit: {
        type: "integer",
        description: "Maximum number of messages to return",
        default: 100
      }
    },
    required: ["session", "chatId"]
  },
  sendMessage: {
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
  },
  executeMethod: {
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
};

/**
 * Generates the MCP manifest.
 * @returns {object} The MCP manifest object.
 */
export function getMcpManifest() {
  logger.debug('Generating MCP Manifest');
  return {
    schema_version: "v1",
    name: "telegram-mcp",
    description: "MCP server for Telegram API integration",
    tools: [
      {
        name: "getDialogs",
        description: "Get a list of user dialogs (chats)",
        parameters: toolSchemas.getDialogs // Reference the schema
      },
      {
        name: "getMessages",
        description: "Get messages from a specific chat",
        parameters: toolSchemas.getMessages // Reference the schema
      },
      {
        name: "sendMessage",
        description: "Send a message to a specific chat",
        parameters: toolSchemas.sendMessage // Reference the schema
      },
      {
        name: "executeMethod",
        description: "Execute any Telegram API method",
        parameters: toolSchemas.executeMethod // Reference the schema
      }
    ],
    version: "1.0.0" // Consider updating version based on changes
  };
}

// Export schemas for use in validation
export { toolSchemas }; 