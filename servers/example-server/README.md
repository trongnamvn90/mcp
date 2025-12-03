# Example MCP Server

A template MCP server demonstrating basic tool implementations.

## Tools

### echo
Echoes back the input message.

**Parameters:**
- `message` (string): The message to echo back

**Example:**
```json
{
  "name": "echo",
  "arguments": {
    "message": "Hello, World!"
  }
}
```

### calculate
Performs basic arithmetic operations.

**Parameters:**
- `operation` (string): One of "add", "subtract", "multiply", "divide"
- `a` (number): First operand
- `b` (number): Second operand

**Example:**
```json
{
  "name": "calculate",
  "arguments": {
    "operation": "add",
    "a": 5,
    "b": 3
  }
}
```

### get_timestamp
Returns the current timestamp in various formats.

**Parameters:**
- `format` (string, optional): One of "iso", "unix", "human" (default: "iso")

**Example:**
```json
{
  "name": "get_timestamp",
  "arguments": {
    "format": "human"
  }
}
```

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run

```bash
npm start
```

## Development

Watch mode for development:
```bash
npm run dev
```

## Claude Desktop Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["/absolute/path/to/servers/example-server/dist/index.js"]
    }
  }
}
```

## License

MIT
