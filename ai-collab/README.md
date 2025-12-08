# AI Collaboration MCP

MCP (Model Context Protocol) server that enables AI-to-AI collaboration for code review, documentation review, and quality assurance throughout the development lifecycle.

## Overview

AI Collaboration MCP creates a structured workflow where:
- **AI Worker**: Works directly with users on tasks (discussions, documentation, coding, testing)
- **AI Reviewer**: Reviews all work produced by AI Worker, providing feedback and suggestions

This ensures higher quality output through peer review between AI agents.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     User ◄──────► AI Worker ◄──────► MCP ◄──────► AI Reviewer   │
│                                                                 │
│     Request        Execute           Store         Review       │
│     Feedback       Submit            Track         Suggest      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Full Lifecycle Coverage**: From initial discussion to final testing
- **Structured Reviews**: Approve, request changes, or comment with detailed suggestions
- **Context Preservation**: All discussions, decisions, and changes are tracked
- **Conversation History**: View complete AI-to-AI dialogue - see exactly what they discussed and why
- **Quality Gates**: Work can require approval before proceeding
- **Learning Loop**: AI Worker can learn from Reviewer feedback

## Installation

```bash
cd ai-collab
npm install
npm run build
```

### Add to Claude Code

Add to your MCP config (`~/.claude/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "ai-collab": {
      "command": "node",
      "args": ["/path/to/mcp/ai-collab/dist/index.js"]
    }
  }
}
```

## Architecture

### Roles

| Role | Description | Primary Tools |
|------|-------------|---------------|
| **Worker** | AI that works with user, produces artifacts | `submit_work`, `get_feedback`, `respond_to_review` |
| **Reviewer** | AI that reviews work, provides suggestions | `get_pending_reviews`, `submit_review`, `add_suggestion` |

### Work Phases

```
Planning ──► Development ──► Testing ──► Review ──► Done
    │              │            │          │
    ▼              ▼            ▼          ▼
Discussion      Code/Doc      Tests     Final QA
Requirements    Implementation Coverage  Approval
```

### Work Types

| Type | Description | Examples |
|------|-------------|----------|
| `discussion` | Conversations with user | Requirements gathering, clarifications |
| `requirement` | Formal requirements | User stories, acceptance criteria |
| `design` | Architecture/design decisions | System design, API design |
| `code` | Source code | Features, bug fixes, refactoring |
| `test` | Test code | Unit tests, integration tests |
| `doc` | Documentation | README, API docs, comments |

## Tools Reference

### Project Management

#### `create_project`
Create a new collaboration project.

```typescript
{
  id: string;           // Unique project ID
  name: string;         // Project name
  description?: string; // Project description
}
```

#### `get_project`
Get project details and current status.

```typescript
{
  projectId: string;
}
```

#### `list_projects`
List all projects.

```typescript
{
  status?: 'active' | 'completed' | 'archived';
}
```

---

### For AI Worker

#### `submit_work`
Submit work for review.

```typescript
{
  projectId: string;
  type: 'discussion' | 'requirement' | 'design' | 'code' | 'test' | 'doc';
  phase: 'planning' | 'development' | 'testing' | 'review';
  title: string;
  description?: string;
  content: string;
  metadata?: {
    filename?: string;      // For code/doc
    language?: string;      // Programming language
    userRequest?: string;   // Original user request
    dependencies?: string[]; // Related work item IDs
  };
}
```

**Returns**: Work item ID and status

#### `get_review_feedback`
Get feedback from reviewer for a work item.

```typescript
{
  workItemId: string;
}
```

**Returns**: Reviews with suggestions

#### `respond_to_review`
Respond to reviewer's feedback.

```typescript
{
  workItemId: string;
  reviewId: string;
  response: string;
  action: 'acknowledged' | 'will_fix' | 'need_discussion' | 'disagree';
}
```

#### `update_work`
Update work item after addressing feedback.

```typescript
{
  workItemId: string;
  content: string;
  changeDescription: string;
}
```

#### `mark_suggestion_resolved`
Mark a suggestion as resolved.

```typescript
{
  suggestionId: string;
  resolution: 'accepted' | 'rejected' | 'partially_accepted';
  comment?: string;
}
```

---

### For AI Reviewer

#### `get_pending_reviews`
Get work items awaiting review.

```typescript
{
  projectId?: string;     // Filter by project
  type?: string;          // Filter by work type
  phase?: string;         // Filter by phase
}
```

**Returns**: List of work items pending review

#### `get_work_detail`
Get detailed information about a work item.

```typescript
{
  workItemId: string;
  includeHistory?: boolean;  // Include revision history
}
```

#### `submit_review`
Submit a review for a work item.

```typescript
{
  workItemId: string;
  verdict: 'approve' | 'request_changes' | 'comment';
  summary: string;
  suggestions?: Suggestion[];
}
```

#### `add_suggestion`
Add a specific suggestion to an existing review.

```typescript
{
  reviewId: string;
  type: 'improvement' | 'bug' | 'security' | 'performance' | 'style' | 'clarity';
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  explanation: string;
  location?: {
    startLine?: number;
    endLine?: number;
    section?: string;      // For docs: section name
  };
  currentContent?: string;   // Current code/text
  suggestedContent?: string; // Suggested replacement
}
```

---

### Shared Tools

#### `get_project_context`
Get full context of a project including all work items and reviews.

```typescript
{
  projectId: string;
  includeResolved?: boolean;  // Include resolved items
}
```

#### `get_history`
Get history of changes and discussions.

```typescript
{
  projectId?: string;
  workItemId?: string;
  limit?: number;
}
```

#### `get_conversation`
View the complete dialogue between AI Worker and AI Reviewer. **Perfect for understanding how they discussed and reached decisions.**

```typescript
{
  projectId?: string;      // Filter by project
  workItemId?: string;     // Filter by specific work item
  format?: 'detailed' | 'summary' | 'timeline';  // Output format
  limit?: number;          // Max messages (default: 100)
}
```

**Returns**: Full conversation history with timestamps, actors, actions, and content. See [docs/workflow.md](docs/workflow.md) for detailed examples.

#### `search_work`
Search across work items.

```typescript
{
  projectId?: string;
  query: string;
  type?: string;
  status?: string;
}
```

## Data Models

### WorkItem

```typescript
interface WorkItem {
  id: string;
  projectId: string;

  // Classification
  type: 'discussion' | 'requirement' | 'design' | 'code' | 'test' | 'doc';
  phase: 'planning' | 'development' | 'testing' | 'review' | 'done';

  // Content
  title: string;
  description?: string;
  content: string;

  // Metadata
  metadata: {
    filename?: string;
    language?: string;
    userRequest?: string;
    dependencies?: string[];
  };

  // Status tracking
  status: 'draft' | 'pending_review' | 'in_review' | 'changes_requested' | 'approved' | 'merged';
  version: number;

  // Audit
  submittedBy: string;
  submittedAt: Date;
  updatedAt: Date;

  // Relations
  reviews: Review[];
  history: WorkItemRevision[];
}
```

### Review

```typescript
interface Review {
  id: string;
  workItemId: string;
  workItemVersion: number;  // Version reviewed

  reviewerId: string;
  verdict: 'approve' | 'request_changes' | 'comment';
  summary: string;

  suggestions: Suggestion[];

  // Worker response
  responses: ReviewResponse[];

  createdAt: Date;
  updatedAt: Date;
}
```

### Suggestion

```typescript
interface Suggestion {
  id: string;
  reviewId: string;

  type: 'improvement' | 'bug' | 'security' | 'performance' | 'style' | 'clarity';
  severity: 'critical' | 'major' | 'minor' | 'info';

  title: string;
  explanation: string;

  // Location in content
  location?: {
    startLine?: number;
    endLine?: number;
    section?: string;
  };

  // Code/content diff
  currentContent?: string;
  suggestedContent?: string;

  // Resolution
  status: 'pending' | 'accepted' | 'rejected' | 'partially_accepted';
  resolution?: {
    action: string;
    comment?: string;
    resolvedAt: Date;
  };
}
```

### ReviewResponse

```typescript
interface ReviewResponse {
  id: string;
  reviewId: string;

  responderId: string;  // AI Worker ID
  response: string;
  action: 'acknowledged' | 'will_fix' | 'need_discussion' | 'disagree';

  createdAt: Date;
}
```

## Workflow Examples

See [docs/workflow.md](docs/workflow.md) for detailed workflow examples.

### Quick Example

```
# AI Worker: Submit code for review
submit_work({
  projectId: "auth-api",
  type: "code",
  phase: "development",
  title: "JWT Authentication Service",
  content: "class AuthService { ... }",
  metadata: {
    filename: "auth.service.ts",
    language: "typescript"
  }
})

# AI Reviewer: Review the code
submit_review({
  workItemId: "work_123",
  verdict: "request_changes",
  summary: "Good implementation but security concerns",
  suggestions: [{
    type: "security",
    severity: "critical",
    title: "Password hashing required",
    explanation: "Plain text password comparison is insecure",
    currentContent: "if (password === user.password)",
    suggestedContent: "if (await bcrypt.compare(password, user.hashedPassword))"
  }]
})

# AI Worker: Respond and update
respond_to_review({
  workItemId: "work_123",
  reviewId: "review_456",
  response: "Good catch! Will implement bcrypt hashing",
  action: "will_fix"
})

update_work({
  workItemId: "work_123",
  content: "class AuthService { /* updated with bcrypt */ }",
  changeDescription: "Added bcrypt password hashing per security review"
})
```

## Configuration

### Storage Location

Data is stored in `~/.mcp-ai-collab/data.json`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_COLLAB_STORAGE_DIR` | Custom storage directory | `~/.mcp-ai-collab` |
| `AI_COLLAB_AUTO_APPROVE` | Auto-approve minor changes | `false` |

## Best Practices

### For AI Worker

1. **Submit early, submit often**: Don't wait until everything is done
2. **Provide context**: Include user requests and reasoning
3. **Respond to all suggestions**: Even if disagreeing, explain why
4. **Track dependencies**: Link related work items

### For AI Reviewer

1. **Be constructive**: Provide solutions, not just problems
2. **Prioritize feedback**: Use severity levels appropriately
3. **Explain reasoning**: Help Worker learn for future
4. **Approve when ready**: Don't block on minor issues

## Security Notes

- All data stored locally on disk
- No network communication between AI instances (via shared storage)
- Sensitive code/credentials in work items should be handled carefully

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Run tests
npm test
```

## License

MIT
