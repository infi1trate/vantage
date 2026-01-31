
## Automatic Dropbox Backup After Recording

### Overview
After a recording finishes processing and uploads to cloud storage, automatically sync to Dropbox in the background. This runs asynchronously with no progress bars, blocking modals, or visible retry UI.

### Current State Analysis
The codebase already has:
- `queueDropboxSync()` called after cloud upload (processingManager.ts:624-632)
- A `dropbox_sync_status` table tracking sync state
- Edge function `/sync` endpoint that downloads from Supabase storage and uploads to Dropbox

**Gap identified**: OAuth tokens are not persisted after connection. The `handleSync` expects an `accessToken` parameter that the client cannot provide for background syncs.

### Implementation

#### 1. Database Migration - Secure Token Storage

Add encrypted token storage to the `connected_accounts` table:

```sql
ALTER TABLE public.connected_accounts 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;
```

**Security note**: Tokens are encrypted using Supabase's built-in `pgcrypto` extension with a server-side secret key accessible only via edge functions.

#### 2. Update Edge Function - Store Tokens on OAuth

Modify `handleOAuthCallback` in `supabase/functions/dropbox-sync/index.ts`:
- Encrypt and store `access_token` and `refresh_token` using a vault secret
- Store token expiration timestamp

#### 3. Update Edge Function - Retrieve Tokens for Sync

Modify `handleSync`:
- Remove requirement for `accessToken` in request body
- Retrieve encrypted tokens from `connected_accounts` for the user
- Decrypt tokens server-side
- If access token expired, use refresh token to get new tokens

#### 4. Add Background Sync Trigger

Create new edge function endpoint `/sync/auto`:
- Called by the client after successful cloud upload
- Fetches pending sync record and video URL
- Uses stored tokens to upload to Dropbox
- Runs as `EdgeRuntime.waitUntil()` for non-blocking execution

#### 5. Update Client - Trigger Auto-Sync

Modify `src/lib/dropboxSync.ts`:
- Update `queueDropboxSync` to also trigger the actual sync
- New function `triggerAutoSync` that invokes the edge function
- All errors handled silently (logged only)

---

### File Changes

| File | Changes |
|------|---------|
| `supabase/functions/dropbox-sync/index.ts` | Add token encryption/storage, token refresh logic, auto-sync endpoint |
| `src/lib/dropboxSync.ts` | Add `triggerAutoSync()` function, update queue to trigger sync |
| Database migration | Add token columns to `connected_accounts` |

---

### Technical Details

#### Token Encryption Flow

```text
OAuth Callback
     │
     ▼
┌─────────────────────────┐
│ Exchange code for tokens│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Encrypt access_token    │
│ using vault secret      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Store encrypted tokens  │
│ in connected_accounts   │
└─────────────────────────┘
```

#### Auto-Sync Flow (After Recording)

```text
Cloud Upload Complete
       │
       ▼
┌──────────────────────────┐
│ Insert dropbox_sync_status│
│ (status: pending)         │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Invoke edge function     │
│ /sync/auto (fire-forget) │
└───────────┬──────────────┘
            │
            ▼ (Edge Function)
┌──────────────────────────┐
│ Get video URL from       │
│ video_assets table       │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Decrypt stored tokens    │
└───────────┬──────────────┘
            │
      ┌─────┴─────┐
      │           │
   Valid      Expired
      │           │
      ▼           ▼
┌──────────┐ ┌──────────────┐
│ Download │ │ Refresh token│
│ video    │ │ Update stored│
└────┬─────┘ └──────┬───────┘
     │              │
     └──────┬───────┘
            ▼
┌──────────────────────────┐
│ Upload to Dropbox        │
│ /Apps/Vantage/Recordings/│
│ {session_id}.webm        │
└───────────┬──────────────┘
            │
      ┌─────┴─────┐
      │           │
   Success      Fail
      │           │
      ▼           ▼
┌──────────┐ ┌──────────────┐
│ Update   │ │ Update status│
│ status:  │ │ to "failed"  │
│ completed│ │ (silent)     │
└──────────┘ └──────────────┘
```

#### Dropbox Path Format

Files are uploaded to:
```
/Apps/Vantage/Recordings/{session_id}.webm
```

This follows the requested format using `{recording_id}.mp4` (using webm since that's the current format).

---

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Dropbox not connected | Skip silently, no error |
| Token expired | Auto-refresh using refresh_token |
| Refresh token invalid | Mark sync as "failed", no UI alert |
| Upload fails | Mark sync as "failed", auto-retry later |
| Video URL unavailable | Mark sync as "failed", log warning |

All failures are logged server-side but do not surface in the UI - users can check Settings for sync status if needed.

---

### Constraints Respected

- No progress bars
- No blocking modals
- No retries shown in UI
- Does not block Library rendering or playback
- Sync is fully async and fire-and-forget
