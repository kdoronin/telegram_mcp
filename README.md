# Telegram MCP Server

English version | [Русская версия](README_RU.md)

Server for working with Telegram API through Model Context Protocol (MCP). Allows AI agents and other MCP clients to interact with Telegram.

## Requirements

- Node.js 14+ (or higher)
- npm
- API ID and API Hash from Telegram

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kdoronin/telegram_mcp
   cd telegram-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   *(This will install the necessary packages: `gramjs`, `@modelcontextprotocol/sdk`, `zod`, etc.)*

3. Create and configure the `.env` file:
   ```bash
   # Copy the example .env file
   cp .env.example .env
   ```
   Edit the `.env` file and specify your `API_ID` and `API_HASH`.

4. Get API ID and API Hash:
   - Go to [my.telegram.org](https://my.telegram.org)
   - Log in to your account
   - Navigate to "API development tools"
   - Create a new application
   - Copy `api_id` and `api_hash` to your `.env` file

## Running

### Important note about running

The main server file `mcp-server.js` is located in the project root, which allows running it without path issues.

### Option 1: Via npm (recommended)

```bash
npm run mcp    # Run from the project root directory
```

### Option 2: Direct node execution

```bash
# Run from the project root directory
node mcp-server.js
```

### Option 3: As an executable file

```bash
# From the project root
./mcp-server.js
```

### Option 4: After global installation

```bash
npm install -g .   # Install the package globally
telegram-mcp       # Run the globally installed package
```

## Integration with MCP clients

### Configuration in Cursor

1. Open Cursor settings
2. Go to Features -> MCP Servers
3. Click "Add new MCP server"
4. Configure the server:
   - **Name**: `telegram` (or any other)
   - **Type**: `command`
   - **Command**: `node /full/path/to/project/mcp-server.js`
   - Alternatively: `npx telegram-mcp` (after global installation)

### Configuration in Claude Desktop

1. Open Claude Desktop settings
2. Go to Tools -> MCP
3. Click "Add New Server"
4. Configure the server:
   - **Name**: `telegram` (or any other)
   - **Type**: `command`
   - **Command**: `node /full/path/to/project/mcp-server.js`
   - Alternatively: `npx telegram-mcp` (after global installation)

## Checking functionality

When the server starts:
1. It will load settings from the `.env` file
2. Check for saved sessions
3. If there are no sessions, it will offer to create a new one (you will need to enter a phone number and confirmation code)

## Available Tools

The MCP server provides the following tools:

- **`getDialogs`**: Gets a list of user dialogs (chats).
  - Parameters: `session` (string, required), `limit` (integer, optional, default: 100).
- **`getMessages`**: Gets messages from the specified chat.
  - Parameters: `session` (string, required), `chatId` (string, required), `limit` (integer, optional, default: 100).
- **`sendMessage`**: Sends a message to the specified chat.
  - Parameters: `session` (string, required), `chatId` (string, required), `message` (string, required).
- **`executeMethod`**: Executes an arbitrary Telegram API method (use with caution).
  - Parameters: `session` (string, required), `method` (string, required), `params` (object, optional).

*Note: The `session` parameter is usually the user's phone number in international format (e.g., `+79001234567`).*

## Usage examples in prompts

```
Using the telegram.getDialogs tool for session +79001234567, show me the last 5 chats.
```

```
With telegram.sendMessage for session +79001234567, send the message "Hello from my AI assistant!" to chat with ID 'username_or_chat_id'.
```

## Authorization

When using a `session` (phone number) for the first time, the server will request a **confirmation code in the console** where it is running. Enter the code received from Telegram to authorize the session.

If you have two-factor authentication (2FA) enabled, you will also need to enter your Telegram password. If the password is entered incorrectly, the system will prompt you to enter it again (up to 3 attempts).

After successful authorization, the session will be saved to a file inside the `sessions/` directory and will be used for subsequent requests.

## Session file structure

Sessions are stored in the `sessions/` directory as JSON files named after the phone number (e.g., `+79001234567.json`). Each file contains:
- A session string (encrypted authorization token)
- A timestamp of creation/update

## Troubleshooting

1. **Error "Your API ID or Hash cannot be empty or undefined"**
   - Check that the `.env` file is in the project root
   - Make sure API_ID and API_HASH are correctly specified in it
   - Run the server from the project root directory

2. **Server doesn't see the saved session**
   - Check the execution path (should be from the project root)
   - Check for the session file in the `sessions/` directory
   - Try running with `npm run mcp`

3. **Authorization error**
   - If you entered an incorrect 2FA password, the system will prompt you to re-enter it
   - If all attempts are exhausted, delete the session file and try again

## Security

- **Do not share your API ID and API Hash with third parties.**
- **Run the server in a trusted environment.**
- **Session files contain sensitive data.** Store them in a secure location and do not share them.
- The `executeMethod` tool allows executing any Telegram API methods. Use it with caution, as it can perform destructive actions.

## License

MIT 