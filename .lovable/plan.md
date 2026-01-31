

## Library Dropbox Sync Status Enhancement

### Overview
Expose detailed Dropbox backup status per recording in the Library so users can see whether backups are pending, synced, or failed - along with when the sync completed.

### Current State
- `SessionWithAssets` interface has `dropbox_synced: boolean`
- The `dropbox_sync_status` table already stores: `sync_status` (pending/syncing/completed/failed) and `completed_at` timestamp
- Library cards show a cloud icon only for completed syncs

### Changes Required

#### 1. Update `SessionWithAssets` Interface

Expand the Dropbox fields in `src/lib/sessionLibrary.ts`:

```typescript
// Current
dropbox_synced: boolean;

// New
dropbox_sync_status: "pending" | "synced" | "failed" | null;
dropbox_synced_at: string | null;
```

**Mapping logic:**
| DB sync_status | UI status |
|----------------|-----------|
| `pending` | `pending` |
| `syncing` | `pending` |
| `completed` | `synced` |
| `failed` | `failed` |
| No record | `null` |

#### 2. Update `getSessionsWithAssets` Query

Modify the query to fetch both `sync_status` and `completed_at`:

```typescript
// Current fetch
supabase.from("dropbox_sync_status")
  .select("session_id, sync_status")
  .in("session_id", sessionIds)

// Updated fetch
supabase.from("dropbox_sync_status")
  .select("session_id, sync_status, completed_at")
  .in("session_id", sessionIds)
```

Build lookup maps for both status and timestamp.

#### 3. Update `SessionLibraryCard` UI

Enhance the cloud icon to reflect all states:

| Status | Icon Color | Tooltip |
|--------|------------|---------|
| `synced` | Muted green or neutral | "Backed up to Dropbox on {date}" |
| `pending` | Amber/yellow | "Backup in progress..." |
| `failed` | Red | "Backup failed" |
| `null` | No icon | (Dropbox not connected or not queued) |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/sessionLibrary.ts` | Update interface and query to include `dropbox_sync_status` and `dropbox_synced_at` |
| `src/components/library/SessionLibraryCard.tsx` | Update cloud icon to show pending/synced/failed states with appropriate colors and tooltips |

---

### Technical Details

#### Updated Interface

```typescript
export interface SessionWithAssets {
  // ... existing fields ...
  
  // Dropbox sync status (replaces dropbox_synced boolean)
  dropbox_sync_status: "pending" | "synced" | "failed" | null;
  dropbox_synced_at: string | null;
}
```

#### Query Result Mapping

```typescript
// Build sync status lookup
const dropboxStatusMap: Record<string, { 
  status: "pending" | "synced" | "failed"; 
  syncedAt: string | null;
}> = {};

dropboxSyncs.data?.forEach(d => {
  let status: "pending" | "synced" | "failed";
  if (d.sync_status === "completed") {
    status = "synced";
  } else if (d.sync_status === "failed") {
    status = "failed";
  } else {
    status = "pending";
  }
  dropboxStatusMap[d.session_id] = {
    status,
    syncedAt: d.completed_at || null,
  };
});

// In mapping
dropbox_sync_status: dropboxStatusMap[session.id]?.status || null,
dropbox_synced_at: dropboxStatusMap[session.id]?.syncedAt || null,
```

#### UI Icon States

```typescript
// Color configuration
const dropboxStatusConfig = {
  synced: { 
    color: "text-vantage-success", 
    tooltip: (date: string) => `Backed up ${formatDistanceToNow(new Date(date), { addSuffix: true })}` 
  },
  pending: { 
    color: "text-vantage-warning", 
    tooltip: "Backup in progress..." 
  },
  failed: { 
    color: "text-destructive", 
    tooltip: "Backup failed" 
  },
};
```

---

### Behavior Summary

- **pending**: Set when sync is queued or in progress
- **synced**: Set on successful upload completion
- **failed**: Set only if upload encounters errors
- **null**: Session has no Dropbox sync record (either not connected or pre-Dropbox feature)

