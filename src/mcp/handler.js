import logger from '../logger.js';
import Ajv from 'ajv'; // Import AJV for validation
import addFormats from 'ajv-formats';

// Import tool schemas for validation and tool functions
import { toolSchemas } from './manifest.js';
import {
  getDialogsTool,
  getMessagesTool,
  sendMessageTool,
  executeMethodTool
} from './tools.js';

// Initialize AJV
const ajv = new Ajv({ useDefaults: true }); // Use defaults to apply default values from schemas
addFormats(ajv);

// Map tool names to their implementation and schema
const toolRegistry = {
  getDialogs: { func: getDialogsTool, schema: toolSchemas.getDialogs },
  getMessages: { func: getMessagesTool, schema: toolSchemas.getMessages },
  sendMessage: { func: sendMessageTool, schema: toolSchemas.sendMessage },
  executeMethod: { func: executeMethodTool, schema: toolSchemas.executeMethod },
};

// Pre-compile schemas for better performance
const compiledValidators = {};
for (const toolName in toolRegistry) {
  compiledValidators[toolName] = ajv.compile(toolRegistry[toolName].schema);
}

/**
 * Handles incoming MCP requests, validates them, calls the appropriate tool,
 * and formats the response according to MCP standards.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
export async function handleMcpRequest(req, res) {
  const { body } = req;

  // 1. Basic MCP Request Validation
  if (!body || typeof body !== 'object' || !body.function_call || typeof body.function_call !== 'object') {
    logger.warn('Invalid MCP request format: Missing or invalid function_call');
    return res.status(200).json({
      isError: true,
      content: [{
        type: 'text',
        text: 'Invalid MCP request format: Request must include a valid function_call object'
      }]
    });
  }

  const { name, parameters } = body.function_call;

  // 2. Check if Tool Exists
  if (!toolRegistry[name]) {
    logger.warn(`Function not found: ${name}`);
    return res.status(200).json({
      isError: true,
      content: [{
        type: 'text',
        text: `Function not found: The function '${name}' is not supported by this MCP server`
      }]
    });
  }

  const { func, schema } = toolRegistry[name];
  const validate = compiledValidators[name];
  const paramsToValidate = parameters || {}; // Use empty object if parameters are missing

  logger.info(`MCP request: ${name} with parameters ${JSON.stringify(paramsToValidate)}`);

  try {
    // 3. Validate Parameters using AJV
    if (!validate(paramsToValidate)) {
      logger.warn(`Invalid parameters for tool ${name}: ${ajv.errorsText(validate.errors)}`);
      return res.status(200).json({
        isError: true,
        content: [{
          type: 'text',
          text: `Invalid parameters for ${name}: ${ajv.errorsText(validate.errors)}`
        }]
      });
    }

    // Parameters are valid (and defaults are applied by AJV)
    const validParams = paramsToValidate; 

    // 4. Execute Tool Function
    const result = await func(validParams);

    // 5. Send Successful Response
    logger.debug(`Tool ${name} executed successfully`);
    return res.json({
      content: result // Assuming the tool function returns the final content structure
    });

  } catch (error) {
    // 6. Handle Tool Execution Errors / Internal Server Errors
    logger.error(`MCP execution error in tool '${name}': ${error.message}`, error);
    return res.status(200).json({
      isError: true,
      content: [{
        type: 'text',
        text: `MCP execution error in ${name}: ${error.message}`
      }]
    });
  }
} 