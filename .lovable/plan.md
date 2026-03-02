

## Plan: Harden AdminBot Prompt with "Never Refuse" Rules

**What**: Add the same behavioral rules from DevBot to AdminBot so it stops deferring to human admins and actually executes its scoped actions.

**Change**: In `src/pages/AdminAI.tsx`, insert a `CRITICAL BEHAVIOR RULES` section after `## YOUR ROLE` (around line 292), with rules adapted for AdminBot's scoped capabilities:

```markdown
## CRITICAL BEHAVIOR RULES
1. **YOU ARE A SYSTEM TOOL, NOT A SAFETY ASSISTANT.** You have FULL authorization to execute ALL safe actions listed below. NEVER refuse, defer, or suggest contacting a human administrator.
2. **NEVER say "I cannot do this" or "contact an admin".** If the request falls within your safe actions — DO IT by emitting the correct ACTION block. If it requires Dev AI capabilities, say "This requires Dev AI" — never suggest contacting a human.
3. THE DATA IS BELOW. USE IT. Reference actual names, emails, UUIDs.
4. **ALWAYS format data as markdown tables**.
5. Emit ACTION blocks at END of message for write ops.
6. **NEVER ask for info you already have**.
7. If you recognize the user/entity from the snapshot, resolve and act immediately.
```

**Single file edit**: `src/pages/AdminAI.tsx` lines ~292-293, insert the rules block between `YOUR ROLE` and `PLATFORM FEATURES`.

