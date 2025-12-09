# Advanced Usage Guide

## 1. Handling Complex Authentication

### Smart Bearer Authentication (Auto-Login & Refresh)

Some APIs require you to POST credentials to a login endpoint to get a token, which then expires after a certain time. The `bearer` credential type covers this automatically.

**Scenario:** You have a login endpoint `POST /auth/login` and a refresh endpoint `POST /auth/refresh`.

**Credential Configuration:**

```json
{
  "id": "my-app-auth",
  "name": "My App Smart Auth",
  "type": "bearer", // Use 'bearer' type
  "apiDocId": "my-app",
  
  // 1. Where to login? (Auto-Login)
  "loginUrl": "https://api.myapp.com/auth/login",
  "loginMethod": "POST",
  "loginBody": {
    "email": "user@example.com",
    "password": "secret_password"
  },
  
  // 2. Where to Refresh? (Auto-Refresh)
  "refreshUrl": "https://api.myapp.com/auth/refresh",
  "refreshMethod": "POST",
  "refreshTokenPath": "refreshToken",
  
  // 3. How to extract the token?
  "tokenPath": "accessToken", // If response is { accessToken: "..." }
  
  // 4. How to use the token?
  "tokenHeader": "Authorization",
  "tokenPrefix": "Bearer ",
  
  // 5. When to retry?
  "invalidStatusCodes": [401] // If API returns 401, API Scout will Refresh -> Retry -> Login -> Retry!
}
```

### Custom Headers (Multiple Keys)

Some legacy APIs require multiple static headers (e.g., `X-App-ID` AND `X-App-Key`).

```json
{
  "id": "legacy-api",
  "type": "customHeaders",
  "customHeaders": [
    { "name": "X-App-ID", "value": "123456" },
    { "name": "X-App-Key", "value": "abcdef" },
    { "name": "X-Environment", "value": "staging" }
  ]
}
```

## 2. Smart Caching Strategy

When using `apiHashUrl`, API Scout performs a "pre-flight" check before extensive operations (Search, List Endpoints).

**Optimization Tips:**
- **Keep the Hash Endpoint Lightweight:** It should return a simple string (MD5/SHA) and execute in < 10ms.
- **Hash Stability:** Ensure the hash only changes when the *implementation* changes. Avoid including timestamps or random nonces in the hash calculation.

## 3. Dealing with Self-Signed Certificates

If you are testing a local server (`https://localhost:3000`) with self-signed certificates, API Scout relies on the underlying Node.js `fetch` implementation. You may need to launch Claude Desktop with `NODE_TLS_REJECT_UNAUTHORIZED=0` if you face SSL errors (Warning: Only do this for local development!).
