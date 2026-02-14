
# Fix: Google Calendar OAuth Callback "Unauthorized" Error

## Problem
The Google OAuth flow successfully reaches the consent screen and the user grants permission, but the callback fails with `{"error":"Unauthorized"}`. This happens because the edge function checks for an `Authorization` header on **every** request, including the OAuth callback redirect from Google — which naturally has no auth header.

## Solution
Move the `callback` action handler **before** the authorization check in the `google-calendar-sync` edge function. The callback doesn't need user-session auth because:
- It validates the `state` parameter (which contains the userId)
- It uses the service role client to store tokens
- Google already verified the user through OAuth

## Changes

### 1. `supabase/functions/google-calendar-sync/index.ts`
- Parse the `action` query parameter **before** the auth check
- If `action === "callback"`, handle it immediately (before requiring Authorization header)
- All other actions continue to require the Authorization header as before

### Technical Detail
The restructured flow:

```text
Request arrives
  |
  +-- Parse action from URL
  |
  +-- action === "callback"?
  |     YES --> handle token exchange with Google, store tokens, redirect user
  |     NO  --> check Authorization header --> handle other actions (auth-url, sync, status, disconnect)
```

This is a single-file change to the edge function. No frontend changes needed — the `CalendarSyncCard` component is already correct.
