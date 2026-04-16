---
name: nextjs-caching
agents: [frontend]
description: >-
  Provides expert guidance on Next.js caching behavior, including use cache directive, revalidation strategies, ISR patterns, and common pitfalls. Use when working with Next.js caching, revalidatePath, revalidateTag, use cache, connection(), unstable_cache, or debugging cache behavior in Next.js applications.
---

# Next.js Caching

Expert guidance on Next.js caching mechanisms, ISR patterns, and common pitfalls.

## Core Concepts

### "use cache" Directive

Mark components or functions as cacheable. The directive does not cache immediately—it marks the output for caching at build time.

```javascript
"use cache"
export default function MyComponent() {
  // Output cached at build time
}
```

When applied to a page's main component, creates ISR-like behavior where the entire output is cached (no partial caching).

### Automatic Static Rendering

Next.js renders top-to-bottom until encountering dynamic APIs, then creates a "dynamic hole." No explicit "use cache" required unless forcing ISR behavior for the entire page.

Cached functions are NOT considered dynamic and won't create holes.

### Two-Phase Rendering

1. **Warmup render (prospective)**: Detects dynamic API usage. Anything not resolving in a microtask is considered dynamic.
2. **Final render**: Captures actual output for pre-rendering.

## Revalidation APIs

### revalidateTag vs updateTag

- `revalidateTag`: Revalidates in stale-while-revalidate manner when used in server actions. Serves stale content while fetching fresh data.
- `updateTag`: Read-your-own-writes pattern, purging previous cache immediately. Cannot be used in route handlers.

Note: Despite the name, `revalidatePath` is actually `revalidateTag` under the hood—the argument is (kind of) a path.

### connection() Replacement

Use `connection()` as a replacement for `unstable_noStore()` to mark functions as dynamic.

## ISR Patterns

### Suspense Boundaries with "use cache"

Components with "use cache" + Suspense boundaries work like ISR:
1. First request triggers Suspense boundary
2. Content displays and result caches
3. Subsequent requests serve cached content

To keep Suspense dynamic, move static content to separate cached components.

### Accessing Cached Values Across Boundaries

Cache function outputs (not just components) to reuse values between layouts and pages. Call the cached function again to retrieve the value.

### Partial Page Caching

For mixed static/dynamic pages:
- Leave page without "use cache"
- Cache individual components
- Wrap dynamic components in Suspense
- Alternative: Use parallel routes

## Dynamic Routes & generateStaticParams

### Critical Requirements

Export at least one param in `generateStaticParams` to generate static shells and enable ISR behavior.

```javascript
export function generateStaticParams() {
  return [{ id: 'placeholder' }] // Handle this case in render
}
```

Without `generateStaticParams`, dynamic pages fail due to missing Suspense above param reads.

**Workaround**: Add `loading.tsx` or empty Suspense around body to block the server.

## Cache Persistence

### unstable_cache vs "use cache: remote"

- `unstable_cache`: Persists across deployments
- `"use cache: remote"`: Does NOT persist across deployments

### Cache Snapshots at Build Time

Cacheable functions snapshot when called at build time. Using "use cache"'d functions in dynamic components only guarantees cache hits if the snapshot was captured at build time. Otherwise serves from in-memory cache.

## Performance & Infrastructure

### Short Cache Behavior

Caches with `stale` < 30 seconds are "short cache" and excluded from runtime prefetch.

### Edge Proxy Resilience

The proxy returning static shells runs on edge. Returns shell immediately and continues request for dynamic content. If a region fails, proxy continues working.

### unstable_cache Performance

`unstable_cache` functions are considered instant for rendering purposes.

## Debugging

### Verifying Static Pages

Build logs sometimes show `ppr` for static pages. Most reliable verification: check `x-nextjs-cache: HIT` header in document request.

### Layout "use cache" Caveat

Setting "use cache" in layout without setting it on page does NOT make the page static.

## References

- **references/detailed-guide.md**: Comprehensive examples and detailed explanations for all caching patterns. Read when implementing specific caching strategies or debugging cache behavior.