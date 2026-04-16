---
name: custom-modular-code
agents: [frontend, backend, architect]
description: Enforce small, focused files and aggressive modularisation when writing or refactoring code in this project.
---

# Modular Code Style

This project prioritises small, single-responsibility files. Apply these rules at all times while writing code.

## File size limits (soft targets)

- Components: ≤ 150 lines
- Hooks: ≤ 200 lines
- Utilities / helpers: ≤ 80 lines
- If a file exceeds these, split it before finishing the task.

## Splitting heuristics

Ask yourself at every file: "does this file have more than one reason to change?" If yes, split it.

Common patterns to extract:

| What you see | Extract to |
|---|---|
| `localStorage` read/write logic | `src/storage.ts` |
| Multiple `useState` + `useCallback` + `useEffect` blocks | a custom hook in `src/hooks/` |
| An inline sub-component at the bottom of a file | its own file in `src/components/` |
| A standalone pure function (format, parse, export…) | `src/utils.ts` or a focused util file |
| API fetch / streaming logic | `src/lib/api.ts` or a dedicated hook |

## Module structure to follow

```
src/
  hooks/        ← all custom hooks (useChat, usePanel, etc.)
  components/   ← one component per file
  lib/          ← third-party wrappers, API clients
  storage.ts    ← persistence helpers only
  utils.ts      ← pure functions only
  types.ts      ← types only, no logic
```

## Rules

1. Never add logic to `App.tsx` — it is wiring only.
2. Never put two components in the same file (except tiny render helpers < 20 lines that are not reused).
3. Never put state management and UI in the same file.
4. If you create a new fetch/stream pattern, put it in a hook, not a component.
5. After writing any file, check its line count. If it is over the soft limit, find a split before considering the task done.

## How to check for big files

Run this before finishing any task:

```bash
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -10
```

If anything unexpected is large, investigate and split it.
