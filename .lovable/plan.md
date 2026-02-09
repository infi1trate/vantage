

## Problem: "Create Reel" CTA Creates Reels But Never Navigates

### Root Cause

There is a race condition in `CreateReelModal`. When a reel is successfully created, `handleReelCreated` does three things in order:

1. Sets `pendingReelId` to the new reel ID
2. Sets `isTransitioning` to `true` (starts the fade overlay)
3. Calls `onOpenChange(false)` to close the modal

However, there is a `useEffect` that watches the `open` prop:

```text
useEffect(() => {
  if (!open) {
    setIsTransitioning(false);   // <-- cancels the transition
    setPendingReelId(null);       // <-- clears the reel ID
  }
}, [open]);
```

Step 3 sets `open` to `false`, which triggers this effect, which immediately cancels the transition and clears the reel ID. The `PageTransitionOverlay` never gets a chance to fire `onFadeInComplete`, so navigation to `/reel/:id` never happens.

**Evidence:** The database has 10+ reels all stuck at `status: compiling` for the same session -- they were created successfully but navigation always failed.

### Additional Issue

There are now 10+ orphaned reels in the database from repeated attempts. These should be cleaned up, and a session's reels should be visible on the session detail page so users know reels were created.

### Fix Plan

**File: `src/components/player/CreateReelModal.tsx`**

1. **Fix the race condition** -- In `handleReelCreated`, do NOT close the modal immediately. Instead, let the `PageTransitionOverlay` handle the visual transition. The modal closing should happen after transition completes, or the cleanup effect should skip resetting when a transition is actively pending.

   Specifically, change the cleanup `useEffect` to not reset transition state when a transition is in progress:

   ```text
   useEffect(() => {
     if (!open && !isTransitioning) {
       setPendingReelId(null);
     }
   }, [open, isTransitioning]);
   ```

   And in `handleReelCreated`, set the transition state BEFORE closing the modal, and defer modal close:

   ```text
   const handleReelCreated = useCallback((reelId: string) => {
     setPendingReelId(reelId);
     setIsTransitioning(true);
     // Close modal AFTER a tick so transition state is established
     setTimeout(() => onOpenChange(false), 0);
   }, [onOpenChange]);
   ```

2. **Show session reels on the Session Detail page** -- Add a "Reels" section to the Session Right Rail (or Highlights section) that lists existing reels for the session using the `useSessionReels` hook, so users can see and access previously created reels.

3. **Clean up orphaned reels** -- Delete the duplicate stuck reels from the database, keeping only the most recent one.

### Technical Details

| Change | File |
|--------|------|
| Fix race condition in modal close vs transition | `src/components/player/CreateReelModal.tsx` (lines 1124-1130, 1148-1155) |
| Add session reels list to Highlights section | `src/components/player/rail/HighlightsSection.tsx` |
| Clean up orphaned reels | Database query (delete duplicates) |

