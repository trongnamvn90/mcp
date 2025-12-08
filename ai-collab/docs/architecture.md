# AI Collaboration MCP - Architecture

Technical architecture and design decisions.

## Table of Contents

- [Storage Architecture](#storage-architecture)
- [Conversation Storage](#conversation-storage)
- [Scalability Options](#scalability-options)
- [Data Flow](#data-flow)

---

## Storage Architecture

### Storage Options

The MCP supports multiple storage backends depending on your needs:

#### Option 1: JSON File (Default)

```
~/.mcp-ai-collab/
├── data.json           # All data in single file
└── backups/            # Auto-backup before major ops
    ├── data.2024-01-15.json
    └── data.2024-01-16.json
```

**Pros:**
- Zero setup required
- Easy to backup (just copy the file)
- Human-readable, can edit manually
- Portable between machines

**Cons:**
- Gets slow with large projects (>10MB)
- No concurrent access from multiple processes
- All data loaded in memory

**Best for:** Individual use, small-medium projects

---

#### Option 2: SQLite (Recommended for large projects)

```
~/.mcp-ai-collab/
├── collab.db           # SQLite database
└── collab.db-wal       # Write-ahead log
```

**Schema:**
```sql
-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  settings JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Work Items
CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  type TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  metadata JSON,
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  submitted_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Work Item History (for versioning)
CREATE TABLE work_item_history (
  id TEXT PRIMARY KEY,
  work_item_id TEXT REFERENCES work_items(id),
  version INTEGER,
  content TEXT,
  change_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  work_item_id TEXT REFERENCES work_items(id),
  work_item_version INTEGER,
  reviewer_id TEXT,
  verdict TEXT,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Suggestions
CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES reviews(id),
  type TEXT,
  severity TEXT,
  title TEXT,
  explanation TEXT,
  location JSON,
  current_content TEXT,
  suggested_content TEXT,
  status TEXT DEFAULT 'pending',
  resolution JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review Responses
CREATE TABLE review_responses (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES reviews(id),
  responder_id TEXT,
  response TEXT,
  action TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation Events (for get_conversation)
CREATE TABLE conversation_events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  work_item_id TEXT REFERENCES work_items(id),
  actor_id TEXT,
  actor_role TEXT,  -- 'worker' or 'reviewer'
  action TEXT,      -- 'submit', 'review', 'response', 'update', 'approve'
  message TEXT,
  content JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX idx_work_items_project ON work_items(project_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_reviews_work_item ON reviews(work_item_id);
CREATE INDEX idx_conversation_project ON conversation_events(project_id);
CREATE INDEX idx_conversation_work_item ON conversation_events(work_item_id);
CREATE INDEX idx_conversation_created ON conversation_events(created_at);
```

**Pros:**
- Fast queries even with large datasets
- Supports concurrent read access
- Built-in indexing
- Still file-based, easy to backup

**Cons:**
- Slightly more complex
- Requires sqlite3 dependency

**Best for:** Large projects, long-running collaboration

---

#### Option 3: PostgreSQL (For team/multi-machine)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ai_collab
      POSTGRES_USER: collab
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

**Configuration:**
```typescript
// Environment variables
AI_COLLAB_STORAGE=postgres
AI_COLLAB_DATABASE_URL=postgresql://collab:secret@localhost:5432/ai_collab
```

**Pros:**
- True concurrent access from multiple machines
- ACID transactions
- Advanced querying capabilities
- Scalable to very large datasets

**Cons:**
- Requires server setup
- More operational overhead
- Network latency

**Best for:** Teams, multiple AI instances on different machines

---

## Conversation Storage

### How Conversations are Stored

Every action in the system generates a **Conversation Event**:

```typescript
interface ConversationEvent {
  id: string;
  projectId: string;
  workItemId?: string;

  // Who did what
  actorId: string;           // AI identifier
  actorRole: 'worker' | 'reviewer';
  action: ConversationAction;

  // What was said/done
  message: string;           // Human-readable summary
  content: EventContent;     // Structured data

  createdAt: Date;
}

type ConversationAction =
  | 'create_project'
  | 'submit'           // Worker submits work
  | 'review'           // Reviewer reviews
  | 'response'         // Worker responds to review
  | 'update'           // Worker updates work
  | 'approve'          // Final approval
  | 'reject'           // Rejection
  | 'comment';         // General comment

interface EventContent {
  // For submissions
  submission?: {
    type: string;
    title: string;
    version: number;
    contentPreview: string;  // First 500 chars
  };

  // For reviews
  review?: {
    verdict: string;
    summary: string;
    suggestionsCount: number;
    suggestions: Array<{
      title: string;
      severity: string;
    }>;
  };

  // For responses
  response?: {
    action: string;
    response: string;
  };

  // For updates
  update?: {
    version: number;
    changeDescription: string;
    resolvedSuggestions: string[];
  };
}
```

### Conversation Event Examples

**When Worker submits:**
```json
{
  "id": "evt_001",
  "projectId": "user-auth-api",
  "workItemId": "work_003",
  "actorId": "ai-worker-claude",
  "actorRole": "worker",
  "action": "submit",
  "message": "Submitted code for review: AuthService implementation (v1)",
  "content": {
    "submission": {
      "type": "code",
      "title": "AuthService implementation",
      "version": 1,
      "contentPreview": "import jwt from 'jsonwebtoken';\nimport bcrypt..."
    }
  },
  "createdAt": "2024-01-15T11:00:00Z"
}
```

**When Reviewer reviews:**
```json
{
  "id": "evt_002",
  "projectId": "user-auth-api",
  "workItemId": "work_003",
  "actorId": "ai-reviewer-gpt",
  "actorRole": "reviewer",
  "action": "review",
  "message": "Reviewed with verdict: request_changes",
  "content": {
    "review": {
      "verdict": "request_changes",
      "summary": "Good structure but security concerns",
      "suggestionsCount": 2,
      "suggestions": [
        { "title": "Add rate limiting", "severity": "critical" },
        { "title": "Add account lockout", "severity": "major" }
      ]
    }
  },
  "createdAt": "2024-01-15T12:00:00Z"
}
```

---

## How to View Conversations

### Using `get_conversation` Tool

#### Detailed Format (Default)

Shows full conversation with all details:

```typescript
get_conversation({
  workItemId: "work_003",
  format: "detailed"
})
```

Output:
```
📋 Conversation: AuthService implementation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2024-01-15 11:00] 🔨 WORKER (ai-worker-claude)
Action: submit
────────────────────────────────────────
Submitted code for review: AuthService implementation (v1)

Type: code | Phase: development | Version: 1
Preview: import jwt from 'jsonwebtoken';...

═══════════════════════════════════════════════════════

[2024-01-15 12:00] 👀 REVIEWER (ai-reviewer-gpt)
Action: review
Verdict: ❌ REQUEST_CHANGES
────────────────────────────────────────
Good structure but security concerns

Suggestions (2):
  🔴 [CRITICAL] Add rate limiting
  🟠 [MAJOR] Add account lockout

═══════════════════════════════════════════════════════

[2024-01-15 13:00] 🔨 WORKER (ai-worker-claude)
Action: response
────────────────────────────────────────
Action: will_fix
Great catches! Will implement rate limiting and account lockout.

═══════════════════════════════════════════════════════

[2024-01-15 14:00] 🔨 WORKER (ai-worker-claude)
Action: update
────────────────────────────────────────
Updated work item to version 2
Change: Added rate limiting and account lockout per security review
Resolved: sug_001, sug_002

═══════════════════════════════════════════════════════

[2024-01-15 15:00] 👀 REVIEWER (ai-reviewer-gpt)
Action: approve
Verdict: ✅ APPROVED
────────────────────────────────────────
Excellent implementation! Security concerns properly addressed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 5 messages | 2 participants | 4 hours | Outcome: APPROVED
```

#### Timeline Format

Compact timeline view:

```typescript
get_conversation({
  projectId: "user-auth-api",
  format: "timeline"
})
```

Output:
```
Timeline: User Authentication API
=================================

Jan 15, 2024
------------
09:00  ⚡ Project created by ai-worker-claude
09:30  📝 [WORKER] Submitted: Requirements Discussion
10:00  👀 [REVIEWER] Reviewed: approved
10:45  📝 [WORKER] Submitted: API Design
11:00  👀 [REVIEWER] Reviewed: request_changes (1 suggestion)
11:30  🔄 [WORKER] Updated: API Design (v2)
11:45  👀 [REVIEWER] Reviewed: approved
12:00  📝 [WORKER] Submitted: AuthService (code)
12:30  👀 [REVIEWER] Reviewed: request_changes
       └── 🔴 Critical: Add rate limiting
       └── 🟠 Major: Add account lockout
13:00  💬 [WORKER] Responded: will_fix
14:00  🔄 [WORKER] Updated: AuthService (v2)
14:30  👀 [REVIEWER] Reviewed: approved ✅

Summary: 12 events | Duration: 5.5 hours
```

#### Summary Format

High-level overview:

```typescript
get_conversation({
  projectId: "user-auth-api",
  format: "summary"
})
```

Output:
```json
{
  "project": "User Authentication API",
  "conversations": [
    {
      "workItem": "Requirements Discussion",
      "type": "discussion",
      "messages": 3,
      "revisions": 1,
      "outcome": "approved",
      "duration": "1h"
    },
    {
      "workItem": "API Design",
      "type": "design",
      "messages": 4,
      "revisions": 2,
      "outcome": "approved",
      "duration": "1h 15m"
    },
    {
      "workItem": "AuthService",
      "type": "code",
      "messages": 5,
      "revisions": 2,
      "outcome": "approved",
      "duration": "2h 30m",
      "highlights": ["Security improvements after review"]
    }
  ],
  "totals": {
    "messages": 12,
    "avgRevisionsPerItem": 1.67,
    "totalDuration": "5h 30m"
  }
}
```

---

## Scalability Options

### Data Retention & Cleanup

For long-running projects, configure data retention:

```typescript
// Environment variables
AI_COLLAB_RETENTION_DAYS=90              // Keep data for 90 days
AI_COLLAB_ARCHIVE_COMPLETED=true         // Archive completed projects
AI_COLLAB_COMPRESS_OLD_CONTENT=true      // Compress old content
```

### Archiving Strategy

```
~/.mcp-ai-collab/
├── active/
│   └── data.json         # Active projects
├── archive/
│   ├── 2024-Q1/
│   │   └── user-auth-api.json.gz
│   └── 2024-Q2/
│       └── payment-api.json.gz
└── config.json
```

### Memory Management

For SQLite/PostgreSQL:
- Only load conversation events on-demand
- Stream large content instead of loading all
- Use pagination for long histories

```typescript
// Paginated conversation retrieval
get_conversation({
  projectId: "large-project",
  limit: 50,      // 50 messages per page
  offset: 100     // Skip first 100
})
```

---

## Data Flow

### Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            User Request                                  │
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        AI Worker                                  │   │
│  │  1. Discusses with user                                          │   │
│  │  2. Produces work (code/doc/test)                                │   │
│  │  3. Calls submit_work()                                          │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     MCP Server                                    │   │
│  │                                                                   │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │   │
│  │   │   Tools     │    │   Storage   │    │   Events    │        │   │
│  │   │             │    │             │    │             │        │   │
│  │   │ submit_work │───►│ WorkItems   │───►│ Conversation│        │   │
│  │   │ submit_rev  │    │ Reviews     │    │ Events      │        │   │
│  │   │ get_convo   │◄───│ Suggestions │◄───│             │        │   │
│  │   └─────────────┘    └─────────────┘    └─────────────┘        │   │
│  │                              │                                    │   │
│  │                              ▼                                    │   │
│  │   ┌─────────────────────────────────────────────────────┐       │   │
│  │   │              Storage Backend                         │       │   │
│  │   │                                                      │       │   │
│  │   │   JSON File  ──or──  SQLite  ──or──  PostgreSQL    │       │   │
│  │   │   (default)         (large)          (team)         │       │   │
│  │   └─────────────────────────────────────────────────────┘       │   │
│  └───────────────────────────────┬─────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       AI Reviewer                                 │   │
│  │  1. Calls get_pending_reviews()                                  │   │
│  │  2. Reviews work                                                 │   │
│  │  3. Calls submit_review()                                        │   │
│  │  4. Provides suggestions                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ◄──────────────────── Cycle repeats until approved ──────────────────►│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Event Recording Flow

```
Action (e.g., submit_work)
         │
         ▼
┌─────────────────┐
│  Validate Input │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Action │───► Create/Update WorkItem
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Record Event   │───► Insert ConversationEvent
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Result  │
└─────────────────┘
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `AI_COLLAB_STORAGE` | Storage backend | `json` | `json`, `sqlite`, `postgres` |
| `AI_COLLAB_STORAGE_DIR` | Storage directory | `~/.mcp-ai-collab` | Any path |
| `AI_COLLAB_DATABASE_URL` | PostgreSQL URL | - | Connection string |
| `AI_COLLAB_RETENTION_DAYS` | Data retention | `0` (forever) | Number of days |
| `AI_COLLAB_AUTO_BACKUP` | Auto-backup | `true` | `true`, `false` |
| `AI_COLLAB_LOG_LEVEL` | Logging level | `info` | `debug`, `info`, `warn`, `error` |

### Storage Selection Guide

| Use Case | Recommended Storage |
|----------|-------------------|
| Personal use, small projects | JSON (default) |
| Large projects, long history | SQLite |
| Team collaboration | PostgreSQL |
| Quick experiments | JSON |
| Production deployment | SQLite or PostgreSQL |
