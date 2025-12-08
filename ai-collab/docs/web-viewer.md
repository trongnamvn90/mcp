# AI Collaboration MCP - Web Viewer

Optional web interface to view AI conversations and collaboration history.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   AI Worker ──► MCP Server ◄── AI Reviewer                             │
│                     │                                                   │
│                     ▼                                                   │
│              ┌─────────────┐                                           │
│              │   Storage   │ ◄── Compressed JSON/SQLite                │
│              └──────┬──────┘                                           │
│                     │                                                   │
│                     ▼                                                   │
│              ┌─────────────┐                                           │
│              │ Web Server  │ ◄── Express/Fastify                       │
│              └──────┬──────┘                                           │
│                     │                                                   │
│                     ▼                                                   │
│              ┌─────────────┐                                           │
│              │  Web UI     │ ◄── Browser-based viewer                  │
│              └─────────────┘                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Conversation Viewer
- View all AI-to-AI conversations
- Timeline view with expandable details
- Filter by project, work item, date range
- Search conversations by keyword

### 2. Project Dashboard
- Overview of all projects
- Status summary (pending, approved, etc.)
- Activity timeline
- Statistics and metrics

### 3. Diff Viewer
- Side-by-side code comparison
- Highlight changes between versions
- Show reviewer suggestions inline

## Architecture

### Mini Server

```
ai-collab/
├── src/
│   ├── index.ts          # MCP server (existing)
│   ├── server/           # Web server (new)
│   │   ├── index.ts      # Express server
│   │   ├── routes/
│   │   │   ├── api.ts    # REST API routes
│   │   │   └── pages.ts  # HTML page routes
│   │   └── middleware/
│   │       └── auth.ts   # Optional basic auth
│   └── web/              # Static web UI
│       ├── index.html
│       ├── styles.css
│       └── app.js
└── package.json
```

### REST API Endpoints

```
GET  /api/projects                    # List all projects
GET  /api/projects/:id                # Get project details
GET  /api/projects/:id/conversations  # Get project conversations
GET  /api/projects/:id/timeline       # Get project timeline

GET  /api/work-items                  # List work items
GET  /api/work-items/:id              # Get work item details
GET  /api/work-items/:id/history      # Get version history
GET  /api/work-items/:id/conversation # Get work item conversation

GET  /api/search?q=keyword            # Search across everything

GET  /api/stats                       # Global statistics
GET  /api/stats/project/:id           # Project statistics
```

### Example Server Code

```typescript
// src/server/index.ts
import express from 'express';
import compression from 'compression';
import { getStorage } from '../utils/storage';

const app = express();
const PORT = process.env.AI_COLLAB_WEB_PORT || 3456;

app.use(compression());
app.use(express.static('src/web'));

// API Routes
app.get('/api/projects', async (req, res) => {
  const storage = await getStorage();
  const projects = await storage.getProjects();
  res.json({ success: true, projects });
});

app.get('/api/projects/:id/conversations', async (req, res) => {
  const storage = await getStorage();
  const conversations = await storage.getConversations(req.params.id);
  res.json({ success: true, conversations });
});

app.get('/api/work-items/:id/conversation', async (req, res) => {
  const storage = await getStorage();
  const conversation = await storage.getWorkItemConversation(req.params.id);
  res.json({ success: true, conversation });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Collab Web Viewer running at http://localhost:${PORT}`);
});
```

## Compressed Storage

### File Structure

```
~/.mcp-ai-collab/
├── config.json                    # Configuration
├── active/                        # Active projects (uncompressed for speed)
│   ├── project-1.json
│   └── project-2.json
├── conversations/                 # Conversation logs (compressed)
│   ├── 2024-01/
│   │   ├── project-1.jsonl.gz    # Compressed JSONL
│   │   └── project-2.jsonl.gz
│   └── 2024-02/
│       └── project-1.jsonl.gz
└── archive/                       # Archived projects (compressed)
    └── 2024-Q1/
        └── old-project.json.gz
```

### Compression Strategy

#### 1. Active Data (Uncompressed)
- Current/active projects
- Fast read/write access
- Migrated to compressed after completion

#### 2. Conversation Logs (JSONL + Gzip)

```typescript
// JSONL format - one event per line
{"id":"evt_001","timestamp":"2024-01-15T11:00:00Z","action":"submit",...}
{"id":"evt_002","timestamp":"2024-01-15T12:00:00Z","action":"review",...}
```

**Benefits:**
- Append-only writes (fast)
- Stream processing without loading entire file
- Good compression ratio (~80-90% reduction)

#### 3. Archive (Full JSON + Gzip)

Completed projects are archived as compressed JSON:

```typescript
// archive/2024-Q1/user-auth-api.json.gz
{
  "project": { ... },
  "workItems": [ ... ],
  "conversations": [ ... ],
  "archivedAt": "2024-04-01T00:00:00Z"
}
```

### Storage Implementation

```typescript
// src/utils/compressed-storage.ts
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import readline from 'readline';

export class CompressedStorage {

  // Append conversation event (streaming)
  async appendConversationEvent(
    projectId: string,
    event: ConversationEvent
  ): Promise<void> {
    const filePath = this.getConversationFilePath(projectId);
    const line = JSON.stringify(event) + '\n';

    // Append to gzipped file
    const gzip = createGzip();
    const output = createWriteStream(filePath, { flags: 'a' });

    gzip.write(line);
    gzip.pipe(output);
    gzip.end();
  }

  // Read conversation events (streaming)
  async *readConversationEvents(
    projectId: string
  ): AsyncGenerator<ConversationEvent> {
    const filePath = this.getConversationFilePath(projectId);

    const gunzip = createGunzip();
    const input = createReadStream(filePath);

    const rl = readline.createInterface({
      input: input.pipe(gunzip),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        yield JSON.parse(line);
      }
    }
  }

  // Archive completed project
  async archiveProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    const workItems = await this.getWorkItems(projectId);
    const conversations = [];

    for await (const event of this.readConversationEvents(projectId)) {
      conversations.push(event);
    }

    const archive = {
      project,
      workItems,
      conversations,
      archivedAt: new Date().toISOString()
    };

    const archivePath = this.getArchivePath(projectId);
    const gzip = createGzip({ level: 9 }); // Max compression
    const output = createWriteStream(archivePath);

    await pipeline(
      Readable.from(JSON.stringify(archive)),
      gzip,
      output
    );

    // Clean up active files
    await this.removeActiveProject(projectId);
  }

  // Get conversation file path (monthly rotation)
  private getConversationFilePath(projectId: string): string {
    const date = new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return path.join(
      this.storageDir,
      'conversations',
      yearMonth,
      `${projectId}.jsonl.gz`
    );
  }
}
```

### Compression Ratio Examples

| Data Type | Raw Size | Compressed | Ratio |
|-----------|----------|------------|-------|
| Conversation (100 events) | 150 KB | 15 KB | 90% |
| Work Item (code) | 50 KB | 8 KB | 84% |
| Full Project Archive | 2 MB | 200 KB | 90% |

## Web UI Design

### Main Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Collaboration Viewer                              🔍 Search...      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📊 Overview                                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │    5    │ │   12    │ │    3    │ │   45    │                       │
│  │ Projects│ │Pending  │ │Approved │ │Messages │                       │
│  │ Active  │ │ Review  │ │ Today   │ │ Today   │                       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                       │
│                                                                         │
│  📁 Recent Projects                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 user-auth-api          4 items │ 2 pending │ Last: 2h ago   │   │
│  │ 🟡 payment-gateway        8 items │ 1 pending │ Last: 5h ago   │   │
│  │ 🟢 notification-service   3 items │ 0 pending │ Last: 1d ago   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  📝 Recent Activity                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 14:30  ✅ ai-reviewer approved "AuthService" in user-auth-api   │   │
│  │ 14:00  🔄 ai-worker updated "AuthService" (v2)                  │   │
│  │ 13:00  💬 ai-worker responded to review                         │   │
│  │ 12:30  ⚠️ ai-reviewer requested changes on "AuthService"        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Conversation View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    AuthService Implementation    user-auth-api                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ✅ Approved    Versions: 2    Messages: 5    Duration: 4h     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📤 SUBMIT                                      Jan 15, 11:00   │   │
│  │  ──────────────────────────────────────────────────────────────  │   │
│  │  🤖 ai-worker-claude                                             │   │
│  │                                                                   │   │
│  │  Submitted: AuthService implementation (v1)                      │   │
│  │  Type: code | Phase: development                                 │   │
│  │                                                                   │   │
│  │  [View Code ▼]                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │ import jwt from 'jsonwebtoken';                          │    │   │
│  │  │ import bcrypt from 'bcrypt';                             │    │   │
│  │  │ ...                                                      │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👀 REVIEW                                      Jan 15, 12:00   │   │
│  │  ──────────────────────────────────────────────────────────────  │   │
│  │  🤖 ai-reviewer-gpt                                              │   │
│  │                                                                   │   │
│  │  Verdict: ⚠️ REQUEST CHANGES                                     │   │
│  │  "Good structure but security concerns"                          │   │
│  │                                                                   │   │
│  │  Suggestions:                                                    │   │
│  │  🔴 [CRITICAL] Add rate limiting                                 │   │
│  │     Login endpoint should have rate limiting to prevent          │   │
│  │     brute force attacks.                                         │   │
│  │                                                                   │   │
│  │  🟠 [MAJOR] Add account lockout                                  │   │
│  │     Lock account after 5 failed attempts.                        │   │
│  │     [Show suggested code ▼]                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  💬 RESPONSE                                    Jan 15, 13:00   │   │
│  │  ──────────────────────────────────────────────────────────────  │   │
│  │  🤖 ai-worker-claude                                             │   │
│  │                                                                   │   │
│  │  Action: will_fix                                                │   │
│  │  "Great catches! Will implement rate limiting using              │   │
│  │   express-rate-limit and add account lockout logic."             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ... more messages ...                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Running the Web Viewer

### Option 1: Built-in Server

```bash
# Start MCP server with web viewer
AI_COLLAB_WEB_ENABLED=true npm start

# Or specify port
AI_COLLAB_WEB_PORT=8080 AI_COLLAB_WEB_ENABLED=true npm start
```

### Option 2: Standalone Server

```bash
# Run web viewer separately
npm run web

# With custom storage path
AI_COLLAB_STORAGE_DIR=/path/to/data npm run web
```

### Option 3: Docker

```yaml
# docker-compose.yml
services:
  ai-collab-web:
    build: .
    ports:
      - "3456:3456"
    volumes:
      - ~/.mcp-ai-collab:/data
    environment:
      - AI_COLLAB_STORAGE_DIR=/data
      - AI_COLLAB_WEB_PORT=3456
```

```bash
docker-compose up -d
```

## Configuration

```json
// ~/.mcp-ai-collab/config.json
{
  "web": {
    "enabled": true,
    "port": 3456,
    "auth": {
      "enabled": false,
      "username": "admin",
      "password": "secret"
    }
  },
  "storage": {
    "compression": {
      "enabled": true,
      "level": 6,
      "rotateMonthly": true
    },
    "archive": {
      "enabled": true,
      "afterDays": 30,
      "deleteAfterDays": 365
    }
  }
}
```

## Security Considerations

### Local Access Only (Default)

```typescript
// Bind to localhost only
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Web viewer at http://localhost:${PORT}`);
});
```

### Optional Basic Auth

```typescript
// Enable with environment variable
if (process.env.AI_COLLAB_WEB_AUTH === 'true') {
  app.use(basicAuth({
    users: {
      [process.env.AI_COLLAB_WEB_USER]: process.env.AI_COLLAB_WEB_PASS
    },
    challenge: true,
    realm: 'AI Collab Viewer'
  }));
}
```

### Read-Only Mode

The web viewer is **read-only by default** - no modifications to data through the web interface.
