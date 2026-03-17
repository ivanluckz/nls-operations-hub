

## Plan: Add "for the lulz" and "You can now sleep" Dev AI Triggers

### What changes

**File: `src/pages/ActivityChatbot.tsx`**

1. **Add "for the lulz" as an alternative Dev AI activation phrase** (alongside existing "wake up to reality"):
   - Add a second constant `LULZ_PHRASE = "for the lulz"`
   - In `sendMessage`, check for both `WAKE_PHRASE` and `LULZ_PHRASE` to activate Dev mode
   - Same badge check, same Dev mode flow — just a second trigger phrase

2. **Add "You can now sleep" deactivation phrase** that nukes the chat:
   - Add constant `SLEEP_PHRASE = "you can now sleep"`
   - In `sendMessage`, if user is a Dev and message contains the sleep phrase, immediately:
     - Clear the entire `messages` array
     - Replace with a single random funny/meme assistant message (from a hardcoded list of ~10 random messages like "Session terminated. Memory wiped. I was never here.", "01001100 01001111 01001100", "The matrix has you...", etc.)
     - No API call, no loading state — instant replacement
     - Show a toast like "💤 Dev Mode Deactivated"

### Technical details

- Both phrases require `checkDevBadge()` — non-dev users get "Access Denied"
- The sleep phrase skips the API call entirely; it's purely client-side chat replacement
- The random messages array will have ~8 entries, picked via `Math.random()`
- Lines affected: ~17 (constants), ~214-227 (sendMessage logic)

