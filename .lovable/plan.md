
# Window Picker Real Preview Thumbnails

## Overview
Update the WindowPickerGrid component to properly display real window preview thumbnails from Electron's `listSources` API while maintaining Vantage styling and adding performance optimizations.

## Current Architecture
- `WindowPickerGrid.tsx` already has conditional thumbnail rendering (line 79-98)
- Electron provides `thumbnailDataUrl` (data:image/png;base64,...) via the bridge
- Sources are adapted in `usePopoverState.ts` and passed as `MockWindow[]`

## Implementation Changes

### 1. Update WindowPickerGrid.tsx

**Enhance thumbnail rendering (lines 79-98):**
- Add `loading="lazy"` and `decoding="async"` attributes for performance
- Add a dark gradient overlay for text legibility over the thumbnail
- Implement error handling with `onError` to fall back to placeholder on load failure
- Maintain `object-fit: cover` for proper scaling without stretch/overflow

**Changes:**
```text
File: src/components/desktop/WindowPickerGrid.tsx

- Add useState for tracking failed image loads
- Update img element with:
  - loading="lazy" 
  - decoding="async"
  - onError handler to mark as failed
- Add dark gradient overlay (from transparent to ~40% black at bottom)
- Fall back to placeholder UI when thumbnail fails to load
```

### 2. Technical Details

**Image element improvements:**
```tsx
<img
  src={window.thumbnail}
  alt={`Preview of ${window.name}`}
  className="absolute inset-0 w-full h-full object-cover"
  loading="lazy"
  decoding="async"
  draggable={false}
  onError={() => handleImageError(window.id)}
/>
```

**Dark gradient overlay for legibility:**
```tsx
{/* Dark gradient for label legibility */}
<div 
  className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"
  aria-hidden="true"
/>
```

**Error state tracking:**
```tsx
const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

const handleImageError = useCallback((windowId: string) => {
  setFailedThumbnails(prev => new Set(prev).add(windowId));
}, []);

// In render: check !failedThumbnails.has(window.id) before showing thumbnail
```

### 3. Preserved Styling
- Rounded corners (`rounded-xl`)
- Selection border + checkmark (vantage-green ring and Check icon)
- Title label strip at bottom (`bg-white/[0.04]`)
- Hover states

## Visual Outcome
| State | Rendering |
|-------|-----------|
| Thumbnail exists + loads successfully | Real window preview with dark gradient overlay |
| Thumbnail exists + fails to load | Placeholder tile (app initial) |
| No thumbnail | Placeholder tile (app initial) |

## Files Modified
1. `src/components/desktop/WindowPickerGrid.tsx` - Enhanced thumbnail rendering with lazy loading, gradient overlay, and error handling
