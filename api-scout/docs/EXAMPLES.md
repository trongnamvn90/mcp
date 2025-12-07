# Usage Examples

## 1. Onboarding a New API

**Goal:** Add the "Petstore" API and prepare it for testing.

```json
// Tool: add_api_doc
{
  "id": "petstore",
  "name": "Petstore API",
  "specUrl": "https://petstore.swagger.io/v2/swagger.json",
  "apiHashUrl": "https://api.petstore.io/meta/hash" // Optional smart cache
}
```

## 2. Discovery

**Goal:** Find all endpoints related to "User Login".

```json
// Tool: search_endpoints
{
  "query": "login",
  "apiDocId": "petstore"
}
```

**Response:**
```json
[
  {
    "path": "/user/login",
    "method": "GET",
    "summary": "Logs user into the system",
    "score": 10
  }
]
```

## 3. Authentication Setup

**Goal:** Add an API Key for the Petstore.

```json
// Tool: add_credential
{
  "id": "petstore_prod",
  "name": "Production Key",
  "type": "apiKey",
  "apiDocId": "petstore",
  "apiKey": "special-key-123",
  "apiKeyHeader": "api_key"
}
```

## 4. Making a Call

**Goal:** Get user details using the stored credential.

```json
// Tool: call_api
{
  "apiDocId": "petstore",
  "path": "/user/{username}",
  "method": "GET",
  "pathParams": {
    "username": "trongnam"
  },
  "credentialId": "petstore_prod"
}
```
