

## Simplify Dropbox Sync Indicator

### Overview
Reduce the Dropbox backup indicator to a minimal, subtle cloud icon that only appears for successfully synced recordings. Remove all visual feedback for pending and failed states.

### Current State
- Shows synced (green cloud), pending (amber spinner), and failed (red cloud-off) states
- Dynamic tooltip messages for each state
- Uses `CloudIcon`, `Loader2`, and `CloudOff` icons

### Changes Required

#### 1. Simplify Icon Rendering (List View)
**Lines 137-161** - Replace the multi-state conditional with a single synced-only check:

```typescript
{session.dropbox_sync_status === "synced" && (
  <Tooltip>
    <TooltipTrigger asChild>
      <CloudIcon className="h-3 w-3 text-muted-foreground/50" />
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      Backed up to Dropbox
    </TooltipContent>
  </Tooltip>
)}
```

#### 2. Simplify Icon Rendering (Grid View)
**Lines 340-364** - Same simplification for grid cards:

```typescript
{session.dropbox_sync_status === "synced" && (
  <Tooltip>
    <TooltipTrigger asChild>
      <CloudIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      Backed up to Dropbox
    </TooltipContent>
  </Tooltip>
)}
```

#### 3. Clean Up Unused Imports
Remove `CloudOff` and `Loader2` from imports since they're no longer needed for the Dropbox indicator (note: `Loader2` is still used elsewhere for delete loading state).

---

### Design Decisions

| Aspect | Implementation |
|--------|----------------|
| Icon | `CloudIcon` from lucide-react |
| Color | `text-muted-foreground/50` (low contrast, subtle) |
| Position | Bottom-right, next to duration badge |
| Tooltip | Simple "Backed up to Dropbox" text |
| Pending state | No indicator shown |
| Failed state | No indicator shown |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/library/SessionLibraryCard.tsx` | Simplify Dropbox indicator to synced-only state with subtle styling |

