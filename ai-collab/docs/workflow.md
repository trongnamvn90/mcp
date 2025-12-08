# AI Collaboration MCP - Workflow Guide

Detailed examples of how AI Worker and AI Reviewer collaborate throughout the development lifecycle.

## Table of Contents

- [Overview](#overview)
- [Complete Project Workflow](#complete-project-workflow)
- [Viewing Conversations](#viewing-conversations)
- [Phase-specific Examples](#phase-specific-examples)
- [Best Practices](#best-practices)

---

## Overview

### The Collaboration Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Development Lifecycle                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   User Request                                                         │
│        │                                                               │
│        ▼                                                               │
│   ┌─────────┐    submit     ┌─────────┐    review    ┌──────────┐    │
│   │   AI    │ ──────────►   │   MCP   │  ◄────────── │    AI    │    │
│   │ Worker  │               │ Storage │              │ Reviewer │    │
│   └─────────┘    feedback   └─────────┘   pending    └──────────┘    │
│        │       ◄──────────               ──────────►       │          │
│        │                                                    │          │
│        └────────────────── conversation ───────────────────┘          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Typical Flow

1. **User** tells AI Worker what they want
2. **AI Worker** discusses, clarifies, then produces work (docs/code/tests)
3. **AI Worker** submits work via `submit_work`
4. **AI Reviewer** picks up work via `get_pending_reviews`
5. **AI Reviewer** reviews and submits feedback via `submit_review`
6. **AI Worker** gets feedback via `get_review_feedback`
7. **AI Worker** responds and updates work
8. **Repeat** until approved
9. **User** can view entire conversation via `get_conversation`

---

## Viewing Conversations

### `get_conversation` Tool

View the complete dialogue between AI Worker and AI Reviewer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | No | Filter by project |
| `workItemId` | string | No | Filter by specific work item |
| `format` | string | No | `detailed` (default), `summary`, `timeline` |
| `limit` | number | No | Max messages (default: 100) |

**Example - View all conversations for a work item:**

```typescript
get_conversation({
  workItemId: "work_003",
  format: "detailed"
})
```

**Response:**

```typescript
{
  success: true,
  workItem: {
    id: "work_003",
    title: "AuthService implementation",
    type: "code"
  },
  conversation: [
    {
      timestamp: "2024-01-15T11:00:00Z",
      actor: "ai-worker-1",
      role: "worker",
      action: "submit",
      message: "Submitted code for review",
      content: {
        type: "submission",
        title: "AuthService implementation",
        version: 1
      }
    },
    {
      timestamp: "2024-01-15T12:00:00Z",
      actor: "ai-reviewer-1",
      role: "reviewer",
      action: "review",
      message: "Request changes: Security improvements needed",
      content: {
        verdict: "request_changes",
        summary: "Good structure but security concerns",
        suggestions: [
          { title: "Add rate limiting", severity: "critical" },
          { title: "Add account lockout", severity: "major" }
        ]
      }
    },
    {
      timestamp: "2024-01-15T13:00:00Z",
      actor: "ai-worker-1",
      role: "worker",
      action: "response",
      message: "Acknowledged: Will implement rate limiting and account lockout",
      content: {
        action: "will_fix",
        response: "Great catches! Will implement rate limiting using express-rate-limit..."
      }
    },
    {
      timestamp: "2024-01-15T14:00:00Z",
      actor: "ai-worker-1",
      role: "worker",
      action: "update",
      message: "Updated work item (v2): Added rate limiting and account lockout",
      content: {
        version: 2,
        changeDescription: "Added rate limiting and account lockout per security review",
        resolvedSuggestions: ["sug_001", "sug_002"]
      }
    },
    {
      timestamp: "2024-01-15T15:00:00Z",
      actor: "ai-reviewer-1",
      role: "reviewer",
      action: "review",
      message: "Approved: Excellent implementation!",
      content: {
        verdict: "approve",
        summary: "Security concerns properly addressed. Rate limiting and account lockout correctly implemented."
      }
    }
  ],
  summary: {
    totalMessages: 5,
    participants: ["ai-worker-1", "ai-reviewer-1"],
    duration: "4 hours",
    revisions: 2,
    outcome: "approved"
  }
}
```

**Example - Summary format:**

```typescript
get_conversation({
  projectId: "user-auth-api",
  format: "summary"
})
```

**Response:**

```typescript
{
  success: true,
  project: {
    id: "user-auth-api",
    name: "User Authentication API"
  },
  conversations: [
    {
      workItemId: "work_001",
      title: "Initial requirements discussion",
      type: "discussion",
      messages: 3,
      outcome: "approved",
      duration: "1 hour"
    },
    {
      workItemId: "work_002",
      title: "API Design",
      type: "design",
      messages: 4,
      outcome: "approved",
      duration: "2 hours"
    },
    {
      workItemId: "work_003",
      title: "AuthService implementation",
      type: "code",
      messages: 5,
      outcome: "approved",
      duration: "4 hours",
      highlight: "Security improvements after review"
    },
    {
      workItemId: "work_004",
      title: "AuthService tests",
      type: "test",
      messages: 2,
      outcome: "pending_review",
      duration: "ongoing"
    }
  ],
  totalMessages: 14,
  avgRevisionsPerItem: 1.5
}
```

**Example - Timeline format:**

```typescript
get_conversation({
  projectId: "user-auth-api",
  format: "timeline"
})
```

**Response:**

```
Timeline for: User Authentication API
=====================================

2024-01-15 09:00  [WORKER] Created project
2024-01-15 09:30  [WORKER] Submitted: Initial requirements discussion
2024-01-15 10:00  [REVIEWER] Reviewed: Approved with minor clarifications
2024-01-15 10:15  [WORKER] Responded: Clarifications added
2024-01-15 10:30  [REVIEWER] Approved: Requirements clear

2024-01-15 10:45  [WORKER] Submitted: API Design
2024-01-15 11:00  [REVIEWER] Reviewed: Request changes (endpoint naming)
2024-01-15 11:30  [WORKER] Updated: Renamed endpoints per review
2024-01-15 11:45  [REVIEWER] Approved: Design looks good

2024-01-15 12:00  [WORKER] Submitted: AuthService implementation (v1)
2024-01-15 12:30  [REVIEWER] Reviewed: Request changes (security)
         │        └── Critical: Add rate limiting
         │        └── Major: Add account lockout
2024-01-15 13:00  [WORKER] Responded: Will fix security issues
2024-01-15 14:00  [WORKER] Updated: AuthService implementation (v2)
2024-01-15 14:30  [REVIEWER] Approved: Security properly addressed

2024-01-15 15:00  [WORKER] Submitted: AuthService tests
2024-01-15 15:30  [REVIEWER] In review...
```

---

## Complete Project Workflow

### Example: Building a User Authentication API

#### Step 1: Create Project

**AI Worker:**
```typescript
// Worker creates a new project
create_project({
  id: "user-auth-api",
  name: "User Authentication API",
  description: "JWT-based authentication with refresh tokens for mobile app"
})
```

---

#### Step 2: Planning Phase - Requirements Discussion

**AI Worker discusses with User:**
```
User: "Tôi cần API login cho app mobile"

AI Worker: "Dạ, em sẽ cần clarify một số điểm:
1. Dùng JWT hay session-based auth?
2. Có cần refresh token không?
3. Có hỗ trợ 2FA không?
4. Giới hạn số thiết bị đăng nhập cùng lúc?"

User: "JWT, có refresh token 7 ngày, 2FA phase 2, max 3 devices"
```

**AI Worker submits discussion:**
```typescript
submit_work({
  projectId: "user-auth-api",
  type: "discussion",
  phase: "planning",
  title: "Requirements Discussion with User",
  content: `
## User Request
Build login API for mobile app

## Clarified Requirements

### Authentication Method
- JWT tokens with 1 hour expiry
- Refresh tokens with 7 day expiry
- Access token in header: Authorization: Bearer <token>

### Session Management
- Maximum 3 concurrent sessions per user
- On 4th login: oldest session is terminated automatically
- User can manually logout from specific devices

### Security
- 2FA support planned for Phase 2 (TOTP only)
- Rate limiting on login endpoint
- Account lockout after failed attempts

### Endpoints Needed
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/sessions
- DELETE /auth/sessions/:id
  `,
  metadata: {
    userRequest: "API login cho app mobile",
    tags: ["requirements", "auth", "jwt"]
  }
})
```

**AI Reviewer reviews:**
```typescript
// Reviewer gets pending items
get_pending_reviews({ projectId: "user-auth-api" })

// Reviewer checks details
get_work_detail({ workItemId: "work_001" })

// Reviewer submits review
submit_review({
  workItemId: "work_001",
  verdict: "request_changes",
  summary: "Requirements are mostly clear but need additional security considerations",
  suggestions: [
    {
      type: "security",
      severity: "major",
      title: "Define lockout policy",
      explanation: "Need to specify: How many failed attempts before lockout? How long is the lockout duration? Is it per-account or per-IP?"
    },
    {
      type: "clarity",
      severity: "minor",
      title: "Clarify token storage",
      explanation: "Should specify where client should store tokens (secure storage, not localStorage)"
    }
  ]
})
```

**AI Worker responds:**
```typescript
// Worker gets feedback
get_review_feedback({ workItemId: "work_001" })

// Worker responds
respond_to_review({
  workItemId: "work_001",
  reviewId: "review_001",
  response: "Good points! Will clarify with user about lockout policy and add token storage guidance.",
  action: "will_fix"
})

// After clarifying with user, Worker updates
update_work({
  workItemId: "work_001",
  content: `
## User Request
Build login API for mobile app

## Clarified Requirements

### Authentication Method
- JWT tokens with 1 hour expiry
- Refresh tokens with 7 day expiry
- Access token in header: Authorization: Bearer <token>
- **Token Storage: Must use secure storage (Keychain/Keystore), never localStorage**

### Session Management
- Maximum 3 concurrent sessions per user
- On 4th login: oldest session is terminated automatically
- User can manually logout from specific devices

### Security
- 2FA support planned for Phase 2 (TOTP only)
- Rate limiting: 10 attempts per 15 minutes per IP
- **Account lockout: 5 failed attempts = 15 minute lockout per account**
- **Lockout notification via email**

### Endpoints Needed
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/sessions
- DELETE /auth/sessions/:id
  `,
  changeDescription: "Added lockout policy details and token storage requirements per review",
  resolvedSuggestions: ["sug_001", "sug_002"]
})
```

**AI Reviewer approves:**
```typescript
submit_review({
  workItemId: "work_001",
  verdict: "approve",
  summary: "Requirements are now comprehensive with clear security policies."
})
```

---

#### Step 3: Design Phase

**AI Worker submits design:**
```typescript
submit_work({
  projectId: "user-auth-api",
  type: "design",
  phase: "planning",
  title: "Authentication API Design",
  content: `
## API Design

### POST /auth/login
Request:
\`\`\`json
{
  "email": "user@example.com",
  "password": "secret123"
}
\`\`\`

Response (200):
\`\`\`json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
\`\`\`

Response (401):
\`\`\`json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect"
}
\`\`\`

Response (423):
\`\`\`json
{
  "error": "ACCOUNT_LOCKED",
  "message": "Account is temporarily locked",
  "unlockAt": "2024-01-15T12:30:00Z"
}
\`\`\`

### POST /auth/refresh
...

### Database Schema
\`\`\`sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_hash VARCHAR(64),
  device_info JSONB,
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE TABLE login_attempts (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  ip_address INET,
  success BOOLEAN,
  created_at TIMESTAMP
);
\`\`\`
  `,
  metadata: {
    dependencies: ["work_001"],
    tags: ["design", "api", "database"]
  }
})
```

*... Reviewer reviews and approves ...*

---

#### Step 4: Development Phase - Code

**AI Worker submits code:**
```typescript
submit_work({
  projectId: "user-auth-api",
  type: "code",
  phase: "development",
  title: "AuthService Implementation",
  description: "Core authentication service with JWT handling",
  content: `
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private tokenRepo: RefreshTokenRepository,
    private loginAttemptRepo: LoginAttemptRepository,
    private config: AuthConfig
  ) {}

  async login(email: string, password: string, deviceInfo: DeviceInfo): Promise<LoginResult> {
    // Check lockout
    if (await this.isAccountLocked(email)) {
      const unlockAt = await this.getUnlockTime(email);
      throw new AccountLockedError(unlockAt);
    }

    // Find user
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      await this.recordFailedAttempt(email);
      throw new InvalidCredentialsError();
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      await this.recordFailedAttempt(email);
      throw new InvalidCredentialsError();
    }

    // Clear failed attempts
    await this.clearFailedAttempts(email);

    // Manage sessions (max 3)
    await this.enforceSessionLimit(user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, deviceInfo);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: this.config.accessTokenTTL,
      user: this.sanitizeUser(user)
    };
  }

  private async isAccountLocked(email: string): Promise<boolean> {
    const recentAttempts = await this.loginAttemptRepo.countRecent(
      email,
      this.config.lockoutWindow
    );
    return recentAttempts >= this.config.maxFailedAttempts;
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email },
      this.config.jwtSecret,
      { expiresIn: this.config.accessTokenTTL }
    );
  }

  // ... more methods
}
  `,
  metadata: {
    filename: "auth.service.ts",
    language: "typescript",
    dependencies: ["work_001", "work_002"]
  }
})
```

**AI Reviewer reviews code:**
```typescript
submit_review({
  workItemId: "work_003",
  verdict: "request_changes",
  summary: "Solid implementation but a few improvements needed",
  suggestions: [
    {
      type: "security",
      severity: "critical",
      title: "Timing attack vulnerability",
      explanation: "Using early return on user not found vs password mismatch allows timing attacks to enumerate valid emails",
      location: { startLine: 20, endLine: 26 },
      currentContent: `const user = await this.userRepo.findByEmail(email);
if (!user) {
  await this.recordFailedAttempt(email);
  throw new InvalidCredentialsError();
}`,
      suggestedContent: `const user = await this.userRepo.findByEmail(email);
// Always do password comparison to prevent timing attacks
const hashedPassword = user?.hashedPassword || '$2b$10$invalidhashplaceholder';
const isValid = await bcrypt.compare(password, hashedPassword);

if (!user || !isValid) {
  await this.recordFailedAttempt(email);
  throw new InvalidCredentialsError();
}`
    },
    {
      type: "improvement",
      severity: "minor",
      title: "Add logging for security events",
      explanation: "Login attempts (success/failure) should be logged for audit trail",
      suggestedContent: `this.logger.info('Login attempt', { email, success: true, ip: deviceInfo.ip });`
    }
  ]
})
```

**Conversation continues until approved...**

---

#### Step 5: Testing Phase

**AI Worker submits tests:**
```typescript
submit_work({
  projectId: "user-auth-api",
  type: "test",
  phase: "testing",
  title: "AuthService Unit Tests",
  content: `
describe('AuthService', () => {
  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      // ... test
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      // ... test
    });

    it('should throw AccountLockedError after max failed attempts', async () => {
      // ... test
    });

    it('should enforce session limit of 3', async () => {
      // ... test
    });

    it('should prevent timing attacks', async () => {
      // Compare response times for valid vs invalid emails
      // ... test
    });
  });
});
  `,
  metadata: {
    filename: "auth.service.spec.ts",
    language: "typescript",
    dependencies: ["work_003"]
  }
})
```

---

#### Step 6: View Full Conversation

**User/AI can view entire collaboration history:**

```typescript
get_conversation({
  projectId: "user-auth-api",
  format: "detailed"
})
```

This returns the complete dialogue between AI Worker and AI Reviewer across all work items.

---

## Phase-specific Examples

### Reviewing Documentation

```typescript
// Worker submits README
submit_work({
  projectId: "user-auth-api",
  type: "doc",
  phase: "development",
  title: "API Documentation",
  content: "# Authentication API\n\n## Getting Started\n...",
  metadata: { filename: "README.md" }
})

// Reviewer checks for clarity
submit_review({
  workItemId: "work_010",
  verdict: "request_changes",
  suggestions: [
    {
      type: "clarity",
      severity: "major",
      title: "Missing error handling section",
      explanation: "Docs should include common errors and how to handle them"
    },
    {
      type: "clarity",
      severity: "minor",
      title: "Add code examples",
      explanation: "Each endpoint should have curl/code examples"
    }
  ]
})
```

### Reviewing Test Coverage

```typescript
submit_review({
  workItemId: "work_005",
  verdict: "request_changes",
  summary: "Good test structure but coverage gaps",
  suggestions: [
    {
      type: "improvement",
      severity: "major",
      title: "Missing edge cases",
      explanation: "Need tests for: concurrent login from same device, token expiry edge cases, database connection failures"
    },
    {
      type: "improvement",
      severity: "minor",
      title: "Add integration tests",
      explanation: "Unit tests are good, but need integration tests for the full auth flow"
    }
  ]
})
```

---

## Best Practices

### For AI Worker

1. **Submit incrementally** - Don't wait until everything is perfect
2. **Provide context** - Always include user requirements and reasoning
3. **Link dependencies** - Reference related work items
4. **Respond thoughtfully** - Explain your decisions when disagreeing

### For AI Reviewer

1. **Be specific** - Point to exact lines/sections
2. **Provide solutions** - Don't just identify problems
3. **Prioritize** - Use severity levels correctly
4. **Be constructive** - Help worker improve

### For Both

1. **Use conversations** - `get_conversation` helps understand history
2. **Keep context** - Reference previous discussions
3. **Learn together** - Each review is a learning opportunity

---

## Troubleshooting

### Common Issues

**Q: Reviewer isn't seeing new submissions**
```typescript
// Ensure work status is 'pending_review'
get_work_detail({ workItemId: "work_xxx" })
```

**Q: Can't update work after approval**
```typescript
// Create new work item instead of updating approved one
submit_work({
  // ... new submission referencing the old one
  metadata: { dependencies: ["work_approved_xxx"] }
})
```

**Q: Lost track of conversation**
```typescript
// Use timeline format for quick overview
get_conversation({ projectId: "xxx", format: "timeline" })
```
