## 2024-05-15 - DAG Optimization
**Learning:** O(N^2) bottlenecks can easily form in DAG iteration when continuously querying full sets (like `.filter` or `.find`) during dependent checks.
**Action:** Always pre-calculate Maps (`O(1)` lookups) before beginning DAG tick or assignment loops, ensuring tracking maps are updated iteratively to avoid stale counts.
