# AI Collaboration MCP - API Reference

Complete reference for all tools available in AI Collaboration MCP.

## Table of Contents

- [Project Management](#project-management)
- [Worker Tools](#worker-tools)
- [Reviewer Tools](#reviewer-tools)
- [Shared Tools](#shared-tools)
- [Error Handling](#error-handling)

---

## Project Management

### `create_project`

Create a new collaboration project. A project groups related work items together.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (lowercase, hyphens allowed) |
| `name` | string | Yes | Human-readable project name |
| `description` | string | No | Project description and goals |
| `settings` | object | No | Project-specific settings |

**Settings Object:**

```typescript
{
  requireApproval?: boolean;      // Require reviewer approval (default: true)
  autoAssignReviewer?: boolean;   // Auto-assign reviewer (default: false)
  allowSelfReview?: boolean;      // Allow worker to review own work (default: false)
  notifyOnSubmit?: boolean;       // Notify reviewer on new submissions (default: true)
}
```

**Example:**

```typescript
create_project({
  id: "user-auth-api",
  name: "User Authentication API",
  description: "Implement JWT-based authentication with refresh tokens",
  settings: {
    requireApproval: true
  }
})
```

**Response:**

```typescript
{
  success: true,
  project: {
    id: "user-auth-api",
    name: "User Authentication API",
    status: "active",
    createdAt: "2024-01-15T10:00:00Z"
  }
}
```

---

### `get_project`

Get detailed information about a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `includeStats` | boolean | No | Include work item statistics (default: true) |

**Example:**

```typescript
get_project({
  projectId: "user-auth-api",
  includeStats: true
})
```

**Response:**

```typescript
{
  success: true,
  project: {
    id: "user-auth-api",
    name: "User Authentication API",
    description: "...",
    status: "active",
    settings: { ... },
    stats: {
      totalWorkItems: 12,
      byStatus: {
        draft: 1,
        pending_review: 2,
        in_review: 1,
        changes_requested: 1,
        approved: 5,
        merged: 2
      },
      byType: {
        discussion: 3,
        code: 5,
        test: 2,
        doc: 2
      }
    },
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-16T14:30:00Z"
  }
}
```

---

### `list_projects`

List all projects with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | string | No | Filter by status: `active`, `completed`, `archived` |
| `limit` | number | No | Max results (default: 20) |
| `offset` | number | No | Pagination offset (default: 0) |

**Example:**

```typescript
list_projects({
  status: "active",
  limit: 10
})
```

---

### `update_project`

Update project settings or status.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `name` | string | No | New project name |
| `description` | string | No | New description |
| `status` | string | No | New status |
| `settings` | object | No | Updated settings (merged with existing) |

---

### `archive_project`

Archive a completed project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `reason` | string | No | Reason for archiving |

---

## Worker Tools

Tools primarily used by the AI Worker (the AI working directly with users).

### `submit_work`

Submit work for review. This is the primary tool for AI Worker.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project to submit to |
| `type` | string | Yes | Work type (see below) |
| `phase` | string | Yes | Current phase (see below) |
| `title` | string | Yes | Brief title |
| `description` | string | No | Detailed description |
| `content` | string | Yes | The actual content (code, doc, etc.) |
| `metadata` | object | No | Additional metadata |

**Work Types:**

| Type | Use For |
|------|---------|
| `discussion` | Conversations, clarifications with user |
| `requirement` | Formal requirements, user stories |
| `design` | Architecture, API design, diagrams |
| `code` | Source code, scripts |
| `test` | Unit tests, integration tests |
| `doc` | Documentation, README, comments |

**Phases:**

| Phase | Description |
|-------|-------------|
| `planning` | Initial discussions, requirements gathering |
| `development` | Active development of code/docs |
| `testing` | Writing and running tests |
| `review` | Final review before completion |

**Metadata Object:**

```typescript
{
  filename?: string;        // File name for code/docs
  language?: string;        // Programming language
  userRequest?: string;     // Original user request (important for context)
  dependencies?: string[];  // IDs of related work items
  tags?: string[];          // Searchable tags
  priority?: 'low' | 'medium' | 'high' | 'critical';
}
```

**Example - Submitting Discussion:**

```typescript
submit_work({
  projectId: "user-auth-api",
  type: "discussion",
  phase: "planning",
  title: "Initial requirements discussion",
  content: `
    User requested authentication API with:
    - JWT tokens with 1 hour expiry
    - Refresh tokens with 7 day expiry
    - Support for 2FA (optional, phase 2)
    - Maximum 3 concurrent sessions per user

    Questions clarified:
    - Q: What happens on 4th login? A: Oldest session is terminated
    - Q: 2FA methods? A: TOTP only for now
  `,
  metadata: {
    userRequest: "I want to create a secure login API for my app",
    tags: ["auth", "jwt", "security"]
  }
})
```

**Example - Submitting Code:**

```typescript
submit_work({
  projectId: "user-auth-api",
  type: "code",
  phase: "development",
  title: "AuthService implementation",
  description: "Core authentication service with JWT handling",
  content: `
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return this.generateTokenPair(user);
  }

  // ... more methods
}
  `,
  metadata: {
    filename: "auth.service.ts",
    language: "typescript",
    dependencies: ["work_001", "work_002"]  // Discussion and design items
  }
})
```

**Response:**

```typescript
{
  success: true,
  workItem: {
    id: "work_003",
    projectId: "user-auth-api",
    type: "code",
    phase: "development",
    title: "AuthService implementation",
    status: "pending_review",
    version: 1,
    submittedAt: "2024-01-15T11:00:00Z"
  }
}
```

---

### `get_review_feedback`

Get all reviews and suggestions for a work item.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workItemId` | string | Yes | Work item ID |
| `includeResolved` | boolean | No | Include resolved suggestions (default: false) |

**Example:**

```typescript
get_review_feedback({
  workItemId: "work_003"
})
```

**Response:**

```typescript
{
  success: true,
  workItem: {
    id: "work_003",
    title: "AuthService implementation",
    status: "changes_requested",
    version: 1
  },
  reviews: [
    {
      id: "review_001",
      reviewerId: "ai-reviewer-1",
      verdict: "request_changes",
      summary: "Good structure but security improvements needed",
      suggestions: [
        {
          id: "sug_001",
          type: "security",
          severity: "critical",
          title: "Add rate limiting",
          explanation: "Login endpoint should have rate limiting to prevent brute force attacks",
          status: "pending"
        },
        {
          id: "sug_002",
          type: "security",
          severity: "major",
          title: "Add account lockout",
          explanation: "Lock account after 5 failed attempts",
          location: { startLine: 10, endLine: 15 },
          currentContent: "if (!isValid) {\n  throw new UnauthorizedError('Invalid credentials');\n}",
          suggestedContent: "if (!isValid) {\n  await this.recordFailedAttempt(user.id);\n  if (await this.isAccountLocked(user.id)) {\n    throw new AccountLockedError();\n  }\n  throw new UnauthorizedError('Invalid credentials');\n}",
          status: "pending"
        }
      ],
      createdAt: "2024-01-15T12:00:00Z"
    }
  ],
  summary: {
    totalReviews: 1,
    pendingSuggestions: 2,
    bySeverity: {
      critical: 1,
      major: 1
    }
  }
}
```

---

### `respond_to_review`

Respond to a reviewer's feedback.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workItemId` | string | Yes | Work item ID |
| `reviewId` | string | Yes | Review ID to respond to |
| `response` | string | Yes | Your response text |
| `action` | string | Yes | Action type (see below) |

**Actions:**

| Action | Meaning |
|--------|---------|
| `acknowledged` | Understood, no action needed |
| `will_fix` | Will address in next update |
| `need_discussion` | Need to discuss further |
| `disagree` | Respectfully disagree with suggestion |

**Example:**

```typescript
respond_to_review({
  workItemId: "work_003",
  reviewId: "review_001",
  response: "Great catches! Will implement rate limiting using express-rate-limit and add account lockout logic.",
  action: "will_fix"
})
```

---

### `update_work`

Update work item after addressing feedback.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workItemId` | string | Yes | Work item ID |
| `content` | string | Yes | Updated content |
| `changeDescription` | string | Yes | Description of changes made |
| `resolvedSuggestions` | string[] | No | IDs of suggestions resolved by this update |

**Example:**

```typescript
update_work({
  workItemId: "work_003",
  content: `
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  async login(email: string, password: string): Promise<TokenPair> {
    // Check if account is locked
    if (await this.isAccountLocked(email)) {
      throw new AccountLockedError('Account temporarily locked');
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Clear failed attempts on successful login
    await this.clearFailedAttempts(email);

    return this.generateTokenPair(user);
  }

  // Rate limiter middleware
  static readonly loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts'
  });

  // ... more methods
}
  `,
  changeDescription: "Added rate limiting and account lockout per security review",
  resolvedSuggestions: ["sug_001", "sug_002"]
})
```

**Response:**

```typescript
{
  success: true,
  workItem: {
    id: "work_003",
    version: 2,  // Version incremented
    status: "pending_review",  // Back to pending for re-review
    updatedAt: "2024-01-15T14:00:00Z"
  }
}
```

---

### `mark_suggestion_resolved`

Mark a specific suggestion as resolved.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `suggestionId` | string | Yes | Suggestion ID |
| `resolution` | string | Yes | `accepted`, `rejected`, `partially_accepted` |
| `comment` | string | No | Explanation of resolution |

**Example:**

```typescript
mark_suggestion_resolved({
  suggestionId: "sug_001",
  resolution: "accepted",
  comment: "Implemented using express-rate-limit with 10 requests per 15 minutes"
})
```

---

## Reviewer Tools

Tools primarily used by the AI Reviewer.

### `get_pending_reviews`

Get work items awaiting review.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | No | Filter by project |
| `type` | string | No | Filter by work type |
| `phase` | string | No | Filter by phase |
| `priority` | string | No | Filter by priority |
| `limit` | number | No | Max results (default: 20) |

**Example:**

```typescript
get_pending_reviews({
  projectId: "user-auth-api",
  type: "code"
})
```

**Response:**

```typescript
{
  success: true,
  pendingReviews: [
    {
      id: "work_003",
      projectId: "user-auth-api",
      type: "code",
      phase: "development",
      title: "AuthService implementation",
      description: "Core authentication service with JWT handling",
      status: "pending_review",
      version: 2,
      submittedBy: "ai-worker-1",
      submittedAt: "2024-01-15T14:00:00Z",
      metadata: {
        filename: "auth.service.ts",
        language: "typescript",
        priority: "high"
      },
      previousReviews: 1,  // Has been reviewed before
      hasUnresolvedSuggestions: false
    }
  ],
  total: 1
}
```

---

### `get_work_detail`

Get detailed information about a work item for review.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workItemId` | string | Yes | Work item ID |
| `includeHistory` | boolean | No | Include revision history (default: false) |
| `includeContext` | boolean | No | Include related items (default: true) |

**Example:**

```typescript
get_work_detail({
  workItemId: "work_003",
  includeHistory: true,
  includeContext: true
})
```

**Response:**

```typescript
{
  success: true,
  workItem: {
    id: "work_003",
    projectId: "user-auth-api",
    type: "code",
    phase: "development",
    title: "AuthService implementation",
    description: "Core authentication service with JWT handling",
    content: "import jwt from 'jsonwebtoken';\n...",
    metadata: {
      filename: "auth.service.ts",
      language: "typescript",
      userRequest: "Create secure login API",
      dependencies: ["work_001", "work_002"]
    },
    status: "pending_review",
    version: 2,
    submittedBy: "ai-worker-1",
    submittedAt: "2024-01-15T14:00:00Z"
  },
  history: [
    {
      version: 1,
      content: "// Original version...",
      submittedAt: "2024-01-15T11:00:00Z",
      changeDescription: "Initial submission"
    },
    {
      version: 2,
      content: "// Current version...",
      submittedAt: "2024-01-15T14:00:00Z",
      changeDescription: "Added rate limiting and account lockout per security review"
    }
  ],
  context: {
    dependencies: [
      {
        id: "work_001",
        type: "discussion",
        title: "Initial requirements discussion",
        status: "approved"
      },
      {
        id: "work_002",
        type: "design",
        title: "Auth API Design",
        status: "approved"
      }
    ],
    relatedItems: [
      {
        id: "work_004",
        type: "test",
        title: "AuthService unit tests",
        status: "draft"
      }
    ]
  },
  previousReviews: [
    {
      id: "review_001",
      verdict: "request_changes",
      summary: "Security improvements needed",
      suggestionsCount: 2,
      allResolved: true
    }
  ]
}
```

---

### `submit_review`

Submit a review for a work item.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workItemId` | string | Yes | Work item ID |
| `verdict` | string | Yes | `approve`, `request_changes`, `comment` |
| `summary` | string | Yes | Review summary |
| `suggestions` | array | No | List of suggestions |

**Verdicts:**

| Verdict | Meaning | Effect |
|---------|---------|--------|
| `approve` | Work is acceptable | Status → `approved` |
| `request_changes` | Changes needed | Status → `changes_requested` |
| `comment` | Feedback only | Status unchanged |

**Suggestion Object:**

```typescript
{
  type: 'improvement' | 'bug' | 'security' | 'performance' | 'style' | 'clarity';
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  explanation: string;
  location?: {
    startLine?: number;
    endLine?: number;
    section?: string;  // For docs
  };
  currentContent?: string;
  suggestedContent?: string;
}
```

**Example - Approval:**

```typescript
submit_review({
  workItemId: "work_003",
  verdict: "approve",
  summary: "Excellent implementation! Security concerns from previous review have been properly addressed. Rate limiting and account lockout are correctly implemented."
})
```

**Example - Request Changes:**

```typescript
submit_review({
  workItemId: "work_005",
  verdict: "request_changes",
  summary: "Test coverage is incomplete",
  suggestions: [
    {
      type: "improvement",
      severity: "major",
      title: "Missing edge case tests",
      explanation: "Need tests for: expired token, invalid token format, locked account",
      location: { section: "describe('login')" }
    },
    {
      type: "improvement",
      severity: "minor",
      title: "Add integration test",
      explanation: "Consider adding an integration test that tests the full login flow",
    }
  ]
})
```

**Response:**

```typescript
{
  success: true,
  review: {
    id: "review_002",
    workItemId: "work_003",
    verdict: "approve",
    summary: "Excellent implementation!...",
    createdAt: "2024-01-15T15:00:00Z"
  },
  workItemStatus: "approved"  // Updated status
}
```

---

### `add_suggestion`

Add a suggestion to an existing review.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reviewId` | string | Yes | Review ID |
| `type` | string | Yes | Suggestion type |
| `severity` | string | Yes | Severity level |
| `title` | string | Yes | Brief title |
| `explanation` | string | Yes | Detailed explanation |
| `location` | object | No | Location in content |
| `currentContent` | string | No | Current code/text |
| `suggestedContent` | string | No | Suggested replacement |

**Example:**

```typescript
add_suggestion({
  reviewId: "review_002",
  type: "performance",
  severity: "minor",
  title: "Consider caching user lookup",
  explanation: "Frequently accessed users could be cached to reduce database queries",
  location: { startLine: 15, endLine: 16 },
  currentContent: "const user = await this.userRepo.findByEmail(email);",
  suggestedContent: "const user = await this.userCache.getOrFetch(email, () => this.userRepo.findByEmail(email));"
})
```

---

## Shared Tools

Tools available to both Worker and Reviewer.

### `get_project_context`

Get comprehensive context of a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `includeContent` | boolean | No | Include full content (default: false) |
| `includeResolved` | boolean | No | Include resolved items (default: false) |

**Example:**

```typescript
get_project_context({
  projectId: "user-auth-api",
  includeContent: false
})
```

**Response:**

```typescript
{
  success: true,
  project: {
    id: "user-auth-api",
    name: "User Authentication API",
    description: "...",
    status: "active"
  },
  workItems: [
    {
      id: "work_001",
      type: "discussion",
      title: "Initial requirements",
      status: "approved",
      summary: "JWT auth with refresh tokens, 2FA optional"
    },
    {
      id: "work_002",
      type: "design",
      title: "API Design",
      status: "approved",
      summary: "REST endpoints for auth flow"
    },
    {
      id: "work_003",
      type: "code",
      title: "AuthService",
      status: "approved",
      summary: "Core auth logic with rate limiting"
    },
    {
      id: "work_004",
      type: "test",
      title: "AuthService tests",
      status: "pending_review",
      summary: "Unit tests for AuthService"
    }
  ],
  timeline: [
    { date: "2024-01-15", event: "Project created" },
    { date: "2024-01-15", event: "Requirements approved" },
    { date: "2024-01-15", event: "Design approved" },
    { date: "2024-01-15", event: "Code approved after 1 revision" }
  ]
}
```

---

### `get_history`

Get detailed history of work items and reviews.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | No | Filter by project |
| `workItemId` | string | No | Filter by work item |
| `eventTypes` | string[] | No | Filter by event types |
| `limit` | number | No | Max results (default: 50) |
| `offset` | number | No | Pagination offset |

**Event Types:** `submit`, `review`, `update`, `approve`, `reject`, `comment`, `response`

**Example:**

```typescript
get_history({
  workItemId: "work_003",
  limit: 20
})
```

---

### `get_conversation`

**View the complete dialogue between AI Worker and AI Reviewer.** This is the key tool for understanding how decisions were made.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | No | Filter by project |
| `workItemId` | string | No | Filter by specific work item |
| `format` | string | No | Output format: `detailed` (default), `summary`, `timeline` |
| `limit` | number | No | Max messages (default: 100) |
| `offset` | number | No | Pagination offset for large histories |

**Formats:**

| Format | Description | Use Case |
|--------|-------------|----------|
| `detailed` | Full conversation with all content | Deep dive into specific discussions |
| `summary` | High-level overview | Quick status check |
| `timeline` | Chronological event list | Understanding project progression |

**Example - Detailed conversation:**

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
      actor: "ai-worker-claude",
      role: "worker",
      action: "submit",
      message: "Submitted code for review: AuthService implementation (v1)",
      content: {
        type: "submission",
        title: "AuthService implementation",
        version: 1,
        contentPreview: "import jwt from 'jsonwebtoken';\nimport bcrypt..."
      }
    },
    {
      timestamp: "2024-01-15T12:00:00Z",
      actor: "ai-reviewer-gpt",
      role: "reviewer",
      action: "review",
      message: "Reviewed with verdict: request_changes",
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
      actor: "ai-worker-claude",
      role: "worker",
      action: "response",
      message: "Responded: will_fix",
      content: {
        action: "will_fix",
        response: "Great catches! Will implement rate limiting and account lockout."
      }
    },
    {
      timestamp: "2024-01-15T14:00:00Z",
      actor: "ai-worker-claude",
      role: "worker",
      action: "update",
      message: "Updated work item (v2)",
      content: {
        version: 2,
        changeDescription: "Added rate limiting and account lockout per security review",
        resolvedSuggestions: ["sug_001", "sug_002"]
      }
    },
    {
      timestamp: "2024-01-15T15:00:00Z",
      actor: "ai-reviewer-gpt",
      role: "reviewer",
      action: "approve",
      message: "Approved",
      content: {
        verdict: "approve",
        summary: "Excellent implementation! Security concerns properly addressed."
      }
    }
  ],
  summary: {
    totalMessages: 5,
    participants: ["ai-worker-claude", "ai-reviewer-gpt"],
    duration: "4 hours",
    revisions: 2,
    outcome: "approved"
  }
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

```typescript
{
  success: true,
  project: {
    id: "user-auth-api",
    name: "User Authentication API"
  },
  timeline: [
    { time: "2024-01-15 09:00", actor: "worker", action: "⚡ Created project" },
    { time: "2024-01-15 09:30", actor: "worker", action: "📝 Submitted: Requirements Discussion" },
    { time: "2024-01-15 10:00", actor: "reviewer", action: "✅ Approved: Requirements" },
    { time: "2024-01-15 10:45", actor: "worker", action: "📝 Submitted: API Design" },
    { time: "2024-01-15 11:00", actor: "reviewer", action: "⚠️ Request changes (1 suggestion)" },
    { time: "2024-01-15 11:30", actor: "worker", action: "🔄 Updated: API Design (v2)" },
    { time: "2024-01-15 11:45", actor: "reviewer", action: "✅ Approved: API Design" },
    { time: "2024-01-15 12:00", actor: "worker", action: "📝 Submitted: AuthService (code)" },
    { time: "2024-01-15 12:30", actor: "reviewer", action: "⚠️ Request changes (2 suggestions)" },
    { time: "2024-01-15 13:00", actor: "worker", action: "💬 Responded: will_fix" },
    { time: "2024-01-15 14:00", actor: "worker", action: "🔄 Updated: AuthService (v2)" },
    { time: "2024-01-15 14:30", actor: "reviewer", action: "✅ Approved: AuthService" }
  ],
  stats: {
    totalEvents: 12,
    duration: "5.5 hours"
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
      title: "Requirements Discussion",
      type: "discussion",
      messages: 3,
      revisions: 1,
      outcome: "approved",
      duration: "1h",
      highlights: []
    },
    {
      workItemId: "work_002",
      title: "API Design",
      type: "design",
      messages: 4,
      revisions: 2,
      outcome: "approved",
      duration: "1h 15m",
      highlights: ["Endpoint naming revised"]
    },
    {
      workItemId: "work_003",
      title: "AuthService implementation",
      type: "code",
      messages: 5,
      revisions: 2,
      outcome: "approved",
      duration: "2h 30m",
      highlights: ["Security improvements: rate limiting, account lockout"]
    }
  ],
  totals: {
    totalMessages: 12,
    totalRevisions: 5,
    avgRevisionsPerItem: 1.67,
    totalDuration: "5h 30m",
    approvalRate: "100%"
  }
}
```

---

### `search_work`

Search across all work items.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `projectId` | string | No | Filter by project |
| `type` | string | No | Filter by type |
| `status` | string | No | Filter by status |
| `limit` | number | No | Max results (default: 20) |

**Example:**

```typescript
search_work({
  query: "authentication JWT",
  type: "code"
})
```

---

## Error Handling

All tools return consistent error responses:

```typescript
{
  success: false,
  error: {
    code: "WORK_ITEM_NOT_FOUND",
    message: "Work item with ID 'work_999' not found",
    suggestion: "Use list_work_items to see available items"
  }
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| `PROJECT_NOT_FOUND` | Project ID doesn't exist |
| `WORK_ITEM_NOT_FOUND` | Work item ID doesn't exist |
| `REVIEW_NOT_FOUND` | Review ID doesn't exist |
| `INVALID_STATUS_TRANSITION` | Cannot change to requested status |
| `PERMISSION_DENIED` | Action not allowed for this role |
| `VALIDATION_ERROR` | Invalid parameters |

---

## Rate Limiting

The MCP does not impose rate limits, but storage operations are atomic to prevent data corruption.

## Data Persistence

All data is persisted to `~/.mcp-ai-collab/data.json`. The file is written atomically to prevent corruption.

Backup is recommended before major operations:
```bash
cp ~/.mcp-ai-collab/data.json ~/.mcp-ai-collab/data.backup.json
```
