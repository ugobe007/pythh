# Investor Lookup API

Service for VCs to **search** PYTHH’s approved startups and **collect** them into curated lists (portfolio-style).

Base path: **`/api/investor-lookup`**

---

## Search (no auth)

### `GET /api/investor-lookup/search`

Query params:

| Param      | Type   | Description                                      |
|-----------|--------|---------------------------------------------------|
| `q`       | string | Text search (name, tagline, pitch, description)  |
| `sectors` | string | Comma-separated sectors (e.g. `Fintech,AI`)       |
| `stage`   | string | e.g. `seed`, `series-a`, `pre-seed`               |
| `minScore` / `min_score` | number | Min GOD score (default none)        |
| `maxScore` / `max_score` | number | Max GOD score (default none)        |
| `limit`   | number | Page size (default 50, max 200)                   |
| `offset`  | number | Pagination offset                                |

Response: `{ ok, data: [...], meta: { total, hasMore, limit, offset } }`.  
Each item: `id`, `name`, `tagline`, `website`, `sectors`, `stage_estimate`, `total_god_score`.

---

## Thesis pre-fill (no auth)

### `GET /api/investor-lookup/thesis/:investorId`

Returns startups that match the investor’s **sectors** and **stage** from the `investors` table.  
Query params: `limit`, `offset`, `minScore` / `min_score` (default 50).  
Response includes `meta.thesis: { sectors, stage }`.

---

## Curated lists (owner id required)

Identify the “owner” with one of:

- Header: **`X-Investor-Session`** or **`X-Session-Id`**
- Query/body: **`owner_id`**

Use the same `owner_id` for all list operations so they see only their lists.

### `GET /api/investor-lookup/lists`

List all curated lists for the current owner.  
Response: `{ ok, data: [{ id, name, created_at, updated_at }] }`.

### `POST /api/investor-lookup/lists`

Create a list. Body: `{ name?: "My list" }`.  
Response: `{ ok, data: { id, name, created_at } }`.

### `GET /api/investor-lookup/lists/:id`

Get one list with startup details.  
If `owner_id` was sent, only the owner can read this list (403 otherwise).  
Response: `{ ok, data: { id, owner_id, name, items: [...], count } }`.  
Each item includes `startup_id`, `added_at`, `notes`, plus `name`, `tagline`, `website`, `sectors`, `stage_estimate`, `total_god_score`.

### `POST /api/investor-lookup/lists/:id/items`

Add a startup. Body: `{ startup_id, notes?: "" }`.  
409 if already in list.

### `DELETE /api/investor-lookup/lists/:id/items/:startupId`

Remove a startup from the list.

### `DELETE /api/investor-lookup/lists/:id`

Delete the list (and all items).

---

## Example flows

1. **Search**  
   `GET /api/investor-lookup/search?minScore=60&sectors=Fintech&limit=20`

2. **My thesis**  
   `GET /api/investor-lookup/thesis/<investor-uuid>?minScore=55`

3. **Create list and add startups**  
   - `POST /api/investor-lookup/lists` with header `X-Investor-Session: my-session-123`, body `{ "name": "Q1 targets" }`  
   - `POST /api/investor-lookup/lists/<list-id>/items` with body `{ "startup_id": "<startup-uuid>" }`

4. **Read my lists**  
   `GET /api/investor-lookup/lists` with header `X-Investor-Session: my-session-123`  
   `GET /api/investor-lookup/lists/<list-id>` with same header to get list + items.
