# @anthropic-mcp/api-testing

MCP (Model Context Protocol) server for API testing, designed for Claude Code and other AI CLI tools.

## Features

- **API Documentation Management**: Import OpenAPI/Swagger specs from URL or content
- **Whitelist-based Access**: Adding API docs automatically whitelists their baseURLs
- **Endpoint Search**: Search endpoints by keyword across all docs
- **Credential Storage**: Securely store API keys, bearer tokens, basic auth, OAuth2
- **Authenticated Calls**: Make API calls with stored credentials

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to Claude Code MCP config:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

## Tools

### API Docs Management

| Tool | Description |
|------|-------------|
| `add_api_doc` | Add API doc from OpenAPI spec, whitelists baseURL |
| `remove_api_doc` | Remove API doc, unwhitelist baseURL |
| `list_api_docs` | List all API docs and whitelisted URLs |
| `get_api_doc` | Get API doc details |
| `refresh_api_doc` | Refresh from spec URL |

### Search & Info

| Tool | Description |
|------|-------------|
| `search_endpoints` | Search endpoints by keyword |
| `get_endpoint_info` | Get endpoint params, body, responses |
| `list_endpoints` | List endpoints with filtering |
| `list_tags` | List API tags |

### Credentials

| Tool | Description |
|------|-------------|
| `add_credential` | Add auth credential |
| `update_credential` | Update credential |
| `remove_credential` | Remove credential |
| `list_credentials` | List credentials (masked) |
| `get_credential` | Get credential (masked) |

### API Calls

| Tool | Description |
|------|-------------|
| `call_api` | Call registered endpoint |
| `call_raw_api` | Call any whitelisted URL |

## Credential Types

- `apiKey`: API key in header
- `bearer`: Bearer token
- `basic`: Username/password
- `oauth2`: OAuth2 tokens
- `custom`: Custom headers

## Data Storage

Data stored in `~/.mcp-api-testing/data.json`

## License

MIT
