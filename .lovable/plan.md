
# Update MoreMenu: Replace "Meetings" with "Live stream"

## Overview
Replace the "Meetings (Soon)" menu item with "Live stream (Soon)" in the desktop MoreMenu dropdown.

## Changes

### File: `src/components/desktop/MoreMenu.tsx`

**1. Update icon import (line 10-18):**
- Remove `Video` from imports
- Add `Radio` icon (broadcast/live signal icon from Lucide)

**2. Update menu item (lines 129-139):**
- Change label from "Meetings" to "Live stream"
- Change icon from `Video` to `Radio`
- Keep the "Soon" badge and disabled state

## Implementation Details

```tsx
// Icon import change
import { 
  LogOut, 
  Settings, 
  HelpCircle, 
  User, 
  Radio,  // Changed from Video
  Info, 
  Power 
} from "lucide-react";

// Menu item change
<DropdownMenuItem 
  disabled
  className="text-xs cursor-not-allowed opacity-50"
>
  <Radio className="w-4 h-4 mr-2 text-muted-foreground" />
  Live stream
  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
    Soon
  </span>
</DropdownMenuItem>
```

## Visual Outcome
| Before | After |
|--------|-------|
| Video icon + "Meetings" + "Soon" badge | Radio icon + "Live stream" + "Soon" badge |
