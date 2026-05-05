## 2024-04-22 - Optimized App.tsx array lookups inside list mapping
**Learning:** O(N) array lookups (`projects.find`) were nested inside O(M) component mapping functions (`workers.map` and `workers.filter`) within the primary UI render path in `App.tsx`. Because `workers` and `projects` scales with usage, this pattern causes an O(N*M) rendering complexity drop. The fix is applying `useMemo` specifically outside the loop context to establish an O(1) property/Set lookup reference (`activeProjectWorkerIds.has(w.id)`). This prevents unnecessary nested list scanning on every frame render.
**Action:** Always hoist complex derivations like array lookups out of list mappers/filters within React components and use `useMemo` when rendering dynamic lists. Look for `.find()` inside `.filter()` as a key performance anti-pattern.
## 2025-02-23 - Avoiding pnpm-lock.yaml bloat in micro-optimizations
**Learning:** `pnpm install` will generate a massive `pnpm-lock.yaml` file if it didn't previously exist or wasn't tracked.
**Action:** When making small optimizations, make sure to explicitly remove `pnpm-lock.yaml` from tracking before committing if it isn't meant to be part of the codebase state.

## 2025-02-23 - Memoizing map lookups inside iterators
**Learning:** React components containing multiple mapping functions (`array.map()`) over large dynamic data sets (like `dagTasks` or `workers`) that execute `.find()` sequentially create hidden $O(N \times M)$ bottlenecks.
**Action:** Always pre-calculate an $O(1)$ lookup Map outside the iterator using `useMemo`. Example: `const workerMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);`
