---
name: feature-branch
description: Automatically create a new git worktree whenever a new feature is requested. Use when the user asks to build, add, or implement any new feature.
---

# Feature Branch Skill

Whenever the user asks to implement, build, or add a new feature, **always create a dedicated git worktree first** before writing any code. Never switch branches — use worktrees instead.

## Steps

1. **Derive a branch name** from the feature description:
   - Format: `claude/feat/<short-kebab-case-description>`
   - Examples: `claude/feat/user-auth`, `claude/feat/dark-mode`, `claude/feat/export-csv`
   - Keep the description part under 40 characters, lowercase, no spaces
   - The `claude/` prefix is mandatory — it identifies this branch as Claude-created

2. **Derive the worktree path**: sibling directory next to the repo root, using the branch slug:
   - Format: `../<repo-name>-<branch-slug>` where `<branch-slug>` is the branch name with `/` replaced by `-`
   - Example: for branch `claude/feat/dark-mode` in repo `myapp` → path `../myapp-claude-feat-dark-mode`

3. **Create the worktree** (creates a new branch and checks it out in an isolated directory):

   ```bash
   git worktree add <worktree-path> -b claude/feat/<branch-name>
   ```

   If the branch already exists:

   ```bash
   git worktree add <worktree-path> claude/feat/<branch-name>
   ```

4. **Implement the feature** inside the worktree directory — no confirmation needed.

5. When done, remind the user to open a PR to merge back into `main`.

## Rules

- **Never use `git checkout` or `git switch` to change branches.** Always use `git worktree add` instead.
- Never implement a feature directly on `main` or `master`.
- If the repo has uncommitted changes, stash them first (`git stash`) — do not ask the user.
- Use descriptive but concise names — avoid generic names like `feat/new-feature`.
