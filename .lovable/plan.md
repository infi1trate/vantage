

## Make Vantage Files Visible in Dropbox

### Overview
Update the Dropbox sync to use human-readable filenames that include the session title, making files easily identifiable in Dropbox.

### Current State
Files upload to `/Apps/Vantage/Recordings/{session_id}.webm` where `session_id` is a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890.webm`. This makes files difficult to identify in Dropbox.

### Changes Required

#### 1. Update Filename Format

Generate user-friendly filenames using the session title:

```
/Apps/Vantage/Recordings/{sanitized_title}_{short_id}.webm
```

**Example:**
- Session title: "Ranked Match - Diamond"
- Result: `Ranked_Match_-_Diamond_a1b2c3d4.webm`

The short ID suffix ensures uniqueness if titles are duplicated.

#### 2. Sanitize Filenames

Add a helper function to create valid Dropbox filenames:
- Replace spaces with underscores
- Remove or replace special characters not allowed in filenames
- Limit length to avoid path limits
- Preserve readability

#### 3. Update Both Sync Endpoints

Modify the filename generation in:
- `handleAutoSync` (background auto-sync after recording)
- `handleSync` (manual sync trigger)

Both already query the session title - just need to use it in the path.

---

### File Changes

| File | Changes |
|------|---------|
| `supabase/functions/dropbox-sync/index.ts` | Add filename sanitizer, update path generation to use title + short ID |

---

### Technical Details

#### Filename Sanitization Function

```typescript
function sanitizeFilename(title: string, sessionId: string): string {
  // Sanitize title: replace invalid chars, limit length
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid chars
    .replace(/\s+/g, "_")         // Replace spaces with underscores
    .slice(0, 80);                // Limit length
  
  // Use first 8 chars of UUID for uniqueness
  const shortId = sessionId.split("-")[0];
  
  return `${sanitized}_${shortId}`;
}
```

#### Updated Path Generation

```typescript
// Before
const dropboxPath = `/Apps/Vantage/Recordings/${sessionId}.webm`;

// After
const filename = sanitizeFilename(session?.title || "Recording", sessionId);
const dropboxPath = `/Apps/Vantage/Recordings/${filename}.webm`;
```

---

### Result Examples

| Session Title | UUID | Dropbox Filename |
|---------------|------|------------------|
| "Ranked Match - Diamond" | `a1b2c3d4-...` | `Ranked_Match_-_Diamond_a1b2c3d4.webm` |
| "Session 1/30/2026" | `b2c3d4e5-...` | `Session_1302026_b2c3d4e5.webm` |
| "Quick Test" | `c3d4e5f6-...` | `Quick_Test_c3d4e5f6.webm` |

---

### Behavior

- Files appear in: `Dropbox > Apps > Vantage > Recordings`
- Filenames are human-readable with the session title
- Short ID suffix ensures uniqueness
- Files are not hidden or obfuscated
- Files are not renamed post-upload (name is set once during initial sync)

