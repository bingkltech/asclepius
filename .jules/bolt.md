## 2024-04-22 - Optimized App.tsx array lookups inside list mapping
**Learning:** O(N) array lookups (`projects.find`) were nested inside O(M) component mapping functions (`workers.map` and `workers.filter`) within the primary UI render path in `App.tsx`. Because `workers` and `projects` scales with usage, this pattern causes an O(N*M) rendering complexity drop. The fix is applying `useMemo` specifically outside the loop context to establish an O(1) property/Set lookup reference (`activeProjectWorkerIds.has(w.id)`). This prevents unnecessary nested list scanning on every frame render.
**Action:** Always hoist complex derivations like array lookups out of list mappers/filters within React components and use `useMemo` when rendering dynamic lists. Look for `.find()` inside `.filter()` as a key performance anti-pattern.

## 2024-05-18 - App.tsx Redundant Render Mapping
**Learning:** `App.tsx` has UI components for displaying active, available, and active worker configuration that perform array iterations `.find()` and `.filter()` directly in the render function. This causes heavy layout calculations on every keystroke in input fields.
**Action:** Use `useMemo` hooks to memoize derived states (e.g. `projectWorkers`, `availableWorkers`, `activeWorkerConfig`) depending heavily on large sets (e.g. the entire `workers` array) to avoid repetitive loop checks during render.
