## 2024-05-03 - O(N*M) Bottlenecks in React List Rendering
**Learning:** Found an architectural pattern where `workers.find()` was called inside a `.map()` during the rendering of the `dagTasks` list. For a large DAG execution path with M tasks and N workers, this results in an O(N*M) operation on every single React render loop, causing significant main thread blocking and unnecessary UI lag.
**Action:** Always pre-calculate lookup Maps using `useMemo` outside of rendering loops for dynamic lists to ensure O(1) lookups and maintain fast render cycles.
