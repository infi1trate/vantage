

## Dropbox Storage Provisioning Plan

### Overview
After successful Dropbox OAuth connection, we need to provision the storage backend by creating the required folder structure and uploading a validation file. If provisioning fails, the connection will be marked as inactive without blocking the app.

### Current State
- OAuth flow completes successfully and stores credentials in `connected_accounts`
- No folder structure is created in Dropbox
- No validation that the app has write permissions

### Implementation

#### 1. Add Storage Provisioning to Edge Function

Update `supabase/functions/dropbox-sync/index.ts` to add a new provisioning function that runs after successful OAuth callback:

**New Helper Function: `provisionDropboxStorage`**
- Create folder: `/Apps/Vantage/` using Dropbox `files/create_folder_v2` API
- Create subfolder: `/Apps/Vantage/Recordings/`
- Upload validation file: `/Apps/Vantage/.vantage_connected` with content "Vantage connected successfully"
- Handle "already exists" responses gracefully (idempotent operation)

**Modify `handleOAuthCallback`**
- After successfully saving to `connected_accounts`, call `provisionDropboxStorage`
- If provisioning fails:
  - Update `connected_accounts` with a status indicating inactive/failed provisioning
  - Log the error but return success for the OAuth connection
  - Include `provisioned: false` in the response

#### 2. Update Database Schema

Add a new column to track provisioning status:

```sql
ALTER TABLE connected_accounts 
ADD COLUMN IF NOT EXISTS provisioning_status TEXT DEFAULT 'pending';
-- Values: 'pending', 'completed', 'failed'
```

#### 3. Update Client-Side Handling

Modify `ConnectedAccountsSection.tsx`:
- Check `provisioning_status` in the account data
- Show a subtle warning indicator if provisioning failed
- Allow retry provisioning from Settings

---

### Technical Details

#### Dropbox API Endpoints Used

```text
POST https://api.dropboxapi.com/2/files/create_folder_v2
Header: Authorization: Bearer {access_token}
Body: { "path": "/Apps/Vantage", "autorename": false }

POST https://content.dropboxapi.com/2/files/upload
Header: Authorization: Bearer {access_token}
Header: Dropbox-API-Arg: {"path": "/Apps/Vantage/.vantage_connected", "mode": "overwrite"}
Header: Content-Type: application/octet-stream
Body: "Vantage connected successfully"
```

#### Error Handling Strategy

| Error | Action |
|-------|--------|
| Folder already exists (409) | Continue normally (idempotent) |
| Permission denied | Mark as `failed`, do not block |
| Network error | Mark as `failed`, allow retry |
| Token invalid | Mark as `failed`, prompt reconnect |

#### Flow Diagram

```text
OAuth Success
     │
     ▼
┌─────────────────────┐
│ Save to             │
│ connected_accounts  │
│ (status: pending)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Create /Apps/Vantage│
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
  Success    Fail
     │         │
     ▼         ▼
┌─────────┐ ┌─────────────┐
│ Create  │ │ Mark status │
│Recordings│ │ as 'failed' │
│ folder  │ │ Return OK   │
└────┬────┘ └─────────────┘
     │
     ▼
┌─────────────────────┐
│ Upload validation   │
│ .vantage_connected  │
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
  Success    Fail
     │         │
     ▼         ▼
┌─────────────┐ ┌─────────────┐
│ Mark status │ │ Mark status │
│ 'completed' │ │ 'failed'    │
└─────────────┘ └─────────────┘
```

### Files to Modify

1. **`supabase/functions/dropbox-sync/index.ts`**
   - Add `provisionDropboxStorage()` helper function
   - Call provisioning after successful OAuth callback
   - Add `/provision/retry` endpoint for manual retry

2. **Database Migration**
   - Add `provisioning_status` column to `connected_accounts`

3. **`src/components/settings/sections/ConnectedAccountsSection.tsx`**
   - Display provisioning status indicator
   - Add retry button for failed provisioning

4. **`src/lib/dropboxOAuth.ts`**
   - Update return type to include `provisioned` status
   - Add `retryProvisioning()` function

