

## Selected Features

### 1. **Theme Marketplace** 🎨
Let students publish their custom themes to a public gallery; others browse, preview, and apply.

**Scope:**
- Add `is_public` boolean + `install_count` integer to `user_themes`
- New page `/student/theme-marketplace` — grid of cards with theme name, author, color preview swatch, install count, "Try" button
- Update `ThemeManagement` page: toggle "Publish to Marketplace" per theme
- New RLS policy: anyone authenticated can SELECT themes WHERE `is_public = true`
- Apply flow: clones the public theme into the user's IndexedDB so it persists locally
- Optional: 👍 likes via a new `theme_likes` table (skip if you want minimal v1)

**Files:** `src/pages/ThemeMarketplace.tsx` (new), `ThemeManagement.tsx` (toggle), `App.tsx` (route), 1 migration

---

### 2. **Student Profile Page** 👤
Full-page profile (currently only a chat card). Public-facing within the school.

**Scope:**
- New route `/profile/:userId` — accessible to anyone authenticated who can SELECT that profile (RLS already permits peers/teachers/admins)
- Sections: avatar + name + house badge + class + role pills, badges grid, streak stats (current/longest for activity/meal/workout), recent activities (last 5 allocated), milestones earned
- Linkable from `UserProfileCard`, leaderboard, chat names → "View full profile"
- Own profile = `/profile/me` shortcut + edit button (avatar, etc.)

**Files:** `src/pages/StudentProfile.tsx` (new), `App.tsx` (route), update `UserProfileCard.tsx` to link

---

### 3. **Voice Notes in DMs** 🎤
Hold mic button → record → release → upload → playback bubble with waveform.

**Scope:**
- New storage bucket `voice-notes` (private, owner-RLS)
- Extend `direct_messages`: add `audio_url TEXT` and `audio_duration_ms INTEGER` columns (content stays optional)
- Composer: mic button next to send. Hold = record (MediaRecorder API, webm/opus). Release = upload + send
- Bubble renderer: waveform + play button + duration. Use `wavesurfer.js` (lightweight) OR a custom canvas renderer (no dep)
- Mobile: respect `getUserMedia` permission flow with clear UX

**Files:** `DirectMessages.tsx` (composer + bubble), 1 migration, 1 storage policy. Likely add `wavesurfer.js` (~30KB).

**Decision needed:** wavesurfer.js dependency vs. custom canvas?

---

### 4. **@Mentions in Activity Channels** 📣
Type `@` → autocomplete dropdown of activity members → mention is highlighted + triggers notification.

**Scope:**
- Composer detects `@` mid-typing, shows popover with members of that activity (filter by typed query)
- Stored as inline tokens like `@[Full Name](user-uuid)` in message content
- Renderer parses tokens → highlighted pill bubbles
- New table `mentions` (message_id, mentioned_user_id, read_at) OR encode in message + parse on send to trigger push
- Reuse existing `send-push` edge function with title "You were mentioned in {Activity}"
- Mentioned user's bubble gets a soft glow until they open the channel

**Files:** `ActivityMessaging.tsx` + `StudentMessages.tsx` + `AdminMessages.tsx` (composer logic shared), new `MentionInput` component, 1 migration, edge function tweak

---

## Suggested Build Order
1. **Student Profile Page** — pure read, no migration risk, unblocks linking from #1 and #4
2. **Theme Marketplace** — adds public visibility to existing system
3. **@Mentions** — extends existing chat infra
4. **Voice Notes** — biggest scope (storage + recording + playback), do last

## Open Questions Before I Start

1. **Theme marketplace likes/install counts** — include or skip for v1?
2. **Voice notes waveform** — `wavesurfer.js` (~30KB) or custom canvas (lighter, less polish)?
3. **Mentions notification** — every mention pings, or only if recipient is offline (like Slack)?
4. **Profile page privacy** — same RLS as chat (peers + teachers + admins), or fully public to all authenticated users?

