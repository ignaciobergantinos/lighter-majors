---
name: worktree
description: Create a new git worktree on an isolated branch, do the work there, commit, push, and open a PR. Use when the user says /worktree or asks to work in an isolated worktree.
---

# Worktree Skill

When invoked, immediately create a git worktree for the given task before writing any code or making any changes. All work happens inside the worktree — never on `main`.

## Argument parsing

The invocation may include optional flags before the task description:

- `--base <branch>` — create the worktree branching from `<branch>` instead of the current HEAD. Used by the queue worker to implement stacked branches.
- `--branch <name>` — use `<name>` as the branch name instead of deriving one from the task description. Must follow the `claude/<slug>` format.

Parse these flags first, then treat the remainder as the task description.

Example: `/worktree --base claude/task-one --branch claude/task-two add dark mode`
→ base = `claude/task-one`, branch = `claude/task-two`, description = `add dark mode`

## Steps

1. **Determine the branch name**:
   - If `--branch <name>` was provided, use it directly.
   - Otherwise, derive from the task description:
     - Format: `claude/<short-kebab-case-description>`
     - Examples: `claude/fix-auth-bug`, `claude/add-export-csv`, `claude/refactor-chat-route`
     - Keep the slug under 40 characters, lowercase, no spaces
     - The `claude/` prefix is mandatory

2. **Derive the worktree path**: sibling directory next to the repo root:
   - Format: `../<repo-name>-<branch-slug>` where `<branch-slug>` replaces `/` with `-`
   - Example: branch `claude/fix-auth-bug` in repo `myapp` → path `../myapp-claude-fix-auth-bug`

3. **Create the worktree**:

   If `--base <branch>` was provided, branch from it:
   ```bash
   git worktree add <worktree-path> -b <branch-name> <base-branch>
   ```

   Otherwise, branch from current HEAD:
   ```bash
   git worktree add <worktree-path> -b <branch-name>
   ```

   If the branch already exists:
   ```bash
   git worktree add <worktree-path> <branch-name>
   ```

4. **Do the work** entirely inside the worktree directory. No confirmation needed.

5. **Commit and push** from the worktree:

   ```bash
   cd <worktree-path>
   git add <relevant files>
   git commit -m "<meaningful message>"
   git push -u origin <branch-name>
   ```

6. **Open a PR** using `gh`:

   If a `--base` branch was provided, set it as the PR base so the diff is scoped correctly:
   ```bash
   gh pr create --base <base-branch> --title "<title>" --body "<summary of changes and test plan>"
   ```

   Otherwise:
   ```bash
   gh pr create --title "<title>" --body "<summary of changes and test plan>"
   ```

7. Return the PR URL to the user.

## Rules

- Never use `git checkout` or `git switch`. Always use `git worktree add`.
- Never modify files in the original repo directory — only in the worktree.
- If there are uncommitted changes in the main repo, stash them first (`git stash -u`) without asking.
- If no task description is given after `/worktree` (and no flags), ask the user: "What task should I work on in the worktree?"
- Always open a PR at the end — never leave the branch unpushed.
