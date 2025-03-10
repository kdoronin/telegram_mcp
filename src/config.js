import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create sessions directory if it doesn't exist
const sessionPath = process.env.SESSION_PATH || join(__dirname, '../sessions');
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

export default {
  apiId: parseInt(process.env.API_ID) || 0,
  apiHash: process.env.API_HASH || '',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  sessionPath,
}; 