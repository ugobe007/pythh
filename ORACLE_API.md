# Oracle API Endpoints

Backend API routes for Oracle system (wizard sessions, actions, insights).

## Authentication

All endpoints require Bearer token authentication:
```
Authorization: Bearer <supabase_jwt_token>
```

## Base URL
```
http://localhost:3002/api/oracle
```

---

## Sessions Endpoints

### List Sessions
```http
GET /api/oracle/sessions
```

**Query Parameters:**
- `status` (optional): Filter by status (`in_progress`, `completed`, `abandoned`)
- `startup_id` (optional): Filter by startup ID

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "startup_id": "uuid",
      "status": "in_progress",
      "current_step": 3,
      "progress_percentage": 37,
      "step_1_stage": { "stage": "Pre-Seed", "raising": "500k" },
      "step_2_problem": { "problem": "..." },
      "signal_score": 7.5,
      "strengths": ["Strong team", "Clear market"],
      "weaknesses": ["Limited traction"],
      "recommendations": ["Focus on MVP"],
      "started_at": "2026-02-10T...",
      "last_updated_at": "2026-02-10T..."
    }
  ]
}
```

### Get Single Session
```http
GET /api/oracle/sessions/:id
```

**Response:**
```json
{
  "session": { ... }
}
```

### Create Session
```http
POST /api/oracle/sessions
```

**Body:**
```json
{
  "startup_id": "uuid" // optional
}
```

**Response:**
```json
{
  "session": { ... }
}
```

### Update Session
```http
PUT /api/oracle/sessions/:id
```

**Body (all fields optional):**
```json
{
  "current_step": 4,
  "step_4_traction": {
    "revenue": "10k MRR",
    "users": 500
  },
  "signal_score": 8.2,
  "strengths": ["Updated strengths"],
  "status": "completed"
}
```

**Response:**
```json
{
  "session": { ... }
}
```

### Delete Session
```http
DELETE /api/oracle/sessions/:id
```

**Response:**
```json
{
  "success": true
}
```

---

## Actions Endpoints

### List Actions
```http
GET /api/oracle/actions
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `skipped`, `blocked`)
- `startup_id` (optional): Filter by startup ID
- `session_id` (optional): Filter by session ID
- `priority` (optional): Filter by priority (`low`, `medium`, `high`, `critical`)

**Response:**
```json
{
  "actions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "startup_id": "uuid",
      "session_id": "uuid",
      "title": "Build MVP",
      "description": "Core features for beta",
      "category": "product",
      "status": "in_progress",
      "priority": "high",
      "impact_score": 9,
      "effort_estimate": "weeks",
      "due_date": "2026-03-01",
      "created_at": "2026-02-10T..."
    }
  ]
}
```

### Get Single Action
```http
GET /api/oracle/actions/:id
```

### Create Action
```http
POST /api/oracle/actions
```

**Body:**
```json
{
  "startup_id": "uuid", // optional
  "session_id": "uuid", // optional
  "title": "Launch beta", // required
  "description": "Get first 100 users",
  "category": "traction", // required: traction, team, product, market, fundraising, signals, positioning, strategy, execution, other
  "priority": "high", // low, medium, high, critical (default: medium)
  "impact_score": 8, // 1-10
  "effort_estimate": "days", // quick, hours, days, weeks, months
  "assigned_to": "John",
  "due_date": "2026-03-15",
  "notes": "Target tech early adopters"
}
```

**Response:**
```json
{
  "action": { ... }
}
```

### Update Action
```http
PUT /api/oracle/actions/:id
```

**Body (all fields optional):**
```json
{
  "status": "completed",
  "notes": "Launched with 150 users!"
}
```

### Delete Action
```http
DELETE /api/oracle/actions/:id
```

---

## Insights Endpoints

### List Insights
```http
GET /api/oracle/insights
```

**Query Parameters:**
- `insight_type` (optional): Filter by type (`strength`, `weakness`, `opportunity`, `threat`, `prediction`, `recommendation`, `warning`, `coaching`, `vc_alignment`, `market_timing`)
- `startup_id` (optional): Filter by startup ID
- `session_id` (optional): Filter by session ID
- `dismissed` (optional): Show dismissed insights (`true`/`false`, default: only non-dismissed)

**Response:**
```json
{
  "insights": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "startup_id": "uuid",
      "session_id": "uuid",
      "insight_type": "recommendation",
      "title": "Accelerate go-to-market",
      "content": "Your product signals are strong...",
      "confidence": 0.85,
      "severity": "high",
      "category": "strategy",
      "is_dismissed": false,
      "is_pinned": true,
      "related_action_id": "uuid",
      "created_at": "2026-02-10T..."
    }
  ]
}
```

### Get Single Insight
```http
GET /api/oracle/insights/:id
```

**Note:** Automatically marks insight as viewed.

### Create Insight
```http
POST /api/oracle/insights
```

**Body:**
```json
{
  "startup_id": "uuid", // optional
  "session_id": "uuid", // optional
  "insight_type": "coaching", // required
  "title": "Team expansion timing", // required
  "content": "Based on your traction...", // required
  "confidence": 0.9, // 0-1
  "severity": "medium", // low, medium, high, critical
  "category": "team",
  "source": "oracle_ai", // default
  "model_version": "gpt-4",
  "related_action_id": "uuid"
}
```

### Update Insight
```http
PUT /api/oracle/insights/:id
```

**Body (all fields optional):**
```json
{
  "is_dismissed": true,
  "is_pinned": false,
  "acted_on": true,
  "related_action_id": "uuid"
}
```

### Delete Insight
```http
DELETE /api/oracle/insights/:id
```

---

## Frontend Integration Example

```typescript
// Using Supabase client for auth
import { supabase } from '@/lib/supabase';

async function getOracleSessions() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch('http://localhost:3002/api/oracle/sessions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const { sessions } = await response.json();
  return sessions;
}

async function updateWizardStep(sessionId: string, stepData: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`http://localhost:3002/api/oracle/sessions/${sessionId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_step: 3,
      step_3_solution: stepData
    })
  });

  const { session: updatedSession } = await response.json();
  return updatedSession;
}
```

---

## Testing with curl

```bash
# Get your token from Supabase dashboard or browser DevTools
TOKEN="your-jwt-token"

# List sessions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/api/oracle/sessions

# Create session
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startup_id": null}' \
  http://localhost:3002/api/oracle/sessions

# Update session
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_step": 2, "step_2_problem": {"problem": "Market saturation"}}' \
  http://localhost:3002/api/oracle/sessions/SESSION_ID

# List pending actions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3002/api/oracle/actions?status=pending"
```

---

## Error Responses

All endpoints return consistent error format:

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "error": "Session not found"
}
```

**500 Server Error:**
```json
{
  "error": "Error message"
}
```
