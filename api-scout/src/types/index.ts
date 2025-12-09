/**
 * Core types for API Testing MCP
 */

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  summary?: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
  tags?: string[];
  security?: ApiSecurity[];
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: ApiSchema;
  example?: unknown;
}

export interface ApiRequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, ApiMediaType>;
}

export interface ApiMediaType {
  schema?: ApiSchema;
  example?: unknown;
  examples?: Record<string, ApiExample>;
}

export interface ApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema;
  required?: string[];
  enum?: unknown[];
  description?: string;
  example?: unknown;
  $ref?: string;
  _circular?: boolean; // Marker for detected circular references
  _maxDepthReached?: boolean; // Marker for max recursion depth reached
}

export interface ApiResponse {
  description?: string;
  content?: Record<string, ApiMediaType>;
  headers?: Record<string, ApiParameter>;
}

export interface ApiExample {
  summary?: string;
  description?: string;
  value?: unknown;
}

export interface ApiSecurity {
  [key: string]: string[];
}

export interface ApiDoc {
  id: string;
  name: string;
  baseUrl: string;
  specUrl?: string;
  version?: string;
  description?: string;
  endpoints: ApiEndpoint[];
  schemas?: Record<string, ApiSchema>;
  securitySchemes?: Record<string, SecurityScheme>;
  apiHashUrl?: string; // URL to check for doc changes (returns hash)
  lastHash?: string;   // Last known hash of the docs
  addedAt: string;
  updatedAt: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}

export interface Credential {
  id: string;
  name: string;
  apiDocId?: string;
  type: 'apiKey' | 'bearer' | 'basic' | 'oauth2' | 'custom' | 'customHeaders';
  config: CredentialConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialConfig {
  // For API Key
  apiKey?: string;
  apiKeyHeader?: string;
  apiKeyQuery?: string;

  // For Bearer token
  token?: string;

  // For Basic auth
  username?: string;
  password?: string;

  // For OAuth2
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenUrl?: string;

  // Custom headers (legacy, max unlimited)
  headers?: Record<string, string>;

  // For customHeaders type (1-5 static headers)
  customHeaders?: Array<{ name: string; value: string }>;

  // Smart Bearer / dynamic config
  loginUrl?: string;
  loginMethod?: 'GET' | 'POST'; // Only GET/POST are conventional for auth
  loginBody?: Record<string, unknown>;
  loginHeaders?: Record<string, string>;
  tokenPath?: string; // JSON path to extract token, e.g., "data.token" or "token"
  tokenHeader?: string; // Header name to send token, default "Authorization"
  tokenPrefix?: string; // Prefix for token, e.g., "Bearer "
  invalidStatusCodes?: number[]; // Status codes that indicate invalid token, e.g., [401, 403]
  validityCheckUrl?: string; // Optional: URL to check token validity
  validityCheckMethod?: 'GET' | 'POST';
  refreshUrl?: string; // URL to refresh token
  refreshMethod?: 'GET' | 'POST';
  refreshTokenPath?: string; // JSON path to extract refresh token, default "refreshToken"
}

// Token cache for dynamic credentials
export interface TokenCache {
  credentialId: string;
  token: string;
  refreshToken?: string;
  obtainedAt: number; // timestamp
}

export interface ApiCallRequest {
  apiDocId: string;
  endpointPath: string;
  method: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  credentialId?: string;
}

export interface ApiCallResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

export interface StorageData {
  apiDocs: ApiDoc[];
  credentials: Credential[];
}

export interface SearchResult {
  apiDocId: string;
  apiDocName: string;
  endpoint: ApiEndpoint;
  score: number;
  matchedFields: string[];
}
