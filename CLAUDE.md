# MCP Collection - Development Guide

This repository contains multiple MCP (Model Context Protocol) servers designed for Claude Code and other AI CLI tools.

## Repository Structure

```
mcp/
├── packages/
│   ├── api-testing/     # API Testing MCP server
│   └── [future-mcp]/    # Other MCP servers
├── CLAUDE.md            # This file
└── README.md
```

## Packages

### api-testing

MCP server for API testing with the following capabilities:

**Features:**
- Manage OpenAPI/Swagger documentation
- Whitelist-based URL access (adding API docs = whitelisting baseURLs)
- Search and explore API endpoints
- Store credentials securely (masked in output)
- Make authenticated API calls

**Tools:**

| Tool | Description |
|------|-------------|
| `add_api_doc` | Add API doc from OpenAPI spec URL or content, whitelists baseURL |
| `remove_api_doc` | Remove API doc and unwhitelist its baseURL |
| `list_api_docs` | List all API docs and whitelisted URLs |
| `get_api_doc` | Get detailed API doc info |
| `refresh_api_doc` | Refresh API doc from spec URL |
| `search_endpoints` | Search endpoints by keyword |
| `get_endpoint_info` | Get detailed endpoint info with params, body, responses |
| `list_endpoints` | List all endpoints with filtering |
| `list_tags` | List API tags with counts |
| `add_credential` | Add authentication credential |
| `update_credential` | Update existing credential |
| `remove_credential` | Remove credential |
| `list_credentials` | List credentials (masked) |
| `get_credential` | Get credential details (masked) |
| `call_api` | Call API endpoint (must be whitelisted) |
| `call_raw_api` | Call any whitelisted URL |

**Credential Types:**

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `apiKey` | Static API key in header | `apiKey`, `apiKeyHeader` (default: X-API-Key) |
| `bearer` | Static bearer token | `token` |
| `basic` | Username/password | `username`, `password` |
| `oauth2` | OAuth2 tokens | `accessToken` or `clientId` |
| `custom` | Custom headers object | `headers` |
| `customHeaders` | Array of 1-5 static headers | `customHeaders: [{name, value}]` |
| `autoToken` | Auto-login & refresh token | `loginUrl`, `loginBody`, `tokenPath` |

**Workflow Examples:**

```
# Basic flow with API key
1. Add API doc: add_api_doc(id="petstore", name="Petstore API", specUrl="https://petstore3.swagger.io/api/v3/openapi.json")
2. Search endpoints: search_endpoints(query="pet")
3. Get endpoint info: get_endpoint_info(apiDocId="petstore", path="/pet/{petId}", method="GET")
4. Add credential: add_credential(id="petstore-key", name="Petstore API Key", type="apiKey", apiKey="xxx")
5. Call API: call_api(apiDocId="petstore", path="/pet/{petId}", method="GET", pathParams={"petId": "1"}, credentialId="petstore-key")
```

```
# Auto-token flow (add once, forget about login)
add_credential({
  id: "my-backend",
  name: "My Backend Auth",
  type: "autoToken",
  loginUrl: "https://api.myapp.com/auth/login",
  loginMethod: "POST",
  loginBody: { "username": "admin", "password": "secret123" },
  tokenPath: "data.token",           // Extract from { data: { token: "xxx" } }
  tokenHeader: "Authorization",      // Header to send token
  tokenPrefix: "Bearer ",            // Prefix for token value
  invalidStatusCodes: [401, 403]     // Re-login when these status codes returned
})

# Then just call APIs - token auto-managed
call_api(apiDocId="my-backend", path="/users", method="GET", credentialId="my-backend")
```

```
# Custom headers (for APIs requiring multiple headers)
add_credential({
  id: "multi-header-api",
  name: "Multi Header API",
  type: "customHeaders",
  customHeaders: [
    { name: "X-API-Key", value: "key123" },
    { name: "X-Client-ID", value: "client456" },
    { name: "X-Signature", value: "sig789" }
  ]
})
```

## Development Commands

### api-testing

```bash
cd packages/api-testing

# Install dependencies
npm install

# Build
npm run build

# Development (watch mode)
npm run dev

# Run server
npm start
```

### Adding to Claude Code

Add to your Claude Code MCP config (`~/.claude/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "node",
      "args": ["/path/to/mcp/packages/api-testing/dist/index.js"]
    }
  }
}
```

## Adding New MCP Packages

1. Create new directory under `packages/`
2. Initialize with TypeScript:
   ```bash
   mkdir -p packages/new-mcp/src
   cd packages/new-mcp
   npm init -y
   # Copy tsconfig.json from api-testing
   ```
3. Add `@modelcontextprotocol/sdk` dependency
4. Implement tools in `src/tools/`
5. Create server entry point in `src/index.ts`

## Data Storage

- API docs and credentials stored in `~/.mcp-api-testing/data.json`
- Sensitive credential values are masked when retrieved via tools
- Full credential values only used internally for API calls

## Security Notes

- Only whitelisted URLs can be called (URLs from registered API docs)
- Credentials are stored locally on disk (`~/.mcp-api-testing/data.json`)
- Sensitive values (passwords, tokens, API keys) are masked in tool outputs
- `autoToken` credentials automatically re-login when token expires (detected via status codes)
- Token cache is in-memory only (cleared on server restart)

## TypeScript Guidelines

- Use ES modules (`"type": "module"` in package.json)
- Target ES2022 with NodeNext module resolution
- Use Zod for runtime schema validation
- Export types from `types/index.ts`
