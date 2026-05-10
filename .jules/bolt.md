## 2024-04-22 - Optimized App.tsx array lookups inside list mapping
**Learning:** O(N) array lookups (`projects.find`) were nested inside O(M) component mapping functions (`workers.map` and `workers.filter`) within the primary UI render path in `App.tsx`. Because `workers` and `projects` scales with usage, this pattern causes an O(N*M) rendering complexity drop. The fix is applying `useMemo` specifically outside the loop context to establish an O(1) property/Set lookup reference (`activeProjectWorkerIds.has(w.id)`). This prevents unnecessary nested list scanning on every frame render.
**Action:** Always hoist complex derivations like array lookups out of list mappers/filters within React components and use `useMemo` when rendering dynamic lists. Look for `.find()` inside `.filter()` as a key performance anti-pattern.

## 2026-05-10 - Optimized LeadAgent DAG processing
**Learning:** Found O(N^2) lookup patterns in the Asclepius orchestrator's task processing routines (`autoAssign` and `tick`). Filtering the full task array per agent or per dependency causes significant CPU bottlenecks during execution cycles.
**Action:** Use pre-calculated Maps for task dependency lookups and agent workload tracking within iterative DAG functions.
