## Automatic Dropbox Backup After Recording

### Overview
After a recording finishes processing and uploads to cloud storage, automatically sync to Dropbox in the background. This runs asynchronously with no progress bars, blocking modals, or visible retry UI.

### Implementation Status: ✅ COMPLETED

#### Completed Tasks:

1. **Database Migration** ✅
   - Added `encrypted_access_token`, `encrypted_refresh_token`, `token_expires_at` columns to `connected_accounts`

2. **Edge Function Updates** ✅
   - Added token encryption/decryption helpers
   - OAuth callback now stores encrypted tokens
   - Added `getValidAccessToken()` with automatic token refresh
   - Added `/sync/auto` endpoint with `EdgeRuntime.waitUntil()` for fire-and-forget execution
   - Updated `/sync` to use stored tokens when none provided
   - Updated `/provision/retry` to use stored tokens

3. **Client Integration** ✅
   - Added `triggerAutoSync()` function to `dropboxSync.ts`
   - Updated `queueDropboxSync()` to trigger auto-sync after queueing

### Flow Summary

```text
Recording Complete → Cloud Upload → queueDropboxSync()
                                         │
                                         ▼
                              Insert pending status
                                         │
                                         ▼
                              triggerAutoSync() (fire-forget)
                                         │
                                         ▼ (Edge Function)
                              /sync/auto endpoint
                                         │
                                         ▼
                              EdgeRuntime.waitUntil()
                                         │
                                         ▼
                              Get stored tokens → Refresh if expired
                                         │
                                         ▼
                              Download video → Upload to Dropbox
                                         │
                                         ▼
                              Update dropbox_sync_status
```

### Path Format
Files are uploaded to: `/Apps/Vantage/Recordings/{session_id}.webm`

### Constraints Respected
- ✅ No progress bars
- ✅ No blocking modals  
- ✅ No retries shown in UI
- ✅ Does not block Library rendering or playback
- ✅ Sync is fully async and fire-and-forget
