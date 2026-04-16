---
name: todo-add
description: Add or complete TODO entries via the API. Use when asked to write a TODO item, document a feature, or mark a task as done.
agents: all
---

# Todo Skill

Manage TODO entries via the API. Never read or edit TODO.md directly — always use these endpoints.

## Endpoint

```
POST /api/todo
Content-Type: application/json
```

## Body

```json
{
  "section": "<one of the valid sections>",
  "text": "<full markdown entry>"
}
```

## Valid sections

- `Security & Stability`
- `Code Quality`
- `Dead Weight`
- `Architecture`
- `Features`

Pick the most relevant one. When in doubt, use `Features`.

## Text format

The `text` field is the full body of the TODO entry. Write it in markdown. Include:

1. A bold title on the first line
2. A short description of the problem or feature
3. Acceptance criteria as a checklist
4. Best-fit engineer at the end

The API automatically assigns the next item number — do NOT include a number in the text.

## Examples

### Minimal

```bash
curl -X POST http://localhost:3001/api/todo \
  -H "Content-Type: application/json" \
  -d '{
    "section": "Features",
    "text": "**Add dark mode toggle**\n\nAllow users to switch between dark and light themes from the settings panel.\n\n- [ ] Add toggle to settings\n- [ ] Persist preference in localStorage\n- [ ] Apply theme class to root element\n\n**Best fit: Jordan (Frontend)**"
  }'
```

### Full entry

```bash
curl -X POST http://localhost:3001/api/todo \
  -H "Content-Type: application/json" \
  -d '{
    "section": "Code Quality",
    "text": "**Extract parseTodo into a shared utility**\n\nThe `parseTodo` function is duplicated between `src/components/TodoPanel.tsx` and `src/hooks/useTodo.ts`. Both copies must be kept in sync manually, which is error-prone.\n\nMove the canonical implementation to `src/lib/todo.ts` and import it in both consumers.\n\n**Acceptance criteria:**\n- [ ] Single `parseTodo` in `src/lib/todo.ts`\n- [ ] Both files import from `src/lib/todo`\n- [ ] No behaviour change\n- [ ] No duplicate type definitions\n\n**Best fit: Jordan (Frontend)**"
  }'
```

## Success response

```json
{ "ok": true, "number": 54 }
```

The `number` field is the item number assigned by the server.

---

## Marking a task as done

When you complete a task, call `POST /api/todo/done` with the item number. Never edit TODO.md directly.

```
POST /api/todo/done
Content-Type: application/json
```

```json
{ "number": 54 }
```

To reopen an item:

```json
{ "number": 54, "done": false }
```

### Example

```bash
curl -X POST http://localhost:3001/api/todo/done \
  -H "Content-Type: application/json" \
  -d '{ "number": 54 }'
```

### Response

```json
{ "ok": true }
```

---

## Rules

- Never read or edit TODO.md directly
- Never scan the file to find the next number — POST /api/todo handles it
- Always use one of the valid section names exactly as written above
- Keep the bold title on the first line of `text`
- When a task is complete, always call POST /api/todo/done — do not use TodoWrite or Edit on TODO.md
