## 2024-04-22 - Optimized App.tsx array lookups inside list mapping
**Learning:** O(N) array lookups (`projects.find`) were nested inside O(M) component mapping functions (`workers.map` and `workers.filter`) within the primary UI render path in `App.tsx`. Because `workers` and `projects` scales with usage, this pattern causes an O(N*M) rendering complexity drop. The fix is applying `useMemo` specifically outside the loop context to establish an O(1) property/Set lookup reference (`activeProjectWorkerIds.has(w.id)`). This prevents unnecessary nested list scanning on every frame render.
**Action:** Always hoist complex derivations like array lookups out of list mappers/filters within React components and use `useMemo` when rendering dynamic lists. Look for `.find()` inside `.filter()` as a key performance anti-pattern.

## 2024-05-18 - Optimized Asclepius DAG Execution Scaling Bottleneck
**Learning:** Asclepius DAG execution paths scale with O(N^2) or O(N*M) complexity when they rely on array operations like `tasks.filter()` or `tasks.find()` inside assignment or resolution loops (such as inside `LeadAgent.autoAssign` and `LeadAgent.tick`).
**Action:** Pre-calculate Map dictionaries (`agentLoads` for agent assignment load, `taskStatusMap` for task dependencies) before the execution loops to ensure O(1) lookups and drop time complexity back to O(N).
