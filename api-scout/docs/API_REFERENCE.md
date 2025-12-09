# API Reference (Data Models)

## ApiDoc Object

Represents a registered OpenAPI specification.

```typescript
interface ApiDoc {
  id: string;          // Unique ID
  name: string;        // Human-readable name
  baseUrl: string;     // The root URL for API calls
  specUrl?: string;    // Source URL of the spec
  apiHashUrl?: string; // URL for smart caching checks
  lastHash?: string;   // Last known hash of the spec
  endpoints: ApiEndpoint[];
  addedAt: string;     // ISO timestamp
}
```

## Credential Object

Stores authentication configuration.

```typescript
interface Credential {
  id: string;
  name: string;
  type: 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'custom' | 'customHeaders';
  apiDocId?: string;   // Associated API Doc
  config: {
    // Type-specific fields
    apiKey?: string;
    token?: string;
    username?: string; 
    password?: string;
    // ...
  };
}
```

## ApiEndpoint Object

Normalized representation of an OpenAPI operation.

```typescript
interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | ...;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
}
```
