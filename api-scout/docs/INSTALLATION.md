# Installation & Configuration

## Prerequisites
- Node.js >= 18.0.0
- MCP-compatible client (e.g., Claude Desktop, Cursor, etc.)

## Installation

### Option 1: Using npx (Recommended)

This is the easiest way to run API Scout without installing it globally.

```bash
npx -y @trongnamvn90/api-scout
```

### Option 2: Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/trongnamvn90/api-scout.git
   cd api-scout
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

## Configuration

To use API Scout with Claude Desktop, add the following to your config file:

**MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "api-scout": {
      "command": "npx",
      "args": ["-y", "@trongnamvn90/api-scout"]
    }
  }
}
```

### Environment Variables

API Scout uses a local file-based storage system by default.
- **Storage Location:** `~/.mcp-api-testing/data.json`

Currently, no additional environment variables are required for basic operation.
