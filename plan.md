1. **Analyze `App.tsx` for performance opportunities.** The prompt mentions "When rendering dynamic lists in React components, avoid nesting array lookups (.find, .filter) inside mappers. Instead, use useMemo to pre-calculate an O(1) lookup structure (like a Set or Map) outside the loop to prevent O(N*M) rendering bottlenecks."
2. **Locate the `.find` and `.filter` calls.**
   - In `src/App.tsx`, `activeProjectWorkerIds` is already optimized: `const activeProjectWorkerIds = useMemo(() => new Set(activeProjectMemo?.assignedWorkerIds || []), [activeProjectMemo]);`
   - However, at line ~602, there is `const assignee = workers.find(w => w.id === task.assignedAgentId);` inside a map over `dagTasks`.
   - Also, `workersMap` can be created as `const workersMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);`.
3. **Implement `workersMap`.**
   - Add `const workersMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);` near line 389.
   - Replace `workers.find(w => w.id === ...)` inside `map` operations with `workersMap.get(...)`.
   - Specifically, around line 358 inside `handleLeadAgentDirective` (it's inside a function, but we can use `workers.find` there since it's an event handler. Wait, `workersMap` can be used everywhere).
   - In the render loop around line 602: `const assignee = workersMap.get(task.assignedAgentId);`.
   - In the render loop around line 1182: `const worker = workersMap.get(configuringWorkerId);` instead of `workers.find`. Wait, this is not in a map, but still O(1).
4. **Review other possible O(N) operations inside maps.**
   - We see `activeProjectWorkerIds.has(w.id)` used in `.filter()` around line 904 and 943. This is correct as it's O(1) inside filter.
5. **Verify changes.** Run `pnpm lint` and `pnpm test` (or `pnpm build`).
6. **Complete pre-commit steps.**
