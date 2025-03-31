import dotenv from 'dotenv';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Create path to sessions directory - always relative to the project root
const sessionDir = process.env.SESSION_PATH || 'sessions';
// Use absolute path from project root
const sessionPath = join(projectRoot, sessionDir);

// Create directory if it doesn't exist
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
  console.log(`Created sessions directory: ${sessionPath}`);
}

// Output path information for debugging
console.log(`Project root: ${projectRoot}`);
console.log(`Sessions directory: ${sessionPath}`);

// For existing sessions, API_ID and API_HASH may not be required
const hasExistingSessions = fs.readdirSync(sessionPath)
  .filter(file => file.endsWith('.json')).length > 0;

// If there are saved sessions, dummy values can be used
const apiId = parseInt(process.env.API_ID) || (hasExistingSessions ? 1 : 0);
const apiHash = process.env.API_HASH || (hasExistingSessions ? 'dummy_hash_for_existing_sessions' : '');

console.log(`API parameters: ID=${apiId}, Hash=${apiHash ? 'provided' : 'not provided'}`);
console.log(`Found saved sessions: ${hasExistingSessions}`);

export default {
  apiId,
  apiHash,
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  sessionPath,
}; 