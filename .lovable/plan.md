

## Dropbox Storage Provisioning Plan

### ✅ IMPLEMENTED

### Overview
After successful Dropbox OAuth connection, we provision the storage backend by creating the required folder structure and uploading a validation file. If provisioning fails, the connection is marked as inactive without blocking the app.

### Implementation Details

#### 1. Edge Function (`supabase/functions/dropbox-sync/index.ts`)
- Added `provisionDropboxStorage()` helper function
- Added `createDropboxFolder()` for creating `/Apps/Vantage/` and `/Apps/Vantage/Recordings/`
- Added `uploadValidationFile()` to write `.vantage_connected` validation file
- Modified `handleOAuthCallback()` to call provisioning after successful token exchange
- Added `/provision/retry` endpoint for manual retry

#### 2. Database Migration
- Added `provisioning_status` column to `connected_accounts` table
- Values: 'pending', 'completed', 'failed'

#### 3. Client-Side Updates
- `src/lib/dropboxOAuth.ts`: Updated `DropboxOAuthResult` interface with `provisioned` and `provisioningError` fields
- Added `retryDropboxProvisioning()` function for retry capability
- `src/components/settings/sections/ConnectedAccountsSection.tsx`:
  - Shows warning badge "Setup incomplete" when provisioning fails
  - Shows hint to reconnect to retry setup
  - Toast messages indicate provisioning status

### Error Handling

| Error | Action |
|-------|--------|
| Folder already exists (409) | Continue normally (idempotent) |
| Permission denied | Mark as `failed`, do not block |
| Network error | Mark as `failed`, allow retry |
| Token invalid | Mark as `failed`, prompt reconnect |
