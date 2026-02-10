

## Plan: Fix Coach Summary Layout Push and Speed Up Analysis

### Problem 1: Coach Summary Expanding Pushes Content

The right rail container (`div` at SessionReview.tsx line 1166) lacks height and overflow constraints. When the coach summary collapsible expands, it grows the rail beyond the viewport instead of scrolling within it. The fix is to add `overflow-hidden` and proper flex sizing to the right rail container so `ScrollArea` inside the coach tab works correctly.

### Problem 2: Coach Analysis Speed

The `analyze-gameplay` edge function makes **3 sequential AI API calls**:
1. Analyst phase (gemini-3-flash-preview)
2. Coach phase (gemini-3-flash-preview) -- waits for #1
3. Summarizer phase (gemini-2.5-flash) -- waits for #2

The Summarizer only needs the coaching cards (not full analyst output), so it must stay sequential with #2. However, we can optimize:
- Switch the Analyst phase to `gemini-2.5-flash-lite` (fastest model, sufficient for factual observation extraction)
- Switch the Coach phase to `gemini-2.5-flash` (balanced, sufficient for coaching cards)
- Keep Summarizer on `gemini-2.5-flash` (already the lightest option)
- Lower `max_tokens` on analyst/coach to reduce generation time

---

### Technical Changes

**1. `src/pages/SessionReview.tsx`** (line 1166-1168)
- Add `overflow-hidden` and `flex flex-col` to the right rail container div so children can use flex-based height constraints properly.

**2. `src/components/player/rail/CoachSection.tsx`**
- Ensure the `ScrollArea` in the "complete" state has a bounded height (it already uses `flex-1` which should work once the parent is constrained).

**3. `supabase/functions/analyze-gameplay/index.ts`**
- Change Analyst model from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash` for faster response.
- Change Coach model from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash`.
- Keep Summarizer on `google/gemini-2.5-flash`.
- This reduces total latency by using faster models for all 3 phases while maintaining quality.

