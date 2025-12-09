# Tools Reference

API Scout provides the following tools to interact with APIs.

## API Documentation Management

### `add_api_doc`
Import an OpenAPI/Swagger specification. This automatically whitelists the API's `baseUrl` for making calls.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Unique identifier (e.g., 'petstore')" },
    "name": { "type": "string", "description": "Display name" },
    "specUrl": { "type": "string", "description": "URL to OpenAPI spec (JSON/YAML)" },
    "specContent": { "type": "string", "description": "Direct spec content string" },
    "baseUrl": { "type": "string", "description": "Override auto-detected Base URL" },
    "apiHashUrl": { "type": "string", "description": "URL returning a hash (MD5) for smart caching" }
  },
  "required": ["id", "name"]
}
```

### `remove_api_doc`
Remove a registered API doc and revoke its `baseUrl` whitelist.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "ID of the API doc to remove" }
  },
  "required": ["id"]
}
```

### `list_api_docs`
List all registered API docs.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "verbose": { "type": "boolean", "description": "Include endpoint counts" }
  }
}
```

### `refresh_api_doc`
Manually refresh an API doc from its `specUrl`.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" }
  },
  "required": ["id"]
}
```

---

## Discovery & Search

### `search_endpoints`
Search for endpoints across one or all docs.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Keyword to search in path, summary, etc." },
    "apiDocId": { "type": "string", "description": "Limit search to specific doc" },
    "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE", ...] },
    "tag": { "type": "string" },
    "limit": { "type": "number", "default": 20 }
  },
  "required": ["query"]
}
```

### `get_endpoint_info`
Get detailed schema information for a specific endpoint.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "apiDocId": { "type": "string" },
    "path": { "type": "string" },
    "method": { "type": "string" },
    "resolveSchemas": { "type": "boolean", "default": true }
  },
  "required": ["apiDocId", "path", "method"]
}
```

---

## Credentials Management

### `add_credential`
Store authentication details securely.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "type": { "type": "string", "enum": ["apiKey", "bearer", "basic", "oauth2", "custom", "customHeaders"] },
    "apiDocId": { "type": "string" },
    "apiKey": { "type": "string" },
    "token": { "type": "string" },
    "username": { "type": "string" },
    "password": { "type": "string" },
    
    // Smart Bearer Options
    "loginUrl": { "type": "string", "description": "Auto-login URL" },
    "loginBody": { "type": "object", "description": "Auto-login credential body" },
    "refreshUrl": { "type": "string", "description": "Auto-refresh URL" },
    "tokenPath": { "type": "string", "default": "token" },
    "refreshTokenPath": { "type": "string", "default": "refreshToken" }
    // ... extensive auth options
  },
  "required": ["id", "name", "type"]
}
```

---

## Execution

### `call_api`
Execute an API request against a known endpoint.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "apiDocId": { "type": "string" },
    "path": { "type": "string" },
    "method": { "type": "string" },
    "pathParams": { "type": "object" },
    "queryParams": { "type": "object" },
    "body": { "type": "object" },
    "credentialId": { "type": "string" }
  },
  "required": ["apiDocId", "path", "method"]
}
```
