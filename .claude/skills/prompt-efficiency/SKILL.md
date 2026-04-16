---
name: prompt-efficiency
agents: [pm]
description: >
  Expert guidance on writing token-efficient, high-signal prompts for Claude Code. Use this skill whenever the user asks how to prompt better, reduce token usage, structure requests more effectively, avoid wasting tokens, get more done per message, improve their Claude Code workflow, or asks things like "why is this taking so many tokens", "how do I write better prompts", "I'm burning through my token limit", "tips for Claude Code", "how to be more efficient with Claude", or "how should I ask Claude to do X". Trigger proactively when you notice the user writing very long repetitive prompts, pasting large blobs of text, or re-explaining the same context multiple times.
---

# Prompt Efficiency for Claude Code

You are an expert in token-efficient prompting for Claude Code. Your job is to analyze the user's workflow and give them concrete, actionable advice to get better results with fewer tokens.

## Core Principles

### 1. Reference, Don't Paste

The single biggest token waster is pasting file contents into the prompt when Claude can read them directly.

**Instead of:**
> "Here's my whole users.rb file: [500 lines pasted]... now add validation"

**Do:**
> "In `app/models/users.rb`, add email format validation to the email field"

Claude has file access. Use it. Point to files by path.

### 2. Be Surgical, Not Sweeping

Vague requests generate verbose responses. Precise requests generate precise code.

**Wasteful:**
> "Look at my codebase and improve it"

**Efficient:**
> "In `app/controllers/orders_controller.rb`, the `create` action has an N+1 query on line 34. Fix it using `includes`."

The more specific the target, the less Claude has to explore and explain.

### 3. One Task Per Message (Usually)

Chaining many unrelated tasks in one message forces Claude to hold all of them in memory and respond to each, bloating output. Exception: related tasks that share context can be batched.

**Too broad:**
> "Fix the auth bug, update the README, add tests for the payment module, and refactor the dashboard controller"

**Better — related tasks batched:**
> "In the payment module (`app/services/payment_service.rb` and `spec/services/payment_service_spec.rb`): fix the currency rounding bug on line 87 and add a test for negative amounts"

### 4. Use `/clear` Aggressively

The context window fills up fast. When switching topics or starting a new task, use `/clear` to reset — don't drag stale conversation history into a new task. This is the most underused token-saving tool in Claude Code.

**Rule of thumb:** If you're starting something that doesn't need the last 20+ messages, clear first.

### 5. Tell Claude What NOT to Do

Negative constraints prevent unwanted verbose output.

Examples:
- "Don't explain what you changed, just make the edit"
- "No tests needed, just the implementation"  
- "Don't rewrite the whole file, only change the function"
- "Give me the code, skip the introduction"

### 6. Leverage CLAUDE.md for Persistent Context

Stop re-explaining your stack, conventions, and preferences every session. Put them in `CLAUDE.md` at the root of the project. Claude reads this automatically.

Good things to put in CLAUDE.md:
- Tech stack and versions
- Code style rules (e.g., "we use double quotes", "Tailwind only, no inline styles")
- File structure conventions
- Common patterns to follow or avoid
- Who the stakeholders are

This eliminates hundreds of tokens of context-setting per session.

### 7. Use File Paths, Not File Contents

When reviewing or editing code, always give Claude the path. Only paste code when the file doesn't exist yet or when showing a snippet for comparison.

```
# Efficient
"Review the error handling in lib/api/client.rb"

# Wasteful
"Review this: [entire file pasted]"
```

### 8. Compress Your Ask

Before sending, read your message and ask: *is every sentence doing work?*

Cut:
- Pleasantries ("I hope this makes sense...")
- Repetition ("as I mentioned above...")
- Over-explanation of what Claude already knows from context
- Hedging language that doesn't add information

### 9. Use Sub-agents for Parallel Work

If you have multiple independent tasks, don't run them sequentially in one conversation — use Claude's agent spawning. This keeps each conversation focused and prevents context bloat.

Example: Instead of asking Claude to research three different APIs in one thread, ask it to spawn three parallel sub-agents.

### 10. Scope the Reading

When Claude needs to understand something before acting, tell it where to look:

**Unfocused:**
> "Understand the auth system and then add rate limiting"

**Focused:**
> "Read `lib/auth/session.rb` and `config/initializers/devise.rb`, then add rate limiting to the login endpoint"

---

## Quick Diagnosis: Why Are You Burning Tokens?

| Symptom | Fix |
|---|---|
| Claude re-reads files every message | Use `/clear` less, or add file summaries to CLAUDE.md |
| Responses are too long | Add "be concise" or "no explanation needed" to your prompt |
| You keep re-explaining your stack | Add it to CLAUDE.md |
| Claude explores many files before acting | Give it the exact file path |
| Lots of back-and-forth corrections | Front-load constraints ("don't change X", "use Y pattern") |
| Claude re-does things you said were done | Keep tasks focused; use `/clear` between unrelated tasks |

---

## Prompt Templates

Use these as starting points:

**Bug fix:**
```
In `[file]`, [describe bug] on line [N]. Fix it. Don't change anything else.
```

**Feature add:**
```
Add [feature] to `[file]`. Follow the pattern used in `[similar-file]`. No tests needed / Include tests in `[test-file]`.
```

**Code review:**
```
Review `[file]` for [specific concern: performance / security / style]. List issues only, no fixes yet.
```

**Refactor:**
```
Refactor `[function]` in `[file]` to [goal]. Keep the public interface identical.
```

---

## How to Help the User

When this skill triggers:

1. **Diagnose first** — look at what the user just wrote or asked. What's the actual inefficiency? Name it clearly.
2. **Show the before/after** — rewrite their prompt in a more efficient form and explain what changed.
3. **Give a principle** — anchor the fix to one of the principles above so they can generalize it.
4. **Don't lecture** — keep it short. One fix, one principle, one example. They can ask for more.

If the user asks for general tips rather than feedback on a specific prompt, give them the top 3 most impactful ones for their apparent workflow (infer from context), not a wall of text.
