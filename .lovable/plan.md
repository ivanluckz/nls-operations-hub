

## Plan: Lock Dev badge from being granted + restrict Academic testing to Dev holders only

### What the user wants
1. **Dev badge cannot be granted by anyone** — not admins, not other Dev holders, nobody. It's permanently locked.
2. **Only Dev badge holders can access/test the Academic section** — this is already partially in place but needs confirmation.

### Changes needed

#### 1. Block Dev badge granting in UI (`src/components/chat/UserProfileCard.tsx`)
- Filter out "Dev" from the `BADGE_OPTIONS` list shown in the admin grant panel, so it never appears as a grantable option.
- This prevents the UI from even showing the Dev badge button.

#### 2. Block Dev badge granting in database (SQL migration)
- Add a database trigger on `user_badges` that prevents INSERT of any row where `badge_name = 'Dev'`. This is the server-side enforcement — even if someone bypasses the UI, the database rejects it.

#### 3. Block Dev badge in badge request system (`src/pages/AdminBadgeRequests.tsx`)
- The `BADGE_OPTIONS` list here already excludes "Dev" (line 11-18), so students can't request it. No change needed.

#### 4. Verify Academic access is Dev-only
- `ProtectedRoute.tsx` already checks `hasDevBadge` and `userRole === "student"` before allowing access to `/admin/academic/*` pages. Admin/moderator/teacher roles access these via their own admin role. This is already correct.
- `StudentDashboard.tsx` already checks for Dev badge before showing the clickable Academic card. Already correct.

### Files to edit
- `src/components/chat/UserProfileCard.tsx` — hide "Dev" from grant panel
- New SQL migration — trigger to block Dev badge inserts

