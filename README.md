# MCP Servers Collection

A collection of Model Context Protocol (MCP) servers for AI applications.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is an open protocol that allows applications to provide context for LLMs in a standardized way. MCP servers can expose:

- **Tools**: Functions that LLMs can call to perform actions
- **Resources**: Data that can be read by LLMs
- **Prompts**: Reusable templates for LLM interactions

## Repository Structure

```
mcp/
├── README.md              # This file
├── servers/               # MCP server implementations
│   └── example-server/    # Example MCP server template
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts   # Server implementation
└── docs/                  # Additional documentation
```

## Available Servers

| Server | Description | Status |
|--------|-------------|--------|
| [example-server](./servers/example-server) | A template MCP server with basic tools | Ready for testing |

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Running an MCP Server

1. Navigate to the server directory:
   ```bash
   cd servers/example-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the server:
   ```bash
   npm run build
   ```

4. Run the server:
   ```bash
   npm start
   ```

### Using with Claude Desktop

To use an MCP server with Claude Desktop, add the server configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["/path/to/mcp/servers/example-server/dist/index.js"]
    }
  }
}
```

## Creating a New MCP Server

1. Copy the `example-server` directory as a template
2. Update `package.json` with your server details
3. Implement your tools, resources, and prompts in `src/index.ts`
4. Build and test your server

## Testing

Each server can be tested using the MCP Inspector or by integrating with an MCP client.

```bash
# Using npx to run the MCP Inspector
npx @modelcontextprotocol/inspector node servers/example-server/dist/index.js
```

## Contributing

1. Fork the repository
2. Create a new branch for your server
3. Implement and test your MCP server
4. Submit a pull request

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

## License

MIT
