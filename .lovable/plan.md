
# Add "GET PAID TO GAME" Hero Layer

## Overview
Add a new content block **above** the existing video mock and "See the Game Differently" headline inside the same `HeroSection` component. The new layer includes a headline, subheadline, support line, proof row, and a waitlist email input. Everything animates in with 120ms stagger before the existing content begins its entrance.

## What Changes
Only one file is modified: `src/components/landing/HeroSection.tsx`

## Layout (top to bottom within the hero section)
1. **NEW** -- "GET PAID TO GAME" block (headline, sub, support, proof row, waitlist input)
2. **EXISTING** -- Live recording interface (video mock) -- shifted down with added `mt-10`
3. **EXISTING** -- "See the Game Differently" + CTAs (unchanged)

## New Content Details

| Element | Text | Style |
|---------|------|-------|
| Headline | GET PAID TO GAME | `font-display text-3xl md:text-5xl text-primary glow-text` |
| Subheadline | Turn your sessions into challenges, rewards, and real-world payouts. | `text-lg md:text-xl text-foreground/90` |
| Support line | Vantage is launching a new rewards layer for competitive play. Join the early list. | `text-sm text-muted-foreground` |
| Proof row | 3 items with Lucide icons: Trophy/"Weekly Challenges", ShieldCheck/"Verified Submissions", Banknote/"Cash + Perks" | `text-xs uppercase tracking-wider font-mono` in a flex row with dividers |
| Waitlist input | Email input + "Join Waitlist" button | Uses existing `Input` and `Button` components, fires a toast on submit |

## Animation Timing
- Base delay: 0.0s (new layer animates first)
- Each new line staggers by 120ms (0.0, 0.12, 0.24, 0.36, 0.48s)
- Proof row items slide up 8px with fade
- Proof items get a subtle glow on hover via `hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)]`
- Existing video mock delay shifts from 0.2s to 0.8s (adds ~0.6s to let new content appear first)
- All other existing animation delays shift by the same +0.6s offset

## Technical Details

- Import `Trophy`, `ShieldCheck`, `Banknote` from lucide-react
- Import `Input` from `@/components/ui/input`
- Import `toast` from `sonner`
- Add local state `waitlistEmail` (string) and `handleWaitlistSubmit` that shows a toast confirmation (no backend call -- just UI for now)
- Proof row items use `motion.div` with `whileHover` for the glow effect
- `prefersReducedMotion` is respected: animations skip to final state
- No new files, no new CSS, no tailwind config changes
