---
name: conventional-commits
description: Always format git commit messages using the Conventional Commits specification. Use whenever creating a commit.
---

# Conventional Commits

Always write commit messages in this format:

```
type(scope): short imperative description

[optional body]

[optional footer(s)]
```

## Types

| Type       | When to use                                           |
| ---------- | ----------------------------------------------------- |
| `feat`     | A new feature                                         |
| `fix`      | A bug fix                                             |
| `refactor` | Code change that is neither a fix nor a feature       |
| `chore`    | Maintenance, deps, config — no production code change |
| `docs`     | Documentation only                                    |
| `test`     | Adding or updating tests                              |
| `ci`       | CI/CD pipeline changes                                |
| `style`    | Formatting, whitespace — no logic change              |
| `perf`     | Performance improvement                               |

## Rules

- **Subject line**: 72 chars max, lowercase, imperative mood ("add" not "added"), no period at the end
- **Scope**: optional, in parentheses — name of the module, component, or area affected (e.g. `feat(auth):`, `fix(sidebar):`)
- **Body**: wrap at 72 chars, explain _why_ not _what_, separated from subject by a blank line
- **Breaking changes**: append `!` after the type/scope (`feat!:`) AND add a `BREAKING CHANGE: <description>` footer

## Examples

```
feat(chat): add context size warning after 3 messages
```

```
fix(sidebar): prevent duplicate branch creation on rapid click
```

```
refactor(server): extract route handlers into separate modules
```

```
feat!(auth)!: replace session tokens with JWT

Migrates authentication from cookie-based sessions to stateless JWTs.

BREAKING CHANGE: existing sessions will be invalidated on deploy
```

```
chore: upgrade vite to 5.4
```
