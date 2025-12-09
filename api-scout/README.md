# API Scout

MCP (Model Context Protocol) server for API testing, designed for Claude Code and other AI CLI tools.

[📚 **Full Documentation**](https://github.com/trongnamvn90/mcp/blob/main/api-scout/docs/README.md) | [💻 **GitHub Repository**](https://github.com/trongnamvn90/mcp/tree/main/api-scout)

## Features

- **API Documentation Management**: Import OpenAPI/Swagger specs from URL or content
- **Whitelist-based Access**: Adding API docs automatically whitelists their baseURLs
- **Endpoint Search**: Search endpoints by keyword across all docs
- **Credential Storage**: Securely store API keys, bearer tokens, basic auth, OAuth2
- **Authenticated Calls**: Make API calls with stored credentials

## Installation

### From NPM (Recommended)

```bash
npx -y @trongnamvn90/api-scout
```

Or add to your Claude Desktop config directly:

### Configuration

Add to `claude_desktop_config.json`:

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

## Smart Bearer Authentication (New! 🛡️)

API Scout introduces the **"Immortal Warrior"** authentication flow. The standard `bearer` credential now supports advanced auto-recovery logic:

1.  **Auto-Login**: If a token is missing, it automatically calls your `loginUrl` to get one.
2.  **Auto-Refresh**: If an API call fails with `401`, it detects `invalidStatusCodes` and automatically calls your `refreshUrl`.
3.  **Fallback Logic**: If refresh fails, it falls back to full login.
4.  **Seamless Retry**: The original request is retried transparently with the new token.
5.  **Strict Verification**: Smart Bearer credentials are tested continuously. When adding/updating, it attempts an immediate login. If it fails, the save is rejected (unless you use `skipValidityCheck: true`).

Configuring this is as simple as adding `loginUrl` and `refreshUrl` to your `bearer` credential!

## Smart Caching (New! 🚀)

API Scout now supports **Smart Caching** for OpenAPI docs. When your API changes, API Scout can automatically detect and refresh the documentation without manual intervention.

To enable this:

1.  Expose a lightweight endpoint on your server that returns a hash (e.g., MD5) of your OpenAPI spec.
2.  When adding a doc via `add_api_doc`, provide the `apiHashUrl`.
3.  API Scout will automatically check this hash before performing searches or lookups. If the hash has changed, it re-fetches the full documentation.

**NestJS Example:**

```typescript
// main.ts
const docString = JSON.stringify(document);
const docHash = crypto.createHash('md5').update(docString).digest('hex');

app.getHttpAdapter().get('/api/docs-hash', (req, res) => {
  res.send(docHash);
});
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
- `bearer`: Bearer token (supports Smart Auto-Login & Refresh)
- `basic`: Username/password
- `oauth2`: OAuth2 tokens
- `custom`: Custom headers

## Data Storage

Data stored in `~/.mcp-api-testing/data.json`

## License

MIT
